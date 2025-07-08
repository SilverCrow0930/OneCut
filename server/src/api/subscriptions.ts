import { Router, Request, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate.js';
import { supabase } from '../config/supabaseClient.js';
import Stripe from 'stripe';

const router = Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
});

// Stripe Price IDs - these should be environment variables
const STRIPE_PRICE_IDS = {
  'video-editor-only': process.env.STRIPE_PRICE_EDITOR_ONLY || 'price_editor_only',
  'creator-combo': process.env.STRIPE_PRICE_CREATOR_COMBO || 'price_creator_combo',
  'pro-combo': process.env.STRIPE_PRICE_PRO_COMBO || 'price_pro_combo',
  'credits-only-starter': process.env.STRIPE_PRICE_CREDITS_STARTER || 'price_credits_starter',
  'credits-only-pro': process.env.STRIPE_PRICE_CREDITS_PRO || 'price_credits_pro',
};

// Plan configurations
const PLAN_CONFIGS = {
  'video-editor-only': {
    name: 'Video Editing Suite',
    subscriptionType: 'editor-only',
    maxCredits: 0,
    maxAiChats: 400,
    priceCents: 800
  },
  'creator-combo': {
    name: 'Creator Complete',
    subscriptionType: 'editor-plus-credits',
    maxCredits: 400,
    maxAiChats: 0, // Unlimited for combo plans
    priceCents: 3900
  },
  'pro-combo': {
    name: 'Pro Complete',
    subscriptionType: 'editor-plus-credits',
    maxCredits: 1000,
    maxAiChats: 0, // Unlimited for combo plans
    priceCents: 7900
  },
  'credits-only-starter': {
    name: 'AI Credits Only - Starter',
    subscriptionType: 'credits-only',
    maxCredits: 150,
    maxAiChats: 0,
    priceCents: 1500
  },
  'credits-only-pro': {
    name: 'AI Credits Only - Pro',
    subscriptionType: 'credits-only',
    maxCredits: 400,
    maxAiChats: 0,
    priceCents: 3100
  }
};

// Create Stripe checkout session
router.post('/create-checkout-session', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { planId } = req.body;
    const userId = authReq.user.id;
    const userEmail = authReq.user.email;

    if (!planId || !STRIPE_PRICE_IDS[planId as keyof typeof STRIPE_PRICE_IDS]) {
      return res.status(400).json({ error: 'Invalid plan ID' });
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
      success_url: `${process.env.CLIENT_URL}/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/pricing?cancelled=true`,
      metadata: {
        userId: userId,
        planId: planId,
        planName: planConfig.name
      }
    });

    res.json({
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Handle Stripe webhooks
router.post('/webhook', async (req: Request, res: Response) => {
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
  const userId = session.metadata.userId;
  const planId = session.metadata.planId;
  const planConfig = PLAN_CONFIGS[planId as keyof typeof PLAN_CONFIGS];

  if (!userId || !planId || !planConfig) {
    console.error('Missing required metadata in checkout session');
    return;
  }

  // Get the subscription from Stripe
  const subscription = await stripe.subscriptions.retrieve(session.subscription);

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
    const userId = authReq.user.id;

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