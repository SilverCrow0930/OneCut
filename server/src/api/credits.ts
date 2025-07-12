import { Router, Request, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate.js';
import { supabase } from '../config/supabaseClient.js';

const router = Router();

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  console.log('[Credits] Health check called');
  res.json({ 
    status: 'ok', 
    message: 'Credits API is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Get user's current credits and subscription info
router.get('/', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const authId = authReq.user.id; // This is the Supabase Auth ID
    console.log('[Credits API] Fetching data for auth ID:', authId);

    // First, get the internal database user ID from the auth ID
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authId)
      .single();

    console.log('[Credits API] User lookup result:', { userRecord, error: userError });

    if (userError || !userRecord) {
      console.error('[Credits API] User not found in database for auth ID:', authId);
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = userRecord.id; // This is the internal database user ID
    console.log('[Credits API] Using internal user ID:', userId);

    // Get user's subscription and credits from database using internal user ID
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    console.log('[Credits API] Subscription query result:', { subscription, error: subError });

    if (subError && subError.code !== 'PGRST116') {
      throw subError;
    }

    // Get current credits usage using internal user ID
    const { data: credits, error: creditsError } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    console.log('[Credits API] Credits query result:', { credits, error: creditsError });

    if (creditsError && creditsError.code !== 'PGRST116') {
      throw creditsError;
    }

    // Default values for no subscription
    let subscriptionType = null;
    let maxCredits = 0;
    let currentCredits = 0;
    let aiAssistantChats = 0;
    let maxAiAssistantChats = 0;
    let nextBillingDate = null;

    if (subscription) {
      subscriptionType = subscription.subscription_type;
      maxCredits = subscription.max_credits || 0;
      maxAiAssistantChats = subscription.max_ai_chats || 0;
      nextBillingDate = subscription.next_billing_date || null;
      console.log('[Credits API] Using subscription data:', { 
        subscriptionType, 
        maxCredits, 
        maxAiAssistantChats,
        nextBillingDate 
      });
    }

    if (credits) {
      currentCredits = credits.current_credits || 0;
      aiAssistantChats = credits.ai_assistant_chats || 0;
      console.log('[Credits API] Using credits data:', { currentCredits, aiAssistantChats });
    }

    const response = {
      subscriptionType,
      maxCredits,
      currentCredits,
      aiAssistantChats,
      maxAiAssistantChats,
      subscriptionId: subscription?.id || null,
      nextBillingDate
    };

    console.log('[Credits API] Sending response:', response);
    res.json(response);

  } catch (error) {
    console.error('Error fetching credits:', error);
    res.status(500).json({ error: 'Failed to fetch credits' });
  }
});

// Consume credits for AI features
router.post('/consume', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const authId = authReq.user.id;
    const { amount, featureName } = req.body;

    console.log('[Credits API] Consume request received:', {
      authId,
      amount,
      featureName,
      body: req.body
    });

    if (!amount || !featureName) {
      console.error('[Credits API] Missing required fields:', { amount, featureName });
      return res.status(400).json({ error: 'Amount and feature name are required' });
    }

    // Get the internal database user ID from the auth ID
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', authId)
      .single();

    console.log('[Credits API] User lookup result:', { userRecord, error: userError });

    if (userError || !userRecord) {
      console.error('[Credits API] User not found for auth ID:', authId);
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = userRecord.id;
    console.log('[Credits API] Using internal user ID:', userId);

    // Get current credits
    const { data: credits, error: creditsError } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    console.log('[Credits API] Credits lookup result:', { credits, error: creditsError });

    let currentCredits = 0;

    if (creditsError && creditsError.code === 'PGRST116') {
      // No credits record found, create one based on subscription
      console.log('[Credits API] No credits record found, creating one...');
      
      // Get user's subscription to determine max credits
      const { data: subscription, error: subError } = await supabase
        .from('user_subscriptions')
        .select('max_credits')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      console.log('[Credits API] Subscription lookup for credits initialization:', { subscription, error: subError });

      if (subError) {
        console.error('[Credits API] Error looking up subscription:', subError);
        throw subError;
      }

      if (!subscription) {
        console.error('[Credits API] No active subscription found for user');
        throw new Error('No active subscription found');
      }

      const maxCredits = subscription.max_credits || 0;
      console.log('[Credits API] Initializing credits with max_credits:', maxCredits);

      // Create credits record
      const { data: newCredits, error: createError } = await supabase
        .from('user_credits')
        .insert({
          user_id: userId,
          current_credits: maxCredits,
          ai_assistant_chats: 0,
          last_reset_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('[Credits API] Error creating credits record:', createError);
        throw createError;
      }

      console.log('[Credits API] Created new credits record:', newCredits);
      currentCredits = newCredits.current_credits;
    } else if (creditsError) {
      console.error('[Credits API] Credits lookup error:', creditsError);
      throw creditsError;
    } else {
      currentCredits = credits?.current_credits || 0;
    }

    console.log('[Credits API] Current credits before consumption:', currentCredits);

    // Check if user has enough credits
    if (currentCredits < amount) {
      console.warn('[Credits API] Insufficient credits:', {
        currentCredits,
        requestedAmount: amount,
        shortfall: amount - currentCredits
      });
      return res.status(400).json({ error: 'Insufficient credits' });
    }

    // Update credits
    const newCredits = currentCredits - amount;
    console.log('[Credits API] Updating credits:', {
      from: currentCredits,
      to: newCredits,
      consumed: amount
    });
    
    const { error: updateError } = await supabase
      .from('user_credits')
      .upsert({
        user_id: userId,
        current_credits: newCredits,
        updated_at: new Date().toISOString()
      });

    if (updateError) {
      console.error('[Credits API] Update error:', updateError);
      throw updateError;
    }

    console.log('[Credits API] Credits updated successfully');

    // Log the credit usage
    const { error: logError } = await supabase
      .from('credit_usage_log')
      .insert({
        user_id: userId,
        feature_name: featureName,
        credits_consumed: amount,
        remaining_credits: newCredits,
        created_at: new Date().toISOString()
      });

    if (logError) {
      console.error('Failed to log credit usage:', logError);
      // Don't fail the request if logging fails
    }

    console.log('[Credits API] Consumption successful:', {
      consumed: amount,
      remaining: newCredits,
      featureName
    });

    res.json({
      success: true,
      remainingCredits: newCredits,
      consumed: amount,
      featureName
    });

  } catch (error) {
    console.error('Error consuming credits:', error);
    let errorMessage = 'Failed to consume credits';
    
    if (error instanceof Error) {
        errorMessage = error.message;
        console.error('[Credits API] Detailed error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

// Consume AI assistant chat (for editor-only plans)
router.post('/consume-chat', authenticate, async (req: Request, res: Response) => {
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

    // Get current credits
    const { data: credits, error: creditsError } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (creditsError && creditsError.code !== 'PGRST116') {
      throw creditsError;
    }

    const currentChats = credits?.ai_assistant_chats || 0;

    // Get subscription to check limits
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (subError && subError.code !== 'PGRST116') {
      throw subError;
    }

    const maxChats = subscription?.max_ai_chats || 0;

    // Check if user has reached the limit
    if (currentChats >= maxChats) {
      return res.status(400).json({ error: 'AI assistant chat limit reached' });
    }

    // Update chat count
    const newChatCount = currentChats + 1;
    
    const { error: updateError } = await supabase
      .from('user_credits')
      .upsert({
        user_id: userId,
        ai_assistant_chats: newChatCount,
        updated_at: new Date().toISOString()
      });

    if (updateError) {
      throw updateError;
    }

    res.json({
      success: true,
      aiAssistantChats: newChatCount,
      maxAiAssistantChats: maxChats
    });

  } catch (error) {
    console.error('Error consuming AI chat:', error);
    res.status(500).json({ error: 'Failed to consume AI chat' });
  }
});

// Reset credits (monthly reset via cron job)
router.post('/reset', authenticate, async (req: Request, res: Response) => {
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

    // Get user's subscription
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (subError) {
      throw subError;
    }

    // Reset credits to max
    const { error: resetError } = await supabase
      .from('user_credits')
      .upsert({
        user_id: userId,
        current_credits: subscription.max_credits || 0,
        ai_assistant_chats: 0,
        updated_at: new Date().toISOString()
      });

    if (resetError) {
      throw resetError;
    }

    res.json({
      success: true,
      resetCredits: subscription.max_credits || 0
    });

  } catch (error) {
    console.error('Error resetting credits:', error);
    res.status(500).json({ error: 'Failed to reset credits' });
  }
});

export default router; 