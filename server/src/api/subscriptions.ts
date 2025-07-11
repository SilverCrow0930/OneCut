import express, { Router, Request, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate.js';
import { supabase } from '../config/supabaseClient.js';
import Stripe from 'stripe';

const router = Router();

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  console.log('[Subscriptions] Health check called');
  res.json({ 
    status: 'ok', 
    message: 'Subscriptions API is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    stripeConfigured: !!process.env.STRIPE_SECRET_KEY
  });
});

// Test endpoint to verify routing works
router.get('/test', (req: Request, res: Response) => {
  res.json({ message: 'Subscriptions API is working', timestamp: new Date().toISOString() });
});

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('[Subscriptions] STRIPE_SECRET_KEY environment variable is not set');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
});

// Stripe Price IDs - these should be environment variables
const STRIPE_PRICE_IDS = {
  'price_1Rii7qRutXiJrhxtPbrjNV04': process.env.STRIPE_PRICE_STARTER || 'price_1Rii7qRutXiJrhxtPbrjNV04',
  'price_1RjQX1RutXiJrhxtK3hMbYB8': process.env.STRIPE_PRICE_TEST || 'price_1RjQX1RutXiJrhxtK3hMbYB8', // Test plan
  'price_1RiinCRutXiJrhxtgS1H7URs': process.env.STRIPE_PRICE_CREATOR || 'price_1RiinCRutXiJrhxtgS1H7URs',
  'price_1RiimLRutXiJrhxtqRr9Iw2l': process.env.STRIPE_PRICE_PRO || 'price_1RiimLRutXiJrhxtqRr9Iw2l',
  'price_1RiikLRutXiJrhxtK3hMbYB8': process.env.STRIPE_PRICE_ENTERPRISE || 'price_1RiikLRutXiJrhxtK3hMbYB8',
};

// Plan configurations
const PLAN_CONFIGS = {
  'price_1Rii7qRutXiJrhxtPbrjNV04': {
    name: 'Essential',
    subscriptionType: 'editor-plus-credits',
    maxCredits: 150,
    maxAiChats: 400,
    priceCents: 1000
  },
  'price_1RiinCRutXiJrhxtgS1H7URs': {
    name: 'Creator',
    subscriptionType: 'editor-plus-credits',
    maxCredits: 400,
    maxAiChats: 400,
    priceCents: 2500
  },
  'price_1Rjit2RutXiJrhxt6GLIIqfb': {
    name: 'Pro',
    subscriptionType: 'editor-plus-credits',
    maxCredits: 1000,
    maxAiChats: 400,
    priceCents: 6800
  }
};

