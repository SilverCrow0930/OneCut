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
        buttonText: 'Your current plan',
        buttonStyle: 'bg-gray-200 hover:bg-gray-300 text-gray-700'
    },
    {
        name: 'Hobby',
        price: '9',
        description: 'For growing creators',
        features: [
            'Everything in Free',
            'AI Usage: 5M tokens/month',
            'Storage: 5 GB',
            'Premium assets',
        ],
        highlighted: true,
        buttonText: 'Get Hobby',
        buttonStyle: 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
    },
    {
        name: 'Pro',
        price: '24',
        description: 'For professional creators',
        features: [
            'Everything in Hobby',
            'AI Usage: 20M tokens/month',
            'Storage: 20 GB',
            'Faster AI responses',
        ],
        highlighted: false,
        buttonText: 'Get Pro',
        buttonStyle: 'bg-gray-100 hover:bg-gray-200 text-gray-900'
    }
];

export default function PricingPage() {
    const [annualBilling, setAnnualBilling] = useState(false);

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
            {/* Navbar */}
            <HomeNavbar />

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-32">
                {/* Header */}
                <div className="text-center">
                    <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">
                        Simple, Transparent Pricing
                    </h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        Choose the perfect plan for your creative journey
                    </p>
                </div>

                {/* Billing Toggle */}
                <div className="flex justify-center items-center mt-12 mb-16 space-x-4">
                    <span className={`text-sm font-medium ${!annualBilling ? 'text-gray-900' : 'text-gray-500'}`}>Monthly</span>
                    <button
                        onClick={() => setAnnualBilling(!annualBilling)}
                        className="relative inline-flex h-6 w-11 items-center rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-colors focus:outline-none shadow-lg"
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                                annualBilling ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                    </button>
                    <span className={`text-sm font-medium ${annualBilling ? 'text-gray-900' : 'text-gray-500'}`}>
                        Annual <span className="text-green-600 font-semibold">(Save 20%)</span>
                    </span>
                </div>

                {/* Pricing Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className={`relative rounded-2xl p-8 transition-all duration-300 hover:transform hover:scale-105 shadow-lg hover:shadow-xl ${
                                plan.highlighted
                                    ? 'bg-white border-2 border-gradient-to-r from-blue-500 to-purple-500 ring-2 ring-blue-200'
                                    : 'bg-white/80 backdrop-blur-sm border border-gray-200'
                            }`}
                        >
                            {plan.highlighted && (
                                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                                    <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm px-4 py-2 rounded-full font-semibold shadow-lg">
                                        Most Popular
                                    </span>
                                </div>
                            )}
                            
                            <h3 className="text-xl font-semibold mb-2 text-gray-900">{plan.name}</h3>
                            <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
                            
                            <div className="mb-6">
                                <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                                <span className="text-gray-600">/month</span>
                            </div>

                            <ul className="space-y-4 mb-8">
                                {plan.features.map((feature, index) => (
                                    <li key={index} className="flex items-start space-x-3">
                                        <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                                        <span className="text-gray-700">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-300 shadow-md hover:shadow-lg ${plan.buttonStyle}`}
                            >
                                {plan.buttonText}
                            </button>
                        </div>
                    ))}
                </div>
            
            </div>
        </div>
    );
} 