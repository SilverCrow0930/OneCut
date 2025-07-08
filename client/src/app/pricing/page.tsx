'use client';

import React, { useState } from 'react';
import HomeNavbar from '@/components/home/HomeNavbar';
import PieChart from '@/components/ui/PieChart';
import { useCredits } from '@/contexts/CreditsContext';
import { useAuth } from '@/contexts/AuthContext';

interface Plan {
  id: string;
  name: string;
  credits: number;
  price: number;
  description: string;
  features: string[];
  popular?: boolean;
  type: 'foundation' | 'credits';
}

interface CartItem {
  plan: Plan;
  quantity: number;
}

export default function PricingPage() {
  // Real credits data from context
  const { credits: currentCredits, maxCredits, subscriptionType, aiAssistantChats, maxAiAssistantChats, isLoading } = useCredits();
  const { user, session } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showEditorFeatures, setShowEditorFeatures] = useState(false);
  const [showAIFeatures, setShowAIFeatures] = useState(false);
  const [processingSubscription, setProcessingSubscription] = useState(false);
  
  // Dynamic subscription data based on current subscription type
  const getCurrentSubscriptions = () => {
    const subscriptions = [];
    
    if (subscriptionType === 'editor-plus-credits') {
      let planName = 'Lemona Plan';
      let price = 19;
      
      if (maxCredits === 150) {
        planName = 'Starter';
        price = 10;
      } else if (maxCredits === 400) {
        planName = 'Creator';
        price = 25;
      } else if (maxCredits === 1000) {
        planName = 'Pro';
        price = 78;
      } else if (maxCredits === 2500) {
        planName = 'Enterprise';
        price = 199;
      }
      
      subscriptions.push({
        id: 'active-plan',
        name: planName,
        credits: maxCredits,
        price: price,
      type: 'credits' as const,
      nextBilling: 'Feb 15',
      status: 'active'
      });
    }
    
    return subscriptions;
  };
  
  const [currentSubscriptions, setCurrentSubscriptions] = useState(getCurrentSubscriptions());

  const plans: Plan[] = [
    {
      id: 'starter-plan',
      name: 'Starter',
      credits: 150,
      price: 10,
      description: 'Perfect for beginners',
      type: 'credits',
      features: [
        'Complete Video Editor',
        '150 AI Credits',
        'Unlimited AI Assistant',
        '1080p Export'
      ]
    },
    {
      id: 'creator-plan',
      name: 'Creator',
      credits: 400,
      price: 25,
      description: 'Most popular choice',
      type: 'credits',
      popular: true,
      features: [
        'Complete Video Editor',
        '400 AI Credits',
        'Unlimited AI Assistant',
        'Priority Support'
      ]
    },
    {
      id: 'pro-plan',
      name: 'Pro',
      credits: 1000,
      price: 78,
      description: 'For power users',
      type: 'credits',
      features: [
        'Complete Video Editor',
        '1000 AI Credits',
        'Unlimited AI Assistant',
        'Early Access Features'
      ]
    },
    {
      id: 'enterprise-plan',
      name: 'Enterprise',
      credits: 2500,
      price: 199,
      description: 'Maximum AI power',
      type: 'credits',
      features: [
        'Complete Video Editor',
        '2500 AI Credits',
        'Unlimited AI Assistant',
        'Professional Support'
      ]
    }
  ];

  const aiFeatures = [
    { name: 'AI Assistant Chat', cost: 1, description: 'Chat with AI assistant (unlimited with Editor Suite)' },
    { name: 'Smart Cut', cost: 20, description: 'AI-powered video editing with automatic cuts' },
    { name: 'AI Voiceover', cost: 5, description: 'Natural voice generation per minute' },
    { name: 'Auto Captions', cost: 8, description: 'Automatic caption generation per video' },
    { name: 'AI Images', cost: 3, description: 'AI-generated images and graphics' },
    { name: 'Video Generation', cost: 30, description: 'AI video clips (5-second)' },
    { name: 'Background Removal', cost: 12, description: 'AI background replacement per video' },
    { name: 'Style Transfer', cost: 15, description: 'Apply artistic styles to videos' },
    { name: 'Audio Enhancement', cost: 6, description: 'AI audio cleanup and enhancement per video' }
  ];

  const addToCart = (plan: Plan) => {
    setCart(prev => {
      const existing = prev.find(item => item.plan.id === plan.id);
      if (existing) {
        if (plan.type === 'foundation') return prev;
        return prev.map(item =>
          item.plan.id === plan.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { plan, quantity: 1 }];
    });
  };

  const removeFromCart = (planId: string) => {
    setCart(prev => prev.filter(item => item.plan.id !== planId));
  };

  const updateQuantity = (planId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(planId);
    } else {
      setCart(prev => prev.map(item =>
        item.plan.id === planId ? { ...item, quantity } : item
      ));
    }
  };

  const getTotalPrice = () => {
    return cart.reduce((sum, item) => sum + (item.plan.price * item.quantity), 0);
  };

  const getTotalCredits = () => {
    return cart.reduce((sum, item) => sum + (item.plan.credits * item.quantity), 0);
  };

  const cancelSubscription = async (subscriptionId: string) => {
    if (!user || !session) return;
    
    try {
      const response = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (response.ok) {
    setCurrentSubscriptions(prev => 
      prev.map(sub => 
        sub.id === subscriptionId 
          ? { ...sub, status: 'cancelled' }
          : sub
      )
    );
      }
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (!user || !session) {
      // Redirect to login
      window.location.href = '/auth/login';
      return;
    }
    
    setProcessingSubscription(true);
    
    try {
      const response = await fetch('/api/subscriptions/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ planId })
      });
      
      if (response.ok) {
        const { url } = await response.json();
        window.location.href = url;
      } else {
        const error = await response.json();
        console.error('Failed to create checkout session:', error);
        alert('Failed to start subscription process. Please try again.');
      }
    } catch (error) {
      console.error('Error starting subscription:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setProcessingSubscription(false);
    }
  };

  const creditPercentage = (currentCredits / maxCredits) * 100;

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
            <HomeNavbar />

      <main className="max-w-[85%] mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16">
        {/* Current Status - Only show if user has active subscriptions */}
        {currentSubscriptions.filter(s => s.status === 'active').length > 0 && (
          <div className="grid md:grid-cols-2 gap-8 mb-16 max-w-5xl mx-auto">
            {/* Credits */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">AI Credits</h3>
              </div>
              <div className="flex items-center justify-center mb-4">
                <PieChart 
                  used={currentCredits} 
                  total={maxCredits}
                  size={140}
                  strokeWidth={10}
                />
              </div>
              <p className="text-sm text-gray-600 text-center">{currentCredits}/{maxCredits} credits • Resets monthly</p>
            </div>

            {/* Active Subscriptions */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Active Plans</h3>
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  ${currentSubscriptions.filter(s => s.status === 'active').reduce((sum, s) => sum + s.price, 0)}/mo
                </span>
              </div>
              <div className="space-y-4">
                {currentSubscriptions.filter(s => s.status === 'active').map(sub => (
                  <div key={sub.id} className="flex items-center justify-between p-4 bg-white/50 rounded-xl border border-white/30">
                    <div>
                      <div className="font-semibold text-gray-900">{sub.name}</div>
                      <div className="text-sm text-gray-600">Next billing: {sub.nextBilling}</div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="font-bold text-gray-900">${sub.price}/mo</span>
                      <button
                        onClick={() => cancelSubscription(sub.id)}
                        className="text-sm text-red-500 hover:text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 transition-all duration-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-6xl mx-auto">
          {/* Choose a Plan */}
          <div>
            <div className="flex items-center justify-between mb-12">
              <h2 className="text-4xl font-bold text-gray-900">Choose Your Plan</h2>
              <button
                onClick={() => setShowAIFeatures(!showAIFeatures)}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center transition-colors"
              >
                {showAIFeatures ? 'Hide' : 'Show'} AI features & credits
                <svg className={`w-4 h-4 ml-1 transition-transform ${showAIFeatures ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* AI Features Expandable Section */}
            {showAIFeatures && (
              <div className="mb-10 p-8 bg-gradient-to-r from-purple-50 to-pink-50 rounded-3xl border border-purple-100">
                <h4 className="font-semibold text-gray-900 mb-6">What you can do with credits:</h4>
                <div className="grid sm:grid-cols-2 gap-6">
                  {aiFeatures.map((feature, idx) => (
                    <div key={idx} className="flex items-start justify-between p-5 bg-white/70 backdrop-blur-sm rounded-2xl border border-white/30 shadow-lg">
                      <div className="flex-1">
                        <h5 className="font-semibold text-gray-900 text-sm">{feature.name}</h5>
                        <p className="text-xs text-gray-600 mt-2">{feature.description}</p>
                      </div>
                      <div className="ml-4 text-right">
                        <div className="text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{feature.cost}</div>
                        <div className="text-xs text-gray-500">credits</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-8 p-5 bg-white/70 backdrop-blur-sm rounded-2xl border border-white/30">
                  <p className="text-sm text-gray-600">
                    <strong>💡 Pro Tip:</strong> Credits reset monthly, so you always have fresh AI power to work with. Start with a smaller pack and upgrade as needed!
                  </p>
                </div>
              </div>
            )}
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {plans.map((plan) => (
                <div 
                  key={plan.id} 
                  className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/20 p-8 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <div className="text-center mb-6">
                    <h4 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h4>
                    <p className="text-sm text-gray-600 mb-4">{plan.description}</p>
                    <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">${plan.price}</div>
                    <div className="text-gray-500 text-sm">/month</div>
                  </div>

                  <div className="mb-6 text-center">
                    <div className="text-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      {plan.credits} credits
                    </div>
                    <div className="text-sm text-gray-500">per month</div>
                  </div>

                  <div className="mb-6 space-y-3">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center text-sm text-gray-700">
                        <svg className="w-4 h-4 text-blue-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={processingSubscription}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingSubscription ? 'Processing...' : `Get ${plan.name}`}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
        </div>
    );
} 