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

interface AIFeature {
  id: string;
  name: string;
  cost: number;
  unit: string;
  description: string;
  icon: string;
}

export default function PricingPage() {
  // Simulated user data - in real app this would come from auth/user context
  const [currentCredits] = useState(47);
  const [maxCredits] = useState(150); // Based on current subscriptions
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Simulated current subscriptions - in real app this would come from user's subscription data
  const [currentSubscriptions, setCurrentSubscriptions] = useState([
    {
      id: 'foundation-active',
      name: 'Foundation Plan',
      credits: 10,
      price: 5,
      type: 'foundation' as const,
      nextBilling: '2024-02-15',
      status: 'active'
    },
    {
      id: 'creator-credits-active',
      name: 'Creator Credits',
      credits: 150,
      price: 20,
      type: 'credits' as const,
      nextBilling: '2024-02-15',
      status: 'active'
    }
  ]);

  const plans: Plan[] = [
    {
      id: 'foundation',
      name: 'Foundation Plan',
      credits: 10,
      price: 5,
      description: 'Everything you need to get started',
      type: 'foundation',
      features: [
        'Unlimited Projects',
        'Cloud Storage (10GB)',
        'Full Video Editor',
        'Basic Export (1080p)',
        'Community Support',
        '10 AI Credits/month'
      ]
    },
    {
      id: 'starter-credits',
      name: 'Starter Credits',
      credits: 50,
      price: 8,
      description: 'Extra credits for light AI usage',
      type: 'credits',
      features: [
        '50 AI Credits/month',
        'Use across all AI features',
        'Credits reset monthly',
        'Cancel anytime'
      ]
    },
    {
      id: 'creator-credits',
      name: 'Creator Credits',
      credits: 150,
      price: 20,
      description: 'Perfect for regular content creation',
      type: 'credits',
      popular: true,
      features: [
        '150 AI Credits/month',
        'Use across all AI features',
        'Credits reset monthly',
        'Priority support',
        'Cancel anytime'
      ]
    },
    {
      id: 'pro-credits',
      name: 'Pro Credits',
      credits: 400,
      price: 45,
      description: 'For power users and teams',
      type: 'credits',
      features: [
        '400 AI Credits/month',
        'Use across all AI features',
        'Credits reset monthly',
        'Priority support',
        'Early access to features',
        'Cancel anytime'
      ]
    },
    {
      id: 'enterprise-credits',
      name: 'Enterprise Credits',
      credits: 1000,
      price: 100,
      description: 'Maximum credits for heavy usage',
      type: 'credits',
      features: [
        '1000 AI Credits/month',
        'Use across all AI features',
        'Credits reset monthly',
        'Dedicated support',
        'Early access to features',
        'Custom integrations',
        'Cancel anytime'
      ]
    }
  ];

  const aiFeatures: AIFeature[] = [
    {
      id: 'smart-cut',
      name: 'Smart Cut',
      cost: 15,
      unit: 'per video',
      description: 'AI-powered video editing with automatic cuts and transitions',
      icon: '✂️'
    },
    {
      id: 'ai-voiceover',
      name: 'AI Voiceover',
      cost: 3,
      unit: 'per minute',
      description: 'Natural-sounding AI voice generation',
      icon: '🎤'
    },
    {
      id: 'ai-images',
      name: 'AI Images',
      cost: 2,
      unit: 'per image',
      description: 'AI-generated images and graphics',
      icon: '🎨'
    },
    {
      id: 'video-generation',
      name: 'Video Generation',
      cost: 25,
      unit: 'per 5-second clip',
      description: 'AI-generated video clips using advanced models',
      icon: '🎬'
    },
    {
      id: 'auto-captions',
      name: 'Auto Captions',
      cost: 5,
      unit: 'per video',
      description: 'Automatic caption generation and styling',
      icon: '📝'
    },
    {
      id: 'background-removal',
      name: 'Background Removal',
      cost: 8,
      unit: 'per video',
      description: 'AI-powered background removal and replacement',
      icon: '🖼️'
    }
  ];

  const addToCart = (plan: Plan) => {
    setCart(prev => {
      const existing = prev.find(item => item.plan.id === plan.id);
      if (existing) {
        // Foundation plan can only be bought once
        if (plan.type === 'foundation') {
          return prev;
        }
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <HomeNavbar />

      <div className="max-w-7xl mx-auto px-4 pt-32 pb-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Simple Monthly Pricing
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Start with our foundation plan, then add credit subscriptions for AI features. Everything billed monthly.
          </p>
        </div>

        {/* Current Status Display */}
        <div className="grid md:grid-cols-2 gap-6 mb-8 max-w-4xl mx-auto">
          {/* Current Credits */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Your Credits</h3>
              <span className="text-2xl font-bold text-blue-600">{currentCredits}</span>
            </div>
            
            {/* Credit Bar */}
            <div className="relative">
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${creditPercentage}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>0</span>
                <span className="font-medium">{currentCredits} / {maxCredits} credits</span>
                <span>{maxCredits}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 text-center mt-2">Credits reset monthly</p>
          </div>

          {/* Current Plans */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Plans</h3>
            
            {currentSubscriptions.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <p className="text-sm">No active subscriptions</p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentSubscriptions.map((subscription) => (
                  <div key={subscription.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 text-sm">{subscription.name}</h4>
                        <p className="text-xs text-gray-600">
                          {subscription.credits} credits/month • ${subscription.price}/month
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {subscription.status === 'active' ? (
                          <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
                            Active
                          </span>
                        ) : (
                          <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full">
                            Cancelled
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        {subscription.status === 'active' 
                          ? `Next billing: ${subscription.nextBilling}`
                          : 'Ends at current period'
                        }
                      </p>
                      {subscription.status === 'active' && (
                        <button
                          onClick={() => cancelSubscription(subscription.id)}
                          className="text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Monthly Total:</span>
                <span className="font-semibold text-gray-900">
                  ${currentSubscriptions
                    .filter(sub => sub.status === 'active')
                    .reduce((sum, sub) => sum + sub.price, 0)
                  }/month
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Plans Section */}
          <div className="lg:col-span-3 space-y-8">
            {/* Foundation Plan */}
            {foundationPlan && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Foundation Plan
                </h2>
                
                <div className="border-2 border-blue-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{foundationPlan.name}</h3>
                      <p className="text-gray-600">{foundationPlan.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-blue-600">${foundationPlan.price}</div>
                      <div className="text-sm text-gray-500">/month</div>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-3 mb-6">
                    {foundationPlan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center">
                        <span className="text-green-500 mr-3">✓</span>
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                  
                  <button 
                    onClick={() => addToCart(foundationPlan)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            )}

            {/* Credit Plans */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Credit Subscriptions
                <span className="ml-3 text-sm font-normal text-gray-500">Monthly billing</span>
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                {creditPlans.map((plan) => (
                  <div 
                    key={plan.id} 
                    className={`relative border-2 rounded-xl p-6 transition-all hover:border-purple-300 ${
                      plan.popular ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-purple-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                          Most Popular
                        </span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                        <p className="text-gray-600 text-sm">{plan.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-purple-600">${plan.price}</div>
                        <div className="text-xs text-gray-500">/month</div>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <div className="text-lg font-semibold text-purple-600 mb-2">
                        {plan.credits} credits/month
                      </div>
                      <ul className="space-y-1">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="text-sm text-gray-600 flex items-center">
                            <span className="text-green-500 mr-2">✓</span>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <button 
                      onClick={() => addToCart(plan)}
                      className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                        plan.popular 
                          ? 'bg-purple-600 hover:bg-purple-700 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      Add to Cart
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Features */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                AI Features
                <span className="ml-3 text-sm font-normal text-gray-500">Use your credits</span>
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                {aiFeatures.map((feature) => (
                  <div key={feature.id} className="border border-gray-200 rounded-xl p-6 hover:border-gray-300 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">{feature.icon}</span>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{feature.name}</h3>
                          <p className="text-gray-600 text-sm">{feature.description}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="text-xl font-bold text-purple-600">{feature.cost}</span>
                        <span className="text-gray-500 ml-1 text-sm">credits {feature.unit}</span>
                      </div>
                      <button 
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          currentCredits >= feature.cost
                            ? 'bg-purple-100 hover:bg-purple-200 text-purple-700'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                        disabled={currentCredits < feature.cost}
                      >
                        {currentCredits >= feature.cost ? 'Use Feature' : 'Need Credits'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cart Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <span className="mr-3">🛒</span>
                Your Cart
              </h2>
              
              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">🛒</div>
                  <p className="text-sm">Your cart is empty</p>
                  <p className="text-xs">Add plans to get started</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {cart.map((item) => (
                      <div key={item.plan.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{item.plan.name}</h4>
                            <p className="text-sm text-gray-600">{item.plan.credits} credits/month</p>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.plan.id)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            ✕
                          </button>
                        </div>
                        
                                                 <div className="flex items-center justify-between">
                           {item.plan.type === 'foundation' ? (
                             <div className="text-sm text-gray-500">
                               Single subscription
                             </div>
                           ) : (
                             <div className="flex items-center space-x-2">
                               <button
                                 onClick={() => updateQuantity(item.plan.id, item.quantity - 1)}
                                 className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 text-sm"
                               >
                                 −
                               </button>
                               <span className="w-8 text-center font-medium">{item.quantity}</span>
                               <button
                                 onClick={() => updateQuantity(item.plan.id, item.quantity + 1)}
                                 className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 text-sm"
                               >
                                 +
                               </button>
                             </div>
                           )}
                           <div className="font-semibold text-gray-900">
                             ${(item.plan.price * item.quantity).toFixed(2)}
                           </div>
                         </div>
                      </div>
                    ))}
                  </div>

                  {/* Cart Summary */}
                  <div className="border-t border-gray-200 pt-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total Credits</span>
                      <span className="font-medium">{getTotalCredits()}/month</span>
                    </div>
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Monthly Total</span>
                      <span>${getTotalPrice().toFixed(2)}</span>
                    </div>
                  </div>

                  <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-xl mt-6 transition-colors">
                    Subscribe Now
                  </button>
                  
                  <p className="text-xs text-gray-500 text-center mt-4">
                    All plans billed monthly • Cancel anytime
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Frequently Asked Questions
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">How does monthly billing work?</h3>
              <p className="text-gray-600 text-sm">
                All plans are billed monthly on the same date. Your credits reset each month, 
                giving you a fresh allocation to use across all AI features.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">What happens to unused credits?</h3>
              <p className="text-gray-600 text-sm">
                Credits reset each month as part of your subscription. This keeps pricing predictable 
                and ensures you always have fresh credits available.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Can I change my plan anytime?</h3>
              <p className="text-gray-600 text-sm">
                Yes! You can upgrade, downgrade, or cancel anytime. Changes take effect on your 
                next billing cycle.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Is there a free trial?</h3>
              <p className="text-gray-600 text-sm">
                New users get 7 days free of the Foundation Plan plus 25 bonus credits to try 
                all our AI features.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 