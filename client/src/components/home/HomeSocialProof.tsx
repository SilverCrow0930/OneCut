import React from 'react'
import { Star, Users, Clock, Video, Quote } from 'lucide-react'

const HomeSocialProof = () => {
    const testimonials = [
        {
            name: "Sarah Chen",
            role: "Content Creator",
            company: "TechTalks",
            image: "/assets/avatars/avatar-1.jpg",
            content: "Lemona has revolutionized my workflow. What used to take me 8 hours now takes 30 minutes. The AI is incredibly smart at finding the best moments.",
            rating: 5
        },
        {
            name: "Mike Rodriguez",
            role: "Podcast Host",
            company: "Business Insights",
            image: "/assets/avatars/avatar-2.jpg", 
            content: "As a weekly podcaster, Lemona saves me countless hours. The quality of the auto-generated highlights is amazing - my engagement has tripled!",
            rating: 5
        },
        {
            name: "Emily Watson",
            role: "Educator",
            company: "Online Learning Hub",
            image: "/assets/avatars/avatar-3.jpg",
            content: "Perfect for creating course previews and lesson highlights. My students love the bite-sized content, and I love how easy it is to create.",
            rating: 5
        }
    ]

    const stats = [
        {
            icon: Users,
            number: "10,000+",
            label: "Active Creators",
            color: "from-blue-500 to-purple-500"
        },
        {
            icon: Video,
            number: "50,000+",
            label: "Videos Created",
            color: "from-emerald-500 to-blue-500"
        },
        {
            icon: Clock,
            number: "100,000+",
            label: "Hours Saved",
            color: "from-purple-500 to-pink-500"
        }
    ]

    const logos = [
        { name: "TechCrunch", logo: "/assets/logos/techcrunch.svg" },
        { name: "Forbes", logo: "/assets/logos/forbes.svg" },
        { name: "Wired", logo: "/assets/logos/wired.svg" },
        { name: "Mashable", logo: "/assets/logos/mashable.svg" },
        { name: "VentureBeat", logo: "/assets/logos/venturebeat.svg" }
    ]

    return (
        <section className="py-20 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Stats Section */}
                <div className="text-center mb-20">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12">
                        Trusted by creators 
                        <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> worldwide</span>
                    </h2>
                    
                    <div className="grid md:grid-cols-3 gap-8 mb-16">
                        {stats.map((stat, index) => {
                            const Icon = stat.icon
                            return (
                                <div key={index} className="text-center">
                                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r ${stat.color} mb-4`}>
                                        <Icon className="w-8 h-8 text-white" />
                                    </div>
                                    <div className="text-4xl font-bold text-gray-900 mb-2">{stat.number}</div>
                                    <div className="text-lg text-gray-600">{stat.label}</div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Trust Badges */}
                    <div className="border-t border-gray-200 pt-12">
                        <p className="text-sm text-gray-500 mb-8">Featured in</p>
                        <div className="flex items-center justify-center gap-12 opacity-40">
                            {/* Placeholder logos - replace with actual ones */}
                            <div className="text-2xl font-bold text-gray-400">TechCrunch</div>
                            <div className="text-2xl font-bold text-gray-400">Forbes</div>
                            <div className="text-2xl font-bold text-gray-400">Wired</div>
                            <div className="text-2xl font-bold text-gray-400">Mashable</div>
                        </div>
                    </div>
                </div>

                {/* Testimonials */}
                <div className="mb-20">
                    <div className="text-center mb-12">
                        <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                            What creators are saying
                        </h3>
                        <div className="flex items-center justify-center gap-1 mb-4">
                            {[...Array(5)].map((_, i) => (
                                <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                            ))}
                            <span className="ml-2 text-gray-600 font-medium">4.9/5 from 1,000+ reviews</span>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {testimonials.map((testimonial, index) => (
                            <div key={index} className="bg-gray-50 rounded-2xl p-8 relative">
                                {/* Quote Icon */}
                                <Quote className="w-8 h-8 text-blue-600/20 mb-4" />
                                
                                {/* Rating */}
                                <div className="flex items-center gap-1 mb-4">
                                    {[...Array(testimonial.rating)].map((_, i) => (
                                        <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                                    ))}
                                </div>

                                {/* Content */}
                                <p className="text-gray-700 mb-6 leading-relaxed">
                                    "{testimonial.content}"
                                </p>

                                {/* Author */}
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                                        {testimonial.name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900">{testimonial.name}</div>
                                        <div className="text-sm text-gray-600">{testimonial.role}, {testimonial.company}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Security & Trust */}
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-3xl p-12 text-center">
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">
                        Your content is safe with us
                    </h3>
                    <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
                        Enterprise-grade security, GDPR compliant, and your videos are never shared or used for training.
                    </p>
                    <div className="flex items-center justify-center gap-8">
                        <div className="flex items-center gap-2 text-gray-700">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="font-medium">SSL Encrypted</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="font-medium">GDPR Compliant</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="font-medium">SOC 2 Certified</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default HomeSocialProof 