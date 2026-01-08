import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { 
  FiUser, 
  FiLock, 
  FiEye, 
  FiEyeOff, 
  FiMail, 
  FiPhone,
  FiShoppingBag,
  FiStar,
  FiTruck,
  FiShield,
  FiHeart
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const CustomerLogin = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loginData, setLoginData] = useState({
    email: '',
    phone: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState('email'); // 'email' or 'phone'

  const handleInputChange = (e) => {
    setLoginData({
      ...loginData,
      [e.target.name]: e.target.value
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Simplified demo login - just use the email/phone as the login identifier
      const loginIdentifier = loginMethod === 'email' ? loginData.email : loginData.phone;
      
      // Demo mode - just need any input
      if (!loginIdentifier) {
        toast.info('Hint: Try "customer" for customer access', {
          position: "top-right",
          autoClose: 5000
        });
        setIsLoading(false);
        return;
      }

      // Use the simplified login function
      await login(loginIdentifier);
      
      toast.success('🎉 Welcome to the demo!', {
        position: "top-right",
        autoClose: 2000
      });
      
      navigate('/customer-dashboard');
      
    } catch (error) {
      console.info('Demo login hint:', error);
      toast.info('Try these demo logins:\n• customer\n• manager\n• staff\n• supplier', {
        position: "top-center",
        autoClose: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    {
      icon: FiShoppingBag,
      title: 'Shop Online',
      description: 'Browse and purchase from our wide selection of products'
    },
    {
      icon: FiStar,
      title: 'Loyalty Rewards',
      description: 'Earn points and unlock exclusive member benefits'
    },
    {
      icon: FiTruck,
      title: 'Fast Delivery',
      description: 'Get your orders delivered quickly and safely'
    },
    {
      icon: FiShield,
      title: 'Secure Payments',
      description: 'Your payment information is always protected'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex">
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes slideInFromLeft {
            from {
              opacity: 0;
              transform: translateX(-50px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          @keyframes slideInFromRight {
            from {
              opacity: 0;
              transform: translateX(50px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          @keyframes float {
            0%, 100% {
              transform: translateY(0px);
            }
            50% {
              transform: translateY(-10px);
            }
          }
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.05);
            }
          }
          @keyframes bounce {
            0%, 20%, 53%, 80%, 100% {
              transform: translate3d(0,0,0);
            }
            40%, 43% {
              transform: translate3d(0, -8px, 0);
            }
            70% {
              transform: translate3d(0, -4px, 0);
            }
            90% {
              transform: translate3d(0, -2px, 0);
            }
          }
          @keyframes wiggle {
            0%, 7% { transform: rotateZ(0); }
            15% { transform: rotateZ(-15deg); }
            20% { transform: rotateZ(10deg); }
            25% { transform: rotateZ(-10deg); }
            30% { transform: rotateZ(6deg); }
            35% { transform: rotateZ(-4deg); }
            40%, 100% { transform: rotateZ(0); }
          }
          @keyframes shimmer {
            0% {
              background-position: -200px 0;
            }
            100% {
              background-position: calc(200px + 100%) 0;
            }
          }
          .animate-fadeInUp {
            animation: fadeInUp 0.8s ease-out;
          }
          .animate-slideInFromLeft {
            animation: slideInFromLeft 0.8s ease-out;
          }
          .animate-slideInFromRight {
            animation: slideInFromRight 0.8s ease-out;
          }
          .animate-float {
            animation: float 3s ease-in-out infinite;
          }
          .animate-pulse-custom {
            animation: pulse 2s infinite;
          }
          .animate-bounce-custom {
            animation: bounce 1s infinite;
          }
          .animate-wiggle {
            animation: wiggle 1s ease-in-out;
          }
          .animate-wiggle:hover {
            animation: wiggle 0.5s ease-in-out;
          }
          .animate-shimmer {
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
            background-size: 200px 100%;
            animation: shimmer 2s infinite;
          }
          .glass-effect {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
          }
        `
      }} />
      {/* Left Side - Features */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-12 flex-col justify-center relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-xl animate-float"></div>
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-white/10 rounded-full blur-xl animate-float" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-white/10 rounded-full blur-xl animate-float" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-1/4 right-1/4 w-20 h-20 bg-white/5 rounded-full blur-xl animate-pulse-custom"></div>
        <div className="absolute bottom-1/4 left-1/3 w-16 h-16 bg-white/5 rounded-full blur-xl animate-bounce-custom"></div>
        
        <div className="relative z-10">
          <div className="mb-8 animate-slideInFromLeft">
            <h1 className="text-5xl font-bold text-white mb-4 transform hover:scale-105 transition-all duration-300">
              Welcome to{' '}
              <span className="bg-gradient-to-r from-yellow-300 to-pink-300 bg-clip-text text-transparent animate-pulse-custom">
                FareDeal
              </span>
            </h1>
            <p className="text-xl text-blue-100 leading-relaxed animate-fadeInUp" style={{animationDelay: '0.3s'}}>
              Your premium shopping experience awaits. Login to access exclusive deals, 
              track your orders, and manage your loyalty rewards.
            </p>
          </div>

          <div className="space-y-6">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className="flex items-center space-x-4 p-4 glass-effect rounded-xl hover:bg-white/20 transition-all duration-300 transform hover:scale-105 hover:shadow-lg animate-fadeInUp"
                style={{animationDelay: `${0.5 + index * 0.2}s`}}
              >
                <div className="p-3 bg-white/20 rounded-full transform hover:rotate-12 transition-all duration-300 animate-wiggle">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white transform hover:scale-105 transition-all duration-300">{feature.title}</h3>
                  <p className="text-blue-100 text-sm">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 animate-slideInFromRight">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8 animate-fadeInUp">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent animate-pulse-custom">
              FareDeal
            </h1>
            <p className="text-gray-600 mt-2">Customer Portal</p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/20 transform hover:scale-105 transition-all duration-500 animate-fadeInUp">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-custom">
                <FiUser className="h-8 w-8 text-white animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 transform hover:scale-105 transition-all duration-300">Welcome Back!</h2>
              <p className="text-gray-600 mt-2 animate-fadeInUp" style={{animationDelay: '0.2s'}}>Sign in to your customer account</p>
            </div>

            {/* Login Method Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1 mb-6 animate-fadeInUp" style={{animationDelay: '0.3s'}}>
              <button
                type="button"
                onClick={() => setLoginMethod('email')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                  loginMethod === 'email'
                    ? 'bg-white text-blue-600 shadow-sm animate-pulse-custom'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <FiMail className="h-4 w-4 inline mr-2 animate-wiggle" />
                Email
              </button>
              <button
                type="button"
                onClick={() => setLoginMethod('phone')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                  loginMethod === 'phone'
                    ? 'bg-white text-blue-600 shadow-sm animate-pulse-custom'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <FiPhone className="h-4 w-4 inline mr-2 animate-wiggle" />
                Phone
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="animate-fadeInUp" style={{animationDelay: '0.4s'}}>
                <label className="block text-sm font-medium text-gray-700 mb-2 transform hover:scale-105 transition-all duration-300">
                  {loginMethod === 'email' ? 'Email Address' : 'Phone Number'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    {loginMethod === 'email' ? (
                      <FiMail className="h-5 w-5 text-gray-400 animate-pulse" />
                    ) : (
                      <FiPhone className="h-5 w-5 text-gray-400 animate-pulse" />
                    )}
                  </div>
                  <input
                    type={loginMethod === 'email' ? 'email' : 'tel'}
                    name={loginMethod}
                    value={loginData[loginMethod]}
                    onChange={handleInputChange}
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 transform hover:scale-105 focus:scale-105"
                    placeholder={loginMethod === 'email' ? 'Enter your email' : 'Enter your phone number'}
                  />
                </div>
              </div>

              <div className="animate-fadeInUp" style={{animationDelay: '0.5s'}}>
                <label className="block text-sm font-medium text-gray-700 mb-2 transform hover:scale-105 transition-all duration-300">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiLock className="h-5 w-5 text-gray-400 animate-pulse" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={loginData.password}
                    onChange={handleInputChange}
                    required
                    className="block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 transform hover:scale-105 focus:scale-105"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center transform hover:scale-110 transition-all duration-300"
                  >
                    {showPassword ? (
                      <FiEyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600 animate-wiggle" />
                    ) : (
                      <FiEye className="h-5 w-5 text-gray-400 hover:text-gray-600 animate-wiggle" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between animate-fadeInUp" style={{animationDelay: '0.6s'}}>
                <label className="flex items-center transform hover:scale-105 transition-all duration-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transform hover:scale-110 transition-all duration-300"
                  />
                  <span className="ml-2 text-sm text-gray-600">Remember me</span>
                </label>
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:text-blue-500 font-medium transform hover:scale-105 transition-all duration-300 animate-wiggle"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 transform hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed animate-fadeInUp animate-shimmer"
                style={{animationDelay: '0.7s'}}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    <span className="animate-pulse">Signing in...</span>
                  </div>
                ) : (
                  <span className="flex items-center justify-center">
                    <span className="animate-bounce-custom">🚀</span>
                    <span className="ml-2">Sign In to Customer Portal</span>
                  </span>
                )}
              </button>
            </form>

            <div className="mt-6 text-center animate-fadeInUp" style={{animationDelay: '0.8s'}}>
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <button className="text-blue-600 hover:text-blue-500 font-medium transform hover:scale-105 transition-all duration-300 animate-wiggle">
                  Contact us to register
                </button>
              </p>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200 animate-fadeInUp" style={{animationDelay: '0.9s'}}>
              <div className="flex items-center justify-center space-x-4">
                <button
                  onClick={() => navigate('/')}
                  className="text-sm text-gray-600 hover:text-gray-900 flex items-center transform hover:scale-105 transition-all duration-300"
                >
                  <FiHeart className="h-4 w-4 mr-1 animate-pulse" />
                  Back to Store
                </button>
                <span className="text-gray-300 animate-pulse">|</span>
                <button
                  onClick={() => navigate('/admin')}
                  className="text-sm text-gray-600 hover:text-gray-900 transform hover:scale-105 transition-all duration-300"
                >
                  Manager Login
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerLogin;