// Create Stripe checkout session
router.post('/create-checkout-session', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  console.log('[Subscriptions] Create checkout session called with:', {
    body: req.body,
    userId: authReq.user.id,
    userEmail: authReq.user.email
  });
  
  try {
    const { planId } = req.body;
    const userId = authReq.user.id;
    const userEmail = authReq.user.email;

    if (!planId) {
      console.error('[Subscriptions] No planId provided in request body');
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    if (!STRIPE_PRICE_IDS[planId as keyof typeof STRIPE_PRICE_IDS]) {
      console.error('[Subscriptions] Invalid planId provided:', {
        providedPlanId: planId,
        availablePlans: Object.keys(STRIPE_PRICE_IDS),
        userEmail: userEmail,
        userId: userId
      });
      return res.status(400).json({ 
        error: 'Invalid plan ID', 
        providedPlanId: planId,
        availablePlans: Object.keys(STRIPE_PRICE_IDS)
      });
    }

    const priceId = STRIPE_PRICE_IDS[planId as keyof typeof STRIPE_PRICE_IDS];
    const planConfig = PLAN_CONFIGS[planId as keyof typeof PLAN_CONFIGS];

    // Create or retrieve customer
    let customer;
    const existingCustomers = await stripe.customers.list({
      email: userEmail,
      limit: 1
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          userId: userId,
          planId: planId
        }
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.origin}/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/pricing?cancelled=true`,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      metadata: {
        userId: userId,
        planId: planId,
        planName: planConfig.name
      },
      customer_update: {
        address: 'auto'
      }
    });

    console.log('[Subscriptions] Created checkout session:', {
      sessionId: session.id,
      url: session.url,
      customerId: customer.id,
      planId: planId
    });

    res.json({
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('[Subscriptions] Error creating checkout session:', error);
    res.status(500).json({ 
      error: 'Failed to create checkout session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Handle Stripe webhooks (needs raw body)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Handle successful checkout
async function handleCheckoutCompleted(session: any) {
  const authId = session.metadata?.userId; // This is the Supabase Auth ID
  const planId = session.metadata?.planId;
  const planConfig = PLAN_CONFIGS[planId as keyof typeof PLAN_CONFIGS];

  if (!authId || !planId || !planConfig) {
    console.error('Missing required metadata in checkout session');
    return;
  }

  // Get the internal database user ID from the auth ID
  const { data: userRecord, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authId)
    .single();

  if (userError || !userRecord) {
    console.error('User not found in database for auth ID:', authId);
    return;
  }

  const userId = userRecord.id; // This is the internal database user ID

  // Get the subscription from Stripe
  const subscription = await stripe.subscriptions.retrieve(session.subscription as string) as any;

  // Create subscription record
  const { error: subError } = await supabase
    .from('user_subscriptions')
    .insert({
      user_id: userId,
      subscription_type: planConfig.subscriptionType,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      max_credits: planConfig.maxCredits,
      max_ai_chats: planConfig.maxAiChats,
      plan_name: planConfig.name,
      price_cents: planConfig.priceCents,
      status: 'active',
      next_billing_date: new Date(subscription.current_period_end * 1000).toISOString()
    });

  if (subError) {
    console.error('Error creating subscription:', subError);
    return;
  }

  // Initialize user credits
  const { error: creditsError } = await supabase
    .from('user_credits')
    .upsert({
      user_id: userId,
      current_credits: planConfig.maxCredits,
      ai_assistant_chats: 0,
      last_reset_at: new Date().toISOString()
    });

  if (creditsError) {
    console.error('Error initializing credits:', creditsError);
  }

  console.log(`✅ Subscription created for user ${userId} with plan ${planId}`);
}

// Handle subscription updates
async function handleSubscriptionUpdated(subscription: any) {
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: subscription.status,
      next_billing_date: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Error updating subscription:', error);
  }
}

// Handle subscription deletion
async function handleSubscriptionDeleted(subscription: any) {
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Error cancelling subscription:', error);
  }
}

// Handle successful payment (monthly renewals)
async function handlePaymentSucceeded(invoice: any) {
  if (invoice.billing_reason === 'subscription_cycle') {
    // Reset credits for monthly renewal
    const subscriptionId = invoice.subscription;
    
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('user_id, max_credits')
      .eq('stripe_subscription_id', subscriptionId)
      .single();

    if (subError || !subscription) {
      console.error('Error finding subscription for invoice:', subError);
      return;
    }

    // Reset user credits
    const { error: resetError } = await supabase
      .from('user_credits')
      .upsert({
        user_id: subscription.user_id,
        current_credits: subscription.max_credits,
        ai_assistant_chats: 0,
        last_reset_at: new Date().toISOString()
      });

    if (resetError) {
      console.error('Error resetting credits:', resetError);
    } else {
      console.log(`✅ Credits reset for user ${subscription.user_id}`);
    }
  }
}

// Handle failed payment
async function handlePaymentFailed(invoice: any) {
  // You might want to send notification emails or pause the subscription
  console.log(`❌ Payment failed for subscription ${invoice.subscription}`);
}

// Cancel subscription
router.post('/cancel', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const authId = authReq.user.id;

    // Get the internal database user ID from the auth ID
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authId)
      .single();

    if (userError || !userRecord) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = userRecord.id;

    // Get user's active subscription
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Cancel subscription in Stripe
    await stripe.subscriptions.cancel(subscription.stripe_subscription_id);

    res.json({ success: true });

  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

export default router; 