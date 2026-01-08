import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  FiUsers, FiUser, FiTruck, FiArrowRight, FiShield, FiStar,
  FiTrendingUp, FiBell, FiAward, FiTarget, FiZap, FiNavigation, 
  FiCheckCircle, FiSettings, FiChevronUp, FiKey
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

const MainLanding = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [activeSection, setActiveSection] = useState('hero');
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [loadingPortal, setLoadingPortal] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [portalAccessCount, setPortalAccessCount] = useState(0);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [adminPortalVisible, setAdminPortalVisible] = useState(true); // Make admin portal visible by default
  const [keySequence, setKeySequence] = useState('');
  const [showAdminHint, setShowAdminHint] = useState(false);

  // Secret key sequence to reveal admin portal
  const ADMIN_KEY_SEQUENCE = 'admin123';

  useEffect(() => {
    setIsVisible(true);
    const availableTestimonials = testimonials.filter(testimonial => {
      // Show all testimonials including admin testimonial
      return true;
    });
    
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % availableTestimonials.length);
    }, 5000);
    
    // Show stats after a delay
    const statsTimer = setTimeout(() => {
      setShowStats(true);
    }, 1000);

    // Scroll progress listener
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = (scrollTop / docHeight) * 100;
      setScrollProgress(scrollPercent);
    };

    // Click outside handler for admin menu
    const handleClickOutside = (event) => {
      if (showAdminMenu && !event.target.closest('.admin-menu-container')) {
        setShowAdminMenu(false);
      }
    };

    // Keyboard listener for admin portal activation
    const handleKeyPress = (event) => {
      // Don't capture keys when typing in input fields
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
      }
      
      const newSequence = keySequence + event.key.toLowerCase();
      setKeySequence(newSequence);
      
      // Check if sequence matches admin key
      if (newSequence.includes(ADMIN_KEY_SEQUENCE)) {
        setAdminPortalVisible(true);
        setKeySequence('');
        setShowAdminHint(true);
        // Show hint for a few seconds
        setTimeout(() => setShowAdminHint(false), 3000);
      } else if (newSequence.length > ADMIN_KEY_SEQUENCE.length) {
        // Reset if sequence gets too long
        setKeySequence('');
      }
    };

    window.addEventListener('scroll', handleScroll);
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keypress', handleKeyPress);
    
    return () => {
      clearInterval(interval);
      clearTimeout(statsTimer);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keypress', handleKeyPress);
    };
  }, [showAdminMenu, keySequence]);

  const userTypes = [
    {
      id: 'manager',
      title: 'Manager Portal',
      subtitle: 'Strategic Leadership',
      description: 'Advanced business analytics, team management, and strategic decision-making tools',
      icon: '👩‍💼',
      color: 'from-blue-600 to-purple-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      features: [
        'Real-time Business Analytics',
        'Team Performance Management',
        'Strategic Goal Tracking',
        'Financial Performance Monitoring',
        'Inventory Optimization',
        'Advanced Reporting Dashboard'
      ],
      stats: {
        primary: '$125K',
        secondary: '12 Team Members',
        tertiary: '95% Efficiency'
      },
      route: '/manager-portal',
      cta: 'Access Manager Portal',
      benefits: [
        'Comprehensive business insights',
        'Team performance analytics',
        'Strategic planning tools',
        'Real-time notifications'
      ]
    },
    {
      id: 'admin',
      title: 'Admin Portal',
      subtitle: 'System Administration',
      description: 'Complete system control, user management, analytics, and administrative functions',
      icon: '⚙️',
      color: 'from-red-600 to-pink-600',
      bgColor: 'bg-red-50',
      textColor: 'text-red-600',
      features: [
        'Full System Administration',
        'User Account Management',
        'Advanced System Analytics',
        'Global Settings Control',
        'Security Management',
        'System Health Monitoring'
      ],
      stats: {
        primary: '5.2K',
        secondary: 'All Users',
        tertiary: '100% Access'
      },
      route: '/admin-portal',
      cta: 'Admin Access',
      benefits: [
        'Complete system oversight',
        'User management tools',
        'Advanced security controls',
        'System performance monitoring'
      ],
      isRestricted: true
    },
    {
      id: 'cashier',
      title: 'Cashier Portal',
      subtitle: 'Point of Sale Excellence',
      description: 'Streamlined POS system with customer service tools and sales tracking',
      icon: '💳',
      color: 'from-green-600 to-emerald-600',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
      features: [
        'Advanced POS System',
        'Customer Service Tools',
        'Sales Performance Tracking',
        'Inventory Management',
        'Payment Processing',
        'Receipt Management'
      ],
      stats: {
        primary: '$2.4K',
        secondary: '8 Active Tasks',
        tertiary: '4.8★ Rating'
      },
      route: '/employee-portal',
      cta: 'Access Cashier Portal',
      benefits: [
        'Fast transaction processing',
        'Customer satisfaction tracking',
        'Sales goal monitoring',
        'Inventory alerts'
      ]
    },
    {
      id: 'supplier',
      title: 'Supplier Portal',
      subtitle: 'Partnership Management',
      description: 'Order management, product catalog, and performance analytics for suppliers',
      icon: '🏢',
      color: 'from-purple-600 to-indigo-600',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      features: [
        'Order Management System',
        'Product Catalog Management',
        'Performance Analytics',
        'Payment Tracking',
        'Inventory Monitoring',
        'Partnership Goals'
      ],
      stats: {
        primary: '156',
        secondary: '$125K Revenue',
        tertiary: '4.8★ Rating'
      },
      route: '/supplier-portal',
      cta: 'Access Supplier Portal',
      benefits: [
        'Streamlined order processing',
        'Performance insights',
        'Payment tracking',
        'Partnership analytics'
      ]
    },
    {
      id: 'customer',
      title: 'Customer Portal',
      subtitle: 'Premium Shopping Experience',
      description: 'Personalized shopping, delivery tracking, and exclusive member benefits',
      icon: '🛍️',
      color: 'from-orange-600 to-red-600',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
      features: [
        'Personal Shopping Dashboard',
        'Order Tracking & Delivery',
        'Loyalty Rewards Program',
        'AR Product Visualization',
        'AI Shopping Assistant',
        'Exclusive Member Benefits'
      ],
      stats: {
        primary: '50K+',
        secondary: '99.5% Satisfaction',
        tertiary: '4.9/5 Rating'
      },
      route: '/customer',
      cta: 'Start Shopping',
      benefits: [
        'Personalized recommendations',
        'Fast delivery options',
        'Exclusive member perks',
        '24/7 customer support'
      ]
    }
  ];

  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Store Manager',
      content: 'The Manager Portal gives me complete visibility into our business operations. The analytics are incredibly detailed and help me make data-driven decisions.',
      rating: 5,
      avatar: '👩‍💼',
      portal: 'Manager'
    },
    {
      name: 'Dr. Alex Chen',
      role: 'System Administrator',
      content: 'The Admin Portal provides unprecedented control and insight into our entire FAREDEAL ecosystem. User management and system analytics are exceptional.',
      rating: 5,
      avatar: '⚙️',
      portal: 'Admin'
    },
    {
      name: 'Mike Chen',
      role: 'Senior Cashier',
      content: 'The Cashier Portal makes transactions so smooth. The customer service tools help me provide excellent service every time.',
      rating: 5,
      avatar: '💳',
      portal: 'Cashier'
    },
    {
      name: 'Emily Rodriguez',
      role: 'Supplier Relations',
      content: 'Managing our partnership with FAREDEAL is effortless through the Supplier Portal. The order tracking and analytics are top-notch.',
      rating: 5,
      avatar: '🏢',
      portal: 'Supplier'
    },
    {
      name: 'David Wilson',
      role: 'Premium Customer',
      content: 'The customer experience is amazing! Fast delivery, great products, and the loyalty rewards make every purchase worthwhile.',
      rating: 5,
      avatar: '🛍️',
      portal: 'Customer'
    }
  ];

  const features = [
    {
      icon: FiShield,
      title: 'Enterprise Security',
      description: 'Bank-level security with 256-bit encryption for all user data',
      color: 'from-blue-500 to-purple-500'
    },
    {
      icon: FiZap,
      title: 'Real-time Updates',
      description: 'Live data synchronization across all portals and devices',
      color: 'from-green-500 to-blue-500'
    },
    {
      icon: FiTarget,
      title: 'Role-specific Design',
      description: 'Tailored interfaces designed for each user type and workflow',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: FiAward,
      title: 'Performance Analytics',
      description: 'Comprehensive insights and reporting for continuous improvement',
      color: 'from-orange-500 to-red-500'
    }
  ];

  const stats = [
    { icon: FiUsers, number: '10K+', label: 'Active Users', color: 'text-blue-600' },
    { icon: FiTrendingUp, number: '99.9%', label: 'Uptime', color: 'text-green-600' },
    { icon: FiAward, number: '4.9/5', label: 'User Rating', color: 'text-purple-600' },
    { icon: FiShield, number: '100%', label: 'Secure', color: 'text-orange-600' }
  ];

  const handlePortalAccess = (portal) => {
    // Special handling for admin portal
    if (portal.isRestricted && !isAdmin) {
      // Show registration page with admin tab for non-admin users
      navigate('/register?tab=admin');
      return;
    }
    
    // Add a creative loading animation before navigation
    setLoadingPortal(portal.id);
    setHoveredCard(portal.id);
    setPortalAccessCount(prev => prev + 1);
    
    // Show success message briefly
    setTimeout(() => {
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        navigate(portal.route);
      }, 500);
    }, 600);
  };

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 overflow-hidden relative">
      {/* Animated Background Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-blue-400 rounded-full opacity-30 animate-float"></div>
        <div className="absolute top-1/3 right-1/3 w-3 h-3 bg-purple-400 rounded-full opacity-20 animate-float" style={{animationDelay: '1s'}}></div>
        <div className="absolute bottom-1/4 left-1/3 w-1 h-1 bg-pink-400 rounded-full opacity-40 animate-float" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-green-400 rounded-full opacity-25 animate-float" style={{animationDelay: '3s'}}></div>
        <div className="absolute bottom-1/3 right-1/2 w-1 h-1 bg-yellow-400 rounded-full opacity-35 animate-float" style={{animationDelay: '4s'}}></div>
        <div className="absolute top-3/4 left-1/2 w-2 h-2 bg-indigo-400 rounded-full opacity-20 animate-float" style={{animationDelay: '5s'}}></div>
      </div>
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
          @keyframes gradientShift {
            0%, 100% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
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
          .animate-gradientShift {
            background-size: 200% 200%;
            animation: gradientShift 3s ease infinite;
          }
        `
      }} />

      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gray-200 z-50">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
          style={{ width: `${Math.min(scrollProgress, 100)}%` }}
        ></div>
      </div>

      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm shadow-lg border-b border-gray-200 sticky top-0 z-40 mt-1">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                <span className="text-2xl animate-bounce">🏢</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  FAREDEAL
                </h1>
                <p className="text-sm text-gray-500">Unified Business Platform</p>
              </div>
            </div>
            
            <nav className="hidden md:flex items-center space-x-4">
              <button 
                onClick={() => scrollToSection('portals')}
                className="px-4 py-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                Portals
              </button>
              <button 
                onClick={() => scrollToSection('features')}
                className="px-4 py-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                Features
              </button>
              <button 
                onClick={() => scrollToSection('testimonials')}
                className="px-4 py-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                Testimonials
              </button>
            </nav>

            <div className="flex items-center space-x-2">
              {/* Admin Access Button (only if user is admin) */}
              {isAdmin && (
                <div className="relative admin-menu-container">
                  <button 
                    onClick={() => setShowAdminMenu(!showAdminMenu)}
                    className="p-2 text-red-600 hover:text-red-700 transition-colors relative"
                    title="Admin Controls"
                  >
                    <FiKey className="h-5 w-5" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  </button>
                  
                  {showAdminMenu && (
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-48 z-50">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <div className="text-sm font-semibold text-red-600">Admin Access</div>
                        <div className="text-xs text-gray-500">System Administrator</div>
                      </div>
                      <button
                        onClick={() => {
                          setShowAdminMenu(false);
                          navigate('/admin-portal');
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center space-x-2"
                      >
                        <FiShield className="h-4 w-4" />
                        <span>Admin Portal</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowAdminMenu(false);
                          navigate('/register');
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center space-x-2"
                      >
                        <FiUsers className="h-4 w-4" />
                        <span>Register Users</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {/* User Status */}
              {user ? (
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-600 hidden md:block">
                    {isAdmin ? 'Admin' : 'User'}
                  </span>
                </div>
              ) : (
                <Link 
                  to="/login"
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all duration-300 text-sm font-medium"
                >
                  Login
                </Link>
              )}
              
              <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                <FiSettings className="h-5 w-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                <FiBell className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        {/* Hero Section */}
        <div className={`text-center mb-20 ${isVisible ? 'animate-fadeInUp' : 'opacity-0'}`}>
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
              The ultimate unified platform for managers, cashiers, suppliers, and customers. 
              <span className="block mt-2 text-lg text-gray-500">Experience seamless business operations and exceptional customer service.</span>
            </p>
            
            <div className="flex flex-wrap justify-center gap-4 mb-12">
              {stats.map((stat, index) => {
                const IconComponent = stat.icon;
                return (
                  <div 
                    key={index} 
                    className={`flex items-center space-x-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg transition-all duration-500 transform ${
                      showStats ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                    }`}
                    style={{ transitionDelay: `${index * 0.1}s` }}
                  >
                    <IconComponent className={`h-5 w-5 ${stat.color}`} />
                    <span className="font-bold text-gray-900">{stat.number}</span>
                    <span className="text-sm text-gray-600">{stat.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Portal Selection */}
        <div id="portals" className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Choose Your Portal
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Access your personalized workspace designed specifically for your role and responsibilities
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:grid-cols-3 xl:grid-cols-5">
            {userTypes
              .filter(portal => {
                // Show all portals including admin portal
                return true;
              })
              .map((portal, index) => (
              <div
                key={portal.id}
                className={`bg-white rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:scale-105 cursor-pointer overflow-hidden relative ${
                  hoveredCard === portal.id ? 'ring-4 ring-blue-500 ring-opacity-50 scale-105' : ''
                } ${loadingPortal === portal.id ? 'animate-pulse' : 'animate-fadeInUp'} ${
                  portal.isRestricted ? 'border-2 border-red-200' : ''
                } ${
                  portal.id === 'admin' && adminPortalVisible && !isAdmin ? 'animate-pulse-custom border-4 border-red-400 shadow-red-200' : ''
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
                onMouseEnter={() => setHoveredCard(portal.id)}
                onMouseLeave={() => setHoveredCard(null)}
                onClick={() => handlePortalAccess(portal)}
              >
                {/* Restricted Portal Badge */}
                {portal.isRestricted && (
                  <div className="absolute top-4 right-4 z-20">
                    <div className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center space-x-1">
                      <FiShield className="h-3 w-3" />
                      <span>ADMIN</span>
                    </div>
                  </div>
                )}
                
                {/* Special Admin Portal Revealed Badge */}
                {portal.id === 'admin' && adminPortalVisible && !isAdmin && (
                  <div className="absolute top-4 left-4 z-20">
                    <div className="bg-yellow-500 text-black px-2 py-1 rounded-full text-xs font-bold flex items-center space-x-1 animate-bounce">
                      <FiKey className="h-3 w-3" />
                      <span>REVEALED</span>
                    </div>
                  </div>
                )}
                {/* Card Header */}
                <div className={`bg-gradient-to-r ${portal.color} p-8 text-white relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white bg-opacity-10 rounded-full -translate-y-16 translate-x-16"></div>
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-white bg-opacity-10 rounded-full translate-y-12 -translate-x-12"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-5xl animate-float">{portal.icon}</div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{portal.stats.primary}</div>
                        <div className="text-sm opacity-90">Primary Metric</div>
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mb-2">{portal.title}</h3>
                    <p className="text-white text-opacity-90 text-sm">{portal.subtitle}</p>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6">
                  <p className="text-gray-600 mb-6 text-sm leading-relaxed">{portal.description}</p>
                  
                  {/* Portal Preview Badge */}
                  <div className="mb-4">
                    <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                      Portal Active
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">{portal.stats.primary}</div>
                      <div className="text-xs text-gray-500">Primary</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">{portal.stats.secondary}</div>
                      <div className="text-xs text-gray-500">Secondary</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">{portal.stats.tertiary}</div>
                      <div className="text-xs text-gray-500">Tertiary</div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-6">
                    <h4 className="font-semibold text-gray-900 mb-3 text-sm">Key Features:</h4>
                    {portal.features.slice(0, 3).map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-center space-x-2">
                        <FiCheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span className="text-xs text-gray-600">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    className={`w-full bg-gradient-to-r ${portal.color} text-white py-3 px-4 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2 relative overflow-hidden ${
                      portal.isRestricted && !isAdmin ? 'opacity-75' : ''
                    }`}
                    disabled={loadingPortal === portal.id}
                  >
                    {loadingPortal === portal.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        <span>Loading...</span>
                      </>
                    ) : portal.isRestricted && !isAdmin ? (
                      <>
                        <FiKey className="h-4 w-4" />
                        <span>Request Admin Access</span>
                      </>
                    ) : (
                      <>
                        <span>{portal.cta}</span>
                        <FiArrowRight className="h-4 w-4" />
                      </>
                    )}
                    {loadingPortal === portal.id && (
                      <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                    )}
                  </button>
                  
                  {/* Admin Access Notice */}
                  {portal.isRestricted && !isAdmin && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <FiShield className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-red-700">
                          <div className="font-semibold mb-1">Admin Access Required</div>
                          <div>This portal requires administrative privileges. Click to register for admin access.</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Features Section */}
        <div id="features" className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why Choose FAREDEAL?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Built with cutting-edge technology and designed for modern business needs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <div key={index} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 text-center hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3 hover:rotate-1 group">
                  <div className={`w-20 h-20 bg-gradient-to-r ${feature.color} rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300`}>
                    <IconComponent className="h-10 w-10 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Testimonials Section */}
        <div id="testimonials" className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              What Our Users Say
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Hear from managers, cashiers, suppliers, and customers who trust FAREDEAL
            </p>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-8">
            <div className="relative">
              <div className="overflow-hidden">
                {(() => {
                  const availableTestimonials = testimonials.filter(testimonial => {
                    // Show all testimonials including admin testimonial
                    return true;
                  });
                  return (
                    <div 
                      className="flex transition-transform duration-500 ease-in-out"
                      style={{ transform: `translateX(-${currentTestimonial * 100}%)` }}
                    >
                      {availableTestimonials.map((testimonial, index) => (
                        <div key={index} className="w-full flex-shrink-0 px-4">
                          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-8 text-center max-w-4xl mx-auto">
                            <div className="flex items-center justify-center mb-4">
                              <div className="text-6xl mr-4">{testimonial.avatar}</div>
                              <div className="text-left">
                                <div className="flex justify-center mb-2">
                                  {[...Array(testimonial.rating)].map((_, i) => (
                                    <FiStar key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                                  ))}
                                </div>
                                <div className="text-sm font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full inline-block">
                                  {testimonial.portal} Portal
                                </div>
                              </div>
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
                  );
                })()}
              </div>
              
              {/* Testimonial dots */}
              <div className="flex justify-center mt-6 space-x-2">
                {(() => {
                  const availableTestimonials = testimonials.filter(testimonial => {
                    // Show all testimonials including admin testimonial
                    return true;
                  });
                  return availableTestimonials.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentTestimonial(index)}
                      className={`w-3 h-3 rounded-full transition-all duration-300 ${
                        index === currentTestimonial 
                          ? 'bg-blue-500 scale-125' 
                          : 'bg-gray-300 hover:bg-gray-400'
                      }`}
                    />
                  ));
                })()}
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
              Choose your portal above to access your personalized dashboard and start experiencing the power of FAREDEAL.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {userTypes
                .filter(portal => {
                  // Show all portals including admin portal
                  return true;
                })
                .map((portal, index) => (
                <button
                  key={portal.id}
                  onClick={() => handlePortalAccess(portal)}
                  className="group inline-flex items-center px-6 py-3 bg-white/20 backdrop-blur-sm text-white font-semibold rounded-xl hover:bg-white/30 transform hover:scale-105 transition-all duration-300 border border-white/30"
                >
                  <span className="mr-2">{portal.icon}</span>
                  {portal.title}
                  <FiArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-8 right-8 z-50">
        <div className="relative">
          <button
            onClick={() => scrollToSection('portals')}
            className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 flex items-center justify-center text-white animate-pulse-custom"
          >
            <FiNavigation className="h-8 w-8" />
          </button>
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold animate-bounce">
            5
          </div>
        </div>
      </div>

      {/* Scroll to Top Button */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-8 left-8 w-12 h-12 bg-white/80 backdrop-blur-sm rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 flex items-center justify-center text-gray-600 hover:text-blue-600 z-50"
      >
        <FiChevronUp className="h-6 w-6" />
      </button>

      {/* Live Status Indicator */}
      <div className="fixed top-4 right-4 z-50">
        <div className="flex items-center space-x-2 bg-green-500 text-white px-3 py-2 rounded-full shadow-lg">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">Live</span>
        </div>
      </div>

      {/* Portal Access Counter */}
      <div className="fixed top-16 right-4 z-50">
        <div className="flex items-center space-x-2 bg-blue-500 text-white px-3 py-2 rounded-full shadow-lg">
          <span className="text-sm font-medium">Portal Access: {portalAccessCount}</span>
        </div>
      </div>

      {/* Quick Access Menu */}
      <div className="fixed top-20 right-4 z-50">
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Quick Access</h3>
          <button
            onClick={() => scrollToSection('portals')}
            className="block w-full text-left px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            🏢 All Portals
          </button>
          <button
            onClick={() => scrollToSection('features')}
            className="block w-full text-left px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            ⭐ Features
          </button>
          <button
            onClick={() => scrollToSection('testimonials')}
            className="block w-full text-left px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            💬 Testimonials
          </button>
        </div>
      </div>

      {/* Success Notification Overlay */}
      {showSuccess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 text-center shadow-2xl transform animate-bounce">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Portal Access Granted!</h3>
            <p className="text-gray-600">Redirecting you to your portal...</p>
            <div className="mt-4">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Portal Revealed Notification */}
      {showAdminHint && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-gradient-to-r from-red-600 to-pink-600 text-white px-6 py-4 rounded-xl shadow-2xl animate-bounce">
            <div className="flex items-center space-x-3">
              <FiKey className="h-6 w-6 animate-pulse" />
              <div>
                <div className="font-bold text-lg">🔓 Admin Portal Revealed!</div>
                <div className="text-sm opacity-90">Secret sequence detected. Admin access unlocked.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Secret Sequence Indicator (for development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 left-4 bg-gray-800 text-white px-3 py-2 rounded-lg text-xs z-50">
          <div className="opacity-50">Secret: type "admin123" to reveal admin portal</div>
          {keySequence && (
            <div className="text-yellow-400">Typing: {keySequence}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default MainLanding;
