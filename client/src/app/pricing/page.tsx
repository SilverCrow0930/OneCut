'use client';

import React, { useState, useEffect } from 'react';
import HomeNavbar from '@/components/home/HomeNavbar';
import PieChart from '@/components/ui/PieChart';
import { useCredits } from '@/contexts/CreditsContext';
import { useAuth } from '@/contexts/AuthContext';
import { apiPath } from '@/lib/config';

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
  const { credits: currentCredits, maxCredits, subscriptionType, aiAssistantChats, maxAiAssistantChats, isLoading, refreshCredits } = useCredits();
  const { user, session } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showEditorFeatures, setShowEditorFeatures] = useState(false);
  const [showAIFeatures, setShowAIFeatures] = useState(false);
  const [processingSubscription, setProcessingSubscription] = useState(false);
  
  // Refresh credits data on mount and when returning from Stripe
  useEffect(() => {
    const refreshData = async () => {
      try {
        console.log('Checking URL parameters...');
        // Check if we're returning from Stripe
        const urlParams = new URLSearchParams(window.location.search);
        const success = urlParams.get('success');
        
        console.log('URL success parameter:', success);
        console.log('Current subscription type:', subscriptionType);
        console.log('Current max credits:', maxCredits);
        
        if (success === 'true') {
          console.log('Success parameter found, refreshing credits...');
          // Clear the URL parameters
          window.history.replaceState({}, '', window.location.pathname);
          
          // Refresh credits data
          await refreshCredits();
          console.log('Credits refreshed. New subscription type:', subscriptionType);
          console.log('New max credits:', maxCredits);
        }
      } catch (error) {
        console.error('Error in refreshData:', error);
      }
    };

    refreshData();
  }, [refreshCredits, subscriptionType, maxCredits]);

  // Update current subscriptions when subscription type or max credits change
  useEffect(() => {
    console.log('Subscription data changed. Updating current subscriptions...');
    console.log('Subscription type:', subscriptionType);
    console.log('Max credits:', maxCredits);
    setCurrentSubscriptions(getCurrentSubscriptions());
  }, [subscriptionType, maxCredits]);
  
  // Dynamic subscription data based on current subscription type
  const getCurrentSubscriptions = () => {
    const subscriptions = [];
    
    if (subscriptionType === 'editor-plus-credits') {
      let planName = 'Lemona Plan';
      let price = 19;
      
      if (maxCredits === 150) {
        planName = 'Essential';
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
      id: 'price_1Rii7qRutXiJrhxtPbrjNV04', // Essential plan
      name: 'Essential',
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
      id: 'price_1RjQX1RutXiJrhxtK3hMbYB8', // Test plan
      name: 'Test',
      credits: 500,
      price: 1,
      description: 'Limited time experimental access',
      type: 'credits',
      features: [
        'Complete Video Editor',
        '500 AI Credits',
        'Unlimited AI Assistant',
        'Early Access Features'
      ]
    },
    {
      id: 'price_1RiinCRutXiJrhxtgS1H7URs', // Creator plan
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
      id: 'price_1RiimLRutXiJrhxtqRr9Iw2l', // Pro plan
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
      id: 'price_1RiikLRutXiJrhxtK3hMbYB8', // Enterprise plan
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
    { name: 'AI Assistant Chat', cost: 1 },
    { name: 'Smart Cut', cost: 20 },
    { name: 'AI Voiceover', cost: 5 },
    { name: 'Auto Captions', cost: 8 },
    { name: 'AI Images', cost: 3 },
    { name: 'Video Generation', cost: 30 },
    { name: 'Background Removal', cost: 12 },
    { name: 'Style Transfer', cost: 15 },
    { name: 'Audio Enhancement', cost: 6 }
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
      const response = await fetch(apiPath('subscriptions/cancel'), {
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
      const response = await fetch(apiPath('subscriptions/create-checkout-session'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ planId })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to start subscription process';
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.error('[Client] Error parsing error response:', e);
        }
        
        alert(errorMessage);
        return;
      }

      const data = await response.json();
      
      if (!data.url) {
        alert('No checkout URL received. Please try again.');
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
      
    } catch (error) {
      console.error('[Client] Network error:', error);
      alert('Network error occurred. Please check your connection and try again.');
    } finally {
      setProcessingSubscription(false);
    }
  };

  const creditPercentage = (currentCredits / maxCredits) * 100;

  const getPlanButtonState = (plan: Plan) => {
    if (!subscriptionType || !maxCredits) return { label: `Start with ${plan.name}`, disabled: false };
    if (plan.credits === maxCredits) {
      return { label: 'Current Plan', disabled: true };
    } else if (plan.credits > maxCredits) {
      return { label: `Upgrade to ${plan.name}`, disabled: false };
    } else {
      return { label: `Switch to ${plan.name}`, disabled: false };
    }
  };

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
            <div>
          {/* Choose a Plan */}
            <div>
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 via-emerald-500 via-cyan-400 via-blue-500 to-emerald-600 bg-clip-text text-transparent mb-4 animate-gradient-x">
                Choose Your Plan
              </h2>
              <p className="text-gray-600 text-lg max-w-2xl mx-auto mb-6">
                Start creating amazing content with our AI-powered video editor
              </p>
                <button
                  onClick={() => setShowAIFeatures(!showAIFeatures)}
                  className="inline-flex items-center px-4 py-2 bg-white/70 backdrop-blur-sm rounded-full border border-white/30 text-blue-600 hover:text-blue-700 font-medium text-sm transition-all duration-200 hover:bg-white/80 shadow-md"
                >
                  {showAIFeatures ? 'Hide' : 'Show'} AI features & cost
                  <svg className={`w-4 h-4 ml-2 transition-transform ${showAIFeatures ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* AI Features Expandable Section */}
              {showAIFeatures && (
                <div className="mb-12 p-6 bg-gradient-to-r from-blue-50/50 to-purple-50/50 rounded-2xl border border-blue-100/50 backdrop-blur-sm">

                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
                    {aiFeatures.map((feature, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-white/60 backdrop-blur-sm rounded-xl border border-white/40 hover:bg-white/70 transition-all duration-200">
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900 text-sm">{feature.name}</h5>
                        </div>
                        <div className="ml-3 text-right">
                          <div className="text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{feature.cost}</div>
                          <div className="text-xs text-gray-400">credits</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-[95%] mx-auto">
              {plans.map((plan) => {
                const { label, disabled } = getPlanButtonState(plan);
                return (
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
                    {plan.features.slice(0, 4).map((feature, idx) => (
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
                      disabled={processingSubscription || disabled}
                      className={`w-full font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed 
                        ${disabled ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'}`}
                  >
                      {processingSubscription && !disabled ? 'Processing...' : label}
                  </button>
                  </div>
                );
              })}
            </div>
            </div>

                {/* User Testimonials */}
        <div className="mt-24 mb-16">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 via-emerald-500 via-cyan-400 via-blue-500 to-emerald-600 bg-clip-text text-transparent mb-4 animate-gradient-x">
              What Our Users Say
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              Join thousands of creators who are already using Lemona
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {/* Testimonial 1 */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  S
                </div>
                <div className="ml-4">
                  <h4 className="font-semibold text-gray-900">Sarah Chen</h4>
                  <p className="text-sm text-gray-600">Content Creator</p>
                </div>
              </div>
              <p className="text-gray-700 mb-4">
                "Lemona has completely transformed my workflow. The AI features save me hours of editing time, and the quality is incredible. I've grown my channel by 300% since using it!"
              </p>
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  M
                </div>
                <div className="ml-4">
                  <h4 className="font-semibold text-gray-900">Marcus Rodriguez</h4>
                  <p className="text-sm text-gray-600">Marketing Manager</p>
                </div>
              </div>
              <p className="text-gray-700 mb-4">
                "As a marketing professional, I need to create content fast. Lemona's AI assistant and smart cut features are game-changers. What used to take me a full day now takes 30 minutes."
              </p>
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  A
                </div>
                <div className="ml-4">
                  <h4 className="font-semibold text-gray-900">Alex Thompson</h4>
                  <p className="text-sm text-gray-600">YouTuber</p>
                </div>
              </div>
              <p className="text-gray-700 mb-4">
                "I was skeptical about AI editing tools, but Lemona proved me wrong. The voiceover feature sounds so natural, and the auto captions are 99% accurate. It's like having a full editing team!"
              </p>
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>

            {/* Testimonial 4 */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  J
                </div>
                <div className="ml-4">
                  <h4 className="font-semibold text-gray-900">Jessica Park</h4>
                  <p className="text-sm text-gray-600">Small Business Owner</p>
                </div>
              </div>
              <p className="text-gray-700 mb-4">
                "Running a small business means wearing many hats. Lemona helps me create professional marketing videos without needing a big budget or technical skills. The ROI has been amazing!"
              </p>
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>

            {/* Testimonial 5 */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  D
                </div>
                <div className="ml-4">
                  <h4 className="font-semibold text-gray-900">David Kim</h4>
                  <p className="text-sm text-gray-600">Video Editor</p>
                </div>
              </div>
              <p className="text-gray-700 mb-4">
                "As a professional editor, I was worried AI would replace me. Instead, Lemona has made me more efficient and creative. I can focus on the artistic vision while AI handles the tedious work."
              </p>
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>

            {/* Testimonial 6 */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  R
                </div>
                <div className="ml-4">
                  <h4 className="font-semibold text-gray-900">Rachel Davis</h4>
                  <p className="text-sm text-gray-600">Course Creator</p>
                </div>
              </div>
              <p className="text-gray-700 mb-4">
                "Creating educational content for my online courses used to be so time-consuming. Lemona's AI features, especially the auto captions and voiceover, have revolutionized my content creation process."
              </p>
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>
            </div>
            </div>
        </div>
      </main>
        </div>
    );
} 