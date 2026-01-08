import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiUser,
  FiShoppingBag,
  FiPackage,
  FiTruck,
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
  FiShare2
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import AnimatedCounter from '../components/AnimatedCounter';
import DemoNavigation from '../components/DemoNavigation';
import { orderService } from '../services/orderService';
import { loyaltyService } from '../services/loyaltyService';
import { productService } from '../services/productService';
import { customerService } from '../services/customerService';

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const { user, customer, logout, loading: authLoading, isAuthenticated } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState('overview');
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

  // Live time updates
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/customer');
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
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
      <DemoNavigation />
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm shadow-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <FiUser className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Welcome back, {currentUser.firstName}! 👋
                </h1>
                <p className="text-sm text-gray-600">
                  {currentTime.toLocaleDateString('en-UG', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })} • {currentTime.toLocaleTimeString()}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                <FiBell className="h-5 w-5" />
              </button>
              <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                <FiSettings className="h-5 w-5" />
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <FiLogOut className="h-4 w-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className={`bg-gradient-to-r ${getMembershipColor(user.membershipLevel)} rounded-3xl p-8 text-white relative overflow-hidden`}>
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold mb-2">
                    Your {user.membershipLevel.charAt(0).toUpperCase() + user.membershipLevel.slice(1)} Membership
                  </h1>
                  <p className="text-white/90 text-lg">
                    Enjoy exclusive benefits and rewards
                  </p>
                </div>
                <div className="hidden md:block">
                  <div className="text-6xl opacity-20">👑</div>
                </div>
              </div>
              
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                  <div className="text-2xl font-bold">
                    <AnimatedCounter end={currentUser.loyaltyPoints} duration={2000} />
                  </div>
                  <div className="text-white/90 text-sm">Loyalty Points</div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                  <div className="text-2xl font-bold">
                    <AnimatedCounter end={currentUser.totalVisits} duration={1500} />
                  </div>
                  <div className="text-white/90 text-sm">Total Visits</div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
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
                <p className="text-2xl font-bold text-gray-900">2023</p>
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

        {/* Main Content Tabs */}
        <div className="mb-6">
          <div className="flex space-x-4 border-b border-gray-200">
            {['overview', 'orders', 'rewards', 'profile'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-4 font-medium text-sm rounded-t-lg transition-colors ${
                  activeTab === tab
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Recent Orders */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <FiShoppingBag className="h-5 w-5 mr-2 text-blue-600" />
                    Recent Orders
                  </h3>
                  <div className="space-y-4">
                    {customerData.recentOrders.slice(0, 3).map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FiPackage className="h-6 w-6 text-blue-600" />
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

                {/* Product Recommendations */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <FiHeart className="h-5 w-5 mr-2 text-red-600" />
                    Recommended for You
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {customerData.recommendations.slice(0, 3).map((product) => (
                      <div key={product.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                        <div className="text-3xl mb-2">
                          {product.product_images?.[0]?.image_url || product.image || '📦'}
                        </div>
                        <h4 className="font-medium text-gray-900">{product.name}</h4>
                        <p className="text-sm text-gray-600">{product.categories?.name || product.category || 'Product'}</p>
                        <p className="text-lg font-bold text-blue-600 mt-2">
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
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Order History</h3>
                <div className="space-y-4">
                  {customerData.recentOrders.map((order) => (
                    <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">{order.order_number || order.id}</h4>
                        <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Date</p>
                          <p className="font-medium">{new Date(order.order_date || order.date).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Items</p>
                          <p className="font-medium">{order.order_items?.length || order.items}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Total</p>
                          <p className="font-medium">{formatCurrency(order.total_amount || order.total)}</p>
                        </div>
                        <div className="flex space-x-2">
                          <button className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                            <FiEye className="h-4 w-4" />
                          </button>
                          <button className="p-1 text-green-600 hover:bg-green-50 rounded">
                            <FiDownload className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {customerData.recentOrders.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <FiPackage className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <h4 className="text-lg font-medium mb-2">No Orders Yet</h4>
                      <p>Start shopping to see your order history here!</p>
                      <button 
                        onClick={() => navigate('/customer-delivery')}
                        className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                      >
                        Start Shopping
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'rewards' && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Loyalty Rewards</h3>
                <div className="space-y-4">
                  {customerData.loyaltyRewards.map((reward) => (
                    <div key={reward.id} className={`p-4 rounded-lg border-2 ${reward.is_available ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{reward.icon || '🎁'}</span>
                          <div>
                            <h4 className="font-medium text-gray-900">{reward.title}</h4>
                            <p className="text-sm text-gray-600">{reward.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">{reward.points_required || reward.points} points</p>
                          {reward.is_available || reward.earned ? (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              Available
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                              Locked
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {customerData.loyaltyRewards.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <FiGift className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <h4 className="text-lg font-medium mb-2">No Rewards Available</h4>
                      <p>Keep shopping to earn loyalty points and unlock rewards!</p>
                    </div>
                  )}
                </div>
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
            {/* Quick Actions */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span className="mr-2">⚡</span>
                Quick Actions
              </h3>
              <div className="space-y-3">
                <button 
                  onClick={handleStartShopping}
                  className="group w-full flex items-center p-4 text-left hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg border border-transparent hover:border-blue-200"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors duration-300">
                    <FiShoppingBag className="h-5 w-5 text-blue-600 group-hover:animate-bounce" />
                  </div>
                  <div className="ml-3 flex-1">
                    <span className="font-medium text-gray-900 group-hover:text-blue-700 transition-colors">Start Shopping</span>
                    <p className="text-sm text-gray-500 group-hover:text-blue-600">Browse & buy products</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-blue-600">→</span>
                  </div>
                </button>
                
                <button 
                  onClick={handleTrackOrders}
                  className="group w-full flex items-center p-4 text-left hover:bg-gradient-to-r hover:from-green-50 hover:to-green-100 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg border border-transparent hover:border-green-200"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors duration-300">
                    <FiTruck className="h-5 w-5 text-green-600 group-hover:animate-pulse" />
                  </div>
                  <div className="ml-3 flex-1">
                    <span className="font-medium text-gray-900 group-hover:text-green-700 transition-colors">Track Orders</span>
                    <p className="text-sm text-gray-500 group-hover:text-green-600">Monitor delivery status</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-green-600">→</span>
                  </div>
                </button>
                
                <button 
                  onClick={handleRedeemRewards}
                  className="group w-full flex items-center p-4 text-left hover:bg-gradient-to-r hover:from-purple-50 hover:to-purple-100 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg border border-transparent hover:border-purple-200"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors duration-300">
                    <FiGift className="h-5 w-5 text-purple-600 group-hover:animate-spin" />
                  </div>
                  <div className="ml-3 flex-1">
                    <span className="font-medium text-gray-900 group-hover:text-purple-700 transition-colors">Redeem Rewards</span>
                    <p className="text-sm text-gray-500 group-hover:text-purple-600">Use loyalty points</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-purple-600">→</span>
                  </div>
                </button>
                
                <button 
                  onClick={handleReferFriends}
                  className="group w-full flex items-center p-4 text-left hover:bg-gradient-to-r hover:from-orange-50 hover:to-orange-100 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg border border-transparent hover:border-orange-200"
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors duration-300">
                    <FiShare2 className="h-5 w-5 text-orange-600 group-hover:animate-ping" />
                  </div>
                  <div className="ml-3 flex-1">
                    <span className="font-medium text-gray-900 group-hover:text-orange-700 transition-colors">Refer Friends</span>
                    <p className="text-sm text-gray-500 group-hover:text-orange-600">Earn bonus points</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-orange-600">→</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Contact Support */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Need Help?</h3>
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <FiPhone className="h-4 w-4 mr-2" />
                  <span>+256 700 000 000</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <FiMail className="h-4 w-4 mr-2" />
                  <span>support@faredeal.com</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <FiMapPin className="h-4 w-4 mr-2" />
                  <span>Kampala, Uganda</span>
                </div>
              </div>
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