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
  FiVolume2,
  FiMusic,
  FiUpload,
  FiTrash2,
  FiHome,
  FiNavigation,
  FiSend,
  FiGrid,
  FiExternalLink,
} from 'react-icons/fi';
import { getBalance, getTransactions } from '@/services/icanWalletService';
import { referralService } from '../services/referralService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import AnimatedCounter from '../components/AnimatedCounter';
import { Greeting } from '../components/customerDashboard/LiveClock';
import PortalHeader from '../components/PortalHeader';
import MobileMenuSheet from '../components/customerDashboard/MobileMenuSheet';
import PhoneOverviewHero from '../components/customerDashboard/PhoneOverviewHero';
import DesktopOverview from '../components/customerDashboard/DesktopOverview';
import { orderService } from '../services/orderService';
import { loyaltyService } from '../services/loyaltyService';
import { productService } from '../services/productService';
import { customerService } from '../services/customerService';
import EnhancedRideRequest from '../vendor/mybodaguy/components/EnhancedRideRequest';
import JourneyBookingFlow from '../vendor/mybodaguy/components/JourneyBookingFlow';
import JourneyTracker from '../vendor/mybodaguy/components/JourneyTracker';
import CustomerSelfCheckout from '../vendor/mybodaguy/components/CustomerSelfCheckout';
import RideTrackingModal from '../vendor/mybodaguy/components/RideTrackingModal';
import ICANWalletPage from './ICANWalletPage';
import useSupermarketBranding from '../hooks/useSupermarketBranding';
import BrowseServicesAndBook from '../components/booking/BrowseServicesAndBook';
import {
  RINGTONES,
  CUSTOM_RINGTONE_ID,
  getSelectedCallRingtoneId,
  setSelectedCallRingtoneId,
  getCustomCallRingtoneMeta,
  saveCustomCallRingtone,
  removeCustomCallRingtone,
  playCallRingtonePreview,
} from '../vendor/mybodaguy/services/notificationSound';
import { useTheme } from '../contexts/ThemeContext';
import '../styles/customer-dark.css';

/** Preset-grid + "upload your own song" picker for the incoming-call
 * ringtone that rings while a rider's voice/video call (from RideTrackingModal's
 * vendored CallController) is waiting to be answered — see notificationSound.ts. */
