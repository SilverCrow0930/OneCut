import { Router, Request } from 'express';
import { supabase } from '../config/supabaseClient.js';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate.js';

const router = Router();

router.get('/', authenticate, async (req: Request, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const authId = authReq.user.id; // This is the auth_id from Supabase Auth

    // Get user credits and subscription info using auth_id
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('auth_id', authId)
      .single();

    if (subscriptionError) {
      console.error('Error fetching subscription:', subscriptionError);
      return res.status(500).json({ error: 'Failed to fetch subscription data' });
    }

    const { data: creditsData, error: creditsError } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', authId)
      .single();

    if (creditsError) {
      console.error('Error fetching credits:', creditsError);
      return res.status(500).json({ error: 'Failed to fetch credits data' });
    }

    return res.json({
      subscription: subscriptionData,
      credits: creditsData?.credits || 0,
      maxCredits: subscriptionData?.max_credits || 0
    });
  } catch (error) {
    console.error('Error in credits endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router; 