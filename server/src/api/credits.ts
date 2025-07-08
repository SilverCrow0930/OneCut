import { Router, Request, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate.js';
import { supabase } from '../config/supabaseClient.js';

const router = Router();

// Get user's current credits and subscription info
router.get('/', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const userId = authReq.user.id;

    // Get user's subscription and credits from database
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (subError && subError.code !== 'PGRST116') {
      throw subError;
    }

    // Get current credits usage
    const { data: credits, error: creditsError } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (creditsError && creditsError.code !== 'PGRST116') {
      throw creditsError;
    }

    // Default values for no subscription
    let subscriptionType = null;
    let maxCredits = 0;
    let currentCredits = 0;
    let aiAssistantChats = 0;
    let maxAiAssistantChats = 0;

    if (subscription) {
      subscriptionType = subscription.subscription_type;
      maxCredits = subscription.max_credits || 0;
      maxAiAssistantChats = subscription.max_ai_chats || 0;
    }

    if (credits) {
      currentCredits = credits.current_credits || 0;
      aiAssistantChats = credits.ai_assistant_chats || 0;
    }

    res.json({
      subscriptionType,
      maxCredits,
      currentCredits,
      aiAssistantChats,
      maxAiAssistantChats,
      subscriptionId: subscription?.id || null
    });

  } catch (error) {
    console.error('Error fetching credits:', error);
    res.status(500).json({ error: 'Failed to fetch credits' });
  }
});

// Consume credits for AI features
router.post('/consume', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const userId = authReq.user.id;
    const { amount, featureName } = req.body;

    if (!amount || !featureName) {
      return res.status(400).json({ error: 'Amount and feature name are required' });
    }

    // Get current credits
    const { data: credits, error: creditsError } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (creditsError && creditsError.code !== 'PGRST116') {
      throw creditsError;
    }

    const currentCredits = credits?.current_credits || 0;

    // Check if user has enough credits
    if (currentCredits < amount) {
      return res.status(400).json({ error: 'Insufficient credits' });
    }

    // Update credits
    const newCredits = currentCredits - amount;
    
    const { error: updateError } = await supabase
      .from('user_credits')
      .upsert({
        user_id: userId,
        current_credits: newCredits,
        updated_at: new Date().toISOString()
      });

    if (updateError) {
      throw updateError;
    }

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

    res.json({
      success: true,
      remainingCredits: newCredits,
      consumed: amount,
      featureName
    });

  } catch (error) {
    console.error('Error consuming credits:', error);
    res.status(500).json({ error: 'Failed to consume credits' });
  }
});

// Consume AI assistant chat (for editor-only plans)
router.post('/consume-chat', authenticate, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const userId = authReq.user.id;

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
    const userId = authReq.user.id;

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