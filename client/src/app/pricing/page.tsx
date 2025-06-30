'use client';

import React, { useState } from 'react';
import HomeNavbar from '@/components/home/HomeNavbar';

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
  // Simulated user data - in real app this would come from auth/user context
  const [currentCredits] = useState(47);
  const [maxCredits] = useState(150);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showEditorFeatures, setShowEditorFeatures] = useState(false);
  const [showAIFeatures, setShowAIFeatures] = useState(false);
  
  // Simulated current subscriptions
  const [currentSubscriptions, setCurrentSubscriptions] = useState([
    {
      id: 'foundation-active',
      name: 'Video Editor',
      credits: 15,
      price: 8,
      type: 'foundation' as const,
      nextBilling: 'Feb 15',
      status: 'active'
    },
    {
      id: 'creator-credits-active',
      name: 'Creator Credits',
      credits: 150,
      price: 20,
      type: 'credits' as const,
      nextBilling: 'Feb 15',
      status: 'active'
    }
  ]);

  const plans: Plan[] = [
    {
      id: 'unlimited-editor',
      name: 'Complete Video Editing Suite',
      credits: 15,
      price: 8,
      description: 'Everything you need to create professional videos',
      type: 'foundation',
      features: ['Unlimited Projects', 'Cloud Storage', 'Full Editor', '1080p Export', '15 AI Credits']
    },
    {
      id: 'starter-credits',
      name: 'Starter',
      credits: 75,
      price: 12,
      description: 'Perfect for beginners',
      type: 'credits',
      features: ['75 AI Credits', 'Monthly Reset', 'Email Support']
    },
    {
      id: 'creator-credits',
      name: 'Creator',
      credits: 200,
      price: 29,
      description: 'Most popular choice',
      type: 'credits',
      popular: true,
      features: ['200 AI Credits', 'Priority Support', 'Advanced Features']
    },
    {
      id: 'pro-credits',
      name: 'Pro',
      credits: 500,
      price: 69,
      description: 'For power users',
      type: 'credits',
      features: ['500 AI Credits', 'Priority Support', 'Early Access']
    },
    {
      id: 'enterprise-credits',
      name: 'Enterprise',
      credits: 1500,
      price: 199,
      description: 'Maximum AI power',
      type: 'credits',
      features: ['1500 AI Credits', 'Dedicated Support', 'Custom Integrations']
    }
  ];

  const aiFeatures = [
    { name: 'Smart Cut', cost: 15, description: 'AI-powered video editing with automatic cuts' },
    { name: 'AI Voiceover', cost: 3, description: 'Natural voice generation per minute' },
    { name: 'Auto Captions', cost: 5, description: 'Automatic caption generation' },
    { name: 'AI Images', cost: 2, description: 'AI-generated images and graphics' },
    { name: 'Video Generation', cost: 25, description: 'AI video clips (5-second)' },
    { name: 'Background Removal', cost: 8, description: 'AI background replacement' },
    { name: 'Style Transfer', cost: 12, description: 'Apply artistic styles to videos' },
    { name: 'Audio Enhancement', cost: 4, description: 'AI audio cleanup and enhancement' }
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

  const cancelSubscription = (subscriptionId: string) => {
    setCurrentSubscriptions(prev => 
      prev.map(sub => 
        sub.id === subscriptionId 
          ? { ...sub, status: 'cancelled' }
          : sub
      )
    );
  };

  const creditPercentage = (currentCredits / maxCredits) * 100;
  const foundationPlan = plans.find(p => p.type === 'foundation');
  const creditPlans = plans.filter(p => p.type === 'credits');

  return (
    <div className="min-h-screen bg-gray-50">
      <HomeNavbar />

      <div className="max-w-7xl mx-auto px-4 pt-24 pb-16">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Pricing
          </h1>
          <p className="text-gray-600 max-w-2xl">
            Start with our complete video editor, then add AI credits as you need them.
          </p>
        </div>

        {/* Current Status */}
        <div className="grid md:grid-cols-2 gap-6 mb-12 max-w-4xl">
          {/* Credits */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">AI Credits</h3>
              <span className="text-2xl font-bold text-blue-600">{currentCredits}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
              <div 
                className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${creditPercentage}%` }}
              />
            </div>
            <p className="text-sm text-gray-500">of {maxCredits} credits • Resets monthly</p>
          </div>

          {/* Active Subscriptions */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Active Plans</h3>
              <span className="text-2xl font-bold text-gray-900">
                ${currentSubscriptions.filter(s => s.status === 'active').reduce((sum, s) => sum + s.price, 0)}/mo
              </span>
            </div>
            <div className="space-y-3">
              {currentSubscriptions.filter(s => s.status === 'active').map(sub => (
                <div key={sub.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{sub.name}</div>
                    <div className="text-sm text-gray-500">Next billing: {sub.nextBilling}</div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="font-semibold text-gray-900">${sub.price}/mo</span>
                    <button
                      onClick={() => cancelSubscription(sub.id)}
                      className="text-sm text-red-500 hover:text-red-600 px-3 py-1 rounded-md hover:bg-red-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Plans Section */}
          <div className="lg:col-span-3 space-y-10">
            
            {/* Video Editor Plan */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">🎬 Video Editor</h2>
                <button 
                  onClick={() => setShowEditorFeatures(!showEditorFeatures)}
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center transition-colors"
                >
                  {showEditorFeatures ? 'Hide' : 'Show'} all features
                  <svg className={`w-4 h-4 ml-1 transition-transform ${showEditorFeatures ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {foundationPlan && (
                <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
                    <div className="mb-4 md:mb-0">
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">{foundationPlan.name}</h3>
                      <p className="text-gray-600">{foundationPlan.description}</p>
                    </div>
                    <div className="text-center md:text-right">
                      <div className="text-4xl font-bold text-gray-900">${foundationPlan.price}</div>
                      <div className="text-gray-500">/month</div>
                    </div>
                  </div>

                  {/* Expandable Features */}
                  {showEditorFeatures && (
                    <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <h4 className="font-semibold text-gray-900 mb-3">What's included:</h4>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {foundationPlan.features.map((feature, idx) => (
                          <div key={idx} className="flex items-center text-sm text-gray-700">
                            <svg className="w-4 h-4 text-blue-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {feature}
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 p-3 bg-white rounded-lg">
                        <p className="text-sm text-gray-600">
                          <strong>Plus:</strong> Timeline editing, multi-track support, transitions, effects, and everything you need for professional video editing.
                        </p>
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={() => addToCart(foundationPlan)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl text-lg transition-colors"
                  >
                    Add to Cart
                  </button>
                </div>
              )}
            </div>

            {/* AI Features Plans */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">✨ AI Features</h2>
                  <p className="text-gray-600 mt-1">Add credits to unlock powerful AI capabilities</p>
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
                <div className="mb-6 p-6 bg-purple-50 rounded-xl border border-purple-100">
                  <h4 className="font-semibold text-gray-900 mb-4">What you can do with credits:</h4>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {aiFeatures.map((feature, idx) => (
                      <div key={idx} className="flex items-start justify-between p-3 bg-white rounded-lg border border-purple-100">
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900 text-sm">{feature.name}</h5>
                          <p className="text-xs text-gray-600 mt-1">{feature.description}</p>
                        </div>
                        <div className="ml-3 text-right">
                          <div className="text-sm font-bold text-purple-600">{feature.cost}</div>
                          <div className="text-xs text-gray-500">credits</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-3 bg-white rounded-lg border border-purple-100">
                    <p className="text-sm text-gray-600">
                      <strong>💡 Pro Tip:</strong> Credits reset monthly, so you always have fresh AI power to work with. Start with a smaller pack and upgrade as needed!
                    </p>
                  </div>
                </div>
              )}
              
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {creditPlans.map((plan) => (
                  <div 
                    key={plan.id} 
                    className="relative bg-white rounded-xl border-2 border-gray-200 p-6 transition-all hover:shadow-md"
                  >
                    <div className="text-center mb-4">
                      <h4 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h4>
                      <p className="text-sm text-gray-600 mb-3">{plan.description}</p>
                      <div className="text-3xl font-bold text-gray-900">${plan.price}</div>
                      <div className="text-gray-500 text-sm">/month</div>
                    </div>

                    <div className="mb-4 text-center">
                      <div className="text-lg font-semibold text-blue-600">
                        {plan.credits} credits
                      </div>
                      <div className="text-sm text-gray-500">per month</div>
                    </div>

                    <button
                      onClick={() => addToCart(plan)}
                      className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                    >
                      Add to Cart
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cart Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 sticky top-24 shadow-sm">
              <div className="flex items-center mb-6">
                <span className="mr-3 text-2xl transform scale-x-[-1]">🛒</span>
                <h3 className="text-xl font-bold text-gray-900">Cart</h3>
              </div>
              
              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 7a2 2 0 01-2 2H8a2 2 0 01-2-2L5 9z" />
                    </svg>
                  </div>
                  <p className="font-medium">Your cart is empty</p>
                  <p className="text-sm mt-1">Add plans to get started</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {cart.map((item) => (
                      <div key={item.plan.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="font-semibold text-gray-900 text-sm">{item.plan.name}</h4>
                          <button
                            onClick={() => removeFromCart(item.plan.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          {item.plan.type === 'foundation' ? (
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Single plan</span>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => updateQuantity(item.plan.id, item.quantity - 1)}
                                className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
                              >
                                −
                              </button>
                              <span className="w-8 text-center font-medium">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.plan.id, item.quantity + 1)}
                                className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
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

                  <div className="border-t border-gray-200 pt-4 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-900">Total</span>
                      <span className="text-2xl font-bold text-gray-900">${getTotalPrice()}/mo</span>
                    </div>
                  </div>

                  <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl text-lg transition-colors">
                    Subscribe Now
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Simple FAQ */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">
            Questions?
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <h3 className="font-medium text-gray-900 mb-2">How do credits work?</h3>
              <p className="text-sm text-gray-600">
                Credits reset monthly. Use them for AI features like voiceover, generation, and smart editing.
              </p>
            </div>
            
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <h3 className="font-medium text-gray-900 mb-2">Can I cancel anytime?</h3>
              <p className="text-sm text-gray-600">
                Yes! Cancel from your account or this page. No contracts, no hassle.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 