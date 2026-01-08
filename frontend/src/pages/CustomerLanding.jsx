import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FiTruck, FiCreditCard, FiShoppingCart, FiPackage, FiStar, 
  FiShield, FiClock, FiMapPin, FiCheckCircle, FiArrowRight,
  FiUsers, FiAward, FiHeart, FiZap, FiSmile, FiTrendingUp,
  FiUser, FiSettings, FiBell, FiGift, FiCamera, FiMessageCircle, FiGrid, FiList
} from 'react-icons/fi';
import VirtualAssistant from '../components/VirtualAssistant';
import LoyaltyRewards from '../components/LoyaltyRewards';
import ARProductViewer from '../components/ARProductViewer';

const CustomerLanding = () => {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [showLoyaltyRewards, setShowLoyaltyRewards] = useState(false);
  const [showARViewer, setShowARViewer] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: FiTruck,
      title: 'Fast Delivery',
      description: 'Get your orders delivered to your doorstep in 1-3 business days',
      color: 'from-blue-500 to-purple-500',
      stats: '98% on-time delivery'
    },
    {
      icon: FiShield,
      title: 'Secure Payment',
      description: 'Multiple payment options with bank-level security protection',
      color: 'from-green-500 to-blue-500',
      stats: '256-bit encryption'
    },
    {
      icon: FiStar,
      title: 'Quality Products',
      description: 'Curated selection of premium electronics and accessories',
      color: 'from-purple-500 to-pink-500',
      stats: '4.8/5 avg rating'
    },
    {
      icon: FiClock,
      title: '24/7 Support',
      description: 'Round-the-clock customer support for all your needs',
      color: 'from-orange-500 to-red-500',
      stats: '<2min response time'
    }
  ];

  const stats = [
    { icon: FiUsers, number: '50K+', label: 'Happy Customers', color: 'text-blue-600' },
    { icon: FiAward, number: '99.5%', label: 'Satisfaction Rate', color: 'text-green-600' },
    { icon: FiTrendingUp, number: '1M+', label: 'Products Delivered', color: 'text-purple-600' },
    { icon: FiHeart, number: '4.9/5', label: 'Customer Rating', color: 'text-pink-600' }
  ];

  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Tech Enthusiast',
      content: 'FAREDEAL has the best selection of electronics. Fast delivery and amazing customer service!',
      rating: 5,
      avatar: '👩‍💻'
    },
    {
      name: 'Mike Chen',
      role: 'Small Business Owner',
      content: 'The in-store payment system is incredibly convenient. Makes shopping so much faster!',
      rating: 5,
      avatar: '👨‍💼'
    },
    {
      name: 'Emily Rodriguez',
      role: 'Student',
      content: 'Great prices and quality products. The delivery tracking is super helpful too.',
      rating: 5,
      avatar: '👩‍🎓'
    }
  ];

  const deliverySteps = [
    {
      step: '1',
      title: 'Browse Products',
      description: 'Explore our wide selection of electronics and accessories',
      icon: '🛍️'
    },
    {
      step: '2',
      title: 'Add to Cart',
      description: 'Select items and add them to your shopping cart',
      icon: '🛒'
    },
    {
      step: '3',
      title: 'Enter Details',
      description: 'Provide delivery address and contact information',
      icon: '📍'
    },
    {
      step: '4',
      title: 'Place Order',
      description: 'Choose payment method and confirm your order',
      icon: '✅'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm shadow-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                <span className="text-2xl animate-bounce">🛍️</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  FAREDEAL
                </h1>
                <p className="text-sm text-gray-500">Your premium shopping destination</p>
              </div>
            </div>
            
            <nav className="hidden md:flex items-center space-x-4">
              <Link
                to="/customer-delivery"
                className="flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:from-blue-600 hover:to-purple-600 transform hover:scale-105 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
              >
                <FiTruck className="h-5 w-5 mr-2" />
                Shop & Delivery
              </Link>
              
              <Link
                to="/customer-payment"
                className="flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 transform hover:scale-105 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
              >
                <FiCreditCard className="h-5 w-5 mr-2" />
                In-Store Payment
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className={`text-center mb-20 ${isVisible ? 'animate-fadeIn' : 'opacity-0'}`}>
          <div className="relative">
            {/* Floating decoration elements */}
            <div className="absolute -top-10 -left-10 w-20 h-20 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full opacity-20 animate-float"></div>
            <div className="absolute -top-5 -right-15 w-16 h-16 bg-gradient-to-r from-pink-400 to-red-400 rounded-full opacity-20 animate-float" style={{animationDelay: '1s'}}></div>
            
            <h1 className="text-6xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              Welcome to{' '}
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-gradientShift">
                FAREDEAL
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-4xl mx-auto leading-relaxed">
              Your premium destination for cutting-edge electronics, lightning-fast delivery, and secure payments. 
              <span className="block mt-2 text-lg text-gray-500">Experience the future of shopping today.</span>
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-12">
              <Link
                to="/customer-delivery"
                className="group inline-flex items-center px-10 py-5 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-2xl hover:from-blue-600 hover:to-purple-600 transform hover:scale-105 hover:shadow-2xl transition-all duration-300 shadow-xl"
              >
                <FiTruck className="h-6 w-6 mr-3 group-hover:animate-bounce" />
                Start Shopping & Delivery
                <FiArrowRight className="h-5 w-5 ml-3 group-hover:translate-x-1 transition-transform" />
              </Link>
              
              <Link
                to="/customer-payment"
                className="group inline-flex items-center px-10 py-5 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-2xl hover:from-green-600 hover:to-emerald-600 transform hover:scale-105 hover:shadow-2xl transition-all duration-300 shadow-xl"
              >
                <FiCreditCard className="h-6 w-6 mr-3 group-hover:animate-bounce" />
                In-Store Payment
                <FiArrowRight className="h-5 w-5 ml-3 group-hover:translate-x-1 transition-transform" />
              </Link>
              
              <Link
                to="/customer-dashboard"
                className="group inline-flex items-center px-10 py-5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl hover:from-orange-600 hover:to-red-600 transform hover:scale-105 hover:shadow-2xl transition-all duration-300 shadow-xl"
              >
                <FiUser className="h-6 w-6 mr-3 group-hover:animate-bounce" />
                Customer Portal
                <FiArrowRight className="h-5 w-5 ml-3 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20">
          {stats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div key={index} className="text-center p-6 bg-white/60 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
                <div className={`w-16 h-16 mx-auto mb-4 ${stat.color} bg-gradient-to-r from-current to-current opacity-10 rounded-full flex items-center justify-center`}>
                  <IconComponent className={`h-8 w-8 ${stat.color}`} />
                </div>
                <div className={`text-3xl font-bold ${stat.color} mb-2`}>{stat.number}</div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </div>
            );
          })}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div key={index} className={`bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 text-center hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3 hover:rotate-1 stagger-item group`}>
                <div className={`w-20 h-20 bg-gradient-to-r ${feature.color} rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300`}>
                  <IconComponent className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">{feature.title}</h3>
                <p className="text-gray-600 mb-4 leading-relaxed">{feature.description}</p>
                <div className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full inline-block">
                  {feature.stats}
                </div>
              </div>
            );
          })}
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">How Delivery Works</h2>
            <p className="text-gray-600">Simple steps to get your products delivered to your doorstep</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {deliverySteps.map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                  {step.icon}
                </div>
                <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center mx-auto mb-3 font-bold text-sm">
                  {step.step}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600 text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Service Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {/* Delivery Service */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiTruck className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Shop & Delivery</h3>
              <p className="text-gray-600">Order online and get it delivered to your home</p>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="flex items-center">
                <FiCheckCircle className="h-5 w-5 text-green-500 mr-3" />
                <span className="text-gray-700">Browse our complete product catalog</span>
              </div>
              <div className="flex items-center">
                <FiCheckCircle className="h-5 w-5 text-green-500 mr-3" />
                <span className="text-gray-700">Free delivery on orders over $100</span>
              </div>
              <div className="flex items-center">
                <FiCheckCircle className="h-5 w-5 text-green-500 mr-3" />
                <span className="text-gray-700">1-3 business day delivery</span>
              </div>
              <div className="flex items-center">
                <FiCheckCircle className="h-5 w-5 text-green-500 mr-3" />
                <span className="text-gray-700">Real-time order tracking</span>
              </div>
            </div>
            
            <Link
              to="/customer-delivery"
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 px-6 rounded-lg font-bold hover:from-blue-600 hover:to-purple-600 transition-all duration-200 flex items-center justify-center"
            >
              <FiTruck className="h-5 w-5 mr-2" />
              Start Shopping
            </Link>
          </div>

          {/* In-Store Payment */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiCreditCard className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">In-Store Payment</h3>
              <p className="text-gray-600">Visit our store and pay with modern payment methods</p>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="flex items-center">
                <FiCheckCircle className="h-5 w-5 text-green-500 mr-3" />
                <span className="text-gray-700">Biometric authentication</span>
              </div>
              <div className="flex items-center">
                <FiCheckCircle className="h-5 w-5 text-green-500 mr-3" />
                <span className="text-gray-700">Multiple payment options</span>
              </div>
              <div className="flex items-center">
                <FiCheckCircle className="h-5 w-5 text-green-500 mr-3" />
                <span className="text-gray-700">Instant payment processing</span>
              </div>
              <div className="flex items-center">
                <FiCheckCircle className="h-5 w-5 text-green-500 mr-3" />
                <span className="text-gray-700">Digital receipts</span>
              </div>
            </div>
            
            <Link
              to="/customer-payment"
              className="w-full bg-green-500 text-white py-3 px-6 rounded-lg font-bold hover:bg-green-600 transition-all duration-200 flex items-center justify-center"
            >
              <FiCreditCard className="h-5 w-5 mr-2" />
              Learn More
            </Link>
          </div>
        </div>

        {/* Testimonials Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8 mb-16">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">What Our Customers Say</h2>
            <p className="text-gray-600 text-lg">Join thousands of satisfied customers who trust FAREDEAL</p>
          </div>
          
          <div className="relative">
            <div className="overflow-hidden">
              <div 
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${currentTestimonial * 100}%)` }}
              >
                {testimonials.map((testimonial, index) => (
                  <div key={index} className="w-full flex-shrink-0 px-4">
                    <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-8 text-center max-w-2xl mx-auto">
                      <div className="text-6xl mb-4">{testimonial.avatar}</div>
                      <div className="flex justify-center mb-4">
                        {[...Array(testimonial.rating)].map((_, i) => (
                          <FiStar key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                        ))}
                      </div>
                      <blockquote className="text-lg text-gray-700 mb-4 italic">
                        "{testimonial.content}"
                      </blockquote>
                      <div className="font-semibold text-gray-900">{testimonial.name}</div>
                      <div className="text-gray-600 text-sm">{testimonial.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Testimonial dots */}
            <div className="flex justify-center mt-6 space-x-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTestimonial(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === currentTestimonial 
                      ? 'bg-blue-500 scale-125' 
                      : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Exclusive Features */}
        <div className="py-20 bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-3xl mb-12">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              🎯 Exclusive Member Features
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Unlock premium experiences designed exclusively for FareDeal customers
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* AI Assistant */}
            <div className="group bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">🤖</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">AI Shopping Assistant</h3>
              <p className="text-gray-600 mb-6">
                Get personalized product recommendations, track orders, and receive instant support from our AI-powered assistant.
              </p>
              <div className="flex items-center justify-between">
                <span className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2 rounded-full text-sm font-medium">
                  Always Available
                </span>
                <button className="text-blue-600 hover:text-blue-800 font-medium">
                  Try Now →
                </button>
              </div>
            </div>

            {/* AR Product Viewer */}
            <div className="group bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">📱</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">AR Product Visualization</h3>
              <p className="text-gray-600 mb-6">
                See products in your space before buying with our advanced AR technology. Try before you buy!
              </p>
              <div className="flex items-center justify-between">
                <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-full text-sm font-medium">
                  AR Enabled
                </span>
                <button 
                  onClick={() => {
                    setSelectedProduct({
                      id: 1,
                      name: 'iPhone 15 Pro Max',
                      price: 1199.99,
                      originalPrice: 1299.99,
                      image: '📱'
                    });
                    setShowARViewer(true);
                  }}
                  className="text-purple-600 hover:text-purple-800 font-medium"
                >
                  Try AR →
                </button>
              </div>
            </div>

            {/* Loyalty Rewards */}
            <div className="group bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">🎁</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Gamified Rewards</h3>
              <p className="text-gray-600 mb-6">
                Earn points, unlock achievements, and redeem exclusive rewards. Make every purchase count!
              </p>
              <div className="flex items-center justify-between">
                <span className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-full text-sm font-medium">
                  Earn Points
                </span>
                <button 
                  onClick={() => setShowLoyaltyRewards(true)}
                  className="text-green-600 hover:text-green-800 font-medium"
                >
                  View Rewards →
                </button>
              </div>
            </div>

            {/* Personalized Dashboard */}
            <div className="group bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">📊</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Personal Dashboard</h3>
              <p className="text-gray-600 mb-6">
                Track your orders, manage wishlist, view recommendations, and access exclusive member benefits.
              </p>
              <div className="flex items-center justify-between">
                <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-full text-sm font-medium">
                  Personalized
                </span>
                <Link to="/customer-dashboard" className="text-orange-600 hover:text-orange-800 font-medium">
                  Open Dashboard →
                </Link>
              </div>
            </div>

            {/* Social Features */}
            <div className="group bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">👥</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Social Shopping</h3>
              <p className="text-gray-600 mb-6">
                Share your purchases, get recommendations from friends, and join our exclusive member community.
              </p>
              <div className="flex items-center justify-between">
                <span className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-4 py-2 rounded-full text-sm font-medium">
                  Community
                </span>
                <button className="text-pink-600 hover:text-pink-800 font-medium">
                  Join Community →
                </button>
              </div>
            </div>

            {/* Premium Support */}
            <div className="group bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">🎧</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Premium Support</h3>
              <p className="text-gray-600 mb-6">
                Get priority customer support, dedicated account manager, and exclusive member hotline.
              </p>
              <div className="flex items-center justify-between">
                <span className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white px-4 py-2 rounded-full text-sm font-medium">
                  VIP Support
                </span>
                <button className="text-indigo-600 hover:text-indigo-800 font-medium">
                  Contact Support →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-3xl text-white p-12 text-center overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full -translate-x-20 -translate-y-20 animate-float"></div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-white rounded-full translate-x-16 translate-y-16 animate-float" style={{animationDelay: '2s'}}></div>
          </div>
          
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Get Started?</h2>
            <p className="text-blue-100 mb-8 text-xl max-w-3xl mx-auto leading-relaxed">
              Choose your preferred way to shop with FAREDEAL and enjoy premium products with excellent service.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Link
                to="/customer-delivery"
                className="group inline-flex items-center px-8 py-4 bg-white text-blue-600 font-bold rounded-2xl hover:bg-gray-100 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                <FiTruck className="h-6 w-6 mr-3 group-hover:animate-bounce" />
                Shop Online
                <FiArrowRight className="h-5 w-5 ml-3 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/customer-payment"
                className="group inline-flex items-center px-8 py-4 bg-transparent border-2 border-white text-white font-bold rounded-2xl hover:bg-white hover:text-blue-600 transform hover:scale-105 transition-all duration-300"
              >
                <FiCreditCard className="h-6 w-6 mr-3 group-hover:animate-bounce" />
                Visit Store
                <FiArrowRight className="h-5 w-5 ml-3 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Virtual Assistant */}
      <VirtualAssistant />

      {/* Loyalty Rewards Modal */}
      <LoyaltyRewards 
        isOpen={showLoyaltyRewards} 
        onClose={() => setShowLoyaltyRewards(false)} 
      />

      {/* AR Product Viewer Modal */}
      {selectedProduct && (
        <ARProductViewer 
          product={selectedProduct}
          isOpen={showARViewer} 
          onClose={() => {
            setShowARViewer(false);
            setSelectedProduct(null);
          }} 
        />
      )}
    </div>
  );
};

export default CustomerLanding;