function CallRingtonePicker() {
  const [selectedId, setSelectedIdState] = useState(() => getSelectedCallRingtoneId());
  const [customMeta, setCustomMeta] = useState(() => getCustomCallRingtoneMeta());
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const choose = (id) => {
    setSelectedIdState(id);
    setSelectedCallRingtoneId(id);
    playCallRingtonePreview(id);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      await saveCustomCallRingtone(file);
      setCustomMeta({ name: file.name });
      choose(CUSTOM_RINGTONE_ID);
      toast.success('Ringtone uploaded');
    } catch (error) {
      toast.error(error.message || 'Could not use that file as a ringtone');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    await removeCustomCallRingtone();
    setCustomMeta(null);
    setSelectedIdState(getSelectedCallRingtoneId());
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {RINGTONES.map(tone => (
          <button
            key={tone.id}
            type="button"
            onClick={() => choose(tone.id)}
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
              selectedId === tone.id
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <span>{tone.label}</span>
            <FiVolume2 className="h-4 w-4 flex-shrink-0" />
          </button>
        ))}
      </div>

      <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFile} />

      {customMeta ? (
        <div className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
          selectedId === CUSTOM_RINGTONE_ID ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
        }`}>
          <button type="button" onClick={() => choose(CUSTOM_RINGTONE_ID)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
            <FiMusic className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{customMeta.name}</span>
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} title="Replace song" className="p-1 rounded hover:bg-black/5 flex-shrink-0">
            <FiUpload className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={handleRemove} title="Remove" className="p-1 rounded hover:bg-red-50 text-red-500 flex-shrink-0">
            <FiTrash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors disabled:opacity-50"
        >
          <FiMusic className="h-4 w-4" />
          {uploading ? 'Uploading…' : 'Upload a song from your phone'}
        </button>
      )}
      <p className="text-[11px] text-gray-400 mt-1">MP3, M4A or WAV, up to 8MB. Stays on this device only.</p>
    </div>
  );
}

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const branding = useSupermarketBranding();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { user, customer, logout, loading: authLoading, isAuthenticated } = useAuth();
  // Lets the landing page's product showcase deep-link a signed-in visitor
  // straight into the Shop tab (?tab=shop) instead of always landing on
  // Overview — falls back to 'overview' for anything not a real tab id.
  const [activeTab, setActiveTab] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    const validTabs = ['overview', 'book-ride', 'journey', 'shop', 'delivery', 'rewards', 'profile'];
    return validTabs.includes(requested) ? requested : 'overview';
  });
  // Overview main column: Recent Orders / Recommended split into small tabs
  // instead of two stacked cards. Tabs stay visible; content collapses.
  const [overviewSubTab, setOverviewSubTab] = useState('orders');
  const [overviewContentOpen, setOverviewContentOpen] = useState(false);
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [showReferModal, setShowReferModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  // Real ride/delivery bookings (mbg_rides, made via EnhancedRideRequest)
  // for the Track Orders modal — separate from customerData.recentOrders,
  // which is POS/cart orders from orderService. EnhancedRideRequest's own
  // live tracking only exists in that component's in-memory state while
  // actively booking, so this re-opens the same LiveTrackingMap + Call/
  // Video/Chat screen for a ride that's already in progress after the
  // customer navigates away or refreshes (mirrors the fix shipped today in
  // Bodagoera's own CustomerDashboard).
  const [myRides, setMyRides] = useState([]);
  const [myRidesLoading, setMyRidesLoading] = useState(false);
  const [rideContacts, setRideContacts] = useState({});
  const [trackedRide, setTrackedRide] = useState(null);
  // status: 'loading' | 'no-session' | 'no-account-row' | 'error' | 'ok'
  const [referral, setReferral] = useState({
    status: 'loading',
    message: '',
    code: '',
    friendsReferred: 0,
    pointsEarned: 0
  });
  
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

  // ICAN wallet for rewards tab
  const [icanBalance, setIcanBalance] = useState(null);
  const [icanTxs, setIcanTxs]         = useState([]);
  const [icanLoading, setIcanLoading] = useState(false);

  // Real role from Supabase (overrides mock AuthContext)
  const [staffRole, setStaffRole] = useState(null); // 'admin' | 'manager' | 'cashier' | 'supplier' | null

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

        if (data?.role && ['admin', 'manager', 'cashier', 'supplier'].includes(data.role)) {
          setStaffRole(data.role);
        }
      } catch (_) {
        // Not logged in via Supabase — demo mode, no staff role
      }
    };
    fetchRealRole();
  }, []);

  // Real referral code + stats, backed by public.users / public.referrals
  // (see referralService.js). diagnoseAvailability() distinguishes "not
  // signed in" from "signed in but this account has no public.users row
  // yet" — collapsing both into one "unavailable" state used to show a
  // "Sign in" button to people who were already signed in.
  const loadReferralData = React.useCallback(async () => {
    setReferral(prev => ({ ...prev, status: 'loading', message: '' }));
    try {
      const availability = await referralService.diagnoseAvailability();
      if (availability.status !== 'ok') {
        setReferral(prev => ({ ...prev, status: availability.status, message: availability.message || '' }));
        return;
      }

      // Redeem a ?ref=CODE captured earlier (App.jsx) now that we know
      // who's signed in — harmless no-op if nothing is pending.
      const applied = await referralService.consumePendingReferralCode();
      if (applied) {
        toast.success(`🎉 Referral applied! ${applied.referrerName} just earned ${referralService.REWARD_POINTS} points.`);
      }

      const code = await referralService.getOrCreateReferralCode();
      const stats = await referralService.getReferralStats();
      setReferral({
        status: 'ok',
        code,
        friendsReferred: stats.friendsReferred,
        pointsEarned: stats.pointsEarned
      });
    } catch (error) {
      console.error('Error loading referral data:', error);
      setReferral(prev => ({ ...prev, status: 'error', message: error.message || '' }));
    }
  }, []);

  useEffect(() => {
    loadReferralData();
  }, [loadReferralData]);

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

  // Fetch this customer's real ride/delivery bookings when the Track
  // Orders modal opens — mbg_rides rows created by EnhancedRideRequest
  // (Book Ride / Delivery tabs), keyed off mbg_customers.user_id like
  // Bodagoera's own CustomerDashboard does it.
  useEffect(() => {
    if (!showTrackModal || !user?.id) return;
    let cancelled = false;
    setMyRidesLoading(true);
    (async () => {
      const { data: cr } = await supabase.from('mbg_customers').select('id').eq('user_id', user.id).maybeSingle();
      if (!cr?.id) { if (!cancelled) setMyRidesLoading(false); return; }
      const { data } = await supabase
        .from('mbg_rides')
        .select('id, created_at, pickup_location, dropoff_location, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, status, fare, service_type, rider_id')
        .eq('customer_id', cr.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (cancelled) return;
      const rows = data || [];
      setMyRides(rows);
      setMyRidesLoading(false);

      const activeRows = rows.filter((r) => ['accepted', 'in_progress'].includes(r.status) && r.rider_id);
      await Promise.all(activeRows.map(async (r) => {
        const { data: rider } = await supabase
          .from('mbg_riders')
          .select('user_id, mbg_users!user_id(phone, email, mbg_user_profiles(full_name))')
          .eq('id', r.rider_id)
          .maybeSingle();
        if (cancelled || !rider?.user_id) return;
        const rUser = rider.mbg_users;
        setRideContacts((prev) => ({
          ...prev,
          [r.id]: {
            userId: rider.user_id,
            name: rUser?.mbg_user_profiles?.[0]?.full_name || rUser?.email?.split('@')[0] || 'Rider',
            phone: rUser?.phone || null,
          },
        }));
      }));
    })();
    return () => { cancelled = true; };
  }, [showTrackModal, user?.id]);

  const switchTab = (id) => { setActiveTab(id); setMobileMenu(false); };

  // Delivery is its own tab, separate from Book Ride — both render
  // EnhancedRideRequest (the one real matching-engine implementation) but
  // each locks it to a single fixedServiceType so Book Ride never shows the
  // delivery toggle and vice versa.
  // emoji drives the desktop tab strip; icon drives the phone menu sheet and
  // section bar.
  const ALL_TABS = [
    { id: 'overview', label: 'Overview', emoji: '🏠', icon: FiHome },
    { id: 'book-ride', label: 'Book Ride', emoji: '🏍️', icon: FiNavigation },
    { id: 'journey', label: 'Book a Journey', emoji: '✈️', icon: FiSend },
    { id: 'shop', label: 'Shop', emoji: '🛒', icon: FiShoppingBag },
    { id: 'book-service', label: 'Book', emoji: '📅', icon: FiCalendar },
    { id: 'delivery', label: 'Delivery', emoji: '📦', icon: FiPackage },
    { id: 'rewards', label: 'Rewards', emoji: '🎁', icon: FiGift },
    { id: 'profile', label: 'Profile', emoji: '👤', icon: FiUser },
  ];
  const activeTabMeta =
    ALL_TABS.find(t => t.id === activeTab) ||
    (activeTab === 'ican-wallet' ? { label: 'IcanEra Wallet', icon: FiCreditCard } : ALL_TABS[0]);
  const ActiveTabIcon = activeTabMeta.icon;

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
  const handleTrackOrders = () => {
    setShowTrackModal(true);
  };

  const handleRedeemRewards = () => {
    setShowRewardsModal(true);
  };

  const handleReferFriends = () => {
    setShowReferModal(true);
  };

  const handleCreateBusiness = () => {
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
    if (!referral.code) return;
    navigator.clipboard.writeText(referral.code);
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
      // sk-customer-themed: dark-mode repaint of this page's white/gray/ivory
      // utilities (styles/customer-dark.css). In dark mode the page itself
      // and the store's background-image overlay go deep green too.
      className={`sk-customer-themed min-h-screen bg-cover bg-center bg-fixed ${
        isDark ? 'bg-[#061510]' : 'bg-gradient-to-br from-gray-50 to-blue-50'
      }`}
      style={branding.backgroundUrl ? {
        backgroundImage: isDark
          ? `linear-gradient(rgba(6,21,16,0.93), rgba(6,21,16,0.93)), url(${branding.backgroundUrl})`
          : `linear-gradient(rgba(249,250,251,0.92), rgba(239,246,255,0.92)), url(${branding.backgroundUrl})`
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
      {/* Header — greeting + nav */}
      <div className="sticky top-0 z-50 shadow-md">
        {/* Row 1 — shared Supermartkera header (BodaGoEra layout). safe-top keeps
            it clear of the notch / status bar when installed as a PWA
            (index.html sets a black-translucent status bar). */}
        <div className="safe-top bg-[#1e3a8a]">
          <PortalHeader
            title={<><Greeting /> · {currentUser.firstName}</>}
            onSignOut={handleLogout}
          />
        </div>

        {/* Row 2 — nav tabs (desktop only): ivory bar, ink text, gold underline that slides in */}
        <div className="hidden sm:block border-b border-[#c4a052]/40 bg-[#fdfaf2]">
          <div className="max-w-7xl mx-auto px-2">
            <nav className="flex overflow-x-auto scrollbar-hide gap-1 items-center">
              {ALL_TABS.map(tab => (
                <button key={tab.id} onClick={() => switchTab(tab.id)}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                  className={`classic-tab flex items-center gap-1.5 px-3 py-3 text-sm whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab.id ? 'font-semibold text-[#1e1b4b]' : 'font-medium text-slate-500 hover:text-[#1e1b4b]'
                  }`}>
                  <span>{tab.emoji}</span>
                  {tab.label}
                </button>
              ))}
              <button onClick={() => setActiveTab('ican-wallet')}
                aria-current={activeTab === 'ican-wallet' ? 'page' : undefined}
                className={`classic-tab flex items-center gap-1.5 px-3 py-3 text-sm whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'ican-wallet' ? 'font-semibold text-[#1e1b4b]' : 'font-medium text-[#a17c28] hover:text-[#1e1b4b]'
                }`}>
                <span>₡</span> IcanEra Wallet
              </button>
            </nav>
          </div>
        </div>

        {/* Phone section bar — current section in serif + the one menu
            trigger (opens the bottom sheet rendered just below the header). */}
        <div className="sm:hidden border-b border-[#c4a052]/25 bg-white">
          <div className="flex h-12 items-center justify-between gap-3 px-4">
            <div className="flex min-w-0 items-center gap-2">
              <ActiveTabIcon className="h-[17px] w-[17px] flex-shrink-0 text-indigo-600" />
              <h2 className="truncate font-classic-display text-[18px] font-semibold leading-none text-slate-800">
                {activeTabMeta.label}
              </h2>
            </div>
            <button type="button" onClick={() => setMobileMenu(true)}
              aria-label="Open menu" aria-expanded={mobileMenuOpen}
              className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full border border-[#c4a052]/40 bg-[#faf8f3] px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition-transform active:scale-95">
              <FiGrid className="h-3.5 w-3.5 text-indigo-600" /> Menu
            </button>
          </div>
        </div>
      </div>

      <MobileMenuSheet
        open={mobileMenuOpen}
        onClose={() => setMobileMenu(false)}
        tabs={ALL_TABS}
        activeTab={activeTab}
        onSelect={switchTab}
        onWallet={() => switchTab('ican-wallet')}
        name={currentUser.full_name || currentUser.firstName}
        email={currentUser.email}
        initial={(currentUser.firstName || 'C').charAt(0).toUpperCase()}
      />

      {/* Role Banner — admin / manager / cashier / supplier. One slim ink bar with a
          gold hairline (an inset rounded pill on phones) instead of a tall
          gradient card; the long label only appears where there's room. */}
      {staffRole && (() => {
        const config = {
          admin:   { path: '/admin-portal',   icon: '⚙️', label: 'Admin' },
          manager: { path: '/manager-portal', icon: '👔', label: 'Manager' },
          cashier: { path: '/cashier-portal', icon: '💰', label: 'Cashier' },
          supplier: { path: '/supplier-portal', icon: '🚚', label: 'Supplier' },
        }[staffRole];
        return (
          <div onClick={() => navigate(config.path)} role="link" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate(config.path); }}
            className="group cursor-pointer mx-4 mt-3 overflow-hidden rounded-xl bg-gradient-to-r from-[#14122f] via-[#1e1b4b] to-[#2b2760] ring-1 ring-[#c4a052]/50 transition-shadow hover:shadow-lg sm:mx-0 sm:mt-0 sm:rounded-none sm:ring-0 sm:border-b sm:border-[#c4a052]/50">
            <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="text-lg leading-none">{config.icon}</span>
                <p className="truncate text-[13px] font-semibold text-[#f3dc9b] sm:text-sm">
                  <span className="sm:hidden">{config.label} portal</span>
                  <span className="hidden sm:inline">You have {config.label} access</span>
                  <span className="ml-1.5 hidden font-normal text-white/60 min-[400px]:inline">· tap to open</span>
                </p>
              </div>
              <span className="flex flex-shrink-0 items-center gap-2 rounded-full border border-[#c4a052]/60 px-2.5 py-1 text-xs font-semibold text-[#f3dc9b] transition-colors group-hover:bg-[#c4a052]/20">
                <span className="hidden sm:inline">Open {config.label} Portal</span>
                <FiArrowRight className="classic-arrow h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        );
      })()}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-28 sm:py-8">
        {/* Phone Overview — loyalty card, live counts, service shortcuts and
            next steps as one scroll (used to be three tabs hiding each other,
            and used to render above EVERY tab, not just Overview). */}
        {activeTab === 'overview' && (
          <div className="sm:hidden mb-6">
            <PhoneOverviewHero
              firstName={currentUser.firstName}
              membershipLevel={currentUser.membershipLevel}
              badge={getMembershipBadge(currentUser.membershipLevel)}
              points={currentUser.loyaltyPoints}
              visits={currentUser.totalVisits}
              totalSpent={currentUser.totalSpent}
              formatCurrency={formatCurrency}
              memberSinceYear={memberSinceYear}
              activeOrders={customerData.recentOrders.filter(o => o.status !== 'delivered').length}
              availableRewards={customerData.loyaltyRewards.filter(r => r.is_available).length}
              onNavigate={switchTab}
              onTrackOrders={handleTrackOrders}
              onRedeemRewards={handleRedeemRewards}
              onRefer={handleReferFriends}
              onWallet={() => switchTab('ican-wallet')}
              onCreateBusiness={handleCreateBusiness}
              onBecomeSupplier={handleBecomeSupplier}
            />
          </div>
        )}

        {/* Web: membership card + ledger + next steps, on the Overview tab only */}
        {activeTab === 'overview' && (
          <div className="hidden sm:block">
            <DesktopOverview
              firstName={currentUser.firstName}
              membershipLevel={currentUser.membershipLevel}
              badge={getMembershipBadge(currentUser.membershipLevel)}
              points={currentUser.loyaltyPoints}
              visits={currentUser.totalVisits}
              totalSpent={currentUser.totalSpent}
              formatCurrency={formatCurrency}
              memberSinceYear={memberSinceYear}
              activeOrders={customerData.recentOrders.filter(o => o.status !== 'delivered').length}
              availableRewards={customerData.loyaltyRewards.filter(r => r.is_available).length}
              onNavigate={switchTab}
              onTrackOrders={handleTrackOrders}
              onRedeemRewards={handleRedeemRewards}
              onCreateBusiness={handleCreateBusiness}
              onBecomeSupplier={handleBecomeSupplier}
            />
          </div>
        )}

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Small sub-tabs instead of two stacked cards — tabs always
                    visible, the content panel below collapses to save space. */}
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-[#c4a052]/25 sm:w-fit sm:flex-none">
                    <button
                      onClick={() => { setOverviewSubTab('orders'); setOverviewContentOpen(true); }}
                      aria-pressed={overviewSubTab === 'orders' && overviewContentOpen}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[12px] font-semibold transition-colors min-[360px]:px-3 min-[360px]:text-[13px] sm:flex-none sm:px-4 sm:text-sm ${
                        overviewSubTab === 'orders' && overviewContentOpen
                          ? 'bg-gradient-to-r from-indigo-700 to-violet-700 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <FiShoppingBag className="hidden h-4 w-4 min-[360px]:block" /> Recent Orders
                    </button>
                    <button
                      onClick={() => { setOverviewSubTab('recommended'); setOverviewContentOpen(true); }}
                      aria-pressed={overviewSubTab === 'recommended' && overviewContentOpen}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[12px] font-semibold transition-colors min-[360px]:px-3 min-[360px]:text-[13px] sm:flex-none sm:px-4 sm:text-sm ${
                        overviewSubTab === 'recommended' && overviewContentOpen
                          ? 'bg-gradient-to-r from-indigo-700 to-violet-700 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <FiHeart className="hidden h-4 w-4 min-[360px]:block" /> Recommended
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOverviewContentOpen((o) => !o)}
                    aria-expanded={overviewContentOpen}
                    className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-white text-slate-400 shadow-sm ring-1 ring-[#c4a052]/25 transition-colors hover:text-slate-600"
                    title={overviewContentOpen ? 'Collapse' : 'Expand'}
                  >
                    <FiChevronDown className={`h-5 w-5 transition-transform ${overviewContentOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {overviewContentOpen && overviewSubTab === 'orders' && (
                  <div className="classic-card p-3 sm:p-6">
                    <div className="space-y-3">
                      {customerData.recentOrders.slice(0, 3).map((order) => (
                        <div key={order.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 sm:p-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-black/5">
                              <FiPackage className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">{order.order_number || order.id}</p>
                              <p className="text-xs leading-snug text-slate-500 sm:text-sm">
                                {new Date(order.order_date || order.date).toLocaleDateString()} · {order.order_items?.length || order.items} items
                              </p>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <p className="text-sm font-semibold text-slate-900 sm:text-base">
                              {formatCurrency(order.total_amount || order.total)}
                            </p>
                            <span className={`mt-1 inline-flex px-2 py-0.5 text-[11px] font-semibold capitalize rounded-full ${getStatusColor(order.status)}`}>
                              {order.status}
                            </span>
                          </div>
                        </div>
                      ))}
                      {customerData.recentOrders.length === 0 && (
                        <div className="py-8 text-center text-slate-500">
                          <FiPackage className="mx-auto mb-4 h-12 w-12 opacity-50" />
                          <p>No orders yet. Start shopping to see your orders here!</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {overviewContentOpen && overviewSubTab === 'recommended' && (
                  <div className="classic-card p-3 sm:p-6">
                    {/* Phone: a swipeable row of cards; md+: the original 3-up grid */}
                    <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0">
                      {customerData.recommendations.slice(0, 3).map((product) => {
                        const visual = product.product_images?.[0]?.image_url || product.image || '📦';
                        const isUrl = /^(https?:|\/|data:)/.test(visual);
                        return (
                          <div key={product.id} className="min-w-[68%] snap-start rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-indigo-300 hover:shadow-md md:min-w-0">
                            {isUrl ? (
                              <img src={visual} alt="" className="mb-2 h-16 w-16 rounded-xl object-cover" loading="lazy" />
                            ) : (
                              <div className="mb-2 text-3xl">{visual}</div>
                            )}
                            <h4 className="font-semibold text-slate-900">{product.name}</h4>
                            <p className="text-sm text-slate-500">{product.categories?.name || product.category || 'Product'}</p>
                            <p className="mt-2 font-classic-display text-lg font-bold text-emerald-600">
                              {formatCurrency(product.selling_price || product.price)}
                            </p>
                          </div>
                        );
                      })}
                      {customerData.recommendations.length === 0 && (
                        <div className="w-full py-8 text-center text-slate-500 md:col-span-3">
                          <FiHeart className="mx-auto mb-4 h-12 w-12 opacity-50" />
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
                <a
                  href="https://bodagoera.icanera.space"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 border-b border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100 transition-colors"
                >
                  <span className="text-lg" aria-hidden="true">🏍️</span>
                  <span className="flex-1">
                    <strong className="font-semibold">For a better experience, open BodaGoEra.</strong>{' '}
                    It has the full ride booking experience.
                  </span>
                  <FiExternalLink className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                </a>
                <EnhancedRideRequest customerId={user?.id} fixedServiceType="ride" />
              </div>
            )}

            {/* Book a Journey — boda to the airport, a real flight, and a
                driver waiting at the destination. Calls BodaGo's own Vercel
                deployment (cross-origin) since the Duffel/ICAN logic lives
                there, not in this app — see vendor/mybodaguy/services/journeyService.ts */}
            {activeTab === 'journey' && (
              <div className="space-y-4">
                {/* No wrapping box: the flow's own step cards are the surface,
                    so on a phone they reach the page gutter instead of sitting
                    inside another padded, bordered container. */}
                <JourneyBookingFlow customerId={user?.id} />
                {/* My Journeys — live legs, driver chat/call, air ticket
                    download, and a refund notice for a paid-but-failed booking */}
                {user?.id && <JourneyTracker customerId={user.id} />}
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

            {/* Book — appointment-style service bookings, reusing the
                existing chat/call system for follow-up with the store */}
            {activeTab === 'book-service' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <BrowseServicesAndBook
                  identity={{
                    userId: user?.id,
                    name: customer?.full_name || user?.email || 'Customer',
                    email: user?.email,
                    phone: customer?.phone || '',
                  }}
                />
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

                {/* Call Ringtone — rings while a rider's voice/video call
                    (placed from the ride tracker) is waiting to be answered. */}
                <div className="mt-8 pt-6 border-t border-gray-100">
                  <h4 className="text-base font-semibold text-gray-900 mb-1">Call Ringtone</h4>
                  <p className="text-sm text-gray-500 mb-3">
                    Plays on repeat while a voice or video call from your ride is waiting for you to answer. Saved to this device.
                  </p>
                  <CallRingtonePicker />
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions — hidden on the phone Overview (the hero already offers
                them), shown on every other tab and on web. */}
            <div className={`classic-card p-4 ${activeTab === 'overview' ? 'hidden sm:block' : ''}`}>
              <p className="classic-eyebrow mb-3">Quick actions</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Start Shopping', icon: FiShoppingBag, onClick: () => switchTab('shop') },
                  { label: 'Track Orders', icon: FiTruck, onClick: handleTrackOrders },
                  { label: 'Redeem Rewards', icon: FiGift, onClick: handleRedeemRewards },
                  { label: 'Refer Friends', icon: FiShare2, onClick: handleReferFriends },
                ].map((a) => (
                  <button
                    key={a.label}
                    onClick={a.onClick}
                    className="classic-lift flex flex-col items-center gap-1.5 rounded-xl border border-[#c4a052]/25 bg-[#fdfaf2] px-2 py-3"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-[#1e1b4b] text-[#e6c980]">
                      <a.icon className="h-4 w-4" />
                    </span>
                    <span className="text-center text-xs font-semibold leading-tight text-slate-700">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Contact Support — opens the real support chat (ChatWidget),
                not a static phone number nobody's answering */}
            <div className="classic-card p-6">
              <h3 className="font-classic-display mb-1 flex items-center gap-2 text-lg font-semibold text-[#1e1b4b]">
                <FiMessageCircle className="h-5 w-5 text-[#a17c28]" /> Need Help?
              </h3>
              <p className="mb-4 text-sm text-slate-500">Chat live with our support team — real people, real answers.</p>
              <button
                onClick={() => window.dispatchEvent(new Event('faredeal:open-support-chat'))}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1e1b4b] py-3 font-semibold text-[#f3dc9b] shadow-sm ring-1 ring-[#c4a052]/50 transition-colors hover:bg-[#28246b]"
              >
                <FiMessageCircle className="h-4 w-4" /> Chat with Support
              </button>
            </div>
          </div>
        </div>
      </div>

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
                
                {/* Real rides & deliveries (mbg_rides, booked from the Book
                    Ride / Delivery tabs) — click one with a live rider
                    assigned to reopen the same live map + Call/Video/Chat
                    screen EnhancedRideRequest shows while actively booking. */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                  <h4 className="font-bold text-blue-900 mb-4 flex items-center">
                    <span className="mr-2">📋</span>
                    Your Rides &amp; Deliveries
                  </h4>
                  {myRidesLoading ? (
                    <p className="text-sm text-gray-500 text-center py-4">Loading…</p>
                  ) : myRides.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No rides or deliveries booked yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {myRides.map((r) => {
                        const isLive = ['accepted', 'in_progress'].includes(r.status) && !!r.rider_id;
                        return (
                          <div
                            key={r.id}
                            className="flex justify-between items-center p-3 bg-white rounded-lg hover:shadow-md transition-all duration-300"
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <span className="text-2xl">{r.service_type === 'delivery' ? '📦' : '🏍️'}</span>
                              <div className="min-w-0">
                                <span className="font-semibold text-blue-900 truncate block">
                                  {r.pickup_location} → {r.dropoff_location}
                                </span>
                                <p className="text-sm text-gray-600 capitalize">
                                  {r.status.replace('_', ' ')} • {new Date(r.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => (isLive ? setTrackedRide(r) : toast.info(`This ${r.service_type} is ${r.status.replace('_', ' ')}.`))}
                              className={`flex-shrink-0 px-4 py-2 rounded-lg transition-all duration-300 transform hover:scale-105 ${
                                isLive
                                  ? 'bg-green-600 text-white hover:bg-green-700'
                                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                              }`}
                            >
                              {isLive ? 'Track Live' : 'View'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
                  <p className="text-orange-700 text-lg">Share your referral code and earn {referralService.REWARD_POINTS} points for each friend who joins</p>
                </div>

                {referral.status === 'loading' ? (
                  <div className="text-center py-8 text-gray-500">Loading your referral info…</div>
                ) : referral.status === 'no-session' ? (
                  <div className="text-center bg-gray-50 p-6 rounded-xl border border-gray-200">
                    <p className="text-gray-700 font-medium mb-3">Sign in to get your personal referral code and start earning points.</p>
                    <button
                      onClick={() => { setShowReferModal(false); navigate('/login'); }}
                      className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-3 rounded-xl hover:from-orange-700 hover:to-red-700 transition-all duration-300 font-semibold"
                    >
                      Sign In
                    </button>
                  </div>
                ) : referral.status === 'no-account-row' ? (
                  <div className="text-center bg-gray-50 p-6 rounded-xl border border-gray-200">
                    <p className="text-gray-700 font-medium mb-2">You're signed in, but we can't find your account profile yet.</p>
                    <p className="text-gray-500 text-sm mb-3">This can happen right after creating a new account — try again in a moment.</p>
                    <button
                      onClick={loadReferralData}
                      className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-3 rounded-xl hover:from-orange-700 hover:to-red-700 transition-all duration-300 font-semibold"
                    >
                      Try Again
                    </button>
                  </div>
                ) : referral.status === 'error' ? (
                  <div className="text-center bg-gray-50 p-6 rounded-xl border border-gray-200">
                    <p className="text-gray-700 font-medium mb-2">Something went wrong loading your referral info.</p>
                    {referral.message && (
                      <p className="text-gray-400 text-xs mb-3 font-mono break-words">{referral.message}</p>
                    )}
                    <button
                      onClick={loadReferralData}
                      className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-3 rounded-xl hover:from-orange-700 hover:to-red-700 transition-all duration-300 font-semibold"
                    >
                      Try Again
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Referral Stats */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center bg-blue-50 p-4 rounded-xl border border-blue-200">
                        <div className="text-2xl font-bold text-blue-600">{referral.friendsReferred}</div>
                        <div className="text-sm text-blue-700">Friends Referred</div>
                      </div>
                      <div className="text-center bg-green-50 p-4 rounded-xl border border-green-200">
                        <div className="text-2xl font-bold text-green-600">{referral.pointsEarned}</div>
                        <div className="text-sm text-green-700">Points Earned</div>
                      </div>
                      <div className="text-center bg-purple-50 p-4 rounded-xl border border-purple-200">
                        <div className="text-2xl font-bold text-purple-600">{Math.max(0, 5 - referral.friendsReferred)}</div>
                        <div className="text-sm text-purple-700">More to Go</div>
                      </div>
                    </div>

                    {/* Referral Code */}
                    <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-6 rounded-xl border border-orange-200">
                      <label className="block text-lg font-bold text-orange-900 mb-3">🎯 Your Referral Code</label>
                      <div className="flex space-x-3">
                        <input
                          type="text"
                          value={referral.code}
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
                            navigator.clipboard.writeText(`🎉 Join me on ${branding.name}! Use my referral code: ${referral.code} and get amazing deals! 🛍️`);
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
                            const shareUrl = `${window.location.origin}/register?ref=${referral.code}`;
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
                            const qrText = `${window.location.origin}/register?ref=${referral.code}`;
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
                              <p className="text-sm text-orange-700">Get {referralService.REWARD_POINTS} bonus points</p>
                            </div>
                          </div>
                          {referral.friendsReferred >= 1 ? (
                            <span className="text-sm font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">✓ Earned</span>
                          ) : (
                            <span className="text-sm font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Not yet</span>
                          )}
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
                            {Math.min(referral.friendsReferred, 5)}/5
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

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

      {trackedRide && (
        <RideTrackingModal
          ride={trackedRide}
          contact={rideContacts[trackedRide.id] || null}
          customerId={user?.id}
          customerName={currentUser.firstName + (currentUser.lastName ? ` ${currentUser.lastName}` : '')}
          onClose={() => setTrackedRide(null)}
        />
      )}
    </div>
  );
};

export default CustomerDashboard;
