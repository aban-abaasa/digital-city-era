import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiTruck, FiPackage, FiDollarSign, FiTrendingUp, FiBarChart, 
  FiPieChart, FiTarget, FiAward, FiClock, FiAlertTriangle,
  FiCalendar, FiMail, FiBell, FiSettings, FiLogOut, FiSearch,
  FiFilter, FiDownload, FiRefreshCw, FiEye, FiEdit, FiTrash2,
  FiPlus, FiMinus, FiChevronRight, FiChevronDown, FiStar,
  FiHeart, FiZap, FiShield, FiGift, FiNavigation, FiMapPin,
  FiSmartphone, FiHeadphones, FiCamera, FiWatch, FiHome,
  FiCreditCard, FiMessageCircle, FiShare2, FiThumbsUp,
  FiBookmark, FiGrid, FiList, FiInfo, FiHelpCircle,
  FiMaximize, FiMinimize, FiRotateCw, FiUpload, FiPrinter,
  FiTag, FiHash, FiImage, FiCheckCircle, FiXCircle, FiUsers,
  FiShoppingCart, FiPercent, FiFlag, FiWifi, FiSend, FiFileText,
  FiMenu, FiX, FiChevronUp
} from 'react-icons/fi';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, ComposedChart
} from 'recharts';
import { supabase } from '../services/supabase';
import IcanCoinBadge from '../components/IcanCoinBadge';
import { notificationService } from '../services/notificationService';
import PaymentService from '../services/paymentService';
import AddProductModal from '../components/AddProductModal';
import SupplierPaymentConfirmations from '../components/SupplierPaymentConfirmations';
import OrderPaymentTracker from '../components/OrderPaymentTracker';
import { SupplierCatalogTab, SupplierApplicationsTab } from '../components/SupplierMarketplace';

