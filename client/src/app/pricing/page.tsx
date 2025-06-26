'use client';

import React, { useState } from 'react';
import HomeNavbar from '@/components/home/HomeNavbar';
import { Check, Zap, Sparkles, Video, Mic, Image, Clock, ArrowRight, ShoppingCart, X } from 'lucide-react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  icon: React.ReactNode;
}

interface Bundle {
  id: string;
  name: string;
  description: string;
  items: { name: string; quantity: number }[];
  originalPrice: number;
  bundlePrice: number;
  savings: number;
  popular?: boolean;
}

export default function PricingPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null);
  const [showCart, setShowCart] = useState(false);

  const aiFeatures = [
    {
      id: 'smart-cut',
      name: 'Smart Cut',
      price: 2.00,
      unit: 'per video',
      description: 'AI-powered video editing with automatic cuts, highlights, and transitions',
      icon: <Video className="w-6 h-6" />,
      features: ['Automatic scene detection', 'Smart highlight extraction', 'Professional transitions', 'Multi-format export']
    },
    {
      id: 'ai-voiceover',
      name: 'AI Voiceover',
      price: 0.50,
      unit: 'per minute',
      description: 'Natural-sounding AI voice generation with multiple voice options',
      icon: <Mic className="w-6 h-6" />,
      features: ['20+ voice options', 'Natural intonation', 'Multiple languages', 'High-quality audio']
    },
    {
      id: 'ai-images',
      name: 'AI Images',
      price: 0.25,
      unit: 'per image',
      description: 'AI-generated images, graphics, and visual elements for your videos',
      icon: <Image className="w-6 h-6" />,
      features: ['Custom graphics', 'Brand-consistent style', 'High resolution', 'Commercial license']
    },
    {
      id: 'video-generation',
      name: 'Video Generation',
      price: 4.00,
      unit: 'per 5-second clip',
      description: 'AI-generated video clips using state-of-the-art models',
      icon: <Sparkles className="w-6 h-6" />,
      features: ['Photorealistic quality', 'Custom prompts', '4K resolution', 'Multiple styles']
    }
  ];

  const bundles: Bundle[] = [
    {
      id: 'creator',
      name: 'Content Creator',
      description: 'Perfect for regular content creation and social media',
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
      id: 'professional',
      name: 'Professional',
      description: 'For serious creators and small businesses',
      items: [
        { name: 'Smart Cut', quantity: 25 },
        { name: 'AI Voiceover', quantity: 60 },
        { name: 'AI Images', quantity: 50 },
        { name: 'Video Generation', quantity: 5 }
      ],
      originalPrice: 87.50,
      bundlePrice: 65.00,
      savings: 22.50,
      popular: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'For agencies and large-scale content production',
      items: [
        { name: 'Smart Cut', quantity: 100 },
        { name: 'AI Voiceover', quantity: 200 },
        { name: 'AI Images', quantity: 150 },
        { name: 'Video Generation', quantity: 20 }
      ],
      originalPrice: 310.00,
      bundlePrice: 199.00,
      savings: 111.00
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
        unit: feature.unit,
        icon: feature.icon
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
    
    bundle.items.forEach(item => {
      const feature = aiFeatures.find(f => f.name === item.name);
      if (feature) {
        addToCart(feature, item.quantity);
      }
    });
    setShowCart(true);
  };

  const clearBundle = () => {
    setSelectedBundle(null);
    setCart([]);
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

  const getCartItemCount = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <HomeNavbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16">
        {/* Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 mb-6 shadow-sm">
            <Zap className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Pricing</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Pay for what you 
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> actually use</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Start with our foundation plan for unlimited projects and storage, then add AI features only when you need them. No waste, no surprises.
          </p>
        </div>

        {/* Foundation Plan */}
        <div className="mb-20">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
              <div className="flex items-center justify-between text-white">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Foundation Plan</h2>
                  <p className="text-blue-100">Everything you need to get started</p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold">$5</div>
                  <div className="text-blue-100">/month</div>
                </div>
              </div>
            </div>
            
            <div className="p-8">
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { icon: <Video className="w-5 h-5" />, title: 'Unlimited Projects', desc: 'Create as many projects as you need' },
                  { icon: <Clock className="w-5 h-5" />, title: 'Cloud Storage', desc: '50GB of secure cloud storage' },
                  { icon: <Sparkles className="w-5 h-5" />, title: 'Full Video Editor', desc: 'Professional editing tools' },
                  { icon: <Mic className="w-5 h-5" />, title: '400 Assistant Messages', desc: 'AI-powered editing assistance' }
                ].map((feature, idx) => (
                  <div key={idx} className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-blue-100 to-purple-100 rounded-xl flex items-center justify-center text-blue-600">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">{feature.title}</h3>
                      <p className="text-sm text-gray-600">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Smart Bundles */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Smart Bundles
              <span className="ml-3 inline-flex items-center gap-1 bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full font-medium">
                <Sparkles className="w-4 h-4" />
                Save More
              </span>
            </h2>
            <p className="text-lg text-gray-600">Pre-configured packages for different usage levels</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {bundles.map((bundle) => (
              <div 
                key={bundle.id} 
                className={`relative bg-white rounded-3xl shadow-lg border-2 transition-all duration-300 hover:shadow-xl ${
                  bundle.popular 
                    ? 'border-gradient-to-r from-blue-500 to-purple-500 border-blue-500 transform scale-105' 
                    : 'border-gray-200 hover:border-gray-300'
                } ${selectedBundle === bundle.id ? 'ring-4 ring-blue-500 ring-opacity-50' : ''}`}
              >
                {bundle.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-full text-sm font-semibold">
                      Most Popular
                    </div>
                  </div>
                )}
                
                <div className="p-8">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{bundle.name}</h3>
                    <p className="text-gray-600 text-sm mb-4">{bundle.description}</p>
                    
                    <div className="flex items-center justify-center space-x-2 mb-4">
                      <span className="text-2xl text-gray-400 line-through">${bundle.originalPrice}</span>
                      <span className="text-4xl font-bold text-gray-900">${bundle.bundlePrice}</span>
                    </div>
                    
                    <div className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full font-medium">
                      <Sparkles className="w-3 h-3" />
                      Save ${bundle.savings}
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-8">
                    {bundle.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <span className="text-gray-700">{item.name}</span>
                        <span className="font-semibold text-gray-900">{item.quantity}x</span>
                      </div>
                    ))}
                  </div>
                  
                  <button
                    onClick={() => selectBundle(bundle.id)}
                    className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-300 ${
                      bundle.popular
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                    }`}
                  >
                    {selectedBundle === bundle.id ? 'Selected' : 'Select Bundle'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Features À La Carte */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              AI Features À La Carte
            </h2>
            <p className="text-lg text-gray-600">Pick exactly what you need, when you need it</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {aiFeatures.map((feature) => (
              <div key={feature.id} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-all duration-300">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-100 to-purple-100 rounded-xl flex items-center justify-center text-blue-600">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">{feature.name}</h3>
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl font-bold text-blue-600">${feature.price}</span>
                        <span className="text-gray-500">{feature.unit}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <p className="text-gray-600 mb-6">{feature.description}</p>
                
                <div className="space-y-2 mb-6">
                  {feature.features.map((item, idx) => (
                    <div key={idx} className="flex items-center space-x-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => addToCart(feature, 1)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-semibold transition-colors duration-300"
                  >
                    Add to Cart
                  </button>
                  <button
                    onClick={() => addToCart(feature, 5)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-3 rounded-xl font-medium transition-colors duration-300"
                  >
                    +5
                  </button>
                  <button
                    onClick={() => addToCart(feature, 10)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-3 rounded-xl font-medium transition-colors duration-300"
                  >
                    +10
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 md:p-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-gray-600">Everything you need to know about our pricing</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                q: "How does billing work?",
                a: "Pay $5/month for the foundation plan, then only pay for AI features you actually use. No surprises, no waste."
              },
              {
                q: "Can I change my usage anytime?",
                a: "Absolutely! Add or remove AI features as needed. Bundles can be activated or deactivated monthly."
              },
              {
                q: "What if I don't use all my bundle credits?",
                a: "Unused bundle credits roll over for up to 3 months, so you never lose what you've paid for."
              },
              {
                q: "Is there a free trial?",
                a: "Yes! New users get 1 free Smart Cut, 5 minutes of AI voiceover, and 3 AI images to try our features."
              },
              {
                q: "Do you offer refunds?",
                a: "We offer a 30-day money-back guarantee on your foundation plan and unused AI feature credits."
              },
              {
                q: "Can I upgrade or downgrade anytime?",
                a: "Yes, you can change your bundle or switch to à la carte pricing at any time. Changes take effect immediately."
              }
            ].map((faq, idx) => (
              <div key={idx} className="space-y-3">
                <h3 className="font-semibold text-gray-900 text-lg">{faq.q}</h3>
                <p className="text-gray-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-8 right-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 z-50"
        >
          <div className="flex items-center space-x-2">
            <ShoppingCart className="w-6 h-6" />
            <span className="bg-white text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
              {getCartItemCount()}
            </span>
          </div>
        </button>
      )}

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Your Order</h2>
                <button
                  onClick={() => setShowCart(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-96">
              {/* Foundation Plan */}
              <div className="border-b border-gray-100 pb-4 mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-gray-900">Foundation Plan</div>
                    <div className="text-sm text-gray-500">Monthly subscription</div>
                  </div>
                  <div className="text-lg font-semibold">$5.00</div>
                </div>
              </div>

              {/* Selected Bundle */}
              {selectedBundle && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-green-800">
                      {bundles.find(b => b.id === selectedBundle)?.name} Bundle
                    </span>
                    <button onClick={clearBundle} className="text-green-600 hover:text-green-800">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-sm text-green-600">Bundle savings applied!</div>
                </div>
              )}
              
              {/* Cart Items */}
              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Your cart is empty</p>
                </div>
              ) : (
                <div className="space-y-4 mb-6">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">
                          {item.icon}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{item.name}</div>
                          <div className="text-sm text-gray-500">${item.price} {item.unit}</div>
                        </div>
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
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Total and Checkout */}
            <div className="p-6 border-t border-gray-200">
              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Foundation Plan</span>
                  <span>$5.00</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">AI Features</span>
                  <span>${getTotalPrice().toFixed(2)}</span>
                </div>
                {getSavings() > 0 && (
                  <div className="flex justify-between items-center text-green-600">
                    <span>Bundle Savings</span>
                    <span>-${getSavings().toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xl font-bold border-t border-gray-200 pt-2">
                  <span>Total Monthly</span>
                  <span>${(5 + getTotalPrice()).toFixed(2)}</span>
                </div>
              </div>
              
              <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-4 px-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl">
                Get Started
              </button>
              
              <p className="text-xs text-gray-500 text-center mt-3">
                You'll only be charged for AI features you actually use
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}