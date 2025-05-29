'use client';

import { useState } from 'react';
import HomeNavbar from '@/components/home/HomeNavbar';
import { Check } from 'lucide-react';

const plans = [
    {
        name: 'Free',
        price: '0',
        description: 'Perfect for getting started',
        features: [
            'AI Usage: 1M tokens/month',
            'Storage: 1 GB',
            'Free assets',
            'Basic multi-modal support',
        ],
        highlighted: false,
        buttonText: 'Get Started',
        buttonStyle: 'bg-white/10 hover:bg-white/20'
    },
    {
        name: 'Hobby',
        price: '9',
        description: 'For growing creators',
        features: [
            'Everything in Free',
            'AI Usage: 10M tokens/month',
            'Storage: 10 GB',
            'Premium assets',
        ],
        highlighted: true,
        buttonText: 'Start Free Trial',
        buttonStyle: 'bg-blue-500 hover:bg-blue-600'
    },
    {
        name: 'Pro',
        price: '24',
        description: 'For professional creators',
        features: [
            'Everything in Hobby',
            'AI Usage: 40M tokens/month',
            'Storage: 40 GB',
            'Faster AI responses',
        ],
        highlighted: false,
        buttonText: 'Start Free Trial',
        buttonStyle: 'bg-white/10 hover:bg-white/20'
    }
];

export default function PricingPage() {
    const [annualBilling, setAnnualBilling] = useState(false);

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Navbar */}
            <HomeNavbar />

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
                {/* Header */}
                <div className="text-center">
                    <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
                        Simple, Transparent Pricing
                    </h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Choose the perfect plan for your creative journey
                    </p>
                </div>

                {/* Billing Toggle */}
                <div className="flex justify-center items-center mt-12 mb-16 space-x-4">
                    <span className={`text-sm ${!annualBilling ? 'text-white' : 'text-gray-400'}`}>Monthly</span>
                    <button
                        onClick={() => setAnnualBilling(!annualBilling)}
                        className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-500 transition-colors focus:outline-none"
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                annualBilling ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                    </button>
                    <span className={`text-sm ${annualBilling ? 'text-white' : 'text-gray-400'}`}>
                        Annual <span className="text-green-400">(Save 20%)</span>
                    </span>
                </div>

                {/* Pricing Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className={`relative rounded-2xl backdrop-blur-xl p-8 transition-all duration-300 hover:transform hover:scale-105 ${
                                plan.highlighted
                                    ? 'bg-gradient-to-b from-blue-600/20 to-purple-600/20 border border-blue-500/50'
                                    : 'bg-white/5'
                            }`}
                        >
                            {plan.highlighted && (
                                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                                    <span className="bg-blue-500 text-white text-sm px-3 py-1 rounded-full">
                                        Most Popular
                                    </span>
                                </div>
                            )}
                            
                            <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                            <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
                            
                            <div className="mb-6">
                                <span className="text-4xl font-bold">${plan.price}</span>
                                <span className="text-gray-400">/month</span>
                            </div>

                            <ul className="space-y-4 mb-8">
                                {plan.features.map((feature, index) => (
                                    <li key={index} className="flex items-start space-x-3">
                                        <Check className="h-5 w-5 text-blue-500 mt-0.5" />
                                        <span className="text-gray-300">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                className={`w-full py-3 px-6 rounded-xl font-medium transition-all duration-300 ${plan.buttonStyle}`}
                            >
                                {plan.buttonText}
                            </button>
                        </div>
                    ))}
                </div>

                {/* FAQ Section */}
                <div className="mt-32 text-center">
                    <h2 className="text-3xl font-bold mb-12">Frequently Asked Questions</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto text-left">
                        <div className="bg-white/5 rounded-xl p-6">
                            <h3 className="text-lg font-semibold mb-2">What are tokens?</h3>
                            <p className="text-gray-400">Tokens are units of AI processing power. One token is roughly equivalent to 4 characters of text.</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-6">
                            <h3 className="text-lg font-semibold mb-2">Can I upgrade anytime?</h3>
                            <p className="text-gray-400">Yes, you can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 