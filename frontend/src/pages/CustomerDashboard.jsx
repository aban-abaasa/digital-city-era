import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiUser,
  FiShoppingBag,
  FiPackage,
  FiTruck,
  FiBriefcase,
  FiUserPlus,
  FiStar,
  FiHeart,
  FiSettings,
  FiLogOut,
  FiBell,
  FiGift,
  FiTrendingUp,
  FiMapPin,
  FiPhone,
  FiMail,
  FiCalendar,
  FiCreditCard,
  FiEye,
  FiEdit,
  FiRefreshCw,
  FiDownload,
  FiShare2,
  FiArrowRight,
  FiZap,
  FiMoreVertical,
  FiX,
  FiCheckCircle,
  FiArrowDownLeft,
  FiArrowUpRight,
  FiMessageCircle,
  FiChevronDown,
} from 'react-icons/fi';
import { getBalance, getTransactions } from '../../../../mybodaguy/frontend/src/mybodaguy/services/icanWalletService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import AnimatedCounter from '../components/AnimatedCounter';
import { orderService } from '../services/orderService';
import { loyaltyService } from '../services/loyaltyService';
import { productService } from '../services/productService';
import { customerService } from '../services/customerService';
import EnhancedRideRequest from '../../../../mybodaguy/frontend/src/mybodaguy/components/EnhancedRideRequest';
import CustomerSelfCheckout from '../../../../mybodaguy/frontend/src/mybodaguy/components/CustomerSelfCheckout';
import IcanCoinBadge from '../components/IcanCoinBadge';
import ICANWalletPage from './ICANWalletPage';
import useSupermarketBranding from '../hooks/useSupermarketBranding';

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const branding = useSupermarketBranding();
  const { user, customer, logout, loading: authLoading, isAuthenticated } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState('overview');
  // Small phones: collapse the membership/stats/actions blocks behind a
  // compact tab switcher instead of stacking three tall sections.
  const [heroTab, setHeroTab] = useState('actions');
  // Overview main column: Recent Orders / Recommended split into small tabs
  // instead of two stacked cards. Tabs stay visible; content collapses.
  const [overviewSubTab, setOverviewSubTab] = useState('orders');
  const [overviewContentOpen, setOverviewContentOpen] = useState(false);
  const [showShoppingModal, setShowShoppingModal] = useState(false);
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [showReferModal, setShowReferModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [referralCode] = useState('FAREDEAL2024');
  
  // Data states
  const [customerData, setCustomerData] = useState({
    recentOrders: [],
    loyaltyRewards: [],
    recommendations: []
  });
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Mobile 3-dot nav
  const [mobileMenuOpen, setMobileMenu] = useState(false);
  const menuRef = useRef(null);

  // ICAN wallet for rewards tab
  const [icanBalance, setIcanBalance] = useState(null);
  const [icanTxs, setIcanTxs]         = useState([]);
  const [icanLoading, setIcanLoading] = useState(false);

  // Real role from Supabase (overrides mock AuthContext)
  const [staffRole, setStaffRole] = useState(null); // 'manager' | 'cashier' | null

  useEffect(() => {
    const fetchRealRole = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;

        const { data } = await supabase
          .from('users')
          .select('role')
          .or(`auth_id.eq.${authUser.id},id.eq.${authUser.id}`)
          .single();

        if (data?.role && ['admin', 'manager', 'cashier'].includes(data.role)) {
          setStaffRole(data.role);
        }
      } catch (_) {
        // Not logged in via Supabase — demo mode, no staff role
      }
    };
    fetchRealRole();
  }, []);
  
  // Mock customer data (fallback for demo)
  const fallbackUser = {
    _id: 'demo-customer-1',
    id: 'demo-customer-1',
    firstName: 'John',
    lastName: 'Doe',
    full_name: 'John Doe',
    email: 'john@example.com',
    phone: '+256700000000',
    membershipLevel: 'gold',
    totalSpent: 2500,
    loyaltyPoints: 1250,
    totalVisits: 15,
    lastVisit: new Date().toISOString(),
    address: {
      street: '123 Main Street',
      city: 'Kampala',
      state: 'Central',
      zipCode: '256'
    }
  };
  
  // Get the user data (real user or fallback)
  const currentUser = user && customer ? {
    ...customer,
    firstName: customer.full_name?.split(' ')[0] || 'Customer',
    lastName: customer.full_name?.split(' ').slice(1).join(' ') || '',
    membershipLevel: loyaltyData?.loyalty_tiers?.name?.toLowerCase() || 'bronze',
    totalSpent: loyaltyData?.lifetime_points ? (loyaltyData.lifetime_points / 0.01) : 0,
    loyaltyPoints: loyaltyData?.points_balance || 0,
    totalVisits: customerData.recentOrders?.length || 0,
    lastVisit: new Date().toISOString()
  } : fallbackUser;

  // Data fetching effect
  useEffect(() => {
    const fetchData = async () => {
      if (!isAuthenticated() || !customer) {
        // Use fallback data for demo
        setCustomerData({
          recentOrders: [
            {
              id: 'ORD-001',
              order_number: 'ORD-001',
              order_date: '2024-01-15',
              status: 'delivered',
              total_amount: 150000,
              order_items: [{ id: 1 }, { id: 2 }, { id: 3 }]
            },
            {
              id: 'ORD-002',
              order_number: 'ORD-002', 
              order_date: '2024-01-10',
              status: 'shipped',
              total_amount: 89500,
              order_items: [{ id: 1 }, { id: 2 }]
            }
          ],
          loyaltyRewards: [
            {
              id: 1,
              title: 'Free Shipping',
              description: 'Get free shipping on your next order',
              points_required: 500,
              is_available: true,
              icon: '🚚'
            }
          ],
          recommendations: [
            {
              id: 1,
              name: 'Wireless Headphones',
              selling_price: 99990,
              product_images: [{ image_url: '🎧' }]
            }
          ]
        });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch customer orders
        const orders = await orderService.getCustomerOrders(customer.id);
        
        // Fetch loyalty data
        const loyalty = await loyaltyService.getCustomerLoyalty(customer.id);
        setLoyaltyData(loyalty);
        
        // Fetch loyalty rewards
        const rewards = await loyaltyService.getAvailableRewards(customer.id);
        
        // Fetch product recommendations (featured products as recommendations)
        const recommendations = await productService.getFeaturedProducts(6);

        setCustomerData({
          recentOrders: orders || [],
          loyaltyRewards: rewards || [],
          recommendations: recommendations || []
        });

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setError(error.message);
        // Use fallback data on error
        setCustomerData({
          recentOrders: [],
          loyaltyRewards: [],
          recommendations: []
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [customer, isAuthenticated]);

  // Live time updates - MUST be before early returns to maintain hook order
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close mobile menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMobileMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Load ICAN wallet when rewards tab opens
  useEffect(() => {
    if (activeTab !== 'rewards' || !user?.id) return;
    setIcanLoading(true);
    Promise.all([getBalance(user.id), getTransactions(user.id, 20)])
      .then(([bal, txs]) => { 
        setIcanBalance(bal); 
        setIcanTxs(txs); 
      })
      .catch(() => {})
      .finally(() => setIcanLoading(false));
  }, [activeTab, user?.id]);

  const switchTab = (id) => { setActiveTab(id); setMobileMenu(false); };

  // Delivery is its own tab, separate from Book Ride — both render
  // EnhancedRideRequest (the one real matching-engine implementation) but
  // each locks it to a single fixedServiceType so Book Ride never shows the
  // delivery toggle and vice versa.
  const ALL_TABS = [
    { id: 'overview', label: 'Overview', emoji: '🏠' },
    { id: 'book-ride', label: 'Book Ride', emoji: '🏍️' },
    { id: 'shop', label: 'Shop', emoji: '🛒' },
    { id: 'delivery', label: 'Delivery', emoji: '📦' },
    { id: 'rewards', label: 'Rewards', emoji: '🎁' },
    { id: 'profile', label: 'Profile', emoji: '👤' },
  ];

  // Authentication check for non-demo mode
  // For demo, we'll use fallback data
  
  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/customer-login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Error logging out');
    }
  };

  // Quick Actions Handlers
  const handleStartShopping = () => {
    setShowShoppingModal(true);
  };

  const handleTrackOrders = () => {
    setShowTrackModal(true);
  };

  const handleRedeemRewards = () => {
    setShowRewardsModal(true);
  };

  const handleReferFriends = () => {
    setShowReferModal(true);
  };

  const handleCreateSupermarket = () => {
    toast.info('Opening the admin setup flow.');
    navigate('/admin-setup');
  };

  const handleBecomeSupplier = () => {
    toast.info('Opening the supplier application flow.');
    navigate('/supplier-auth');
  };

  const handleTrackOrder = async () => {
    if (trackingNumber) {
      try {
        if (customer && customer.id) {
          // Try to track with real data first
          const order = await orderService.trackOrder(trackingNumber);
          if (order) {
            toast.success(`Tracking ${trackingNumber}: ${order.status}`);
            setShowTrackModal(false);
            setTrackingNumber('');
            return;
          }
        }
        
        // Fallback to demo behavior
        toast.success(`Tracking order: ${trackingNumber}`);
        setShowTrackModal(false);
        setTrackingNumber('');
      } catch (error) {
        console.error('Tracking error:', error);
        if (error.code === 404) {
          toast.error('Order not found. Please check your tracking number.');
        } else {
          toast.error('Unable to track order at this time.');
        }
      }
    } else {
      toast.error('Please enter a tracking number');
    }
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText(referralCode);
    toast.success('Referral code copied to clipboard!');
  };

  const formatCurrency = (amount) => {
    // Convert from UGX (database stores in UGX cents)
    const ugxAmount = typeof amount === 'number' ? amount : 0;
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(ugxAmount);
  };

  const getMembershipColor = (level) => {
    switch (level) {
      case 'platinum': return 'from-purple-500 to-purple-600';
      case 'gold': return 'from-yellow-500 to-yellow-600';
      case 'silver': return 'from-gray-500 to-gray-600';
      default: return 'from-orange-500 to-orange-600';
    }
  };

  // Small tier badge — icon + label chip shown next to the membership title
  const getMembershipBadge = (level) => {
    switch (level) {
      case 'platinum': return { icon: '💎', label: 'Platinum' };
      case 'gold': return { icon: '🥇', label: 'Gold' };
      case 'silver': return { icon: '🥈', label: 'Silver' };
      default: return { icon: '🥉', label: 'Bronze' };
    }
  };

  // Real "member since" year from the customer's actual account creation date
  const memberSinceYear = customer?.created_at
    ? new Date(customer.created_at).getFullYear()
    : new Date().getFullYear();

  const getStatusColor = (status) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'shipped': return 'bg-blue-100 text-blue-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // No loading or authentication checks needed for demo

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 bg-cover bg-center bg-fixed"
      style={branding.backgroundUrl ? {
        backgroundImage: `linear-gradient(rgba(249,250,251,0.92), rgba(239,246,255,0.92)), url(${branding.backgroundUrl})`
      } : undefined}
    >
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { 
              opacity: 0;
              transform: translateY(30px);
            }
            to { 
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes bounceIn {
            0% { 
              opacity: 0;
              transform: scale(0.3);
            }
            50% { 
              opacity: 1;
              transform: scale(1.05);
            }
            70% { 
              transform: scale(0.9);
            }
            100% { 
              opacity: 1;
              transform: scale(1);
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
          .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
          .animate-slideUp { animation: slideUp 0.4s ease-out; }
          .animate-bounceIn { animation: bounceIn 0.6s ease-out; }
          .animate-wiggle { animation: wiggle 1s ease-in-out; }
          .animate-wiggle:hover { animation: wiggle 0.5s ease-in-out; }
        `
      }} />
      {/* Header — 2 rows: brand + nav */}
      <div className="sticky top-0 z-50 shadow-md">
        {/* Row 1 — brand + user + mobile 3-dot */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <FiUser className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="font-bold leading-none text-sm">Hi, {currentUser.firstName}! 👋</p>
                  <p className="text-[10px] opacity-75">{currentTime.toLocaleTimeString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors">
                  <FiBell className="h-4 w-4" />
                </button>
                <button className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors hidden sm:flex">
                  <FiSettings className="h-4 w-4" />
                </button>
                <button onClick={handleLogout}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-colors">
                  <FiLogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2 — nav tabs (desktop only) */}
        <div className="hidden sm:block bg-white border-b border-blue-100">
          <div className="max-w-7xl mx-auto px-2">
            <nav className="flex overflow-x-auto scrollbar-hide gap-0.5 py-1 items-center">
              {ALL_TABS.map(tab => (
                <button key={tab.id} onClick={() => switchTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                  }`}>
                  <span>{tab.emoji}</span>
                  {tab.label}
                </button>
              ))}
              <button onClick={() => setActiveTab('ican-wallet')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                  activeTab === 'ican-wallet' 
                    ? 'bg-violet-100 text-violet-700 font-semibold' 
                    : 'text-violet-600 hover:bg-violet-50'
                }`}>
                <span>₡</span> IcanEra Wallet
              </button>
              <div className="ml-auto flex-shrink-0 pr-1">
                <div className="w-36"><IcanCoinBadge onOpen={() => setActiveTab('ican-wallet')} /></div>
              </div>
            </nav>
          </div>
        </div>

        {/* Mobile active-tab bar — the one and only mobile menu trigger */}
        <div className="sm:hidden bg-white border-b border-blue-100 px-4 py-2 flex items-center justify-between relative" ref={menuRef}>
          <span className="text-sm font-semibold text-slate-700">
            {ALL_TABS.find(t => t.id === activeTab)?.emoji}{' '}
            {ALL_TABS.find(t => t.id === activeTab)?.label}
          </span>
          <button onClick={() => setMobileMenu(o => !o)}
            className="text-xs text-blue-500 font-medium flex items-center gap-1">
            {mobileMenuOpen ? <FiX className="h-3.5 w-3.5" /> : <FiMoreVertical className="h-3.5 w-3.5" />} Menu
          </button>
          {mobileMenuOpen && (
            <div className="absolute right-4 top-full mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50">
              {ALL_TABS.map(tab => (
                <button key={tab.id} onClick={() => switchTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left
                    ${activeTab === tab.id ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-50'}`}>
                  <span>{tab.emoji}</span>
                  {tab.label}
                  {activeTab === tab.id && <FiCheckCircle className="ml-auto text-blue-500 h-3.5 w-3.5" />}
                </button>
              ))}
              <button onClick={() => { setActiveTab('ican-wallet'); setMobileMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-violet-600 hover:bg-violet-50 border-t border-slate-100">
                <span>₡</span> IcanEra Wallet
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Role Banner — admin / manager / cashier */}
      {staffRole && (() => {
        const config = {
          admin:   { path: '/admin-portal',   icon: '⚙️', label: 'Admin',   gradient: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1d4ed8 100%)' },
          manager: { path: '/manager-portal', icon: '👔', label: 'Manager', gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)' },
          cashier: { path: '/cashier-portal', icon: '💰', label: 'Cashier', gradient: 'linear-gradient(135deg, #f59e0b 0%, #f97316 50%, #ef4444 100%)' },
        }[staffRole];
        return (
          <div onClick={() => navigate(config.path)} className="cursor-pointer" style={{ background: config.gradient }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{config.icon}</span>
                <div>
                  <p className="text-white font-semibold text-sm">You have {config.label} access</p>
                  <p className="text-white/80 text-xs">Tap to open your {config.label} Portal</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-colors rounded-lg px-4 py-2">
                <FiZap className="text-white h-4 w-4" />
                <span className="text-white font-bold text-sm">Open {config.label} Portal</span>
                <FiArrowRight className="text-white h-4 w-4" />
              </div>
            </div>
          </div>
        );
      })()}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Small phones: membership / stats / actions collapsed behind a
            small tab switcher — full real content per tab, just one
            section visible at a time instead of three stacked full-height
            blocks before any real page content. */}
        <div className="sm:hidden mb-6">
          <div className="flex gap-1 mb-3 bg-gray-100 rounded-xl p-1">
            {[
              { id: 'membership', label: '👑 Membership' },
              { id: 'stats', label: '📊 Stats' },
              { id: 'actions', label: '⚡ Actions' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setHeroTab(t.id)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  heroTab === t.id ? 'bg-white shadow text-gray-900' : 'text-gray-500'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {heroTab === 'membership' && (
            <div className={`bg-gradient-to-r ${getMembershipColor(currentUser.membershipLevel)} rounded-2xl p-5 text-white relative overflow-hidden`}>
              <div className="absolute inset-0 bg-black/10"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl font-bold">
                    Your {currentUser.membershipLevel.charAt(0).toUpperCase() + currentUser.membershipLevel.slice(1)} Membership
                  </h1>
                  <span className="inline-flex items-center gap-1 bg-white/25 backdrop-blur-sm rounded-full px-2 py-0.5 text-[11px] font-semibold flex-shrink-0">
                    {getMembershipBadge(currentUser.membershipLevel).icon} {getMembershipBadge(currentUser.membershipLevel).label}
                  </span>
                </div>
                <p className="text-white/90 text-sm mb-4">Enjoy exclusive benefits and rewards</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2.5 text-center">
                    <div className="text-base mb-0.5">⭐</div>
                    <div className="text-lg font-bold"><AnimatedCounter end={currentUser.loyaltyPoints} duration={2000} /></div>
                    <div className="text-white/90 text-[10px] leading-tight">Loyalty Points</div>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2.5 text-center">
                    <div className="text-base mb-0.5">🛍️</div>
                    <div className="text-lg font-bold"><AnimatedCounter end={currentUser.totalVisits} duration={1500} /></div>
                    <div className="text-white/90 text-[10px] leading-tight">Total Visits</div>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2.5 text-center">
                    <div className="text-base mb-0.5">💰</div>
                    <div className="text-sm font-bold">{formatCurrency(currentUser.totalSpent)}</div>
                    <div className="text-white/90 text-[10px] leading-tight">Total Spent</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {heroTab === 'stats' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-gray-600 text-[11px] truncate">Active Orders</p>
                    <p className="text-xl font-bold text-gray-900">
                      <AnimatedCounter end={customerData.recentOrders.filter(o => o.status !== 'delivered').length} duration={1000} />
                    </p>
                  </div>
                  <FiPackage className="h-6 w-6 text-blue-500 flex-shrink-0" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-gray-600 text-[11px] truncate">Available Rewards</p>
                    <p className="text-xl font-bold text-gray-900">
                      <AnimatedCounter end={customerData.loyaltyRewards.filter(r => r.earned).length} duration={1200} />
                    </p>
                  </div>
                  <FiGift className="h-6 w-6 text-green-500 flex-shrink-0" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-gray-600 text-[11px] truncate">Member Since</p>
                    <p className="text-xl font-bold text-gray-900">{memberSinceYear}</p>
                  </div>
                  <FiStar className="h-6 w-6 text-yellow-500 flex-shrink-0" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-gray-600 text-[11px] truncate">Next Reward</p>
                    <p className="text-xl font-bold text-gray-900">{1000 - (currentUser.loyaltyPoints % 1000)} pts</p>
                  </div>
                  <FiTrendingUp className="h-6 w-6 text-purple-500 flex-shrink-0" />
                </div>
              </div>
            </div>
          )}

          {heroTab === 'actions' && (
            <div className="space-y-3">
              <button
                onClick={handleStartShopping}
                className="w-full text-left bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-4 text-white shadow-lg active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <FiShoppingBag className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm">Shop the Store</h3>
                    <p className="text-blue-100 text-xs mt-0.5">
                      Browse products, track orders, and start shopping right away.
                    </p>
                  </div>
                  <FiShare2 className="h-4 w-4 flex-shrink-0 mt-1" />
                </div>
              </button>

              <button
                onClick={handleCreateSupermarket}
                className="w-full text-left bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-4 text-white shadow-lg active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <FiBriefcase className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm">Create Your Supermarket</h3>
                    <p className="text-emerald-100 text-xs mt-0.5">
                      Open the admin setup flow to create a supermarket and assign managers or cashiers.
                    </p>
                  </div>
                  <FiShare2 className="h-4 w-4 flex-shrink-0 mt-1" />
                </div>
              </button>

              <button
                onClick={handleBecomeSupplier}
                className="w-full text-left bg-gradient-to-br from-purple-600 to-fuchsia-700 rounded-2xl p-4 text-white shadow-lg active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <FiUserPlus className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm">Become a Supplier</h3>
                    <p className="text-fuchsia-100 text-xs mt-0.5">
                      Apply to available supermarkets from the supplier onboarding page.
                    </p>
                  </div>
                  <FiShare2 className="h-4 w-4 flex-shrink-0 mt-1" />
                </div>
              </button>
            </div>
          )}
        </div>

        {/* sm and up: full stacked layout — there's room to show everything at once */}
        <div className="hidden sm:block">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className={`bg-gradient-to-r ${getMembershipColor(currentUser.membershipLevel)} rounded-3xl p-8 text-white relative overflow-hidden`}>
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold">
                      Your {currentUser.membershipLevel.charAt(0).toUpperCase() + currentUser.membershipLevel.slice(1)} Membership
                    </h1>
                    <span className="inline-flex items-center gap-1.5 bg-white/25 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-semibold">
                      {getMembershipBadge(currentUser.membershipLevel).icon} {getMembershipBadge(currentUser.membershipLevel).label}
                    </span>
                  </div>
                  <p className="text-white/90 text-lg">
                    Enjoy exclusive benefits and rewards
                  </p>
                </div>
                <div className="hidden md:block">
                  <div className="text-6xl opacity-20">{getMembershipBadge(currentUser.membershipLevel).icon}</div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                  <div className="text-xl mb-1">⭐</div>
                  <div className="text-2xl font-bold">
                    <AnimatedCounter end={currentUser.loyaltyPoints} duration={2000} />
                  </div>
                  <div className="text-white/90 text-sm">Loyalty Points</div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                  <div className="text-xl mb-1">🛍️</div>
                  <div className="text-2xl font-bold">
                    <AnimatedCounter end={currentUser.totalVisits} duration={1500} />
                  </div>
                  <div className="text-white/90 text-sm">Total Visits</div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                  <div className="text-xl mb-1">💰</div>
                  <div className="text-2xl font-bold">
                    {formatCurrency(currentUser.totalSpent)}
                  </div>
                  <div className="text-white/90 text-sm">Total Spent</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Active Orders</p>
                <p className="text-2xl font-bold text-gray-900">
                  <AnimatedCounter end={customerData.recentOrders.filter(o => o.status !== 'delivered').length} duration={1000} />
                </p>
              </div>
              <FiPackage className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Available Rewards</p>
                <p className="text-2xl font-bold text-gray-900">
                  <AnimatedCounter end={customerData.loyaltyRewards.filter(r => r.earned).length} duration={1200} />
                </p>
              </div>
              <FiGift className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Member Since</p>
                <p className="text-2xl font-bold text-gray-900">{memberSinceYear}</p>
              </div>
              <FiStar className="h-8 w-8 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Next Reward</p>
                                  <p className="text-2xl font-bold text-gray-900">
                    {1000 - (currentUser.loyaltyPoints % 1000)} pts
                  </p>
              </div>
              <FiTrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Primary Hub Actions */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={handleStartShopping}
              className="group text-left bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-6 text-white shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
                <FiShoppingBag className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">Shop the Store</h3>
              <p className="text-blue-100 text-sm mb-4">
                Browse products, track orders, and start shopping right away.
              </p>
              <span className="inline-flex items-center text-sm font-semibold">
                Start Now
                <FiShare2 className="ml-2 h-4 w-4" />
              </span>
            </button>

            <button
              onClick={handleCreateSupermarket}
              className="group text-left bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-6 text-white shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
                <FiBriefcase className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">Create Your Supermarket</h3>
              <p className="text-emerald-100 text-sm mb-4">
                Open the admin setup flow to create a supermarket and assign managers or cashiers.
              </p>
              <span className="inline-flex items-center text-sm font-semibold">
                Admin Setup
                <FiShare2 className="ml-2 h-4 w-4" />
              </span>
            </button>

            <button
              onClick={handleBecomeSupplier}
              className="group text-left bg-gradient-to-br from-purple-600 to-fuchsia-700 rounded-3xl p-6 text-white shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
                <FiUserPlus className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">Become a Supplier</h3>
              <p className="text-fuchsia-100 text-sm mb-4">
                Apply to available supermarkets from the supplier onboarding page.
              </p>
              <span className="inline-flex items-center text-sm font-semibold">
                Open Supplier Flow
                <FiShare2 className="ml-2 h-4 w-4" />
              </span>
            </button>
          </div>
        </div>
        </div>
        {/* end sm-and-up hero/stats/actions wrapper */}

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Small sub-tabs instead of two stacked cards — tabs always
                    visible, the content panel below collapses to save space. */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                    <button
                      onClick={() => { setOverviewSubTab('orders'); setOverviewContentOpen(true); }}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        overviewSubTab === 'orders' && overviewContentOpen
                          ? 'bg-gradient-to-r from-green-600 to-yellow-500 text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <FiShoppingBag className="h-4 w-4" /> Recent Orders
                    </button>
                    <button
                      onClick={() => { setOverviewSubTab('recommended'); setOverviewContentOpen(true); }}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        overviewSubTab === 'recommended' && overviewContentOpen
                          ? 'bg-gradient-to-r from-green-600 to-yellow-500 text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <FiHeart className="h-4 w-4" /> Recommended
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOverviewContentOpen((o) => !o)}
                    className="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    title={overviewContentOpen ? 'Collapse' : 'Expand'}
                  >
                    <FiChevronDown className={`h-5 w-5 transition-transform ${overviewContentOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {overviewContentOpen && overviewSubTab === 'orders' && (
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="space-y-4">
                      {customerData.recentOrders.slice(0, 3).map((order) => (
                        <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                              <FiPackage className="h-6 w-6 text-green-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{order.order_number || order.id}</p>
                              <p className="text-sm text-gray-600">
                                {new Date(order.order_date || order.date).toLocaleDateString()} •
                                {order.order_items?.length || order.items} items
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900">
                              {formatCurrency(order.total_amount || order.total)}
                            </p>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                              {order.status}
                            </span>
                          </div>
                        </div>
                      ))}
                      {customerData.recentOrders.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <FiPackage className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No orders yet. Start shopping to see your orders here!</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {overviewContentOpen && overviewSubTab === 'recommended' && (
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {customerData.recommendations.slice(0, 3).map((product) => (
                        <div key={product.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md hover:border-yellow-300 transition-all">
                          <div className="text-3xl mb-2">
                            {product.product_images?.[0]?.image_url || product.image || '📦'}
                          </div>
                          <h4 className="font-medium text-gray-900">{product.name}</h4>
                          <p className="text-sm text-gray-600">{product.categories?.name || product.category || 'Product'}</p>
                          <p className="text-lg font-bold text-green-600 mt-2">
                            {formatCurrency(product.selling_price || product.price)}
                          </p>
                        </div>
                      ))}
                      {customerData.recommendations.length === 0 && (
                        <div className="col-span-3 text-center py-8 text-gray-500">
                          <FiHeart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No recommendations available at the moment.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Book Ride — mybodaguy ride booking */}
            {activeTab === 'book-ride' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <EnhancedRideRequest customerId={user?.id} fixedServiceType="ride" />
              </div>
            )}

            {/* Delivery — same real matching-engine flow as Book Ride,
                locked to delivery so the two never mix */}
            {activeTab === 'delivery' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <EnhancedRideRequest customerId={user?.id} fixedServiceType="delivery" />
              </div>
            )}

            {/* Shop — self-checkout POS */}
            {activeTab === 'shop' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <CustomerSelfCheckout user={user} />
              </div>
            )}

            {activeTab === 'rewards' && (
              <div className="space-y-4">
                {/* ICAN balance card */}
                <div className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl p-5 text-white">
                  <p className="text-violet-200 text-sm mb-1">IcanEra Balance</p>
                  <p className="text-4xl font-bold">
                    {icanLoading ? '…' : (icanBalance?.ican ?? 0).toFixed(4)} <span className="text-2xl">₡</span>
                  </p>
                  <p className="text-violet-200 text-xs mt-1">≈ UGX {icanLoading ? '…' : Number(icanBalance?.ugx ?? 0).toLocaleString()}</p>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                    {[
                      { label: 'Earned', value: icanBalance?.totalEarned },
                      { label: 'Spent',  value: icanBalance?.totalSpent },
                      { label: 'Tithe',  value: icanBalance?.totalTithe },
                    ].map(s => (
                      <div key={s.label} className="bg-white/10 rounded-xl p-2">
                        <p className="text-xs text-violet-200">{s.label}</p>
                        <p className="font-bold text-sm">{icanLoading ? '…' : (s.value ?? 0).toFixed(2)} ₡</p>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setActiveTab('ican-wallet')}
                    className="mt-4 w-full py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors">
                    Open Full Wallet →
                  </button>
                </div>

                {/* Loyalty points (existing) */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <FiStar className="text-yellow-500" /> Loyalty Points
                  </h4>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-3xl font-bold text-gray-900">{currentUser.loyaltyPoints}</p>
                      <p className="text-sm text-gray-500">points balance</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">{1000 - (currentUser.loyaltyPoints % 1000)} pts to next reward</p>
                      <div className="w-32 h-2 bg-gray-200 rounded-full mt-1">
                        <div className="h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                          style={{ width: `${(currentUser.loyaltyPoints % 1000) / 10}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {customerData.loyaltyRewards.slice(0, 3).map(r => (
                      <div key={r.id} className={`flex items-center justify-between p-3 rounded-lg border ${r.is_available ? 'border-green-200 bg-green-50' : 'border-gray-100'}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{r.icon || '🎁'}</span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{r.title}</p>
                            <p className="text-xs text-gray-500">{r.points_required || r.points} pts</p>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${r.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {r.is_available ? 'Available' : 'Locked'}
                        </span>
                      </div>
                    ))}
                    {customerData.loyaltyRewards.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-3">Keep shopping to unlock rewards!</p>
                    )}
                  </div>
                </div>

                {/* ICAN transaction history */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <FiTrendingUp className="text-blue-500" /> ICAN Transactions
                  </h4>
                  {icanLoading ? (
                    <p className="text-gray-400 text-sm text-center py-4">Loading…</p>
                  ) : icanTxs.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-4">No ICAN transactions yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {icanTxs.map(tx => (
                        <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                          <div className="flex items-center gap-2">
                            {tx.direction === 'in'
                              ? <FiArrowDownLeft className="text-emerald-500 h-4 w-4" />
                              : <FiArrowUpRight className="text-red-400 h-4 w-4" />}
                            <div>
                              <p className="text-sm text-gray-700 font-medium capitalize">{tx.transaction_type.replace('_', ' ')}</p>
                              <p className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <p className={`font-bold text-sm ${tx.direction === 'in' ? 'text-emerald-600' : 'text-red-500'}`}>
                            {tx.direction === 'in' ? '+' : '-'}{tx.ican_amount.toFixed(4)} ₡
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Full ICAN Wallet Tab - Unified with other apps */}
            {activeTab === 'ican-wallet' && (
              <div className="mt-0 -mx-4 sm:-mx-0">
                <ICANWalletPage embedded={true} userId={user?.id} />
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Profile Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                    <input
                      type="text"
                      value={currentUser.firstName}
                      className="block w-full border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                    <input
                      type="text"
                      value={currentUser.lastName}
                      className="block w-full border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={currentUser.email || 'N/A'}
                      className="block w-full border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                    <input
                      type="tel"
                      value={currentUser.phone}
                      className="block w-full border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                      readOnly
                    />
                  </div>
                </div>
                <div className="mt-6">
                  <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <FiEdit className="h-4 w-4 mr-2" />
                    Edit Profile
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions — no header/collapse, just the compact tab-style
                grid, always visible */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleStartShopping}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-100 transition-colors"
                >
                  <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FiShoppingBag className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-xs font-semibold text-gray-800 text-center leading-tight">Start Shopping</span>
                </button>

                <button
                  onClick={handleTrackOrders}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-green-50 hover:bg-green-100 border border-green-100 transition-colors"
                >
                  <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
                    <FiTruck className="h-4 w-4 text-green-600" />
                  </div>
                  <span className="text-xs font-semibold text-gray-800 text-center leading-tight">Track Orders</span>
                </button>

                <button
                  onClick={handleRedeemRewards}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-100 transition-colors"
                >
                  <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
                    <FiGift className="h-4 w-4 text-purple-600" />
                  </div>
                  <span className="text-xs font-semibold text-gray-800 text-center leading-tight">Redeem Rewards</span>
                </button>

                <button
                  onClick={handleReferFriends}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-100 transition-colors"
                >
                  <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center">
                    <FiShare2 className="h-4 w-4 text-orange-600" />
                  </div>
                  <span className="text-xs font-semibold text-gray-800 text-center leading-tight">Refer Friends</span>
                </button>
              </div>
            </div>

            {/* Contact Support — opens the real support chat (ChatWidget),
                not a static phone number nobody's answering */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <FiMessageCircle className="h-5 w-5 text-green-600" /> Need Help?
              </h3>
              <p className="text-sm text-gray-500 mb-4">Chat live with our support team — real people, real answers.</p>
              <button
                onClick={() => window.dispatchEvent(new Event('faredeal:open-support-chat'))}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-yellow-500 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity shadow-sm"
              >
                <FiMessageCircle className="h-4 w-4" /> Chat with Support
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Shopping Modal */}
      {showShoppingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 animate-fadeIn">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 shadow-2xl rounded-2xl bg-white animate-slideUp">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900 flex items-center">
                  <span className="mr-3 text-3xl animate-bounce">🛍️</span>
                  Start Shopping
                </h3>
                <button
                  onClick={() => setShowShoppingModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200 hover:scale-110 transform"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="text-center py-8">
                <div className="text-8xl mb-6 animate-pulse">🛒</div>
                <h4 className="text-2xl font-bold text-gray-900 mb-3">Ready to Shop?</h4>
                <p className="text-gray-600 mb-8 text-lg">Discover amazing deals and exclusive offers just for you!</p>
                
                {/* Shopping Categories */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105 cursor-pointer">
                    <div className="text-3xl mb-2">🍎</div>
                    <h5 className="font-semibold text-blue-800">Fresh Groceries</h5>
                    <p className="text-sm text-blue-600">Farm to table</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105 cursor-pointer">
                    <div className="text-3xl mb-2">📱</div>
                    <h5 className="font-semibold text-green-800">Electronics</h5>
                    <p className="text-sm text-green-600">Latest gadgets</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105 cursor-pointer">
                    <div className="text-3xl mb-2">👕</div>
                    <h5 className="font-semibold text-purple-800">Fashion</h5>
                    <p className="text-sm text-purple-600">Trendy styles</p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl hover:shadow-lg transition-all duration-300 transform hover:scale-105 cursor-pointer">
                    <div className="text-3xl mb-2">🏠</div>
                    <h5 className="font-semibold text-orange-800">Home & Garden</h5>
                    <p className="text-sm text-orange-600">Make it yours</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <button
                    onClick={() => {
                      setShowShoppingModal(false);
                      navigate('/customer-delivery');
                    }}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 px-8 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300 transform hover:scale-105 hover:shadow-xl font-semibold text-lg"
                  >
                    🚀 Start Shopping Now
                  </button>
                  <button
                    onClick={() => setShowShoppingModal(false)}
                    className="w-full border-2 border-gray-300 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-300 transform hover:scale-105"
                  >
                    Maybe Later
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Track Orders Modal */}
      {showTrackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 animate-fadeIn">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 shadow-2xl rounded-2xl bg-white animate-slideUp">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900 flex items-center">
                  <span className="mr-3 text-3xl animate-pulse">📦</span>
                  Track Your Order
                </h3>
                <button
                  onClick={() => setShowTrackModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200 hover:scale-110 transform"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">🔍 Tracking Number</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="Enter your tracking number"
                      className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-300 text-lg"
                    />
                    <div className="absolute right-3 top-3">
                      <span className="text-gray-400">🔍</span>
                    </div>
                  </div>
                </div>
                
                {/* Live Tracking Simulation */}
                {trackingNumber && (
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-xl border border-green-200 animate-fadeIn">
                    <h4 className="font-bold text-green-900 mb-4 flex items-center">
                      <span className="mr-2">🚚</span>
                      Live Tracking: {trackingNumber}
                    </h4>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-green-800 font-medium">Order Confirmed</span>
                        <span className="text-sm text-gray-500">2 hours ago</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-green-800 font-medium">Picked Up</span>
                        <span className="text-sm text-gray-500">1 hour ago</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-4 h-4 bg-yellow-500 rounded-full animate-pulse"></div>
                        <span className="text-yellow-800 font-medium">In Transit</span>
                        <span className="text-sm text-gray-500">Currently</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-4 h-4 bg-gray-300 rounded-full"></div>
                        <span className="text-gray-600">Out for Delivery</span>
                        <span className="text-sm text-gray-500">Estimated 2:30 PM</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                  <h4 className="font-bold text-blue-900 mb-4 flex items-center">
                    <span className="mr-2">📋</span>
                    Recent Orders
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-white rounded-lg hover:shadow-md transition-all duration-300 transform hover:scale-105">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">📦</span>
                        <div>
                          <span className="font-semibold text-blue-900">ORD-001</span>
                          <p className="text-sm text-gray-600">Delivered • 2 days ago</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setTrackingNumber('ORD-001');
                          toast.success('Tracking ORD-001');
                        }}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-105"
                      >
                        View Details
                      </button>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white rounded-lg hover:shadow-md transition-all duration-300 transform hover:scale-105">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">🚚</span>
                        <div>
                          <span className="font-semibold text-green-900">ORD-002</span>
                          <p className="text-sm text-gray-600">In Transit • ETA 2:30 PM</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setTrackingNumber('ORD-002');
                          toast.success('Tracking ORD-002');
                        }}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all duration-300 transform hover:scale-105"
                      >
                        Track Live
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-4">
                  <button
                    onClick={handleTrackOrder}
                    className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-3 px-6 rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-300 transform hover:scale-105 hover:shadow-xl font-semibold"
                  >
                    🔍 Track Order
                  </button>
                  <button
                    onClick={() => setShowTrackModal(false)}
                    className="flex-1 border-2 border-gray-300 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-300 transform hover:scale-105"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Redeem Rewards Modal */}
      {showRewardsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 animate-fadeIn">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 shadow-2xl rounded-2xl bg-white animate-slideUp">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900 flex items-center">
                  <span className="mr-3 text-3xl animate-spin">🎁</span>
                  Redeem Rewards
                </h3>
                <button
                  onClick={() => setShowRewardsModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200 hover:scale-110 transform"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-6">
                {/* Points Display */}
                <div className="text-center bg-gradient-to-r from-purple-100 to-pink-100 p-6 rounded-2xl border border-purple-200">
                  <div className="text-6xl mb-3 animate-bounce">⭐</div>
                  <h4 className="text-2xl font-bold text-purple-900 mb-2">Your Loyalty Points</h4>
                  <div className="text-4xl font-bold text-purple-700 mb-2">{currentUser.loyaltyPoints.toLocaleString()}</div>
                  <p className="text-purple-600">Available for redemption</p>
                </div>
                
                {/* Rewards Grid */}
                <div className="space-y-4">
                  <h5 className="text-lg font-semibold text-gray-900 flex items-center">
                    <span className="mr-2">🏆</span>
                    Available Rewards
                  </h5>
                  <div className="grid grid-cols-1 gap-4">
                    {customerData.loyaltyRewards.filter(reward => reward.earned).map((reward, index) => (
                      <div key={reward.id} className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-5 hover:shadow-lg transition-all duration-300 transform hover:scale-105 animate-fadeIn" style={{animationDelay: `${index * 100}ms`}}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="text-3xl">{reward.icon}</div>
                            <div>
                              <h6 className="font-bold text-green-900 text-lg">{reward.title}</h6>
                              <p className="text-green-700">{reward.description}</p>
                              <div className="flex items-center mt-2">
                                <span className="text-sm font-semibold text-green-600 bg-green-100 px-2 py-1 rounded-full">
                                  {reward.pointsRequired} points
                                </span>
                                <span className="ml-2 text-sm text-green-600">• {reward.discount}% off</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                if (customer && customer.id) {
                                  // Real redemption
                                  await loyaltyService.redeemPoints(
                                    customer.id, 
                                    reward.points_required || reward.pointsRequired,
                                    `Redeemed: ${reward.title}`
                                  );
                                  
                                  // Refresh loyalty data
                                  const updatedLoyalty = await loyaltyService.getCustomerLoyalty(customer.id);
                                  setLoyaltyData(updatedLoyalty);
                                  
                                  // Refresh rewards
                                  const updatedRewards = await loyaltyService.getAvailableRewards(customer.id);
                                  setCustomerData(prev => ({
                                    ...prev,
                                    loyaltyRewards: updatedRewards
                                  }));
                                }
                                
                                toast.success(`🎉 Redeemed: ${reward.title}! ${reward.description}`);
                                setShowRewardsModal(false);
                              } catch (error) {
                                console.error('Redemption error:', error);
                                toast.error(error.message || 'Failed to redeem reward');
                              }
                            }}
                            className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 transform hover:scale-105 hover:shadow-xl font-semibold"
                          >
                            Redeem Now
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Special Offers */}
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-6 rounded-xl border border-yellow-200">
                  <h5 className="text-lg font-bold text-orange-900 mb-4 flex items-center">
                    <span className="mr-2">🔥</span>
                    Limited Time Offers
                  </h5>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">🎯</span>
                        <div>
                          <span className="font-semibold text-orange-900">Double Points Weekend</span>
                          <p className="text-sm text-orange-700">Earn 2x points on all purchases</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                        Active
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">🎪</span>
                        <div>
                          <span className="font-semibold text-orange-900">Birthday Bonus</span>
                          <p className="text-sm text-orange-700">500 bonus points this month</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                        Claim
                      </span>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowRewardsModal(false)}
                  className="w-full border-2 border-gray-300 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-300 transform hover:scale-105"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refer Friends Modal */}
      {showReferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 animate-fadeIn">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 shadow-2xl rounded-2xl bg-white animate-slideUp">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900 flex items-center">
                  <span className="mr-3 text-3xl animate-ping">👥</span>
                  Refer Friends
                </h3>
                <button
                  onClick={() => setShowReferModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200 hover:scale-110 transform"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-6">
                {/* Header */}
                <div className="text-center bg-gradient-to-r from-orange-100 to-red-100 p-6 rounded-2xl border border-orange-200">
                  <div className="text-6xl mb-3 animate-bounce">🎉</div>
                  <h4 className="text-2xl font-bold text-orange-900 mb-2">Earn Rewards for Referring Friends!</h4>
                  <p className="text-orange-700 text-lg">Share your referral code and earn 100 points for each friend who joins</p>
                </div>
                
                {/* Referral Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center bg-blue-50 p-4 rounded-xl border border-blue-200">
                    <div className="text-2xl font-bold text-blue-600">3</div>
                    <div className="text-sm text-blue-700">Friends Referred</div>
                  </div>
                  <div className="text-center bg-green-50 p-4 rounded-xl border border-green-200">
                    <div className="text-2xl font-bold text-green-600">300</div>
                    <div className="text-sm text-green-700">Points Earned</div>
                  </div>
                  <div className="text-center bg-purple-50 p-4 rounded-xl border border-purple-200">
                    <div className="text-2xl font-bold text-purple-600">5</div>
                    <div className="text-sm text-purple-700">More to Go</div>
                  </div>
                </div>
                
                {/* Referral Code */}
                <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-6 rounded-xl border border-orange-200">
                  <label className="block text-lg font-bold text-orange-900 mb-3">🎯 Your Referral Code</label>
                  <div className="flex space-x-3">
                    <input
                      type="text"
                      value={referralCode}
                      readOnly
                      className="flex-1 border-2 border-orange-300 rounded-xl px-4 py-3 bg-white text-center text-xl font-bold text-orange-800"
                    />
                    <button
                      onClick={copyReferralCode}
                      className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-3 rounded-xl hover:from-orange-700 hover:to-red-700 transition-all duration-300 transform hover:scale-105 hover:shadow-xl font-semibold"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
                
                {/* Share Options */}
                <div className="space-y-4">
                  <h5 className="text-lg font-bold text-gray-900 flex items-center">
                    <span className="mr-2">📱</span>
                    Share Options
                  </h5>
                  <div className="grid grid-cols-1 gap-4">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`🎉 Join me on FareDeal! Use my referral code: ${referralCode} and get amazing deals! 🛍️`);
                        toast.success('📱 Referral message copied to clipboard!');
                      }}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200 hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">💬</span>
                        <div className="text-left">
                          <div className="font-semibold text-blue-900">Copy Message</div>
                          <div className="text-sm text-blue-700">Ready-to-send text with emojis</div>
                        </div>
                      </div>
                      <span className="text-blue-600">→</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        const shareUrl = `https://faredeal.com/join?ref=${referralCode}`;
                        navigator.clipboard.writeText(shareUrl);
                        toast.success('🔗 Referral link copied to clipboard!');
                      }}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-xl border border-green-200 hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">🔗</span>
                        <div className="text-left">
                          <div className="font-semibold text-green-900">Copy Link</div>
                          <div className="text-sm text-green-700">Direct link to sign up page</div>
                        </div>
                      </div>
                      <span className="text-green-600">→</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        const qrText = `https://faredeal.com/join?ref=${referralCode}`;
                        navigator.clipboard.writeText(qrText);
                        toast.success('📱 QR code data copied! Share this link to generate QR codes!');
                      }}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl border border-purple-200 hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">📱</span>
                        <div className="text-left">
                          <div className="font-semibold text-purple-900">QR Code</div>
                          <div className="text-sm text-purple-700">Generate QR code for easy sharing</div>
                        </div>
                      </div>
                      <span className="text-purple-600">→</span>
                    </button>
                  </div>
                </div>
                
                {/* Referral Rewards */}
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-6 rounded-xl border border-yellow-200">
                  <h5 className="text-lg font-bold text-orange-900 mb-4 flex items-center">
                    <span className="mr-2">🏆</span>
                    Referral Rewards
                  </h5>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">🎁</span>
                        <div>
                          <span className="font-semibold text-orange-900">First Referral</span>
                          <p className="text-sm text-orange-700">Get 100 bonus points</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">
                        ✓ Earned
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">🎯</span>
                        <div>
                          <span className="font-semibold text-orange-900">5 Referrals</span>
                          <p className="text-sm text-orange-700">Unlock premium rewards</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                        2/5
                      </span>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowReferModal(false)}
                  className="w-full border-2 border-gray-300 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-300 transform hover:scale-105"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDashboard;
