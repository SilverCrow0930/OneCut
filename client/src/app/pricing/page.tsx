'use client';

import React, { useState } from 'react';
import HomeNavbar from '@/components/home/HomeNavbar';
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

interface UserSubscription {
  videoEditor: {
    active: boolean;
    nextBilling: string;
    price: number;
  } | null;
  
  credits: {
    plan: 'starter' | 'creator' | 'pro' | 'enterprise' | null;
    remaining: number;
    monthly: number;
    nextBilling: string;
    price: number;
  } | null;
}

type UserState = 'new' | 'editor-only' | 'credits-only' | 'full-user';

export default function PricingPage() {
  const { user } = useAuth();
  
  // Simulated user subscription data - in real app this would come from API
  const [userSubscription] = useState<UserSubscription>({
    videoEditor: user ? {
      active: true,
      nextBilling: 'Feb 15',
      price: 8
    } : null,
    credits: user ? {
      plan: 'creator',
      remaining: 47,
      monthly: 200,
      nextBilling: 'Feb 15',
      price: 29
    } : null
  });

  // Determine user state
  const getUserState = (): UserState => {
    if (!user) return 'new';
    if (userSubscription.videoEditor?.active && userSubscription.credits?.plan) return 'full-user';
    if (userSubscription.videoEditor?.active && !userSubscription.credits?.plan) return 'editor-only';
    if (!userSubscription.videoEditor?.active && userSubscription.credits?.plan) return 'credits-only';
    return 'new';
  };

  const userState = getUserState();
  const currentCredits = userSubscription.credits?.remaining || 0;
  const maxCredits = userSubscription.credits?.monthly || 200;
  const currentCreditPlan = userSubscription.credits?.plan;
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showEditorFeatures, setShowEditorFeatures] = useState(false);
  const [showAIFeatures, setShowAIFeatures] = useState(false);
  const [showPlanSelector, setShowPlanSelector] = useState(false);
  
  // Legacy simulated data for backward compatibility
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
    // Prevent adding video editor if already have it
    if (plan.type === 'foundation' && userSubscription.videoEditor?.active) {
      console.log('User already has video editor');
      return;
    }
    
    // Prevent adding credit plan if already have one (should use change plan instead)
    if (plan.type === 'credits' && userSubscription.credits?.plan) {
      console.log('User already has a credit plan, use change plan instead');
      return;
    }
    
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

  // Enhanced button logic and plan management
  const getVideoEditorButtonState = () => {
    if (userSubscription.videoEditor?.active) {
      return {
        text: '✅ Active Plan',
        disabled: true,
        className: 'bg-green-100 text-green-700 cursor-not-allowed border-2 border-green-200'
      };
    }
    return {
      text: user ? 'Add to Cart' : 'Start Free Trial',
      disabled: false,
      className: 'bg-blue-600 hover:bg-blue-700 text-white'
    };
  };

  const getCurrentPlanIndex = (planId: string) => {
    return creditPlans.findIndex(plan => plan.id.includes(planId));
  };

  const getCreditButtonState = (plan: Plan) => {
    if (!userSubscription.credits?.plan) {
      return {
        text: user ? 'Add to Cart' : 'Start Free Trial',
        action: () => addToCart(plan),
        disabled: false,
        className: 'bg-gray-900 hover:bg-gray-800 text-white'
      };
    }
    
    if (plan.id.includes(currentCreditPlan || '')) {
      return {
        text: '✅ Current Plan',
        disabled: true,
        className: 'bg-green-100 text-green-700 cursor-not-allowed border-2 border-green-200'
      };
    }
    
    const currentIndex = getCurrentPlanIndex(currentCreditPlan || '');
    const planIndex = getCurrentPlanIndex(plan.id.split('-')[0]);
    
    if (planIndex > currentIndex) {
      return {
        text: 'Upgrade',
        action: () => handlePlanChange(plan.id),
        className: 'bg-blue-600 hover:bg-blue-700 text-white'
      };
    } else if (planIndex < currentIndex) {
      return {
        text: 'Downgrade',
        action: () => handlePlanChange(plan.id),
        className: 'bg-gray-600 hover:bg-gray-700 text-white'
      };
    }
    
    return {
      text: 'Switch Plan',
      action: () => handlePlanChange(plan.id),
      className: 'bg-gray-600 hover:bg-gray-700 text-white'
    };
  };

  const handlePlanChange = (planId: string) => {
    console.log('Changing to plan:', planId);
    // In real app, this would call an API to change the subscription
    // For now, just show a message or update local state
  };

  const getContextualMessage = () => {
    switch (userState) {
      case 'new':
        return "Start with our complete video editor, then add AI credits as you need them.";
      case 'editor-only':
        return "🎉 You have the Video Editor! Add AI credits to unlock powerful features like voiceover and smart editing.";
      case 'credits-only':
        return "⚠️ You have AI credits but need the Video Editor to use them. Add it now to start creating!";
      case 'full-user':
        return "You're all set! Create amazing videos with your editor and AI credits.";
      default:
        return "Start with our complete video editor, then add AI credits as you need them.";
    }
  };

  // Visibility logic for status sections
  const showAICreditsSection = userState === 'full-user' || userState === 'credits-only';
  const showActivePlansSection = userState === 'full-user' || userState === 'editor-only';

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
            {getContextualMessage()}
          </p>
        </div>

        {/* Hero Section for New Users */}
        {userState === 'new' && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-8 mb-12">
            <div className="max-w-3xl">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Create professional videos with AI-powered editing
              </h2>
              <p className="text-gray-600 mb-6">
                Join 10,000+ creators using Lemona to make stunning videos 10x faster. 
                Start with our complete editor, then add AI features as you grow.
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-6">
                <div className="flex items-center">
                  <span className="text-yellow-500 mr-2">⭐⭐⭐⭐⭐</span>
                  <span className="text-sm text-gray-600">4.9/5 from 500+ reviews</span>
                </div>
                <div className="text-sm text-gray-600">
                  🎬 Free 7-day trial • No credit card required
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Current Status - Only show for authenticated users with subscriptions */}
        {(showAICreditsSection || showActivePlansSection) && (
          <div className={`grid ${showAICreditsSection && showActivePlansSection ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-6 mb-12 max-w-4xl`}>
            {/* Enhanced AI Credits Section */}
            {showAICreditsSection && (
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                {/* Header with current plan info */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold text-gray-900">AI Credits</h3>
                    {currentCreditPlan && (
                      <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full capitalize">
                        {currentCreditPlan} Plan
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-blue-600">{currentCredits}</span>
                    <span className="text-sm text-gray-500 ml-1">left</span>
                  </div>
                </div>

                {/* Enhanced Progress Bar */}
                <div className="relative mb-4">
                  <div className="w-full bg-gray-200 rounded-full h-4 relative overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-4 rounded-full transition-all duration-300"
                      style={{ width: `${creditPercentage}%` }}
                    />
                  </div>
                  
                  {/* Usage indicator */}
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0</span>
                    <span className="font-medium">
                      {currentCredits} of {maxCredits} credits
                    </span>
                    <span>{maxCredits}</span>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {/* Usage status */}
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      creditPercentage > 50 
                        ? 'bg-green-100 text-green-700' 
                        : creditPercentage > 20 
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {creditPercentage > 50 ? '✅ Good' : creditPercentage > 20 ? '⚠️ Low' : '🚨 Very Low'}
                    </div>
                    
                    <span className="text-xs text-gray-500">• Resets monthly</span>
                  </div>

                  {/* Quick plan management */}
                  <button
                    onClick={() => setShowPlanSelector(!showPlanSelector)}
                    className="text-xs px-3 py-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                  >
                    {showPlanSelector ? 'Hide Plans' : 'Change Plan'}
                  </button>
                </div>

                {/* Expandable Plan Selector */}
                {showPlanSelector && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <h4 className="font-medium text-gray-900 mb-3">Choose Your Plan</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {creditPlans.map((plan) => {
                        const buttonState = getCreditButtonState(plan);
                        return (
                          <button
                            key={plan.id}
                            onClick={buttonState.action}
                            disabled={buttonState.disabled}
                            className={`p-3 rounded-lg border-2 text-left transition-all ${
                              buttonState.disabled
                                ? 'border-green-200 bg-green-50 cursor-not-allowed'
                                : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">{plan.name}</span>
                              {buttonState.disabled && <span className="text-xs text-green-600">✅</span>}
                            </div>
                            
                            <div className="text-xs text-gray-600 mb-2">
                              {plan.credits} credits/mo
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm">${plan.price}</span>
                              {!buttonState.disabled && (
                                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                                  {buttonState.text}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Active Subscriptions */}
            {showActivePlansSection && (
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Active Plans</h3>
                  <span className="text-2xl font-bold text-gray-900">
                    ${(userSubscription.videoEditor?.price || 0) + (userSubscription.credits?.price || 0)}/mo
                  </span>
                </div>
                <div className="space-y-3">
                  {userSubscription.videoEditor?.active && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">Video Editor</div>
                        <div className="text-sm text-gray-500">Next billing: {userSubscription.videoEditor.nextBilling}</div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="font-semibold text-gray-900">${userSubscription.videoEditor.price}/mo</span>
                        <button
                          onClick={() => console.log('Cancel video editor')}
                          className="text-sm text-red-500 hover:text-red-600 px-3 py-1 rounded-md hover:bg-red-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {userSubscription.credits?.plan && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900 capitalize">{userSubscription.credits.plan} Credits</div>
                        <div className="text-sm text-gray-500">Next billing: {userSubscription.credits.nextBilling}</div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="font-semibold text-gray-900">${userSubscription.credits.price}/mo</span>
                        <button
                          onClick={() => console.log('Cancel credits')}
                          className="text-sm text-red-500 hover:text-red-600 px-3 py-1 rounded-md hover:bg-red-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

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
                    onClick={() => !getVideoEditorButtonState().disabled && addToCart(foundationPlan)}
                    disabled={getVideoEditorButtonState().disabled}
                    className={`w-full font-semibold py-4 px-6 rounded-xl text-lg transition-colors ${getVideoEditorButtonState().className}`}
                  >
                    {getVideoEditorButtonState().text}
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
                      onClick={() => {
                        const buttonState = getCreditButtonState(plan);
                        if (!buttonState.disabled && buttonState.action) {
                          buttonState.action();
                        }
                      }}
                      disabled={getCreditButtonState(plan).disabled}
                      className={`w-full font-semibold py-3 px-4 rounded-lg transition-colors ${getCreditButtonState(plan).className}`}
                    >
                      {getCreditButtonState(plan).text}
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