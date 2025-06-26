'use client';

import React, { useState } from 'react';
import HomeNavbar from '@/components/home/HomeNavbar';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
}

interface Bundle {
  id: string;
  name: string;
  description: string;
  items: { name: string; quantity: number }[];
  originalPrice: number;
  bundlePrice: number;
  savings: number;
}

export default function PricingPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null);

  const aiFeatures = [
    {
      id: 'smart-cut',
      name: 'Smart Cut',
      price: 2.00,
      unit: 'per video',
      description: 'AI-powered video editing with automatic cuts and transitions',
      icon: '✂️',
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'ai-voiceover',
      name: 'AI Voiceover',
      price: 0.50,
      unit: 'per minute',
      description: 'Natural-sounding AI voice generation in multiple languages',
      icon: '🎤',
      color: 'from-purple-500 to-purple-600'
    },
    {
      id: 'ai-images',
      name: 'AI Images',
      price: 0.25,
      unit: 'per image',
      description: 'AI-generated images, graphics, and visual elements',
      icon: '🎨',
      color: 'from-pink-500 to-pink-600'
    },
    {
      id: 'video-generation',
      name: 'Video Generation',
      price: 4.00,
      unit: 'per 5-second clip',
      description: 'AI-generated video clips using state-of-the-art models',
      icon: '🎬',
      color: 'from-emerald-500 to-emerald-600'
    }
  ];

  const bundles: Bundle[] = [
    {
      id: 'starter',
      name: 'Content Creator',
      description: 'Perfect for regular content creation',
      items: [
        { name: 'Smart Cut', quantity: 10 },
        { name: 'AI Voiceover', quantity: 30 },
        { name: 'AI Images', quantity: 20 }
      ],
      originalPrice: 32.50,
      bundlePrice: 25.00,
      savings: 7.50
    },
    {
      id: 'pro',
      name: 'Professional',
      description: 'For serious video creators and teams',
      items: [
        { name: 'Smart Cut', quantity: 25 },
        { name: 'AI Voiceover', quantity: 60 },
        { name: 'AI Images', quantity: 50 },
        { name: 'Video Generation', quantity: 5 }
      ],
      originalPrice: 87.50,
      bundlePrice: 65.00,
      savings: 22.50
    }
  ];

  const addToCart = (feature: typeof aiFeatures[0], quantity: number = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === feature.id);
      if (existing) {
        return prev.map(item =>
          item.id === feature.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, {
        id: feature.id,
        name: feature.name,
        price: feature.price,
        quantity,
        unit: feature.unit
      }];
    });
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== id));
    } else {
      setCart(prev => prev.map(item =>
        item.id === id ? { ...item, quantity } : item
      ));
    }
  };

  const selectBundle = (bundleId: string) => {
    const bundle = bundles.find(b => b.id === bundleId);
    if (!bundle) return;

    setSelectedBundle(bundleId);
    setCart([]);
    
    // Add bundle items to cart
    bundle.items.forEach(item => {
      const feature = aiFeatures.find(f => f.name === item.name);
      if (feature) {
        addToCart(feature, item.quantity);
      }
    });
  };

  const getTotalPrice = () => {
    const itemsTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    if (selectedBundle) {
      const bundle = bundles.find(b => b.id === selectedBundle);
      return bundle ? bundle.bundlePrice : itemsTotal;
    }
    
    return itemsTotal;
  };

  const getSavings = () => {
    if (selectedBundle) {
      const bundle = bundles.find(b => b.id === selectedBundle);
      return bundle ? bundle.savings : 0;
    }
    return 0;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <HomeNavbar />
      
      <div className="max-w-7xl mx-auto px-4 pt-32 pb-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 via-teal-500 to-emerald-400 rounded-2xl mb-6 shadow-lg">
            <span className="text-2xl">🍋</span>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-teal-600 to-emerald-600 bg-clip-text text-transparent mb-6">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
            Start with everything you need, then pay only for the AI features you use. 
            No surprises, no waste - just powerful tools when you need them.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Foundation Plan */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 via-teal-500 to-emerald-400 rounded-2xl flex items-center justify-center mr-6 shadow-lg">
                    <span className="text-2xl">🏗️</span>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">Foundation Plan</h2>
                    <p className="text-gray-600 text-lg">Everything you need to get started</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-teal-600 bg-clip-text text-transparent">$5</div>
                  <div className="text-gray-500 font-medium">/month</div>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex items-center p-4 bg-gray-50 rounded-xl">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-4">
                    <span className="text-green-600 font-bold">✓</span>
                  </div>
                  <span className="font-medium text-gray-800">Unlimited Projects</span>
                </div>
                <div className="flex items-center p-4 bg-gray-50 rounded-xl">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-4">
                    <span className="text-green-600 font-bold">✓</span>
                  </div>
                  <span className="font-medium text-gray-800">Cloud Storage</span>
                </div>
                <div className="flex items-center p-4 bg-gray-50 rounded-xl">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-4">
                    <span className="text-green-600 font-bold">✓</span>
                  </div>
                  <span className="font-medium text-gray-800">Full Video Editor</span>
                </div>
                <div className="flex items-center p-4 bg-gray-50 rounded-xl">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-4">
                    <span className="text-green-600 font-bold">✓</span>
                  </div>
                  <span className="font-medium text-gray-800">400 Assistant Messages</span>
                </div>
              </div>
            </div>

            {/* AI Features Menu */}
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
              <div className="flex items-center mb-8">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mr-6 shadow-lg">
                  <span className="text-2xl">🤖</span>
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">AI Features</h2>
                  <p className="text-gray-600 text-lg">Pay only for what you use</p>
                </div>
              </div>
              
              <div className="grid gap-6">
                {aiFeatures.map((feature) => (
                  <div key={feature.id} className="group p-6 border border-gray-200 rounded-2xl hover:border-gray-300 hover:shadow-lg transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center flex-1">
                        <div className={`w-12 h-12 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mr-4 shadow-md`}>
                          <span className="text-xl">{feature.icon}</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-gray-900 mb-1">{feature.name}</h3>
                          <p className="text-gray-600 text-sm mb-2">{feature.description}</p>
                          <div className="flex items-baseline">
                            <span className="text-2xl font-bold text-gray-900">${feature.price}</span>
                            <span className="text-gray-500 ml-2 font-medium">{feature.unit}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3 ml-6">
                        <button
                          onClick={() => addToCart(feature, 1)}
                          className="bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                          Add 1
                        </button>
                        <button
                          onClick={() => addToCart(feature, 5)}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-xl font-semibold transition-all duration-200"
                        >
                          +5
                        </button>
                        <button
                          onClick={() => addToCart(feature, 10)}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-xl font-semibold transition-all duration-200"
                        >
                          +10
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Smart Bundles */}
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center">
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mr-6 shadow-lg">
                    <span className="text-2xl">📦</span>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">Smart Bundles</h2>
                    <p className="text-gray-600 text-lg">Save more with bundles</p>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                  UP TO 25% OFF
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                {bundles.map((bundle) => (
                  <div 
                    key={bundle.id} 
                    className={`relative p-6 rounded-2xl cursor-pointer transition-all duration-300 transform hover:scale-105 ${
                      selectedBundle === bundle.id 
                        ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-400 shadow-xl' 
                        : 'bg-gray-50 border-2 border-gray-200 hover:border-gray-300 hover:shadow-lg'
                    }`}
                    onClick={() => selectBundle(bundle.id)}
                  >
                    {selectedBundle === bundle.id && (
                      <div className="absolute -top-3 -right-3 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-white text-sm font-bold">✓</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xl font-bold text-gray-900">{bundle.name}</h3>
                      <div className="text-right">
                        <div className="text-sm text-gray-500 line-through">${bundle.originalPrice}</div>
                        <div className="text-2xl font-bold text-green-600">${bundle.bundlePrice}</div>
                      </div>
                    </div>
                    
                    <p className="text-gray-600 mb-4">{bundle.description}</p>
                    
                    <div className="space-y-2 mb-4">
                      {bundle.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                          <span className="text-gray-700">{item.name}</span>
                          <span className="font-semibold text-gray-900">{item.quantity}x</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-center py-3 rounded-xl font-bold shadow-lg">
                      Save ${bundle.savings}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Shopping Cart */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl shadow-xl p-6 sticky top-24 border border-gray-100">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                  <span className="text-xl">🛒</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Your Order</h2>
              </div>
              
              {/* Foundation Plan in Cart */}
              <div className="bg-gradient-to-r from-blue-50 to-teal-50 p-4 rounded-xl mb-6 border border-blue-200">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-gray-900">Foundation Plan</div>
                    <div className="text-sm text-gray-600">Monthly subscription</div>
                  </div>
                  <div className="text-xl font-bold text-blue-600">$5.00</div>
                </div>
              </div>

              {/* Selected Bundle */}
              {selectedBundle && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4 mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-green-800">
                      {bundles.find(b => b.id === selectedBundle)?.name} Bundle
                    </span>
                    <button 
                      onClick={() => {setSelectedBundle(null); setCart([]);}}
                      className="text-green-600 hover:text-green-800 w-6 h-6 rounded-full bg-green-100 hover:bg-green-200 flex items-center justify-center transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="text-sm text-green-700 font-medium">Bundle savings applied!</div>
                </div>
              )}
              
              {/* Cart Items */}
              {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-6xl mb-4 opacity-50">🎯</div>
                  <p className="font-medium text-gray-600">No AI features selected</p>
                  <p className="text-sm text-gray-500 mt-1">Add features from the menu above</p>
                </div>
              ) : (
                <div className="space-y-4 mb-6">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{item.name}</div>
                        <div className="text-sm text-gray-600">${item.price} {item.unit}</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-8 h-8 rounded-full bg-white border-2 border-gray-200 hover:border-gray-300 flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors"
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-bold text-gray-900">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-8 h-8 rounded-full bg-white border-2 border-gray-200 hover:border-gray-300 flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors"
                        >
                          +
                        </button>
                      </div>
                      <div className="ml-4 font-bold text-gray-900 w-16 text-right">
                        ${(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Total */}
              <div className="border-t-2 border-gray-100 pt-6">
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Foundation Plan</span>
                    <span className="font-semibold">$5.00</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">AI Features</span>
                    <span className="font-semibold">${getTotalPrice().toFixed(2)}</span>
                  </div>
                  {getSavings() > 0 && (
                    <div className="flex justify-between items-center text-green-600">
                      <span className="font-medium">Bundle Savings</span>
                      <span className="font-semibold">-${getSavings().toFixed(2)}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between items-center text-2xl font-bold border-t-2 border-gray-100 pt-4 mb-6">
                  <span>Total Monthly</span>
                  <span className="bg-gradient-to-r from-blue-600 to-teal-600 bg-clip-text text-transparent">
                    ${(5 + getTotalPrice()).toFixed(2)}
                  </span>
                </div>
                
                <button className="w-full bg-gradient-to-r from-blue-500 via-teal-500 to-emerald-400 hover:from-blue-600 hover:via-teal-600 hover:to-emerald-500 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 mb-4">
                  Get Started Now
                </button>
                
                <p className="text-xs text-gray-500 text-center leading-relaxed">
                  Start with Foundation Plan. AI features are charged only when used. Cancel anytime.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Trust & FAQ Section */}
        <div className="mt-20 grid md:grid-cols-2 gap-8">
          {/* Trust Indicators */}
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              <span className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-green-600">🛡️</span>
              </span>
              Why Choose Lemona?
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-1">
                  <span className="text-blue-600 text-sm">✓</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">No Hidden Fees</div>
                  <div className="text-gray-600 text-sm">What you see is what you pay. Always.</div>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-1">
                  <span className="text-blue-600 text-sm">✓</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Cancel Anytime</div>
                  <div className="text-gray-600 text-sm">No contracts, no commitments.</div>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-1">
                  <span className="text-blue-600 text-sm">✓</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Free Trial</div>
                  <div className="text-gray-600 text-sm">Try AI features before you buy.</div>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              <span className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-purple-600">❓</span>
              </span>
              Common Questions
            </h3>
            
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">How does billing work?</h4>
                <p className="text-gray-600 text-sm">
                  Pay $5/month for the foundation plan, then only pay for AI features you actually use.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Can I change my plan?</h4>
                <p className="text-gray-600 text-sm">
                  Yes! Add or remove AI features anytime. Bundles can be activated monthly.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">What about unused credits?</h4>
                <p className="text-gray-600 text-sm">
                  Bundle credits roll over for up to 3 months, so you never lose what you've paid for.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 