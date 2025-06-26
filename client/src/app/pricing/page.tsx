'use client';

import React, { useState } from 'react';
import Navbar from '@/components/layout/Navbar';

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
      icon: '✂️'
    },
    {
      id: 'ai-voiceover',
      name: 'AI Voiceover',
      price: 0.50,
      unit: 'per minute',
      description: 'Natural-sounding AI voice generation',
      icon: '🎤'
    },
    {
      id: 'ai-images',
      name: 'AI Images',
      price: 0.25,
      unit: 'per image',
      description: 'AI-generated images and graphics',
      icon: '🎨'
    },
    {
      id: 'video-generation',
      name: 'Video Generation',
      price: 4.00,
      unit: 'per 5-second clip',
      description: 'AI-generated video clips using advanced models',
      icon: '🎬'
    }
  ];

  const bundles: Bundle[] = [
    {
      id: 'starter',
      name: 'Content Creator Bundle',
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
      name: 'Professional Bundle',
      description: 'For serious video creators',
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
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🍋 Lemona Pricing Menu
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Like ordering at your favorite restaurant - pick what you need, when you need it. 
            Start with our foundation plan, then add AI features à la carte.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Foundation Plan */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border-2 border-yellow-200">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mr-4">
                  <span className="text-2xl">🏗️</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Foundation Plan</h2>
                  <p className="text-gray-600">Everything you need to get started</p>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-3xl font-bold text-yellow-600">$5</div>
                  <div className="text-sm text-gray-500">/month</div>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Unlimited Projects</span>
                </div>
                <div className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Cloud Storage</span>
                </div>
                <div className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>Full Video Editor</span>
                </div>
                <div className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  <span>400 Assistant Messages</span>
                </div>
              </div>
            </div>

            {/* AI Features Menu */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <span className="mr-3">🤖</span>
                AI Features Menu
              </h2>
              
              <div className="space-y-6">
                {aiFeatures.map((feature) => (
                  <div key={feature.id} className="border-b border-gray-100 pb-6 last:border-b-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <span className="text-2xl mr-3">{feature.icon}</span>
                          <h3 className="text-lg font-semibold text-gray-900">{feature.name}</h3>
                        </div>
                        <p className="text-gray-600 text-sm mb-3">{feature.description}</p>
                        <div className="flex items-center">
                          <span className="text-2xl font-bold text-blue-600">${feature.price}</span>
                          <span className="text-gray-500 ml-2">{feature.unit}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => addToCart(feature, 1)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          Add to Cart
                        </button>
                        <button
                          onClick={() => addToCart(feature, 5)}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          +5
                        </button>
                        <button
                          onClick={() => addToCart(feature, 10)}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
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
            <div className="mt-8 bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <span className="mr-3">📦</span>
                Smart Bundles
                <span className="ml-3 bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full">Save More</span>
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                {bundles.map((bundle) => (
                  <div 
                    key={bundle.id} 
                    className={`border-2 rounded-xl p-6 cursor-pointer transition-all ${
                      selectedBundle === bundle.id 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => selectBundle(bundle.id)}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">{bundle.name}</h3>
                      <div className="text-right">
                        <div className="text-sm text-gray-500 line-through">${bundle.originalPrice}</div>
                        <div className="text-xl font-bold text-green-600">${bundle.bundlePrice}</div>
                      </div>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-4">{bundle.description}</p>
                    
                    <div className="space-y-2 mb-4">
                      {bundle.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>{item.name}</span>
                          <span className="font-medium">{item.quantity}x</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="bg-green-100 text-green-800 text-sm px-3 py-2 rounded-lg text-center font-medium">
                      Save ${bundle.savings}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Shopping Cart */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <span className="mr-3">🛒</span>
                Your Order
              </h2>
              
              {/* Foundation Plan in Cart */}
              <div className="border-b border-gray-100 pb-4 mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-gray-900">Foundation Plan</div>
                    <div className="text-sm text-gray-500">Monthly subscription</div>
                  </div>
                  <div className="text-lg font-semibold">$5.00</div>
                </div>
              </div>

              {/* Selected Bundle */}
              {selectedBundle && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-green-800">
                      {bundles.find(b => b.id === selectedBundle)?.name}
                    </span>
                    <button 
                      onClick={() => {setSelectedBundle(null); setCart([]);}}
                      className="text-green-600 hover:text-green-800"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="text-sm text-green-600">Bundle savings applied!</div>
                </div>
              )}
              
              {/* Cart Items */}
              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">🍽️</div>
                  <p>Your AI features cart is empty</p>
                  <p className="text-sm">Add some delicious AI features!</p>
                </div>
              ) : (
                <div className="space-y-4 mb-6">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="text-sm text-gray-500">${item.price} {item.unit}</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
                        >
                          +
                        </button>
                      </div>
                      <div className="ml-4 font-semibold text-gray-900 w-16 text-right">
                        ${(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Total */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Foundation Plan</span>
                  <span>$5.00</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">AI Features</span>
                  <span>${getTotalPrice().toFixed(2)}</span>
                </div>
                {getSavings() > 0 && (
                  <div className="flex justify-between items-center mb-2 text-green-600">
                    <span>Bundle Savings</span>
                    <span>-${getSavings().toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-lg font-bold border-t border-gray-200 pt-2">
                  <span>Total Monthly</span>
                  <span>${(5 + getTotalPrice()).toFixed(2)}</span>
                </div>
              </div>
              
              <button className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 px-4 rounded-lg mt-6 transition-colors">
                Get Started
              </button>
              
              <p className="text-xs text-gray-500 text-center mt-4">
                You'll only be charged for AI features you actually use
              </p>
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
              <h3 className="font-semibold text-gray-900 mb-2">How does billing work?</h3>
              <p className="text-gray-600 text-sm">
                Pay $5/month for the foundation plan, then only pay for AI features you actually use. 
                No surprises, no waste.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Can I change my usage anytime?</h3>
              <p className="text-gray-600 text-sm">
                Absolutely! Add or remove AI features as needed. Bundles can be activated or 
                deactivated monthly.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">What if I don't use all my bundle credits?</h3>
              <p className="text-gray-600 text-sm">
                Unused bundle credits roll over for up to 3 months, so you never lose what you've paid for.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Is there a free trial?</h3>
              <p className="text-gray-600 text-sm">
                Yes! New users get 1 free Smart Cut, 5 minutes of AI voiceover, and 3 AI images to try our features.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 