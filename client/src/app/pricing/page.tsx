'use client';

import React, { useState } from 'react';
import HomeNavbar from '@/components/home/HomeNavbar';

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  bonus?: number;
  popular?: boolean;
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
  const [maxCredits] = useState(100);

  const creditPackages: CreditPackage[] = [
    {
      id: 'starter',
      name: 'Starter Pack',
      credits: 50,
      price: 10,
    },
    {
      id: 'popular',
      name: 'Creator Pack',
      credits: 120,
      price: 20,
      bonus: 20,
      popular: true,
    },
    {
      id: 'pro',
      name: 'Pro Pack',
      credits: 300,
      price: 45,
      bonus: 50,
    },
    {
      id: 'enterprise',
      name: 'Enterprise Pack',
      credits: 750,
      price: 100,
      bonus: 150,
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

  const creditPercentage = (currentCredits / maxCredits) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <HomeNavbar />

      <div className="max-w-6xl mx-auto px-4 pt-32 pb-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Simple, Credit-Based Pricing
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Start with our foundation plan, then buy credits to unlock AI features as you need them.
          </p>
        </div>

        {/* Current Credits Display */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 max-w-md mx-auto">
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
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Foundation Plan */}
          <div className="lg:col-span-2 space-y-8">
            {/* Foundation Plan Card */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-blue-200">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
                    <span className="text-2xl">🏗️</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Foundation Plan</h2>
                    <p className="text-gray-600">Everything you need to get started</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600">$5</div>
                  <div className="text-sm text-gray-500">/month</div>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span>Unlimited Projects</span>
                </div>
                <div className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span>Cloud Storage (10GB)</span>
                </div>
                <div className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span>Full Video Editor</span>
                </div>
                <div className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span>Basic Export (1080p)</span>
                </div>
                <div className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span>Community Support</span>
                </div>
                <div className="flex items-center">
                  <span className="text-green-500 mr-3">✓</span>
                  <span>10 Free Credits/month</span>
                </div>
              </div>
              
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors">
                Start Foundation Plan
              </button>
            </div>

            {/* AI Features */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <span className="mr-3">🤖</span>
                AI Features
                <span className="ml-3 text-sm font-normal text-gray-500">Pay with credits</span>
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

          {/* Credit Packages */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <span className="mr-3">💎</span>
                Buy Credits
              </h2>
              
              <div className="space-y-4">
                {creditPackages.map((pkg) => (
                  <div 
                    key={pkg.id} 
                    className={`relative border-2 rounded-xl p-4 cursor-pointer transition-all hover:border-purple-300 ${
                      pkg.popular ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                    }`}
                  >
                    {pkg.popular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-purple-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                          Most Popular
                        </span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{pkg.name}</h3>
                        <div className="flex items-center mt-1">
                          <span className="text-lg font-bold text-purple-600">{pkg.credits}</span>
                          <span className="text-gray-500 text-sm ml-1">credits</span>
                          {pkg.bonus && (
                            <span className="ml-2 bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
                              +{pkg.bonus} bonus
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-gray-900">${pkg.price}</div>
                        {pkg.bonus && (
                          <div className="text-xs text-green-600 font-medium">
                            {pkg.credits + pkg.bonus} total
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <button className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                      pkg.popular 
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}>
                      Buy Credits
                    </button>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                <h4 className="font-medium text-gray-900 mb-2">Credit Benefits</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Credits never expire</li>
                  <li>• Use across all AI features</li>
                  <li>• No monthly commitment</li>
                  <li>• Volume discounts included</li>
                </ul>
              </div>
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
              <h3 className="font-semibold text-gray-900 mb-2">How do credits work?</h3>
              <p className="text-gray-600 text-sm">
                Each AI feature costs a specific number of credits. Buy credit packages and use them 
                as needed. Credits never expire and work across all features.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">What's included in the Foundation Plan?</h3>
              <p className="text-gray-600 text-sm">
                Full access to our video editor, cloud storage, unlimited projects, and 10 free 
                credits monthly. Perfect for basic editing needs.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Can I cancel anytime?</h3>
              <p className="text-gray-600 text-sm">
                Yes! The Foundation Plan can be canceled anytime. Your purchased credits remain 
                available even after cancellation.
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