const SupplierPortal = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [expandedPaymentId, setExpandedPaymentId] = useState(null);
  const [supplierProfile, setSupplierProfile] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    category: '',
    rating: 0,
    partnershipYears: 0,
    avatar: '🇺🇬',
    status: '',
    paymentTerms: '',
    creditLimit: 0,
    businessLicense: '',
    taxID: '',
    exportLicense: '',
    languages: [],
    certifications: [],
    specialties: [],
    deliveryAreas: []
  });

  // Ugandan Supplier Performance Data
  const [performanceMetrics, setPerformanceMetrics] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    onTimeDelivery: 0,
    qualityRating: 0,
    activeProducts: 0,
    pendingOrders: 0,
    avgOrderValue: 0,
    customerSatisfaction: 0,
    mobileMoneyTransactions: 0,
    bankTransferTransactions: 0,
    weeklyGrowth: 0,
    monthlyGrowth: 0,
    exportOrders: 0,
    localOrders: 0,
    seasonalProductsAvailable: 0,
    organicCertifiedProducts: 0,
    paidOrders: 0,
    unpaidOrders: 0,
    partiallyPaidOrders: 0,
    totalPaid: 0,
    totalOutstanding: 0
  });

  const [orderHistory, setOrderHistory] = useState([]);

  const [pendingOrders, setPendingOrders] = useState([]);

  const [productCatalog, setProductCatalog] = useState([]);

  const [revenueData, setRevenueData] = useState([]);

  const [performanceInsights] = useState([]);

  const [notifications] = useState([]);

  const [partnershipGoals] = useState([]);

  // Enhanced payment history for supplier view (with setState for database updates)
  const [paymentHistory, setPaymentHistory] = useState([]);

  const [paymentFilter, setPaymentFilter] = useState('all');

  // Enhanced payment history for supplier to view their own payments
  const [supplierPaymentHistory] = useState([]);

  // Payment statistics
  const [paymentStats] = useState({
    totalPaid: 0,
    totalPending: 0,
    totalOverdue: 0,
    averagePaymentTime: '0 days',
    onTimePaymentRate: 0,
    totalEarnings: 0,
    processingFees: 0
  });

  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Edit Profile States
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedProfile, setEditedProfile] = useState({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Edit Financial Details States
  const [isEditingFinancial, setIsEditingFinancial] = useState(false);
  const [editedFinancial, setEditedFinancial] = useState({});
  const [isSavingFinancial, setIsSavingFinancial] = useState(false);

  // Profile Picture Upload States
  const [uploadingProfilePic, setUploadingProfilePic] = useState(false);
  const [profilePicUrl, setProfilePicUrl] = useState(null);

  // Payment Status collapse state
  const [showPaymentStatus, setShowPaymentStatus] = useState(false);

  // Supermarket Management States
  const [availableSupermarkets, setAvailableSupermarkets] = useState([]);
  const [currentSupermarketId, setCurrentSupermarketId] = useState(null);
  const [loadingSupermarkets, setLoadingSupermarkets] = useState(false);

  // Helper function to calculate years from created date
  const calculateYears = (createdAt) => {
    if (!createdAt) return 0;
    const years = Math.floor((new Date() - new Date(createdAt)) / (1000 * 60 * 60 * 24 * 365));
    return years;
  };

  // Load supplier profile from database
  const loadSupplierProfile = async (userId) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No authenticated user');
        return;
      }

      console.log('🔍 Loading supplier profile for user:', user.email, 'auth_id:', user.id);

      // Fetch user row — match by auth_id OR id (handles legacy rows)
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('*')
        .or(`auth_id.eq.${user.id},id.eq.${user.id}`)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking user:', checkError);
        throw checkError;
      }

      // Wrong role (fully set up as something else) → redirect
      if (existingUser && existingUser.role && existingUser.role !== 'supplier' && existingUser.role !== 'customer') {
        const redirectPath = existingUser.role === 'manager' ? '/manager-portal'
                           : existingUser.role === 'admin'   ? '/admin-portal'
                           : existingUser.role === 'cashier' ? '/cashier-portal'
                           : '/customer-dashboard';
        notificationService.show(`This account is registered as ${existingUser.role}.`, 'warning', 3000);
        setTimeout(() => navigate(redirectPath), 2000);
        return;
      }

      // Use the found row as the supplier profile (role = supplier)
      const { data: supplier, error: suppError } = await supabase
        .from('users')
        .select('*')
        .or(`auth_id.eq.${user.id},id.eq.${user.id}`)
        .eq('role', 'supplier')
        .maybeSingle();

      if (suppError && suppError.code !== 'PGRST116') {
        console.error('Error fetching supplier profile:', suppError);
        throw suppError;
      }

      if (supplier) {
        console.log('✅ Supplier profile found:', supplier);
        
        // Check approval status (don't check profile_completed since it's already done in auth page)
        if (!supplier.is_active) {
          // Account pending approval - show welcome message
          console.log('⏳ Supplier account pending approval');
          notificationService.show('🎉 Profile completed! Your application is pending admin approval. You can view your dashboard with limited access.', 'info', 8000);
          // Don't return - let them see their profile with limited access
        } else {
          // Account is approved - show success message
          notificationService.show('✅ Welcome back! Your account is active.', 'success', 3000);
        }
        
        // Fetch business profile from suppliers table (company_name, address, etc. live there)
        const { data: bizProfile } = await supabase
          .from('suppliers')
          .select('company_name, address, contact_phone, city, is_active')
          .eq('user_id', supplier.id)
          .maybeSingle();

        const certifications = supplier.certifications || [];
        const deliveryAreas = ['Kampala', 'Entebbe', 'Mukono', 'Wakiso', 'Jinja'];
        const languages = ['English', 'Luganda', 'Swahili'];
        const profilePicture = supplier.avatar_url || null;

        setSupplierProfile({
          id: supplier.id,
          name: bizProfile?.company_name || supplier.full_name || 'Your Company',
          contactPerson: supplier.full_name || '',
          email: supplier.email || user.email || '',
          phone: supplier.phone || '',
          address: bizProfile?.address || supplier.address || '',
          rating: 4.5,
          paymentTerms: 'Net 30 Days',
          creditLimit: 0,
          businessLicense: '',
          taxID: '',
          exportLicense: '',
          category: 'Supplier',
          avatar: '🇺🇬',
          profile_image_url: profilePicture,
          status: 'Active Supplier',
          partnershipYears: calculateYears(supplier.created_at),
          languages: languages,
          certifications: certifications,
          specialties: [],
          deliveryAreas: deliveryAreas
        });
        
        // Set profile pic URL state from avatar_url
        if (profilePicture) {
          setProfilePicUrl(profilePicture);
          console.log('✅ Loaded profile picture from database (avatar_url)');
        }
      } else {
        // User row exists but role not yet 'supplier' — profile was just created, show empty shell
        console.log('⚠️ No supplier row found yet — showing empty profile');
        setSupplierProfile({
          id: existingUser?.id || user.id,
          name: existingUser?.full_name || user.user_metadata?.full_name || 'Your Company',
          contactPerson: existingUser?.full_name || '',
          email: existingUser?.email || user.email || '',
          phone: existingUser?.phone || '',
          address: '',
          rating: 4.5,
          paymentTerms: 'Net 30 Days',
          creditLimit: 0,
          businessLicense: '',
          taxID: '',
          exportLicense: '',
          category: 'Supplier',
          avatar: '🇺🇬',
          profile_image_url: null,
          status: 'Active Supplier',
          partnershipYears: 0,
          languages: ['English'],
          certifications: [],
          specialties: [],
          deliveryAreas: ['Kampala']
        });
      }
    } catch (error) {
      console.error('Error loading supplier profile:', error);
    }
  };

  // Save edited profile to Supabase
  const saveSupplierProfile = async () => {
    try {
      setIsSavingProfile(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert('No authenticated user');
        return;
      }

      console.log('💾 Saving supplier profile for auth_id:', user.id);
      console.log('📝 Profile data to save:', editedProfile);

      // Prepare update data - using users table column names (no contact_person field)
      const updateData = {
        company_name: editedProfile.name || supplierProfile.name,
        full_name: editedProfile.contactPerson || supplierProfile.contactPerson, // Use full_name instead
        phone: editedProfile.phone || supplierProfile.phone,
        address: editedProfile.address || supplierProfile.address,
        category: editedProfile.category || supplierProfile.category
      };

      console.log('📤 Sending to database:', updateData);

      // First check if user exists in users table
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id, auth_id, role')
        .eq('auth_id', user.id)
        .single();

      if (checkError) {
        console.error('❌ Error checking user:', checkError);
        alert('Failed to save: User profile not found. Please complete your profile first from the sign-in page.');
        return;
      }

      if (!existingUser) {
        console.error('❌ No user found with auth_id:', user.id);
        alert('Failed to save: User profile not found. Please complete your profile first from the sign-in page.');
        return;
      }

      console.log('✅ User found:', existingUser);

      // Ensure we're updating a supplier record only
      if (existingUser.role !== 'supplier') {
        console.error('❌ Existing user role is not supplier:', existingUser.role);
        alert('Failed to save: Authenticated account is not registered as a supplier.');
        return;
      }

      // Update in Supabase users table by auth_id AND role='supplier' to avoid accidentally updating other roles
      const { data: updatedUsers, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('auth_id', user.id)
        .eq('role', 'supplier')
        .select();

      if (error) {
        console.error('❌ Error saving profile:', error);
        alert('Failed to save profile changes: ' + error.message);
        return;
      }

      if (!updatedUsers || updatedUsers.length === 0) {
        console.error('❌ Update returned no rows');
        alert('Failed to save: Update did not complete.');
        return;
      }

      console.log('✅ Profile saved successfully!', updatedUsers[0]);

      // Update local state
      setSupplierProfile(prev => ({
        ...prev,
        name: updateData.company_name,
        contactPerson: updateData.full_name,
        phone: updateData.phone,
        address: updateData.address,
        category: updateData.category,
        languages: editedProfile.languages || supplierProfile.languages,
        specialties: editedProfile.specialties || supplierProfile.specialties,
        deliveryAreas: editedProfile.deliveryAreas || supplierProfile.deliveryAreas
      }));

      setIsEditingProfile(false);
      setEditedProfile({});
      
      // Reload profile from database to get fresh data
      await loadSupplierProfile();
      
      alert('✅ Profile updated successfully!');
    } catch (error) {
      console.error('❌ Error saving profile:', error);
      alert('Failed to save profile changes: ' + error.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Start editing profile
  const startEditingProfile = () => {
    setEditedProfile({
      name: supplierProfile.name,
      contactPerson: supplierProfile.contactPerson,
      phone: supplierProfile.phone,
      address: supplierProfile.address,
      category: supplierProfile.category,
      languages: supplierProfile.languages,
      specialties: supplierProfile.specialties,
      deliveryAreas: supplierProfile.deliveryAreas
    });
    setIsEditingProfile(true);
  };

  // Cancel editing
  const cancelEditingProfile = () => {
    setIsEditingProfile(false);
    setEditedProfile({});
  };

  // Handle profile field change
  const handleProfileFieldChange = (field, value) => {
    setEditedProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Save financial details to Supabase
  const saveFinancialDetails = async () => {
    try {
      setIsSavingFinancial(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert('No authenticated user');
        return;
      }

      // Prepare update data
      const updateData = {
        payment_terms: editedFinancial.paymentTerms || supplierProfile.paymentTerms,
        payment_terms_days: parseInt(editedFinancial.paymentTermsDays) || 30,
        credit_limit_ugx: parseFloat(editedFinancial.creditLimit) || 0,
        mobile_money_provider: editedFinancial.mobileMoneyEnabled ? 'MTN' : 'None',
        updated_at: new Date().toISOString()
      };

      // Update in Supabase users table
      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('auth_id', user.id)
        .eq('role', 'supplier');

      if (error) {
        console.error('Error saving financial details:', error);
        alert('Failed to save financial details: ' + error.message);
        return;
      }

      // Update local state
      setSupplierProfile(prev => ({
        ...prev,
        paymentTerms: updateData.payment_terms,
        creditLimit: updateData.credit_limit_ugx
      }));

      setIsEditingFinancial(false);
      setEditedFinancial({});
      alert('✅ Financial details updated successfully!');
    } catch (error) {
      console.error('Error saving financial details:', error);
      alert('Failed to save financial details');
    } finally {
      setIsSavingFinancial(false);
    }
  };

  // Start editing financial details
  const startEditingFinancial = () => {
    setEditedFinancial({
      paymentTerms: supplierProfile.paymentTerms,
      creditLimit: supplierProfile.creditLimit,
      mobileMoneyEnabled: true,
      bankTransferEnabled: true,
      cashEnabled: false
    });
    setIsEditingFinancial(true);
  };

  // Cancel editing financial
  const cancelEditingFinancial = () => {
    setIsEditingFinancial(false);
    setEditedFinancial({});
  };

  // Handle financial field change
  const handleFinancialFieldChange = (field, value) => {
    setEditedFinancial(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle profile picture upload
  const handleProfilePictureUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 2MB for better performance)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size should be less than 2MB');
      return;
    }

    try {
      setUploadingProfilePic(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert('No authenticated user');
        return;
      }

      // Get supplier profile - use existing supplierProfile state
      if (!supplierProfile.id) {
        alert('Supplier profile not loaded yet. Please wait for profile to load.');
        return;
      }

      const supplierId = supplierProfile.id;

      // Convert image to base64 and store in both localStorage and database
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result;
        
        try {
          // Save to database (users table) using avatar_url column
          const { error } = await supabase
            .from('users')
            .update({ 
              avatar_url: base64String,
              updated_at: new Date().toISOString()
            })
            .eq('auth_id', user.id)
            .eq('role', 'supplier');

          if (error) {
            console.error('❌ Error saving to database:', error);
            notificationService.error('Failed to upload profile picture');
            return;
          }
          
          console.log('✅ Avatar uploaded to database successfully');
          
          // Verify the update by fetching the data
          const { data: updatedData, error: fetchError } = await supabase
            .from('users')
            .select('avatar_url')
            .eq('auth_id', user.id)
            .eq('role', 'supplier')
            .single();
          
          if (fetchError) {
            console.error('Error verifying upload:', fetchError);
          } else {
            console.log('Verified avatar_url in database:', updatedData?.avatar_url ? 'Image exists' : 'No image');
          }
          
          // Update local state immediately
          setProfilePicUrl(base64String);
          setSupplierProfile(prev => ({ ...prev, profile_image_url: base64String }));
          
          console.log('✅ Local state updated');
          notificationService.success('✅ Profile picture updated successfully!');
          
          // Also update the supplier profile state
          setSupplierProfile(prev => ({
            ...prev,
            profile_image_url: base64String
          }));
          
        } catch (error) {
          console.error('Error in upload process:', error);
          alert('⚠️ Profile picture saved locally but failed to save to database');
        } finally {
          // Force upload state to false
          setUploadingProfilePic(false);
        }
      };
      
      reader.onerror = () => {
        setUploadingProfilePic(false);
        alert('Failed to read image file');
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      alert('Failed to upload profile picture');
    } finally {
      setUploadingProfilePic(false);
    }
  };

  // Load performance metrics from database
  const loadPerformanceMetrics = async (userId) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('No authenticated user');
        return;
      }

      // Use auth UUID — this is what is stored in purchase_orders.supplier_id
      // (supplier_applications.supplier_user_id = auth UUID, stored by SupplierMarketplace)
      const authId = user.id;

      // Get all orders in one query — match by auth UUID OR users.id (covers old rows)
      const { data: allOrders, count: totalOrders } = await supabase
        .from('purchase_orders')
        .select('id, status, total_amount, ordered_at, expected_delivery_date', { count: 'exact' })
        .or(`supplier_id.eq.${authId}`);

      if (!allOrders) {
        console.log('No orders found for supplier');
        setPerformanceMetrics({ totalOrders: 0 });
        return;
      }

      const pendingOrders = allOrders?.filter(o => 
        ['pending_approval', 'approved', 'sent_to_supplier', 'confirmed'].includes(o.status)
      ).length || 0;

      // Calculate total revenue (all non-cancelled orders = processing, confirmed, received, completed)
      const totalRevenue = allOrders
        ?.filter(o => !['pending_approval', 'cancelled', 'rejected'].includes(o.status))
        .reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0) || 0;

      // Calculate average order value
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // On-time delivery (no actual_delivery_date column — estimate from received orders)
      const deliveredOrders = allOrders?.filter(o => ['received', 'completed'].includes(o.status)) || [];
      const onTimeDelivery = deliveredOrders.length > 0 ? 85 : 0; // default until real data exists

      setPerformanceMetrics({
        totalOrders: totalOrders || 0,
        totalRevenue: totalRevenue,
        onTimeDelivery: onTimeDelivery,
        qualityRating: 0,
        activeProducts: 0,
        pendingOrders: pendingOrders || 0,
        avgOrderValue: avgOrderValue,
        customerSatisfaction: 0,
        mobileMoneyTransactions: 0,
        bankTransferTransactions: 0,
        weeklyGrowth: 0,
        monthlyGrowth: 0,
        exportOrders: 0,
        localOrders: totalOrders || 0,
        seasonalProductsAvailable: 0,
        organicCertifiedProducts: 0,
        paidOrders: 0,
        unpaidOrders: pendingOrders || 0,
        partiallyPaidOrders: 0,
        totalPaid: 0,
        totalOutstanding: totalRevenue
      });
    } catch (error) {
      console.error('Error loading performance metrics:', error);
    }
  };

  // Load order history from database
  const loadOrderHistory = async (userId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const authId = user.id;
      console.log('📚 Loading order history for supplier auth ID:', authId);

      const { data: orders, error: ordersError } = await supabase
        .from('purchase_orders')
        .select('id, po_number, status, total_amount, items, ordered_at, expected_delivery_date, notes')
        .eq('supplier_id', authId)
        .order('ordered_at', { ascending: false })
        .limit(20);

      if (ordersError) {
        console.error('Error loading orders:', ordersError);
        return;
      }

      // Filter for completed/received/cancelled orders in JavaScript
      const filteredOrders = orders?.filter(o => 
        ['received', 'completed', 'cancelled'].includes(o.status)
      ) || [];

      if (!filteredOrders || filteredOrders.length === 0) {
        console.log('No order history found in database');
        setOrderHistory([]);
        return;
      }

      console.log(`Found ${filteredOrders.length} orders in history`);

      // Format orders with payment data from purchase_orders table
      // (payment data is now tracked directly in purchase_orders)
      const formatted = filteredOrders.map(order => ({
        id: order.po_number || order.id,
        orderId: order.id,
        date: new Date(order.ordered_at).toLocaleDateString('en-UG', {
          year: 'numeric', month: 'short', day: 'numeric'
        }),
        items: order.items?.length || 0,
        amount: parseFloat(order.total_amount) || 0,
        status: order.status === 'completed' ? 'delivered'
              : order.status === 'received'   ? 'received'
              : 'cancelled',
        rating: 5,
        products: order.items?.map(item => item.product_name || item.name || 'Item').join(', ') || 'N/A',
        payment_status: 'unpaid',
        amount_paid: 0,
        balance_due: parseFloat(order.total_amount) || 0
      }));

      console.log('✅ Order history loaded:', formatted.length, 'orders');
      setOrderHistory(formatted);
    } catch (error) {
      console.error('❌ Error loading order history:', error);
      setOrderHistory([]);
    }
  };

  // Load product catalog from database
  const loadProductCatalog = async (userId) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get users row then suppliers row (products.supplier_id → suppliers.id)
      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .or(`auth_id.eq.${user.id},id.eq.${user.id}`)
        .eq('role', 'supplier')
        .maybeSingle();

      if (!userRow?.id) {
        console.log('No supplier profile found');
        return;
      }

      const { data: supplierRow } = await supabase
        .from('suppliers')
        .select('id')
        .eq('user_id', userRow.id)
        .maybeSingle();

      if (!supplierRow?.id) {
        setProductCatalog([]);
        return;
      }

      const { data: products } = await supabase
        .from('products')
        .select('id, name, sku, selling_price, category_id')
        .eq('supplier_id', supplierRow.id)
        .order('name');

      const formatted = products?.map(product => ({
        id: product.id,
        name: product.name,
        category: 'Uncategorized',
        price: parseFloat(product.selling_price) || 0,
        stock: 0,
        status: 'active',
        unit: 'unit',
        season: 'year-round'
      })) || [];

      setProductCatalog(formatted);
    } catch (error) {
      console.error('Error loading product catalog:', error);
    }
  };

  // Load revenue data for charts
  const loadRevenueData = async (userId) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const authId = user.id;

      // Get orders from last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: orders } = await supabase
        .from('purchase_orders')
        .select('total_amount, status, ordered_at')
        .eq('supplier_id', authId)
        .gte('ordered_at', sixMonthsAgo.toISOString())
        .order('ordered_at');

      // Filter for completed/received orders in JavaScript
      const completedOrders = orders?.filter(o => 
        ['received', 'completed'].includes(o.status)
      ) || [];

      // Group by month
      const revenueByMonth = {};
      completedOrders.forEach(order => {
        const month = new Date(order.ordered_at).toLocaleDateString('en-US', { month: 'short' });
        if (!revenueByMonth[month]) {
          revenueByMonth[month] = { name: month, revenue: 0, orders: 0, products: 0 };
        }
        revenueByMonth[month].revenue += parseFloat(order.total_amount) || 0;
        revenueByMonth[month].orders += 1;
      });

      const revenueArray = Object.values(revenueByMonth);
      if (revenueArray.length > 0) {
        setRevenueData(revenueArray);
      }
    } catch (error) {
      console.error('Error loading revenue data:', error);
    }
  };

  // Load pending orders from Manager Portal
  const loadPendingOrders = async (userId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use auth UUID — matches what was stored by the manager when creating the order
      const authId = user.id;
      console.log('Loading orders for supplier auth ID:', authId);

      // Get orders sent to this supplier
      const { data: orders, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('supplier_id', authId)
        .order('ordered_at', { ascending: false });

      if (error) {
        console.error('Error loading pending orders:', error);
        return;
      }

      // Filter statuses in JavaScript instead of relying on enum
      const validStatuses = ['sent_to_supplier', 'confirmed', 'approved', 'pending_approval', 'received', 'completed'];
      const filteredOrders = orders?.filter(o => validStatuses.includes(o.status)) || [];

      const formatted = filteredOrders.map(order => {
        return {
          id: order.po_number || order.id,
          orderId: order.id,
          date: new Date(order.ordered_at).toLocaleDateString(),
          items: order.items?.length || 0,
          amount: parseFloat(order.total_amount) || 0,
          status: order.status === 'sent_to_supplier' ? 'processing' : 
                  order.status === 'confirmed' ? 'confirmed' :
                  order.status === 'received' ? 'received' :
                  order.status === 'completed' ? 'completed' : 'processing',
          expectedDelivery: order.expected_delivery_date ? 
            new Date(order.expected_delivery_date).toLocaleDateString() : 'TBD',
          products: order.items?.map(item => item.product_name).join(', ') || 'Various items',
          priority: order.priority || 'normal',
          deliveryAddress: order.delivery_address,
          notes: order.notes,
          payment_status: 'unpaid',
          amount_paid: 0,
          balance_due: parseFloat(order.total_amount) || 0,
          total_amount: parseFloat(order.total_amount) || 0,
          fullOrder: order
        };
      }) || [];

      setPendingOrders(formatted);
      console.log(`Loaded ${formatted.length} orders with payment status`);
    } catch (error) {
      console.error('Error loading pending orders:', error);
    }
  };

  // Main data loading function
  const loadSupplierData = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user logged in');
        setLoading(false);
        return;
      }

      console.log('Loading supplier data for user:', user.id);
      
      // Create timeout promise that rejects after 15 seconds
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Data loading timeout')), 15000)
      );

      // Load all data with timeout
      const loadPromise = (async () => {
        try {
          await loadSupplierProfile(user.id);
        } catch (e) {
          console.error('Error in loadSupplierProfile:', e);
        }
        
        try {
          await loadPerformanceMetrics(user.id);
        } catch (e) {
          console.error('Error in loadPerformanceMetrics:', e);
        }
        
        try {
          await loadOrderHistory(user.id);
        } catch (e) {
          console.error('Error in loadOrderHistory:', e);
        }
        
        try {
          await loadPendingOrders(user.id);
        } catch (e) {
          console.error('Error in loadPendingOrders:', e);
        }
        
        try {
          await loadProductCatalog(user.id);
        } catch (e) {
          console.error('Error in loadProductCatalog:', e);
        }
        
        try {
          await loadRevenueData(user.id);
        } catch (e) {
          console.error('Error in loadRevenueData:', e);
        }

        try {
          await loadAvailableSupermarkets(user.id);
        } catch (e) {
          console.error('Error loading supermarkets:', e);
        }
        
        console.log('Supplier data loaded successfully');
      })();

      // Race between load and timeout
      try {
        await Promise.race([loadPromise, timeoutPromise]);
      } catch (e) {
        console.error('Loading timeout or error:', e.message);
        // Continue anyway - some data may have loaded
      }
    } catch (error) {
      console.error('Error loading supplier data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load available supermarkets for this supplier
  const loadAvailableSupermarkets = async (userId) => {
    try {
      setLoadingSupermarkets(true);
      
      // Get current supermarket_id from user
      const { data: userData } = await supabase
        .from('users')
        .select('supermarket_id')
        .eq('auth_id', userId)
        .single();
      
      if (userData?.supermarket_id) {
        setCurrentSupermarketId(userData.supermarket_id);
      }
      
      // Fetch all active supermarkets
      const { data: supermarkets, error } = await supabase
        .from('supermarkets')
        .select('id, name, location, is_active')
        .eq('is_active', true)
        .order('name', { ascending: true });
      
      if (error) {
        console.error('Error fetching supermarkets:', error);
      } else {
        console.log('Loaded supermarkets:', supermarkets);
        setAvailableSupermarkets(supermarkets || []);
      }
    } catch (error) {
      console.error('Error in loadAvailableSupermarkets:', error);
    } finally {
      setLoadingSupermarkets(false);
    }
  };

  // Switch to a different supermarket
  const switchSupermarket = async (supermarketId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setLoadingSupermarkets(true);
      
      // Update supermarket_id in users table
      const { error } = await supabase
        .from('users')
        .update({ supermarket_id: supermarketId })
        .eq('auth_id', user.id);
      
      if (error) {
        console.error('Error switching supermarket:', error);
        notificationService.show('Failed to switch supermarket', 'error');
      } else {
        setCurrentSupermarketId(supermarketId);
        const selectedMarket = availableSupermarkets.find(s => s.id === supermarketId);
        notificationService.show(`✅ Switched to ${selectedMarket?.name}!`, 'success');
        // Reload data for new supermarket
        await loadSupplierData();
      }
    } catch (error) {
      console.error('Error switching supermarket:', error);
      notificationService.show('An error occurred while switching supermarket', 'error');
    } finally {
      setLoadingSupermarkets(false);
    }
  };


  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Verify user role before loading data
    const checkAuthAndLoad = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('No authenticated user - redirecting to supplier auth');
        navigate('/supplier-auth');
        return;
      }

      // Check user role — match by auth_id OR id (handles both old and new rows)
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, role')
        .or(`auth_id.eq.${user.id},id.eq.${user.id}`)
        .maybeSingle();

      // No row at all → send back to create account
      if (!existingUser) {
        console.log('No user record found - redirecting to supplier auth');
        navigate('/supplier-auth');
        return;
      }

      // Wrong role (fully set up as something else) → redirect
      if (existingUser.role && existingUser.role !== 'supplier' && existingUser.role !== 'customer') {
        const redirectPath = existingUser.role === 'manager' ? '/manager-portal'
                           : existingUser.role === 'admin'   ? '/admin-portal'
                           : existingUser.role === 'cashier' ? '/cashier-portal'
                           : '/customer-dashboard';
        notificationService.show(`This account is registered as ${existingUser.role}.`, 'warning', 3000);
        setTimeout(() => navigate(redirectPath), 2000);
        return;
      }

      // If user is supplier or profile not completed, proceed with loading data
      loadSupplierData();
      loadPaymentData();
    };

    checkAuthAndLoad();

    // Subscribe to real-time updates on purchase orders (only refresh on actual changes)
    const subscription = supabase
      .channel('purchase-orders-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'purchase_orders'
      }, (payload) => {
        console.log('📊 Real-time order update detected, refreshing supplier metrics...', payload);
        loadSupplierData();
      })
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(subscription);
    };
  }, []);

  // Mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Function to load payment data from database
  const loadPaymentData = async () => {
    try {
      // Payment history is now handled by SupplierPaymentConfirmations component
      // which uses payment_transactions table with supplier confirmation flow
      console.log('✅ Payment data will be loaded by SupplierPaymentConfirmations component');
      
      // Old payment service disabled - using new confirmation-based system
      // const dbPayments = await PaymentService.getSupplierPaymentHistory(supplierId);
      
    } catch (error) {
      console.log('Payment data loading skipped:', error.message);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  // Payment status helper functions
  const getPaymentStatusColor = (status) => {
    switch(status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'unpaid': return 'bg-red-100 text-red-800';
      case 'partial': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusIcon = (status) => {
    switch(status) {
      case 'paid': return '✅';
      case 'unpaid': return '❌';
      case 'partial': return '⚡';
      default: return '❓';
    }
  };

  const getPaymentMethodIcon = (method) => {
    switch(method) {
      case 'mobile_money': return '📱';
      case 'bank_transfer': return '🏦';
      case 'check': return '📝';
      case 'cash': return '💰';
      default: return '💳';
    }
  };

  const getFilteredPaymentHistory = () => {
    if (paymentFilter === 'all') return paymentHistory;
    return paymentHistory.filter(payment => payment.status === paymentFilter);
  };

  const getPaymentStats = () => {
    const total = paymentHistory.length;
    const paid = paymentHistory.filter(p => p.status === 'paid').length;
    const unpaid = paymentHistory.filter(p => p.status === 'unpaid').length;
    const partial = paymentHistory.filter(p => p.status === 'partial').length;
    const totalAmount = paymentHistory.reduce((sum, p) => sum + p.amount, 0);
    const paidAmount = paymentHistory.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0) +
                     paymentHistory.filter(p => p.status === 'partial').reduce((sum, p) => sum + (p.paidAmount || 0), 0);
    const outstandingAmount = totalAmount - paidAmount;
    
    return { total, paid, unpaid, partial, totalAmount, paidAmount, outstandingAmount };
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];

  const renderProfile = () => (
    <div className="space-y-6 animate-fadeInUp">
      {/* Profile Header Card */}
      <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-6">
              {/* Company Logo/Avatar */}
              <div className="relative group">
                <div className="w-32 h-32 bg-white rounded-2xl flex items-center justify-center shadow-xl overflow-hidden">
                  {profilePicUrl || supplierProfile.profile_image_url ? (
                    <img 
                      src={profilePicUrl || supplierProfile.profile_image_url} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-6xl">{supplierProfile.avatar}</span>
                  )}
                </div>
                
                {/* Upload Button Overlay */}
                <label 
                  htmlFor="profile-pic-upload"
                  className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 rounded-2xl flex items-center justify-center cursor-pointer transition-all duration-300"
                >
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white text-center">
                    {uploadingProfilePic ? (
                      <div className="flex flex-col items-center">
                        <FiRefreshCw className="h-8 w-8 animate-spin mb-2" />
                        <span className="text-xs">Uploading...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <FiCamera className="h-8 w-8 mb-2" />
                        <span className="text-xs font-medium">Change Photo</span>
                      </div>
                    )}
                  </div>
                  <input
                    id="profile-pic-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePictureUpload}
                    disabled={uploadingProfilePic}
                    className="hidden"
                  />
                </label>

                <div className="absolute bottom-0 right-0 w-10 h-10 bg-green-500 rounded-full border-4 border-white flex items-center justify-center">
                  <FiCheckCircle className="text-white h-5 w-5" />
                </div>
                <div className="absolute -top-2 -right-2 px-3 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full animate-pulse">
                  PREMIUM
                </div>
              </div>
              
              {/* Company Info */}
              <div className="text-white">
                <h1 className="text-4xl font-bold mb-2">{supplierProfile.name}</h1>
                <p className="text-xl text-purple-200 mb-4">{supplierProfile.category}</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <FiUsers className="h-5 w-5" />
                    <span>Contact: {supplierProfile.contactPerson}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FiMail className="h-5 w-5" />
                    <span>{supplierProfile.email}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FiSmartphone className="h-5 w-5" />
                    <span>{supplierProfile.phone}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FiMapPin className="h-5 w-5" />
                    <span>Kampala, Uganda</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col space-y-2">
              <button 
                onClick={() => setShowAddProductModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all flex items-center space-x-2 font-medium shadow-lg"
              >
                <FiPlus className="h-4 w-4" />
                <span>Add Product</span>
              </button>
              <button 
                onClick={startEditingProfile}
                className="px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-gray-100 transition-all flex items-center space-x-2 font-medium shadow-md hover:shadow-lg"
              >
                <FiEdit className="h-4 w-4" />
                <span>Edit Profile</span>
              </button>
              <button className="px-4 py-2 bg-white/20 backdrop-blur-sm text-white rounded-lg hover:bg-white/30 transition-all flex items-center space-x-2 font-medium">
                <FiSettings className="h-4 w-4" />
                <span>Settings</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="bg-black/30 backdrop-blur-sm px-8 py-4">
          <div className="grid grid-cols-5 gap-6">
            <div className="text-center">
              <p className="text-purple-200 text-sm mb-1">Total Revenue</p>
              <p className="text-white text-2xl font-bold">UGX {(performanceMetrics.totalRevenue / 1000000).toFixed(1)}M</p>
            </div>
            <div className="text-center">
              <p className="text-purple-200 text-sm mb-1">Total Orders</p>
              <p className="text-white text-2xl font-bold">{performanceMetrics.totalOrders}</p>
            </div>
            <div className="text-center">
              <p className="text-purple-200 text-sm mb-1">Quality Rating</p>
              <p className="text-white text-2xl font-bold flex items-center justify-center">
                {supplierProfile.rating}
                <FiStar className="h-5 w-5 text-yellow-400 ml-1 fill-current" />
              </p>
            </div>
            <div className="text-center">
              <p className="text-purple-200 text-sm mb-1">On-Time Delivery</p>
              <p className="text-white text-2xl font-bold">{performanceMetrics.onTimeDelivery}%</p>
            </div>
            <div className="text-center">
              <p className="text-purple-200 text-sm mb-1">Partnership</p>
              <p className="text-white text-2xl font-bold">{supplierProfile.partnershipYears} Years</p>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Business Information */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Business Information</h3>
            <FiHome className="h-6 w-6 text-gray-400" />
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Company Name</p>
              <p className="text-base font-semibold text-gray-900">{supplierProfile.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Business License</p>
              <p className="text-base font-semibold text-gray-900">{supplierProfile.businessLicense}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tax ID (TIN)</p>
              <p className="text-base font-semibold text-gray-900">{supplierProfile.taxID}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Export License</p>
              <p className="text-base font-semibold text-gray-900">{supplierProfile.exportLicense}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Category</p>
              <p className="text-base font-semibold text-gray-900">{supplierProfile.category}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                {supplierProfile.status}
              </span>
            </div>
          </div>
        </div>

        {/* Contact & Location */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Contact & Location</h3>
            <FiMapPin className="h-6 w-6 text-gray-400" />
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Contact Person</p>
              <p className="text-base font-semibold text-gray-900">{supplierProfile.contactPerson}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email Address</p>
              <p className="text-base font-semibold text-gray-900">{supplierProfile.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Phone Number</p>
              <p className="text-base font-semibold text-gray-900">{supplierProfile.phone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Business Address</p>
              <p className="text-base font-semibold text-gray-900">{supplierProfile.address}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Languages</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {supplierProfile.languages.map(lang => (
                  <span key={lang} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {lang}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500">Delivery Areas</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {supplierProfile.deliveryAreas.slice(0, 3).map(area => (
                  <span key={area} className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                    {area}
                  </span>
                ))}
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                  +{supplierProfile.deliveryAreas.length - 3} more
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Details */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Financial Details</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={startEditingFinancial}
                className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                title="Edit Financial Details"
              >
                <FiEdit className="h-5 w-5" />
              </button>
              <FiDollarSign className="h-6 w-6 text-gray-400" />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Payment Terms</p>
              <p className="text-base font-semibold text-gray-900">{supplierProfile.paymentTerms}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Credit Limit</p>
              <p className="text-base font-semibold text-gray-900">
                UGX {(supplierProfile.creditLimit / 1000000).toFixed(1)}M
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Payment Methods</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center">
                  <FiSmartphone className="h-3 w-3 mr-1" />
                  Mobile Money
                </span>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center">
                  <FiCreditCard className="h-3 w-3 mr-1" />
                  Bank Transfer
                </span>
                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium flex items-center">
                  <FiDollarSign className="h-3 w-3 mr-1" />
                  Cash
                </span>
              </div>
            </div>
            <div className="pt-4 border-t">
              <p className="text-sm text-gray-500 mb-3">Transaction Distribution</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">Mobile Money</span>
                  <span className="font-semibold">{performanceMetrics.mobileMoneyTransactions}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{ width: `${performanceMetrics.mobileMoneyTransactions}%` }}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-sm mt-3">
                  <span className="text-gray-700">Bank Transfer</span>
                  <span className="font-semibold">{performanceMetrics.bankTransferTransactions}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full" 
                    style={{ width: `${performanceMetrics.bankTransferTransactions}%` }}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-sm mt-3">
                  <span className="text-gray-700">Cash</span>
                  <span className="font-semibold">
                    {100 - performanceMetrics.mobileMoneyTransactions - performanceMetrics.bankTransferTransactions}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-yellow-500 h-2 rounded-full" 
                    style={{ width: `${100 - performanceMetrics.mobileMoneyTransactions - performanceMetrics.bankTransferTransactions}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Certifications & Specialties */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Certifications */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Certifications & Compliance</h3>
            <FiShield className="h-6 w-6 text-green-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {supplierProfile.certifications.map((cert, index) => (
              <div key={index} className="flex items-center space-x-3 p-4 bg-green-50 rounded-xl border-2 border-green-200">
                <FiCheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="font-semibold text-gray-900">{cert}</p>
                  <p className="text-xs text-gray-600">Certified</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-4 bg-blue-50 rounded-xl">
            <div className="flex items-start space-x-3">
              <FiInfo className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">Compliance Status</p>
                <p className="text-xs text-blue-700 mt-1">All certifications are up to date and verified</p>
              </div>
            </div>
          </div>
        </div>

        {/* Specialties */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Product Specialties</h3>
            <FiPackage className="h-6 w-6 text-purple-500" />
          </div>
          <div className="space-y-3">
            {supplierProfile.specialties.map((specialty, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-purple-50 rounded-xl border-2 border-purple-200">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                    <FiStar className="h-5 w-5 text-white" />
                  </div>
                  <p className="font-semibold text-gray-900">{specialty}</p>
                </div>
                <FiChevronRight className="h-5 w-5 text-gray-400" />
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-xl text-center">
              <p className="text-sm text-green-600 mb-1">Organic Products</p>
              <p className="text-2xl font-bold text-gray-900">{performanceMetrics.organicCertifiedProducts}</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl text-center">
              <p className="text-sm text-orange-600 mb-1">Seasonal Items</p>
              <p className="text-2xl font-bold text-gray-900">{performanceMetrics.seasonalProductsAvailable}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Performance Overview</h3>
          <FiTrendingUp className="h-6 w-6 text-green-500" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
            <FiPackage className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <p className="text-sm text-blue-600 mb-1">Active Products</p>
            <p className="text-2xl font-bold text-gray-900">{performanceMetrics.activeProducts}</p>
            <p className="text-xs text-gray-600 mt-1">In catalog</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
            <FiTruck className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-sm text-green-600 mb-1">On-Time Delivery</p>
            <p className="text-2xl font-bold text-gray-900">{performanceMetrics.onTimeDelivery}%</p>
            <p className="text-xs text-gray-600 mt-1">Success rate</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl">
            <FiStar className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <p className="text-sm text-purple-600 mb-1">Customer Rating</p>
            <p className="text-2xl font-bold text-gray-900">{performanceMetrics.customerSatisfaction}</p>
            <p className="text-xs text-gray-600 mt-1">Out of 5.0</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl">
            <FiDollarSign className="h-8 w-8 text-orange-600 mx-auto mb-2" />
            <p className="text-sm text-orange-600 mb-1">Avg Order Value</p>
            <p className="text-2xl font-bold text-gray-900">
              {(performanceMetrics.avgOrderValue / 1000).toFixed(0)}K
            </p>
            <p className="text-xs text-gray-600 mt-1">UGX</p>
          </div>
        </div>
      </div>

      {/* Achievements & Recognition */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Achievements & Recognition</h3>
          <FiAward className="h-6 w-6 text-yellow-500" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border-2 border-yellow-300">
            <div className="text-4xl mb-2">🏆</div>
            <p className="text-sm font-bold text-gray-900">Premium Supplier</p>
            <p className="text-xs text-gray-600">{supplierProfile.partnershipYears} Years Partner</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-300">
            <div className="text-4xl mb-2">⭐</div>
            <p className="text-sm font-bold text-gray-900">Top Rated</p>
            <p className="text-xs text-gray-600">{supplierProfile.rating} Rating</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-300">
            <div className="text-4xl mb-2">🎯</div>
            <p className="text-sm font-bold text-gray-900">Quality Leader</p>
            <p className="text-xs text-gray-600">Certified Organic</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-300">
            <div className="text-4xl mb-2">💎</div>
            <p className="text-sm font-bold text-gray-900">Trusted Partner</p>
            <p className="text-xs text-gray-600">Verified Business</p>
          </div>
        </div>
      </div>

      {/* Supermarket Management */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Supermarket Management</h3>
            <p className="text-sm text-gray-600 mt-1">Switch between supermarkets to manage products and orders</p>
          </div>
          <div className="text-3xl">🏪</div>
        </div>
        
        {loadingSupermarkets ? (
          <div className="flex items-center justify-center py-8">
            <FiRefreshCw className="animate-spin h-6 w-6 text-blue-600 mr-2" />
            <span className="text-gray-600">Loading supermarkets...</span>
          </div>
        ) : availableSupermarkets.length === 0 ? (
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-start gap-3">
              <FiAlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-900">No supermarkets available</p>
                <p className="text-xs text-yellow-700 mt-1">Please contact an administrator to enable supermarket access.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Supermarket Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Location</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {availableSupermarkets.map((supermarket) => (
                  <tr 
                    key={supermarket.id}
                    className={`border-b transition-colors ${
                      currentSupermarketId === supermarket.id 
                        ? 'bg-blue-50 hover:bg-blue-100' 
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <span className="text-lg">🏪</span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{supermarket.name}</p>
                          <p className="text-xs text-gray-500">ID: {supermarket.id.substring(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2 text-gray-700">
                        <FiMapPin className="h-4 w-4 text-gray-400" />
                        <span>{supermarket.location}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      {currentSupermarketId === supermarket.id ? (
                        <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                          <div className="w-2 h-2 bg-blue-600 rounded-full mr-2 animate-pulse"></div>
                          Currently Selected
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">
                          Available
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {currentSupermarketId === supermarket.id ? (
                        <button
                          disabled
                          className="px-4 py-2 bg-gray-100 text-gray-500 rounded-lg font-medium cursor-not-allowed opacity-60"
                        >
                          Current
                        </button>
                      ) : (
                        <button
                          onClick={() => switchSupermarket(supermarket.id)}
                          disabled={loadingSupermarkets}
                          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {loadingSupermarkets ? (
                            <>
                              <FiRefreshCw className="animate-spin h-4 w-4" />
                              <span className="text-sm">Switching...</span>
                            </>
                          ) : (
                            <>
                              <FiNavigation className="h-4 w-4" />
                              <span className="text-sm">Switch</span>
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
          <div className="flex gap-3">
            <FiInfo className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">Multiple Supermarkets</p>
              <p className="text-xs text-blue-700 mt-1">You can switch between supermarkets to manage products and orders for each location. Your profile and financial information will be displayed per supermarket.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-6 animate-fadeInUp">
      {/* ICAN Coin Balance */}
      <div className="flex justify-end">
        <div className="w-44"><IcanCoinBadge /></div>
      </div>

      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {getGreeting()}, {supplierProfile.contactPerson}! 👋
            </h1>
            <p className="text-purple-100 text-lg">
              Welcome to your supplier dashboard - {supplierProfile.name}
            </p>
            <div className="flex items-center mt-4 space-x-4">
              <div className="flex items-center space-x-2">
                <FiClock className="h-5 w-5" />
                <span>{currentTime.toLocaleTimeString()}</span>
              </div>
              <div className="flex items-center space-x-2">
                <FiCalendar className="h-5 w-5" />
                <span>{currentTime.toLocaleDateString()}</span>
              </div>
              <div className="flex items-center space-x-2">
                <FiStar className="h-5 w-5" />
                <span>{supplierProfile.rating} Rating</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl mb-2">🏢</div>
            <p className="text-purple-100">Partnership Strong!</p>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Total Revenue', value: formatCurrency(performanceMetrics.totalRevenue), icon: FiDollarSign, color: 'from-green-500 to-green-600', change: '+18.5%', detail: `${performanceMetrics.totalOrders} orders` },
          { title: 'Total Orders', value: formatNumber(performanceMetrics.totalOrders), icon: FiPackage, color: 'from-blue-500 to-blue-600', change: '+12.3%', detail: `${performanceMetrics.pendingOrders} pending` },
          { title: 'On-Time Delivery', value: `${performanceMetrics.onTimeDelivery}%`, icon: FiTruck, color: 'from-purple-500 to-purple-600', change: '+2.1%', detail: 'On schedule' },
          { title: 'Quality Rating', value: performanceMetrics.qualityRating, icon: FiStar, color: 'from-yellow-500 to-yellow-600', change: '+0.3', detail: 'Customer satisfaction' }
        ].map((metric, index) => (
          <div key={index} className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-gray-600 text-sm font-medium">{metric.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
                <p className="text-xs text-gray-500 mt-1">{metric.detail}</p>
                <p className="text-green-600 text-sm font-medium mt-1">{metric.change}</p>
              </div>
              <div className={`p-3 rounded-lg bg-gradient-to-r ${metric.color}`}>
                <metric.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Payment Summary Bar */}
      <div className="mt-6 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 shadow-md border border-purple-100">
        <h3 className="text-lg font-bold text-gray-900 mb-4">💳 Payment Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-white rounded-lg shadow-sm">
            <p className="text-xs text-gray-600 font-semibold mb-1">FULLY PAID</p>
            <p className="text-2xl font-bold text-green-600">{performanceMetrics.paidOrders || 0}</p>
            <p className="text-xs text-gray-500 mt-1">{formatCurrency(performanceMetrics.totalPaid || 0)}</p>
          </div>
          
          <div className="text-center p-4 bg-white rounded-lg shadow-sm border-2 border-yellow-300">
            <p className="text-xs text-gray-600 font-semibold mb-1">PARTIALLY PAID ⚠️</p>
            <p className="text-2xl font-bold text-yellow-600">{performanceMetrics.partiallyPaidOrders || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Needs Completion</p>
          </div>
          
          <div className="text-center p-4 bg-white rounded-lg shadow-sm">
            <p className="text-xs text-gray-600 font-semibold mb-1">UNPAID</p>
            <p className="text-2xl font-bold text-red-600">{performanceMetrics.unpaidOrders || 0}</p>
            <p className="text-xs text-gray-500 mt-1">{formatCurrency(performanceMetrics.totalOutstanding || 0)}</p>
          </div>
          
          <div className="text-center p-4 bg-white rounded-lg shadow-sm">
            <p className="text-xs text-gray-600 font-semibold mb-1">TOTAL RECEIVED</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(performanceMetrics.totalPaid || 0)}</p>
            <p className="text-xs text-gray-500 mt-1">Cash In</p>
          </div>
          
          <div className="text-center p-4 bg-white rounded-lg shadow-sm">
            <p className="text-xs text-gray-600 font-semibold mb-1">OUTSTANDING</p>
            <p className="text-2xl font-bold text-purple-600">{formatCurrency(performanceMetrics.totalOutstanding || 0)}</p>
            <p className="text-xs text-gray-500 mt-1">Balance Due</p>
          </div>
        </div>
      </div>

      {/* Payment Statistics - Collapsible */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <button
          onClick={() => setShowPaymentStatus(!showPaymentStatus)}
          className="w-full flex items-center justify-between mb-4 text-xl font-bold text-gray-900 hover:text-purple-600 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <span>💰 Payment Status Overview</span>
          </div>
          {showPaymentStatus ? <FiChevronUp className="h-6 w-6" /> : <FiChevronDown className="h-6 w-6" />}
        </button>
        
        {showPaymentStatus && (
          <ul className="space-y-3 animate-fadeIn">
            <li className="flex items-start space-x-3 p-3 hover:bg-green-50 rounded-lg transition-all">
              <span className="text-green-500 text-xl mt-1">•</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-green-700 font-semibold">Paid Orders</span>
                  <span className="text-2xl font-bold text-green-800">{performanceMetrics.paidOrders || 0}</span>
                </div>
                <p className="text-xs text-green-600">{formatCurrency(performanceMetrics.totalPaid || 0)}</p>
              </div>
            </li>
            
            <li className="flex items-start space-x-3 p-3 hover:bg-yellow-50 rounded-lg transition-all">
              <span className="text-yellow-500 text-xl mt-1">•</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-yellow-700 font-semibold">Half Paid</span>
                  <span className="text-2xl font-bold text-yellow-800">{performanceMetrics.partiallyPaidOrders || 0}</span>
                </div>
                <p className="text-xs text-yellow-600">Partial Payments</p>
              </div>
            </li>
            
            <li className="flex items-start space-x-3 p-3 hover:bg-red-50 rounded-lg transition-all">
              <span className="text-red-500 text-xl mt-1">•</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-red-700 font-semibold">Unpaid Orders</span>
                  <span className="text-2xl font-bold text-red-800">{performanceMetrics.unpaidOrders || 0}</span>
                </div>
                <p className="text-xs text-red-600">{formatCurrency(performanceMetrics.totalOutstanding || 0)}</p>
              </div>
            </li>
            
            <li className="flex items-start space-x-3 p-3 hover:bg-blue-50 rounded-lg transition-all">
              <span className="text-blue-500 text-xl mt-1">•</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-blue-700 font-semibold">Total Received</span>
                  <span className="text-xl font-bold text-blue-800">{formatCurrency(performanceMetrics.totalPaid || 0)}</span>
                </div>
                <p className="text-xs text-blue-600">Payments Received</p>
              </div>
            </li>
            
            <li className="flex items-start space-x-3 p-3 hover:bg-purple-50 rounded-lg transition-all">
              <span className="text-purple-500 text-xl mt-1">•</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-purple-700 font-semibold">Outstanding</span>
                  <span className="text-xl font-bold text-purple-800">{formatCurrency(performanceMetrics.totalOutstanding || 0)}</span>
                </div>
                <p className="text-xs text-purple-600">Balance Due</p>
              </div>
            </li>
          </ul>
        )}
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Revenue Trends</h3>
          <div className="flex space-x-2">
            {['6m', '1y', '2y'].map((range) => (
              <button
                key={range}
                className="px-3 py-1 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all duration-300"
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="revenue" fill="#8B5CF6" fillOpacity={0.3} />
            <Line type="monotone" dataKey="revenue" stroke="#8B5CF6" strokeWidth={3} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Partnership Goals */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Partnership Goals Progress</h3>
        <div className="space-y-4">
          {partnershipGoals.map((goal) => (
            <div key={goal.id} className="border rounded-lg p-4 hover:shadow-md transition-all duration-300">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-900">{goal.title}</h4>
                <span className="text-sm text-gray-500">{goal.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(goal.progress, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Target: {typeof goal.target === 'number' && goal.target > 1000 ? formatCurrency(goal.target) : goal.target}</span>
                <span>Current: {typeof goal.current === 'number' && goal.current > 1000 ? formatCurrency(goal.current) : goal.current}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Handle order confirmation
  const handleConfirmOrder = async (orderId) => {
    if (!confirm('Confirm this order? This will notify FAREDEAL that you accept the order.')) return;

    try {
      console.log('🔵 Confirming order with ID:', orderId);
      
      const { data, error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error confirming order:', error);
        throw error;
      }

      console.log('✅ Order confirmed successfully:', data);
      alert('✅ Order confirmed successfully!');
      loadSupplierData(); // Reload data
    } catch (err) {
      console.error('Error confirming order:', err);
      alert('Failed to confirm order: ' + err.message);
    }
  };

  // Handle order rejection
  const handleRejectOrder = async (orderId) => {
    const reason = prompt('Enter reason for rejection:');
    if (!reason) return;

    try {
      console.log('🔴 Rejecting order with ID:', orderId);
      
      const { data, error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'cancelled',
          cancellation_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error rejecting order:', error);
        throw error;
      }

      console.log('✅ Order rejected:', data);
      alert('❌ Order rejected');
      loadSupplierData(); // Reload data
    } catch (err) {
      console.error('Error rejecting order:', err);
      alert('Failed to reject order: ' + err.message);
    }
  };

  const renderOrders = () => (
    <div className="space-y-6 animate-fadeInUp">
      {/* Pending Orders */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">📦 Orders from FAREDEAL Manager Portal</h3>
          <button
            onClick={loadSupplierData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 flex items-center space-x-2"
          >
            <FiRefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
        <div className="space-y-3">
          {pendingOrders.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <FiPackage className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-semibold">No pending orders</p>
              <p className="text-gray-500 text-sm">Orders from FAREDEAL will appear here</p>
            </div>
          ) : (
            pendingOrders.map((order) => (
              <div key={order.id} className="border-2 border-blue-200 rounded-lg overflow-hidden bg-gradient-to-r from-blue-50 to-white hover:shadow-md transition-all duration-300">
                {/* Collapsed View - Order Header */}
                <div 
                  className="p-4 md:p-5 cursor-pointer hover:bg-blue-50 transition-colors"
                  onClick={() => setExpandedOrderId(expandedOrderId === order.orderId ? null : order.orderId)}
                >
                  {/* Mobile Portrait: Completely Stacked Layout */}
                  <div className="space-y-3 md:space-y-0">
                    {/* Row 1: Order Icon, ID, and Expand Button */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <FiPackage className="h-5 w-5 md:h-6 md:w-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm md:text-base text-gray-900">{order.id}</h4>
                          <p className="text-xs md:text-sm text-gray-600 mt-0.5">{order.items} items • {order.date}</p>
                        </div>
                      </div>
                      {/* Expand/Collapse Icon */}
                      <div className={`transform transition-transform flex-shrink-0`}>
                        <FiChevronDown className="h-5 w-5 text-gray-500 mt-0.5" />
                      </div>
                    </div>

                    {/* Row 2: Status and Payment Badges */}
                    <div className="flex items-center gap-2 flex-wrap pl-13 md:pl-0">
                      {/* Status Badge */}
                      <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                        order.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                        order.status === 'received' ? 'bg-teal-100 text-teal-800' :
                        order.status === 'completed' ? 'bg-green-100 text-green-800' :
                        order.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {order.status?.toUpperCase()}
                      </span>
                      {/* Payment Status Badge */}
                      <span className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-full ${
                        order.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                        order.payment_status === 'partially_paid' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {order.payment_status === 'paid' && '✅ PAID'}
                        {order.payment_status === 'partially_paid' && '⚠️ PARTIAL'}
                        {order.payment_status === 'unpaid' && '❌ UNPAID'}
                        {!order.payment_status && '❌ UNPAID'}
                      </span>
                    </div>

                    {/* Row 3: Amount (Large and Prominent) */}
                    <div className="flex items-baseline justify-between pl-13 md:pl-0 pt-1 border-t md:border-t-0 md:pt-0">
                      <div className="flex-1">
                        <p className="text-xs text-gray-600 mb-1">Total Amount</p>
                        <p className="font-bold text-3xl md:text-lg text-green-600">{formatCurrency(order.amount)}</p>
                        {order.payment_status === 'partially_paid' && (
                          <p className="text-xs text-gray-600 mt-1">
                            Paid: <span className="text-green-600 font-semibold">{formatCurrency(order.amount_paid)}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded View - Order Details */}
                {expandedOrderId === order.orderId && (
                  <div className="border-t-2 border-blue-200 p-4 bg-white animate-fadeInUp">
                    {/* Order Items */}
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
                      <p className="text-sm font-semibold text-gray-700 mb-1">Products:</p>
                      <p className="text-sm text-gray-600">{order.products}</p>
                    </div>

                    {/* Expected Delivery */}
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
                      <p className="text-sm font-semibold text-gray-700 mb-1">📅 Expected Delivery:</p>
                      <p className="text-sm text-gray-600">{order.expectedDelivery}</p>
                    </div>

                    {/* Delivery Address */}
                    {order.deliveryAddress && (
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
                        <p className="text-sm font-semibold text-gray-700 mb-1">📍 Delivery Address:</p>
                        <p className="text-sm text-gray-600">{order.deliveryAddress}</p>
                      </div>
                    )}

                    {/* Notes */}
                    {order.notes && (
                      <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <p className="text-sm font-semibold text-yellow-800 mb-1">💬 Notes:</p>
                        <p className="text-sm text-yellow-700">{order.notes}</p>
                      </div>
                    )}

                    {/* Priority Badge */}
                    {order.priority && order.priority !== 'normal' && (
                      <div className="mb-4">
                        <span className={`inline-block px-3 py-1 text-xs font-semibold rounded ${
                          order.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                          order.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.priority === 'urgent' && '🔥 '}
                          {order.priority === 'high' && '⚠️ '}
                          {order.priority?.toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* 💰 PAYMENT TRACKER - Supplier View */}
                    {(order.status === 'confirmed' || order.payment_status !== 'unpaid' || order.amount_paid > 0) && (
                      <div className="mb-4">
                        <OrderPaymentTracker
                          order={order}
                          showAddPayment={false}
                          userRole="supplier"
                        />
                      </div>
                    )}

                    {/* Action Buttons */}
                    {order.status === 'processing' && (
                      <div className="flex items-center space-x-3 pt-4 border-t">
                        <button
                          onClick={() => handleConfirmOrder(order.orderId)}
                          className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-all duration-300 font-semibold flex items-center justify-center space-x-2"
                        >
                          <FiCheckCircle className="h-5 w-5" />
                          <span>Confirm Order</span>
                        </button>
                        <button
                          onClick={() => handleRejectOrder(order.orderId)}
                          className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-all duration-300 font-semibold flex items-center justify-center space-x-2"
                        >
                          <FiXCircle className="h-5 w-5" />
                          <span>Reject Order</span>
                        </button>
                      </div>
                    )}

                    {order.status === 'confirmed' && (
                      <div className="flex items-center space-x-2 pt-4 border-t text-green-600">
                        <FiCheckCircle className="h-5 w-5" />
                        <span className="font-semibold">Order Confirmed - Preparing for delivery</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Order History */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-6">📚 Recent Order History</h3>
        {orderHistory.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <FiPackage className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-semibold">No order history yet</p>
            <p className="text-gray-500 text-sm">Completed orders will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance Due</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orderHistory.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-all duration-300">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {order.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.items} items
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                      {formatCurrency(order.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        order.status === 'delivered' || order.status === 'received' ? 'bg-green-100 text-green-800' :
                        order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {order.status?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-bold rounded-full border-2 ${
                        order.payment_status === 'paid' ? 'bg-green-100 text-green-800 border-green-300' :
                        order.payment_status === 'partially_paid' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                        'bg-red-100 text-red-800 border-red-300'
                      }`}>
                        {order.payment_status === 'paid' && '✅ PAID'}
                        {order.payment_status === 'partially_paid' && '⚠️ HALF PAID'}
                        {(order.payment_status === 'unpaid' || !order.payment_status) && '❌ UNPAID'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {order.payment_status === 'paid' ? (
                        <span className="text-green-600 font-semibold">-</span>
                      ) : (
                        <span className="text-red-600 font-semibold">{formatCurrency(order.balance_due)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100">
                <tr>
                  <td colSpan="3" className="px-6 py-4 text-sm font-bold text-gray-900">TOTALS:</td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">
                    {formatCurrency(orderHistory.reduce((sum, o) => sum + o.amount, 0))}
                  </td>
                  <td className="px-6 py-4"></td>
                  <td className="px-6 py-4 text-sm">
                    <span className="text-green-600 font-semibold">
                      {orderHistory.filter(o => o.payment_status === 'paid').length} Paid
                    </span>
                    {' / '}
                    <span className="text-red-600 font-semibold">
                      {orderHistory.filter(o => o.payment_status === 'unpaid' || !o.payment_status).length} Unpaid
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-red-600">
                    {formatCurrency(orderHistory.reduce((sum, o) => sum + (o.balance_due || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderProducts = () => (
    <div className="space-y-6 animate-fadeInUp">
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Product Catalog</h3>
          <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-all duration-300 flex items-center space-x-2">
            <FiPlus className="h-4 w-4" />
            <span>Add Product</span>
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {productCatalog.map((product) => (
            <div key={product.id} className="border rounded-lg p-4 hover:shadow-md transition-all duration-300">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">{product.name}</h4>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  product.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {product.status}
                </span>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Category: {product.category}</p>
                <p className="text-sm text-gray-600">Price: {formatCurrency(product.price)}</p>
                <p className="text-sm text-gray-600">Stock: {product.stock} units</p>
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <button className="text-blue-600 hover:text-blue-800">
                  <FiEdit className="h-4 w-4" />
                </button>
                <button className="text-green-600 hover:text-green-800">
                  <FiEye className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPerformance = () => (
    <div className="space-y-6 animate-fadeInUp">
      {/* Performance Insights */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Performance Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {performanceInsights.map((insight, index) => (
            <div key={index} className="text-center p-4 border rounded-lg hover:shadow-md transition-all duration-300">
              <div className="text-3xl mb-2">{insight.icon}</div>
              <h4 className="font-semibold text-gray-900 mb-1">{insight.metric}</h4>
              <div className="text-2xl font-bold text-gray-900 mb-1">{insight.value}</div>
              <p className="text-sm text-gray-600">Target: {insight.target}</p>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-2 ${
                insight.status === 'excellent' ? 'bg-green-100 text-green-800' :
                insight.status === 'good' ? 'bg-blue-100 text-blue-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {insight.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Chart */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Monthly Performance</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="revenue" fill="#8B5CF6" />
            <Bar dataKey="orders" fill="#3B82F6" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="space-y-6 animate-fadeInUp">
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Notifications</h3>
        <div className="space-y-4">
          {notifications.map((notification) => (
            <div key={notification.id} className={`border-l-4 p-4 rounded-lg ${
              notification.type === 'order' ? 'border-blue-500 bg-blue-50' :
              notification.type === 'payment' ? 'border-green-500 bg-green-50' :
              notification.type === 'inventory' ? 'border-yellow-500 bg-yellow-50' :
              'border-purple-500 bg-purple-50'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">{notification.title}</h4>
                  <p className="text-gray-600">{notification.message}</p>
                  <p className="text-sm text-gray-500 mt-1">{notification.time}</p>
                </div>
                <button className="text-blue-600 hover:text-blue-800">
                  <FiEye className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPayments = () => {
    // Calculate payment stats from ALL orders (pending + history)
    const allOrders = [...pendingOrders, ...orderHistory];
    
    // Separate paid and unpaid orders
    const paidOrders = allOrders.filter(o => o.payment_status === 'paid').length;
    const partialOrders = allOrders.filter(o => o.payment_status === 'partially_paid').length;
    const unpaidOrders = allOrders.filter(o => !o.payment_status || o.payment_status === 'unpaid').length;
    
    // Calculate financial totals
    const totalPaid = allOrders.reduce((sum, order) => {
      if (order.payment_status === 'paid') {
        return sum + (parseFloat(order.amount) || parseFloat(order.total_amount) || 0);
      } else if (order.payment_status === 'partially_paid') {
        return sum + (parseFloat(order.amount_paid) || parseFloat(order.amount_paid_ugx) || 0);
      }
      return sum;
    }, 0);
    
    const totalDue = allOrders.reduce((sum, order) => {
      if (order.payment_status === 'unpaid' || !order.payment_status) {
        return sum + (parseFloat(order.amount) || parseFloat(order.total_amount) || 0);
      } else if (order.payment_status === 'partially_paid') {
        return sum + (parseFloat(order.balance_due) || parseFloat(order.balance_due_ugx) || 0);
      }
      return sum;
    }, 0);
    
    const totalOrders = allOrders.length;
    const completedOrders = paidOrders;

    return (
      <div className="space-y-6 animate-fadeInUp">
        {/* Payment Statistics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Total Received */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 shadow-md border-2 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-green-600 uppercase tracking-wide">Total Received</p>
                <p className="text-3xl font-extrabold text-green-700">{formatCurrency(totalPaid)}</p>
                <p className="text-xs text-green-600 mt-1 font-semibold">{completedOrders} completed orders</p>
              </div>
              <div className="text-4xl">💰</div>
            </div>
          </div>
          
          {/* Outstanding */}
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 shadow-md border-2 border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-red-600 uppercase tracking-wide">Outstanding</p>
                <p className="text-3xl font-extrabold text-red-700">{formatCurrency(totalDue)}</p>
                <p className="text-xs text-red-600 mt-1 font-semibold">{partialOrders + unpaidOrders} pending</p>
              </div>
              <div className="text-4xl">⏳</div>
            </div>
          </div>
          
          {/* Partial Payments */}
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 shadow-md border-2 border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-yellow-600 uppercase tracking-wide">Partial Payments</p>
                <p className="text-3xl font-extrabold text-yellow-700">{partialOrders}</p>
                <p className="text-xs text-yellow-600 mt-1 font-semibold">In progress</p>
              </div>
              <div className="text-4xl">⚡</div>
            </div>
          </div>
          
          {/* Payment Rate */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 shadow-md border-2 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-blue-600 uppercase tracking-wide">Payment Rate</p>
                <p className="text-3xl font-extrabold text-blue-700">
                  {totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0}%
                </p>
                <p className="text-xs text-blue-600 mt-1 font-semibold">Completion rate</p>
              </div>
              <div className="text-4xl">📊</div>
            </div>
          </div>
        </div>

        {/* Orders with Payment Details */}
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FiDollarSign className="text-green-600" />
              Payment Details by Order
            </h3>
            <button
              onClick={loadSupplierData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 flex items-center space-x-2"
            >
              <FiRefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="space-y-6">
            {pendingOrders.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <div className="text-6xl mb-4">💸</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Orders Yet</h3>
                <p className="text-gray-600">Payment information will appear here when you receive orders</p>
              </div>
            ) : (
              pendingOrders
                .filter(order => paymentFilter === 'all' || 
                  (paymentFilter === 'paid' && order.payment_status === 'paid') ||
                  (paymentFilter === 'partial' && order.payment_status === 'partially_paid') ||
                  (paymentFilter === 'unpaid' && (!order.payment_status || order.payment_status === 'unpaid'))
                )
                .map((order) => (
                  <div key={order.id} className="border-2 border-blue-200 rounded-xl overflow-hidden bg-gradient-to-r from-blue-50 to-white shadow-md hover:shadow-lg transition-all">
                    {/* Order Header with Status - Mobile Optimized & Clickable */}
                    <div 
                      className="p-4 md:p-6 border-b-2 border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                      onClick={() => setExpandedPaymentId(expandedPaymentId === order.id ? null : order.id)}
                    >
                      <div className="space-y-3 md:space-y-0 md:flex md:items-start md:justify-between md:gap-4">
                        {/* Left Section: Order ID and Info */}
                        <div className="flex-1">
                          <div className="flex items-start gap-2 mb-2 flex-wrap">
                            <h4 className="font-bold text-base md:text-xl text-gray-900">{order.id}</h4>
                            <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full border-2 ${
                              order.status === 'confirmed' ? 'bg-green-100 text-green-800 border-green-300' :
                              order.status === 'processing' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                              'bg-gray-100 text-gray-800 border-gray-300'
                            }`}>
                              {order.status?.toUpperCase() || 'PENDING'}
                            </span>
                            <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full border-2 ${
                              order.payment_status === 'paid' ? 'bg-green-100 text-green-800 border-green-300' :
                              order.payment_status === 'partially_paid' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                              'bg-red-100 text-red-800 border-red-300'
                            }`}>
                              {order.payment_status === 'paid' && '✅ PAID'}
                              {order.payment_status === 'partially_paid' && '⚠️ PARTIAL'}
                              {(!order.payment_status || order.payment_status === 'unpaid') && '❌ UNPAID'}
                            </span>
                          </div>
                          <p className="text-xs md:text-sm text-gray-600">Ordered: {order.date}</p>
                        </div>

                        {/* Right Section: Amount + Expand Icon */}
                        <div className="flex items-baseline justify-between md:items-start md:flex-col gap-3 pt-2 md:pt-0 border-t md:border-t-0">
                          <div className="md:text-right">
                            <p className="text-xs text-gray-500 font-semibold">Total Amount</p>
                            <p className="font-bold text-3xl md:text-2xl text-blue-600">{formatCurrency(order.amount)}</p>
                          </div>
                          {/* Expand/Collapse Icon */}
                          <div className={`transform transition-transform flex-shrink-0 ${expandedPaymentId === order.id ? 'rotate-180' : ''}`}>
                            <FiChevronDown className="h-5 w-5 text-gray-500" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Payment Details */}
                    {expandedPaymentId === order.id && (
                      <div className="p-4 md:p-6 space-y-4 animate-fadeInUp bg-white">
                        {/* Payment Tracker Component - Larger on Mobile */}
                        {(order.status === 'confirmed' || order.payment_status) && (
                          <div className="bg-blue-50 rounded-lg p-4 md:p-6 border-2 border-blue-200">
                            <OrderPaymentTracker
                              order={order}
                              showAddPayment={false}
                              userRole="supplier"
                            />
                          </div>
                        )}

                        {/* Order Items Summary - Larger Bullet Form for Mobile */}
                        <div className="bg-gray-50 rounded-lg p-4 md:p-6 border-2 border-gray-200">
                          <p className="text-base md:text-lg font-bold text-gray-800 mb-3">📦 Products</p>
                          <div className="space-y-2">
                            <p className="text-sm md:text-base text-gray-700 leading-relaxed">
                              • {order.products}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>

          {pendingOrders.filter(order => 
            paymentFilter === 'all' || 
            (paymentFilter === 'paid' && order.payment_status === 'paid') ||
            (paymentFilter === 'partial' && order.payment_status === 'partially_paid') ||
            (paymentFilter === 'unpaid' && (!order.payment_status || order.payment_status === 'unpaid'))
          ).length === 0 && pendingOrders.length > 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No {paymentFilter} Orders</h3>
              <p className="text-gray-600">Try a different filter</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FiBarChart },
    { id: 'profile', label: 'My Profile', icon: FiUsers },
    { id: 'orders', label: 'Orders', icon: FiPackage },
    { id: 'products', label: 'Products', icon: FiShoppingCart },
    { id: 'payments', label: 'Payments', icon: FiDollarSign },
    { id: 'confirmations', label: 'Payment Confirmations', icon: FiCheckCircle },
    { id: 'performance', label: 'Performance', icon: FiTrendingUp },
    { id: 'notifications', label: 'Notifications', icon: FiBell },
    { id: 'my-catalog', label: 'My Catalog', icon: FiGrid },
    { id: 'apply-stores', label: 'Apply to Stores', icon: FiSend },
    { id: 'ican-wallet', label: '₡ ICAN Wallet', icon: FiDollarSign, href: '/ican-wallet' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
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
          .animate-fadeInUp {
            animation: fadeInUp 0.8s ease-out;
          }
        `
      }} />
      
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-700 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Header Content */}
          <div className="flex justify-between items-center py-4 sm:py-6">
            {/* Mobile: Show only hamburger button */}
            {isMobile ? (
              <div className="flex items-center justify-between w-full">
                <button
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className="p-3 bg-white/20 hover:bg-white/30 rounded-xl border-2 border-white/30 transition-all"
                >
                  <div className="space-y-1.5">
                    <div className="w-6 h-0.5 bg-white"></div>
                    <div className="w-6 h-0.5 bg-white"></div>
                    <div className="w-6 h-0.5 bg-white"></div>
                  </div>
                </button>
                
                <div className="flex items-center space-x-2">
                  <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-2xl">🏢</span>
                  </div>
                  <h1 className="text-xl font-bold text-white">Supplier Portal</h1>
                </div>
              </div>
            ) : (
              <>
                {/* Desktop: Full Header */}
                <div className="flex items-center space-x-6">
                  {/* Animated Logo */}
                  <div className="relative">
                    <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center shadow-xl transform hover:scale-110 transition-all duration-300">
                      <span className="text-4xl animate-bounce">🏢</span>
                    </div>
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
                  </div>
                  
                  <div>
                    <h1 className="text-3xl font-bold text-white mb-1 flex items-center space-x-3">
                      Supplier Portal
                      <span className="px-3 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full">
                        PREMIUM
                      </span>
                    </h1>
                    <p className="text-purple-100 text-lg">Partnership Management Hub</p>
                  </div>
                </div>
                
                {/* Right Side - Profile & Actions */}
                <div className="flex items-center space-x-4">
              {/* Quick Stats Container */}
              <div className="hidden lg:flex items-center space-x-4 mr-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20">
                  <div className="flex items-center space-x-2 text-white">
                    <FiTrendingUp className="h-5 w-5 text-green-300" />
                    <div>
                      <p className="text-xs text-purple-200">Monthly Growth</p>
                      <p className="text-sm font-bold">+{performanceMetrics.monthlyGrowth}%</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20">
                  <div className="flex items-center space-x-2 text-white">
                    <FiPackage className="h-5 w-5 text-yellow-300" />
                    <div>
                      <p className="text-xs text-purple-200">Pending Orders</p>
                      <p className="text-sm font-bold">{performanceMetrics.pendingOrders}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Profile Container - Clickable */}
              <button 
                onClick={() => setActiveTab('profile')}
                className="bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-xl px-4 py-3 border border-white/20 transition-all duration-300 group"
              >
                <div className="text-right">
                  <p className="text-sm text-white font-semibold group-hover:text-yellow-300 transition-colors">
                    {supplierProfile.name}
                  </p>
                  <p className="text-xs text-purple-200">{supplierProfile.contactPerson}</p>
                </div>
              </button>

              {/* Action Buttons Container */}
              <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-xl px-2 py-2 border border-white/20">
                {/* Notifications with Badge */}
                <button className="relative p-2 text-white hover:bg-white/20 rounded-lg transition-all duration-300 group">
                  <FiBell className="h-6 w-6 group-hover:animate-bounce" />
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                    {performanceMetrics.pendingOrders}
                  </span>
                </button>
                
                {/* Settings */}
                <button 
                  onClick={() => setActiveTab('profile')}
                  className="p-2 text-white hover:bg-white/20 rounded-lg transition-all duration-300 group"
                  title="Settings & Profile"
                >
                  <FiSettings className="h-6 w-6 group-hover:rotate-90 transition-transform duration-300" />
                </button>
                
                {/* Logout */}
                <button className="p-2 text-white hover:bg-red-500/50 rounded-lg transition-all duration-300 group">
                  <FiLogOut className="h-6 w-6 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
            </>
            )}
          </div>

          {/* Status Bar with Live Stats - Hidden on mobile */}
          {!isMobile && (
          <div className="pb-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {/* Total Revenue */}
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <FiDollarSign className="h-5 w-5 text-green-300" />
                  </div>
                  <div>
                    <p className="text-xs text-purple-200">Total Revenue</p>
                    <p className="text-sm font-bold text-white">
                      UGX {(performanceMetrics.totalRevenue / 1000000).toFixed(1)}M
                    </p>
                  </div>
                </div>

                {/* Total Orders */}
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <FiShoppingCart className="h-5 w-5 text-blue-300" />
                  </div>
                  <div>
                    <p className="text-xs text-purple-200">Total Orders</p>
                    <p className="text-sm font-bold text-white">{performanceMetrics.totalOrders}</p>
                  </div>
                </div>

                {/* Quality Rating */}
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                    <FiStar className="h-5 w-5 text-yellow-300" />
                  </div>
                  <div>
                    <p className="text-xs text-purple-200">Quality Rating</p>
                    <p className="text-sm font-bold text-white flex items-center">
                      {supplierProfile.rating} 
                      <FiStar className="h-3 w-3 text-yellow-300 ml-1 fill-current" />
                    </p>
                  </div>
                </div>

                {/* On-Time Delivery */}
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <FiTruck className="h-5 w-5 text-purple-300" />
                  </div>
                  <div>
                    <p className="text-xs text-purple-200">On-Time</p>
                    <p className="text-sm font-bold text-white">{performanceMetrics.onTimeDelivery}%</p>
                  </div>
                </div>

                {/* Active Products */}
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <FiPackage className="h-5 w-5 text-orange-300" />
                  </div>
                  <div>
                    <p className="text-xs text-purple-200">Products</p>
                    <p className="text-sm font-bold text-white">{performanceMetrics.activeProducts}</p>
                  </div>
                </div>

                {/* Partnership Years */}
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-pink-500/20 rounded-lg flex items-center justify-center">
                    <FiAward className="h-5 w-5 text-pink-300" />
                  </div>
                  <div>
                    <p className="text-xs text-purple-200">Partnership</p>
                    <p className="text-sm font-bold text-white">{supplierProfile.partnershipYears} Years</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Mobile Sidebar Menu */}
      {isMobile && showMobileMenu && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setShowMobileMenu(false)}>
          <div 
            className="w-80 max-w-[85vw] bg-white shadow-2xl transform transition-all duration-300 ease-out overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-600 text-white p-6">
              <button 
                onClick={() => setShowMobileMenu(false)}
                className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <FiX className="h-5 w-5" />
              </button>

              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/30">
                  <span className="text-2xl">🏢</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold">FAREDEAL</h2>
                  <p className="text-blue-100 text-sm">Supplier Portal</p>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-14 h-14 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-2xl font-bold border-2 border-white shadow-lg">
                    {supplierProfile.avatar}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">{supplierProfile.name}</h3>
                    <div className="flex items-center space-x-2 text-sm">
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-green-200">Active</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Menu */}
            <div className="p-4 space-y-1">
              <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                Main Menu
              </div>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.href) { window.location.href = tab.href; return; }
                    setActiveTab(tab.id);
                    setShowMobileMenu(false);
                  }}
                  className={`w-full group relative flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                    activeTab === tab.id 
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg scale-[1.02]' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${
                    activeTab === tab.id ? 'bg-white/20' : 'bg-gray-100 group-hover:scale-110'
                  }`}>
                    <tab.icon className="h-5 w-5" />
                  </div>
                  
                  <div className="flex-1 text-left">
                    <h4 className="font-semibold text-sm">{tab.label}</h4>
                  </div>
                  
                  {activeTab === tab.id && (
                    <FiChevronRight className="h-5 w-5" />
                  )}
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  // Handle logout
                  navigate('/supplier-auth');
                }}
                className="w-full p-3 bg-red-50 hover:bg-red-100 rounded-xl text-center border border-red-200 transition-all flex items-center justify-center gap-2"
              >
                <FiLogOut className="h-4 w-4 text-red-600" />
                <span className="text-red-600 font-medium">Logout</span>
              </button>
            </div>
          </div>

          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)}></div>
        </div>
      )}

      {/* Navigation Tabs - Desktop Only */}
      {!isMobile && (
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { if (tab.href) { window.location.href = tab.href; return; } setActiveTab(tab.id); }}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300 ${
                    activeTab === tab.id
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}
      )

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {(loading && ['overview','orders','products','payments'].includes(activeTab)) ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <FiRefreshCw className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading supplier data from database...</p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'profile' && renderProfile()}
            {activeTab === 'orders' && renderOrders()}
            {activeTab === 'products' && renderProducts()}
            {activeTab === 'payments' && renderPayments()}
            {activeTab === 'confirmations' && <SupplierPaymentConfirmations />}
            {activeTab === 'performance' && renderPerformance()}
            {activeTab === 'notifications' && renderNotifications()}
            {activeTab === 'my-catalog' && (
              <SupplierCatalogTab userId={supplierProfile.auth_id || supplierProfile.id} />
            )}
            {activeTab === 'apply-stores' && (
              <SupplierApplicationsTab userId={supplierProfile.auth_id || supplierProfile.id} />
            )}
          </>
        )}
      </div>

      {/* Add Product Modal - Supplier Specific */}
      <AddProductModal
        isOpen={showAddProductModal}
        onClose={() => setShowAddProductModal(false)}
        onProductAdded={(newProduct) => {
          console.log('✅ Supplier added new product:', newProduct);
          alert(`🎉 Product "${newProduct.name}" added successfully!`);
          setShowAddProductModal(false);
        }}
        prefilledData={{
          // Supplier can have their supplier_id pre-filled if known
          // brand: supplierProfile.name
        }}
      />

      {/* Edit Profile Modal */}
      {isEditingProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white rounded-t-2xl">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <span>✏️</span> Edit Supplier Profile
                  </h2>
                  <p className="text-purple-100 mt-1">Update your business information</p>
                </div>
                <button
                  onClick={cancelEditingProfile}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <span className="text-2xl">✕</span>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Business Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Business Name
                </label>
                <input
                  type="text"
                  value={editedProfile.name || supplierProfile.name}
                  onChange={(e) => handleProfileFieldChange('name', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  placeholder="Enter your business name"
                />
              </div>

              {/* Contact Person */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Contact Person Name
                </label>
                <input
                  type="text"
                  value={editedProfile.contactPerson || supplierProfile.contactPerson}
                  onChange={(e) => handleProfileFieldChange('contactPerson', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  placeholder="Enter contact person name"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editedProfile.phone || supplierProfile.phone}
                  onChange={(e) => handleProfileFieldChange('phone', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  placeholder="+256 700 000 000"
                />
              </div>

              {/* Business Address */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Business Address
                </label>
                <textarea
                  value={editedProfile.address || supplierProfile.address}
                  onChange={(e) => handleProfileFieldChange('address', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  placeholder="Enter business address"
                  rows="3"
                />
              </div>

              {/* Business Category */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Business Category
                </label>
                <select
                  value={editedProfile.category || supplierProfile.category}
                  onChange={(e) => handleProfileFieldChange('category', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                >
                  <option value="Fresh Produce">Fresh Produce</option>
                  <option value="Groceries & Staples">Groceries & Staples</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Beverages">Beverages</option>
                  <option value="Household Items">Household Items</option>
                  <option value="Personal Care">Personal Care</option>
                  <option value="Fashion & Apparel">Fashion & Apparel</option>
                  <option value="Food & Snacks">Food & Snacks</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Languages */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Languages Spoken (comma separated)
                </label>
                <input
                  type="text"
                  value={(editedProfile.languages || supplierProfile.languages).join(', ')}
                  onChange={(e) => handleProfileFieldChange('languages', e.target.value.split(',').map(l => l.trim()))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  placeholder="English, Luganda, Swahili"
                />
              </div>

              {/* Product Specialties */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Product Specialties (comma separated)
                </label>
                <input
                  type="text"
                  value={(editedProfile.specialties || supplierProfile.specialties).join(', ')}
                  onChange={(e) => handleProfileFieldChange('specialties', e.target.value.split(',').map(s => s.trim()))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  placeholder="Fresh Vegetables, Organic Fruits, Dairy Products"
                />
              </div>

              {/* Delivery Areas */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Delivery Areas (comma separated)
                </label>
                <input
                  type="text"
                  value={(editedProfile.deliveryAreas || supplierProfile.deliveryAreas).join(', ')}
                  onChange={(e) => handleProfileFieldChange('deliveryAreas', e.target.value.split(',').map(a => a.trim()))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  placeholder="Kampala, Entebbe, Mukono, Wakiso"
                />
              </div>

              {/* Read-only fields */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Read-Only Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Email:</span>
                    <p className="font-medium text-gray-900">{supplierProfile.email}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>
                    <p className="font-medium text-gray-900">{supplierProfile.status}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Partnership Years:</span>
                    <p className="font-medium text-gray-900">{supplierProfile.partnershipYears} Years</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Rating:</span>
                    <p className="font-medium text-gray-900">{supplierProfile.rating} ⭐</p>
                  </div>
                  {supplierProfile.businessLicense && (
                    <div>
                      <span className="text-gray-500">Business License:</span>
                      <p className="font-medium text-gray-900">{supplierProfile.businessLicense}</p>
                    </div>
                  )}
                  {supplierProfile.taxID && (
                    <div>
                      <span className="text-gray-500">Tax ID:</span>
                      <p className="font-medium text-gray-900">{supplierProfile.taxID}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 rounded-b-2xl flex justify-end gap-3">
              <button
                onClick={cancelEditingProfile}
                disabled={isSavingProfile}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={saveSupplierProfile}
                disabled={isSavingProfile}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSavingProfile ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <span>💾</span> Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Financial Details Modal */}
      {isEditingFinancial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-green-600 to-blue-600 p-6 text-white rounded-t-2xl">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <span>💰</span> Edit Financial Details
                  </h2>
                  <p className="text-green-100 mt-1">Update payment terms and methods</p>
                </div>
                <button
                  onClick={cancelEditingFinancial}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <span className="text-2xl">✕</span>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Payment Terms */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Payment Terms
                </label>
                <select
                  value={editedFinancial.paymentTerms || supplierProfile.paymentTerms}
                  onChange={(e) => handleFinancialFieldChange('paymentTerms', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                >
                  <option value="immediate">Immediate Payment</option>
                  <option value="net_7">Net 7 Days</option>
                  <option value="net_15">Net 15 Days</option>
                  <option value="net_30">Net 30 Days</option>
                  <option value="net_60">Net 60 Days</option>
                  <option value="net_90">Net 90 Days</option>
                </select>
              </div>

              {/* Credit Limit */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Credit Limit (UGX)
                </label>
                <input
                  type="number"
                  value={editedFinancial.creditLimit !== undefined ? editedFinancial.creditLimit : supplierProfile.creditLimit}
                  onChange={(e) => handleFinancialFieldChange('creditLimit', parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  placeholder="Enter credit limit"
                  step="100000"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Current: UGX {((editedFinancial.creditLimit !== undefined ? editedFinancial.creditLimit : supplierProfile.creditLimit) / 1000000).toFixed(1)}M
                </p>
              </div>

              {/* Payment Methods */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Accepted Payment Methods
                </label>
                <div className="space-y-3">
                  {/* Mobile Money */}
                  <div className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-green-300 transition-colors">
                    <div className="flex items-center space-x-3">
                      <FiSmartphone className="h-6 w-6 text-green-600" />
                      <div>
                        <p className="font-semibold text-gray-900">Mobile Money</p>
                        <p className="text-xs text-gray-500">MTN, Airtel Money</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editedFinancial.mobileMoneyEnabled !== undefined ? editedFinancial.mobileMoneyEnabled : true}
                        onChange={(e) => handleFinancialFieldChange('mobileMoneyEnabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                  </div>

                  {/* Bank Transfer */}
                  <div className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                    <div className="flex items-center space-x-3">
                      <FiCreditCard className="h-6 w-6 text-blue-600" />
                      <div>
                        <p className="font-semibold text-gray-900">Bank Transfer</p>
                        <p className="text-xs text-gray-500">Direct bank payment</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editedFinancial.bankTransferEnabled !== undefined ? editedFinancial.bankTransferEnabled : true}
                        onChange={(e) => handleFinancialFieldChange('bankTransferEnabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* Cash */}
                  <div className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-yellow-300 transition-colors">
                    <div className="flex items-center space-x-3">
                      <FiDollarSign className="h-6 w-6 text-yellow-600" />
                      <div>
                        <p className="font-semibold text-gray-900">Cash Payment</p>
                        <p className="text-xs text-gray-500">Physical currency</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editedFinancial.cashEnabled !== undefined ? editedFinancial.cashEnabled : false}
                        onChange={(e) => handleFinancialFieldChange('cashEnabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-start space-x-3">
                  <FiInfo className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Payment Terms Information</p>
                    <p className="text-xs text-blue-700 mt-1">
                      These settings determine how you'll be paid by the store. Select payment methods you accept and credit terms you're comfortable with.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 rounded-b-2xl flex justify-end gap-3">
              <button
                onClick={cancelEditingFinancial}
                disabled={isSavingFinancial}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={saveFinancialDetails}
                disabled={isSavingFinancial}
                className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 transition-all font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSavingFinancial ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <span>💾</span> Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierPortal;
