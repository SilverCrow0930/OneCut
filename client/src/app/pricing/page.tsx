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
  const [showAIFeatures, setShowAIFeatures] = useState(false);
  const [showEditorFeatures, setShowEditorFeatures] = useState(false);
  
  // Simulated current subscriptions
  const [currentSubscriptions, setCurrentSubscriptions] = useState([
    {
      id: 'foundation-active',
      name: 'Foundation',
      credits: 10,
      price: 5,
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

      <div className="max-w-6xl mx-auto px-4 pt-24 pb-16">
                {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Simple Monthly Pricing
                    </h1>
          <p className="text-gray-600 max-w-2xl mx-auto mb-4">
            Start with Complete Video Editing Suite, add AI credits as needed.
          </p>
        </div>

        {/* Current Status - Compact */}
        <div className="grid md:grid-cols-2 gap-4 mb-12 max-w-3xl mx-auto">
          {/* Credits */}
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Credits</span>
              <span className="text-lg font-bold text-blue-600">{currentCredits}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${creditPercentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">of {maxCredits} • Resets monthly</p>
          </div>

          {/* Current Plans */}
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">Active Subscriptions</span>
              <span className="text-lg font-bold text-gray-900">
                ${currentSubscriptions.filter(s => s.status === 'active').reduce((sum, s) => sum + s.price, 0)}/mo
              </span>
            </div>
            <div className="space-y-2">
              {currentSubscriptions.filter(s => s.status === 'active').map(sub => (
                <div key={sub.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-800">{sub.name}</span>
                    <div className="text-xs text-gray-500">Next billing: {sub.nextBilling}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-gray-900">${sub.price}/mo</span>
                    <button
                      onClick={() => cancelSubscription(sub.id)}
                      className="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Editor Section */}
        <div className="grid lg:grid-cols-4 gap-6 mb-12">
          <div className="lg:col-span-3">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Video Editor</h2>
            {foundationPlan && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{foundationPlan.name}</h3>
                    <p className="text-sm text-gray-600">{foundationPlan.description}</p>
                    <div className="mt-2">
                      <button 
                        onClick={() => setShowEditorFeatures(true)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View all features →
                      </button>
                    </div>
                  </div>
                  <div className="text-right ml-6">
                    <div className="text-2xl font-bold text-gray-900">${foundationPlan.price}</div>
                    <div className="text-xs text-gray-500">/month</div>
                  </div>
                </div>

                <button 
                  onClick={() => addToCart(foundationPlan)}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
                >
                  Add to Cart
                </button>
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-8">
              <div className="flex items-center mb-4">
                <span className="mr-2">🛒</span>
                <h3 className="font-semibold text-gray-900">Cart</h3>
              </div>
              
              {cart.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <div className="text-2xl mb-2">🛒</div>
                  <p className="text-sm">Cart is empty</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-4">
                    {cart.map((item) => (
                      <div key={item.plan.id} className="border border-gray-100 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-gray-900">{item.plan.name}</h4>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.plan.id)}
                            className="text-gray-400 hover:text-red-500 text-sm"
                          >
                            ×
                            </button>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          {item.plan.type === 'foundation' ? (
                            <span className="text-xs text-gray-500">Single plan</span>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => updateQuantity(item.plan.id, item.quantity - 1)}
                                className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 text-xs"
                              >
                                −
                              </button>
                              <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.plan.id, item.quantity + 1)}
                                className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 text-xs"
                              >
                                +
                              </button>
                            </div>
                          )}
                          <div className="text-sm font-semibold text-gray-900">
                            ${(item.plan.price * item.quantity).toFixed(2)}
                          </div>
                        </div>
                        </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-100 pt-3 space-y-2">
                    <div className="flex justify-between text-base font-bold">
                      <span>Total</span>
                      <span>${getTotalPrice()}/mo</span>
                    </div>
                  </div>

                  <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg mt-4 transition-colors">
                    Subscribe
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* AI Features Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">AI Features</h2>
              <p className="text-sm text-gray-600 mt-1">Add credits to unlock powerful AI capabilities</p>
            </div>
            <button
              onClick={() => setShowAIFeatures(true)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              What can I do with credits? →
            </button>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {creditPlans.map((plan) => (
              <div 
                key={plan.id} 
                className={`relative bg-white rounded-xl border p-4 transition-all hover:shadow-md ${
                  plan.popular ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-2 left-4">
                    <span className="bg-blue-500 text-white text-xs font-medium px-2 py-1 rounded">
                      Popular
                                  </span>
                              </div>
                          )}
                          
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">{plan.name}</h4>
                    <p className="text-xs text-gray-600">{plan.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-900">${plan.price}</div>
                    <div className="text-xs text-gray-500">/month</div>
                  </div>
                          </div>

                <div className="mb-3">
                  <div className="text-sm font-medium text-blue-600 mb-1">
                    {plan.credits} credits/month
                  </div>
                </div>

                          <button
                  onClick={() => addToCart(plan)}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                >
                  Add to Cart
                </button>
              </div>
            ))}
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

      {/* Editor Features Modal */}
      {showEditorFeatures && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">🎬</span>
                  <h2 className="text-2xl font-bold text-gray-900">Editor Features</h2>
                </div>
                <button
                  onClick={() => setShowEditorFeatures(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <p className="text-gray-600 mb-6">
                Everything you need to create professional videos with our complete editing suite.
              </p>
              
              <div className="grid gap-4">
                {foundationPlan?.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center p-4 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                      <span className="text-blue-600 text-lg">✓</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{feature}</h3>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-4 bg-blue-50 rounded-xl">
                <div className="flex items-center mb-2">
                  <span className="text-blue-600 mr-2">💡</span>
                  <h4 className="font-semibold text-blue-900">Plus More</h4>
                </div>
                <p className="text-sm text-blue-800">
                  Timeline editing, multi-track support, transitions, effects, and everything you need for professional video editing.
                </p>
              </div>
              
              <button
                onClick={() => setShowEditorFeatures(false)}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Features Modal */}
      {showAIFeatures && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">✨</span>
                  <h2 className="text-2xl font-bold text-gray-900">AI Features</h2>
                </div>
                <button
                  onClick={() => setShowAIFeatures(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <p className="text-gray-600 mb-6">
                Use your credits to unlock powerful AI features that enhance your video editing workflow.
              </p>
              
              <div className="grid gap-4">
                {aiFeatures.map((feature, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{feature.name}</h3>
                      <p className="text-sm text-gray-600">{feature.description}</p>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="text-lg font-bold text-blue-600">{feature.cost}</div>
                      <div className="text-xs text-gray-500">credits</div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-4 bg-blue-50 rounded-xl">
                <div className="flex items-center mb-2">
                  <span className="text-blue-600 mr-2">💡</span>
                  <h4 className="font-semibold text-blue-900">Pro Tip</h4>
                </div>
                <p className="text-sm text-blue-800">
                  Credits reset monthly, so you always have fresh AI power to work with. 
                  Start with a smaller pack and upgrade as needed!
                </p>
              </div>
              
              <button
                onClick={() => setShowAIFeatures(false)}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors"
              >
                Got it!
              </button>
            </div>
            </div>
        </div>
      )}
        </div>
    );
} 