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
      features: ['Complete Video Editor', '150 AI Credits', 'Unlimited AI Assistant', 'Cloud Storage', '1080p Export', 'Email Support']
    },
    {
      id: 'creator-plan',
      name: 'Creator',
      credits: 400,
      price: 25,
      description: 'Most popular choice',
      type: 'credits',
      popular: true,
      features: ['Complete Video Editor', '400 AI Credits', 'Unlimited AI Assistant', 'Priority Support', 'All Features Unlocked', 'Advanced Templates']
    },
    {
      id: 'pro-plan',
      name: 'Pro',
      credits: 1000,
      price: 78,
      description: 'For power users',
      type: 'credits',
      features: ['Complete Video Editor', '1000 AI Credits', 'Unlimited AI Assistant', 'Priority Support', 'Early Access Features', 'Custom Branding']
    },
    {
      id: 'enterprise-plan',
      name: 'Enterprise',
      credits: 2500,
      price: 199,
      description: 'Maximum AI power',
      type: 'credits',
      features: ['Complete Video Editor', '2500 AI Credits', 'Unlimited AI Assistant', 'Dedicated Support', 'Custom Integrations', 'Team Collaboration']
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
                {/* Header */}
        <div className="mb-16 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {currentSubscriptions.filter(s => s.status === 'active').length > 0 ? 'Current Plans' : 'Pricing'}
                    </h1>
          <p className="text-base text-gray-600 max-w-3xl mx-auto">
            {currentSubscriptions.filter(s => s.status === 'active').length > 0 
              ? 'Manage your active subscriptions and upgrade your plans as needed.'
              : 'Start with our complete video editor, then add AI credits as you need them.'
            }
          </p>
        </div>

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
        <div className="grid lg:grid-cols-4 gap-10">
          {/* Plans Section */}
          <div className="lg:col-span-3 space-y-16">
            
            {/* Choose a Plan */}
            <div>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Choose a Plan</h2>
                  <p className="text-base text-gray-600 mt-2">Complete video editor + AI credits included in every plan</p>
                </div>
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
                    className={`relative bg-white/80 backdrop-blur-sm rounded-2xl border p-8 transition-all duration-300 hover:shadow-xl hover:scale-105 ${
                      plan.popular 
                        ? 'border-blue-200 ring-2 ring-blue-500/20 shadow-lg' 
                        : 'border-gray-200/60 hover:border-gray-300/80'
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-full text-xs font-semibold">
                          Most Popular
                        </div>
                      </div>
                    )}
                    
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
                      {processingSubscription ? 'Processing...' : 'Subscribe Now'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cart Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white/70 backdrop-blur-sm rounded-3xl border border-white/20 p-8 sticky top-32 shadow-xl">
              <div className="flex items-center mb-8">
                <span className="mr-4 text-2xl transform scale-x-[-1]">🛒</span>
                <h3 className="text-xl font-bold text-gray-900">Cart</h3>
              </div>
              
              {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 7a2 2 0 01-2 2H8a2 2 0 01-2-2L5 9z" />
                    </svg>
                  </div>
                  <p className="font-semibold">Your cart is empty</p>
                  <p className="text-sm mt-2">Add plans to get started</p>
                </div>
              ) : (
                <>
                  <div className="space-y-6 mb-8">
                    {cart.map((item) => (
                      <div key={item.plan.id} className="bg-white/50 backdrop-blur-sm border border-white/30 rounded-2xl p-6">
                        <div className="flex items-start justify-between mb-4">
                          <h4 className="font-semibold text-gray-900 text-sm">{item.plan.name}</h4>
                          <button
                            onClick={() => removeFromCart(item.plan.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                                </div>
                        
                        <div className="flex items-center justify-between">
                          {item.plan.type === 'foundation' ? (
                            <span className="text-xs text-gray-600 bg-gray-100/70 px-3 py-2 rounded-lg">Single plan</span>
                          ) : (
                            <div className="flex items-center space-x-3">
                              <button
                                onClick={() => updateQuantity(item.plan.id, item.quantity - 1)}
                                className="w-8 h-8 rounded-lg bg-gray-100/70 hover:bg-gray-200/70 flex items-center justify-center text-gray-600 transition-colors"
                              >
                                −
                              </button>
                              <span className="w-10 text-center font-semibold">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.plan.id, item.quantity + 1)}
                                className="w-8 h-8 rounded-lg bg-gray-100/70 hover:bg-gray-200/70 flex items-center justify-center text-gray-600 transition-colors"
                              >
                                +
                              </button>
                            </div>
                          )}
                          <div className="font-bold text-gray-900">
                            ${(item.plan.price * item.quantity).toFixed(2)}
                          </div>
                        </div>
                        </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-200/50 pt-6 mb-8">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-900">Total</span>
                      <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">${getTotalPrice()}/mo</span>
                    </div>
                  </div>

                  <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-2xl text-base transition-all duration-300 shadow-lg hover:shadow-xl">
                    Subscribe Now
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Simple FAQ */}
        <div className="mt-24 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-12 text-center">
            Questions?
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
              <h3 className="font-semibold text-gray-900 mb-4">How do credits work?</h3>
              <p className="text-gray-600">
                Credits reset monthly. Use them for AI features like voiceover, generation, and smart editing.
              </p>
                </div>
            
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
              <h3 className="font-semibold text-gray-900 mb-4">Can I cancel anytime?</h3>
              <p className="text-gray-600">
                Yes! Cancel from your account or this page. No contracts, no hassle.
              </p>
            </div>
            </div>
        </div>
      </main>
        </div>
    );
} 