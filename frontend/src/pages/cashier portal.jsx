import React, { useState, useEffect } from 'react';
import { 
  FiUser, FiShoppingBag, FiPackage, FiTruck, FiTrendingUp, 
  FiZap, FiAward, FiBell, FiSettings, FiLogOut, FiSearch,
  FiCreditCard, FiShield, FiMessageCircle, FiCalendar, 
  FiMapPin, FiClock, FiUsers, FiShare2, FiEye, FiThumbsUp,
  FiGrid, FiList, FiChevronRight, FiPlus, FiMinus, FiRefreshCw, 
  FiDollarSign, FiTarget, FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiEdit,
  FiDownload, FiUpload, FiPrinter, FiMail, FiStar, FiHeart,
  FiShoppingCart, FiTag, FiHash, FiImage, FiInfo, FiHelpCircle,
  FiBarChart, FiPieChart, FiActivity, FiGift, FiNavigation, 
  FiX, FiXCircle, FiCheck, FiPercent, FiPhone, FiWifi, FiGlobe, FiCamera,
  FiMenu, FiChevronDown
} from 'react-icons/fi';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';
import { toast } from 'react-toastify';
import DualScannerInterface from '../components/DualScannerInterface';
import ProductInventoryInterface from '../components/ProductInventoryInterface';
import AddProductModal from '../components/AddProductModal';
import Receipt from '../components/Receipt'; 
import TransactionHistory from '../components/TransactionHistory';
import TillSuppliesSection from '../components/TillSuppliesSection';
import OrderSuppliesModal from '../components/OrderSuppliesModal';
import inventoryService from '../services/inventorySupabaseService';
import transactionService from '../services/transactionService';
import cashierOrdersService from '../services/cashierOrdersService';
import { receiptService } from '../services/receiptService';
import { supabase } from '../services/supabase';

const CashierPortal = () => {
  const [activeTab, setActiveTab] = useState('pos');
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [currentTransaction, setCurrentTransaction] = useState({
    items: [],
    subtotal: 0,
    tax: 0,
    total: 0,
    paymentMethod: null,
    customer: null
  });
  const [paymentModal, setPaymentModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);
  
  // 💰 CASH HANDLING - Track cash received and change
  const [cashReceived, setCashReceived] = useState('');
  const [quickCashAmounts, setQuickCashAmounts] = useState([]);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState(null); // Track missing barcode for adding
  
  // 🧾 RECEIPT & TRANSACTION HISTORY
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [savedReceipts, setSavedReceipts] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  
  // Load saved receipts from localStorage on mount
  useEffect(() => {
    try {
      const receipts = JSON.parse(localStorage.getItem('receipts') || '[]');
      setSavedReceipts(receipts);
      console.log(`✅ Loaded ${receipts.length} saved receipts from localStorage`);
    } catch (error) {
      console.warn('⚠️ Could not load saved receipts:', error);
    }
  }, []);
  
  // � CASHIER ORDERS & TILL SUPPLIES
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [tillSupplies, setTillSupplies] = useState([]);
  const [orderStats, setOrderStats] = useState({
    myOrders: 0,
    approved: 0,
    totalPaid: 0,
    pending: 0
  });
  const [submittingOrder, setSubmittingOrder] = useState(false);
  
  // �🔥 SUPABASE REAL-TIME PRODUCTS - Loaded from Database
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [refreshingProducts, setRefreshingProducts] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sample products as fallback (if Supabase fails)
  // Sample products removed - using real products from Supabase
  const [sampleProducts] = useState([]);

  // Payment methods available in Uganda
  const paymentMethods = [
    {
      id: 'mtn_momo',
      name: 'MTN Mobile Money',
      icon: '📱',
      color: 'bg-yellow-600 hover:bg-yellow-700',
      description: 'Pay with MTN MoMo',
      fee: 0.015, // 1.5% fee
      limit: 10000000 // UGX 10M daily limit
    },
    {
      id: 'airtel_money',
      name: 'Airtel Money',
      icon: '📲',
      color: 'bg-red-600 hover:bg-red-700',
      description: 'Pay with Airtel Money',
      fee: 0.02, // 2% fee
      limit: 5000000 // UGX 5M daily limit
    },
    {
      id: 'card_payment',
      name: 'Card Payment',
      icon: '💳',
      color: 'bg-blue-600 hover:bg-blue-700',
      description: 'Visa/Mastercard',
      fee: 0.025, // 2.5% fee
      limit: 50000000 // UGX 50M
    },
    {
      id: 'cash_ugx',
      name: 'Cash (UGX)',
      icon: '💵',
      color: 'bg-green-600 hover:bg-green-700',
      description: 'Uganda Shillings',
      fee: 0, // No fee
      limit: Infinity
    },
    {
      id: 'utl_money',
      name: 'UTL Money',
      icon: '📞',
      color: 'bg-purple-600 hover:bg-purple-700',
      description: 'UTL Mobile Money',
      fee: 0.018,
      limit: 3000000
    },
    {
      id: 'm_sente',
      name: 'M-Sente',
      icon: '💰',
      color: 'bg-orange-600 hover:bg-orange-700',
      description: 'Uganda Telecom',
      fee: 0.02,
      limit: 2000000
    }
  ];

  // Cashier Profile - Load from Supabase (no mock data)
  const [cashierProfile, setCashierProfile] = useState({
    id: null,
    name: 'Cashier',
    phone: '+256 XXX XXX XXX',
    email: 'your.email@example.com',
    role: 'Cashier',
    department: 'Front End Operations',
    employeeId: 'CASH-001',
    joinDate: new Date().toISOString().split('T')[0],
    avatar: '🛒',
    avatar_url: null,
    shift: 'Morning Shift',
    register: 'Till #1',
    manager: 'Manager',
    location: 'Kampala Branch',
    languages: ['English', 'Luganda'],
    permissions: {
      pos: true,
      returns: true,
      voidTransactions: false,
      mobileMoneyTransactions: true,
      foreignCurrency: true,
      loyaltyProgram: true
    }
  });

  // Profile Picture Upload States
  const [uploadingProfilePic, setUploadingProfilePic] = useState(false);
  const [profilePicUrl, setProfilePicUrl] = useState(null);

  // Edit Profile & Settings Modals
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editProfileForm, setEditProfileForm] = useState({
    name: '',
    phone: '',
    email: '',
    languages: []
  });
  const [settingsForm, setSettingsForm] = useState({
    notifications: true,
    soundEffects: true,
    receiptPrinting: 'auto',
    theme: 'light',
    language: 'en'
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Performance Metrics from Supabase (Real-time data)
  const [performanceMetrics, setPerformanceMetrics] = useState({
    todaySales: 0,
    todayTransactions: 0,
    averageBasketSize: 0,
    customersServed: 0,
    scanRate: 0,
    efficiency: 0,
    mobileMoneyTransactions: 0,
    cashTransactions: 0,
    cardTransactions: 0,
    loyaltySignups: 0,
    returnRate: 0
  });

  // Daily Tasks - Load from Supabase or generate based on shift
  const [dailyTasks, setDailyTasks] = useState([]);

  // Recent Transactions - Load from Supabase
  const [recentTransactions, setRecentTransactions] = useState([]);

  // Ugandan supermarket specific departments
  // Department Sales - Load from Supabase
  const [departmentSales, setDepartmentSales] = useState([]);

  // Top Products - Load from Supabase
  const [topProducts, setTopProducts] = useState([]);

  // Weekly Performance Data - Load from Supabase
  const [weeklyPerformance, setWeeklyPerformance] = useState([]);

  // Achievements - Load from Supabase or generate
  const [achievements, setAchievements] = useState([]);

  // Notifications - Load from Supabase
  const [notifications, setNotifications] = useState([]);

  // 🔥 Load products from Supabase on component mount
  useEffect(() => {
    loadProductsFromSupabase();
    
    // Subscribe to real-time product updates
    const productSubscription = inventoryService.subscribeToProductChanges((payload) => {
      console.log('📡 Product change detected in Cashier Portal:', payload);
      loadProductsFromSupabase(); // Reload products on any change
    });
    
    // Subscribe to real-time inventory updates
    const inventorySubscription = inventoryService.subscribeToInventoryChanges((payload) => {
      console.log('📡 Inventory change detected in Cashier Portal:', payload);
      loadProductsFromSupabase(); // Reload products on stock changes
    });
    
    return () => {
      // Cleanup subscriptions
      inventoryService.unsubscribeAll();
    };
  }, []);

  // Function to load products from Supabase
  const loadProductsFromSupabase = async () => {
    try {
      setProductsLoading(true);
      setRefreshingProducts(true);
      
      // Load products and inventory separately (like Admin does)
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, price, selling_price, cost_price, category, barcode, sku, is_active')
        .eq('is_active', true);

      const { data: inventoryData } = await supabase
        .from('inventory')
        .select('product_id, current_stock, reserved_stock, minimum_stock, reorder_point');

      // Create inventory lookup map
      const inventoryMap = {};
      inventoryData?.forEach(inv => {
        inventoryMap[inv.product_id] = inv;
      });

      // Combine products with inventory
      const allProducts = (productsData || []).map(product => {
        const inv = inventoryMap[product.id];
        return {
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          price: product.price || 0,
          selling_price: product.selling_price || 0,
          cost_price: product.cost_price || 0,
          category: product.category || 'General',
          categoryName: product.category || 'General',
          is_active: product.is_active,
          // Inventory data
          stock: inv?.current_stock || 0,
          current_stock: inv?.current_stock || 0,
          available_stock: (inv?.current_stock || 0) - (inv?.reserved_stock || 0),
          reserved_stock: inv?.reserved_stock || 0,
          minimum_stock: inv?.minimum_stock || 10,
          reorder_point: inv?.reorder_point || 20
        };
      });

      console.log('📊 Loaded products and inventory:', allProducts.length);
      console.log('📦 Books product:', allProducts.find(p => p.name === 'Books'));
      
      if (allProducts.length > 0) {
        setProducts(allProducts);
        const inStock = allProducts.filter(p => p.stock > 0).length;
        toast.success(`✅ Loaded ${allProducts.length} products (${inStock} in stock)`);
      } else {
        setProducts([]);
        toast.info('No products found. Admin needs to create products.');
      }
    } catch (error) {
      console.error('❌ Error loading products:', error);
      toast.error('Failed to load products: ' + error.message);
      setProducts([]);
    } finally {
      setProductsLoading(false);
      setRefreshingProducts(false);
    }
  };

  // Load cashier profile from Supabase
  const loadCashierProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('❌ No authenticated user found');
        return;
      }

      console.log('🔍 Loading cashier profile for user:', user.id);

      // Get cashier data from users table
      const { data: cashierData, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ Error loading cashier profile:', error);
        return;
      }

      if (cashierData) {
        console.log('📋 Raw data from Supabase:', {
          full_name: cashierData.full_name,
          employee_id: cashierData.employee_id,
          department: cashierData.department,
          phone: cashierData.phone,
          avatar_url: cashierData.avatar_url,
          metadata: cashierData.metadata,
          created_at: cashierData.created_at
        });
        
        // Parse metadata - handle both JSON string and object
        let metadata = {};
        if (cashierData.metadata) {
          if (typeof cashierData.metadata === 'string') {
            try {
              metadata = JSON.parse(cashierData.metadata);
            } catch (e) {
              console.warn('⚠️ Could not parse metadata JSON:', cashierData.metadata);
            }
          } else {
            metadata = cashierData.metadata;
          }
        }
        
        console.log('📊 Parsed metadata:', metadata);
        
        // Get profile picture from database first, fallback to localStorage
        const storageKey = `cashier_profile_pic_${user.id}`;
        const localProfilePic = localStorage.getItem(storageKey);
        const profilePicture = cashierData.avatar_url || localProfilePic || null;
        
        const profileData = {
          id: cashierData.id,
          name: cashierData.full_name && cashierData.full_name.trim() ? cashierData.full_name : 'Cashier',
          phone: cashierData.phone && cashierData.phone.trim() ? cashierData.phone : '+256 XXX XXX XXX',
          email: cashierData.email || user.email || 'your.email@example.com',
          role: 'Cashier',
          department: cashierData.department && cashierData.department.trim() ? cashierData.department : 'Front End Operations',
          employeeId: cashierData.employee_id && cashierData.employee_id.trim() ? cashierData.employee_id : 'CASH-001',
          joinDate: cashierData.created_at ? new Date(cashierData.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          avatar: metadata.avatar || '🛒',
          avatar_url: profilePicture,
          shift: metadata.shift || 'Morning Shift',
          register: metadata.register || 'Till #1',
          manager: metadata.manager || 'Manager',
          location: metadata.location || 'Kampala Branch',
          languages: Array.isArray(metadata.languages) ? metadata.languages : ['English', 'Luganda'],
          permissions: metadata.permissions ? {
            pos: metadata.permissions.pos !== false,
            returns: metadata.permissions.returns !== false,
            voidTransactions: metadata.permissions.voidTransactions === true,
            mobileMoneyTransactions: metadata.permissions.mobileMoneyTransactions !== false,
            foreignCurrency: metadata.permissions.foreignCurrency === true,
            loyaltyProgram: metadata.permissions.loyaltyProgram !== false
          } : {
            pos: true,
            returns: true,
            voidTransactions: false,
            mobileMoneyTransactions: true,
            foreignCurrency: true,
            loyaltyProgram: true
          }
        };
        
        setCashierProfile(profileData);
        console.log('✅ Cashier profile successfully loaded and set:', profileData);
        
        // Set profile pic URL state
        setProfilePicUrl(profilePicture);
        console.log('🖼️ Profile picture source:', profilePicture ? (cashierData.avatar_url ? 'Database' : 'LocalStorage') : 'None');
      } else {
        console.log('⚠️ No cashier record found in database - using fallback defaults');
        
        // Use fallback profile if no data exists
        const fallbackProfile = {
          id: user.id,
          name: 'Cashier',
          phone: '+256 XXX XXX XXX',
          email: user.email || 'your.email@example.com',
          role: 'Cashier',
          department: 'Front End Operations',
          employeeId: 'CASH-001',
          joinDate: new Date().toISOString().split('T')[0],
          avatar: '🛒',
          avatar_url: null,
          shift: 'Morning Shift',
          register: 'Till #1',
          manager: 'Manager',
          location: 'Kampala Branch',
          languages: ['English', 'Luganda'],
          permissions: {
            pos: true,
            returns: true,
            voidTransactions: false,
            mobileMoneyTransactions: true,
            foreignCurrency: true,
            loyaltyProgram: true
          }
        };
        
        setCashierProfile(fallbackProfile);
        setProfilePicUrl(null);
        console.log('ℹ️ Using fallback defaults:', fallbackProfile);
      }
    } catch (error) {
      console.error('❌ Exception in loadCashierProfile:', error);
      
      // Always set a fallback on error
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCashierProfile({
          id: user.id,
          name: 'Cashier',
          phone: '+256 XXX XXX XXX',
          email: user.email || 'your.email@example.com',
          role: 'Cashier',
          department: 'Front End Operations',
          employeeId: 'CASH-001',
          joinDate: new Date().toISOString().split('T')[0],
          avatar: '🛒',
          avatar_url: null,
          shift: 'Morning Shift',
          register: 'Till #1',
          manager: 'Manager',
          location: 'Kampala Branch',
          languages: ['English', 'Luganda'],
          permissions: {
            pos: true,
            returns: true,
            voidTransactions: false,
            mobileMoneyTransactions: true,
            foreignCurrency: true,
            loyaltyProgram: true
          }
        });
      }
    }
  };

  // Update profile data in Supabase (for empty fields)
  const ensureProfileDataInDatabase = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('🔄 Ensuring profile data exists in database...');

      // Check if user has a profile record
      const { data: existingProfile } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', user.id)
        .maybeSingle();

      if (!existingProfile) {
        console.log('📝 Creating new profile record...');
        
        // Create new profile record
        const { error } = await supabase
          .from('users')
          .insert({
            auth_id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || 'Cashier',
            employee_id: 'CASH-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            department: 'Front End Operations',
            phone: user.user_metadata?.phone || '+256',
            role: 'cashier',
            metadata: {
              shift: 'Morning Shift',
              register: 'Till #1',
              manager: 'Manager',
              location: 'Kampala Branch',
              languages: ['English', 'Luganda'],
              permissions: {
                pos: true,
                returns: true,
                voidTransactions: false,
                mobileMoneyTransactions: true,
                foreignCurrency: true,
                loyaltyProgram: true
              }
            }
          });

        if (error) {
          console.error('❌ Error creating profile:', error);
        } else {
          console.log('✅ Profile record created successfully');
          loadCashierProfile(); // Reload to get the new data
        }
      } else if (!existingProfile.full_name || !existingProfile.employee_id) {
        console.log('📝 Updating empty profile fields...');
        
        // Update empty fields
        const { error } = await supabase
          .from('users')
          .update({
            full_name: existingProfile.full_name || user.user_metadata?.full_name || 'Cashier',
            employee_id: existingProfile.employee_id || 'CASH-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            department: existingProfile.department || 'Front End Operations',
            phone: existingProfile.phone || user.user_metadata?.phone || '+256'
          })
          .eq('auth_id', user.id);

        if (error) {
          console.error('❌ Error updating profile:', error);
        } else {
          console.log('✅ Profile fields updated successfully');
          loadCashierProfile(); // Reload to get the updated data
        }
      } else {
        console.log('✅ Profile data is complete');
      }
    } catch (error) {
      console.error('❌ Error ensuring profile data:', error);
    }
  };

  // Handle profile picture upload
  const handleProfilePictureUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size should be less than 2MB');
      return;
    }

    try {
      setUploadingProfilePic(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('No authenticated user');
        return;
      }

      // Convert image to base64 and store in both localStorage and database
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result;
        
        try {
          // Store in localStorage with user ID as key (for quick loading)
          const storageKey = `cashier_profile_pic_${user.id}`;
          localStorage.setItem(storageKey, base64String);
          
          console.log('Profile picture saved to localStorage:', storageKey);
          
          // Save to database - update avatar_url in users table
          const { error } = await supabase
            .from('users')
            .update({ 
              avatar_url: base64String,
              updated_at: new Date().toISOString()
            })
            .eq('auth_id', user.id)
            .eq('role', 'cashier');

          if (error) {
            console.error('❌ Error saving to database:', error);
            toast.error('Failed to upload profile picture');
            setUploadingProfilePic(false);
            return;
          }
          
          console.log('✅ Profile picture saved to database successfully');
          
          // Update local state immediately  
          console.log('🔄 Updating local state with base64 image...');
          setProfilePicUrl(base64String);
          
          // Also update the cashier profile state
          setCashierProfile(prev => ({
            ...prev,
            avatar_url: base64String
          }));
          
          console.log('🔄 Reloading cashier profile from database...');
          // Reload profile to ensure sync
          await loadCashierProfile();
          
          console.log('✅ Profile picture display updated!');
          toast.success('✅ Profile picture updated successfully!');
          
        } catch (error) {
          console.error('❌ Error in upload process:', error);
          toast.error('Failed to upload profile picture');
        } finally {
          setUploadingProfilePic(false);
        }
      };
      
      reader.onerror = () => {
        setUploadingProfilePic(false);
        toast.error('Failed to read image file');
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      toast.error('Failed to upload profile picture');
    } finally {
      setUploadingProfilePic(false);
    }
  };

  // Open Edit Profile Modal
  const openEditProfileModal = () => {
    setEditProfileForm({
      name: cashierProfile.name || '',
      phone: cashierProfile.phone || '',
      email: cashierProfile.email || '',
      languages: cashierProfile.languages || []
    });
    setShowEditProfileModal(true);
  };

  // Save Profile Changes
  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('No authenticated user');
        return;
      }

      // Get current metadata
      const { data: currentData } = await supabase
        .from('users')
        .select('metadata')
        .eq('auth_id', user.id)
        .single();
      
      const currentMetadata = currentData?.metadata || {};

      // Update user profile in database
      const { error } = await supabase
        .from('users')
        .update({
          full_name: editProfileForm.name,
          phone: editProfileForm.phone,
          email: editProfileForm.email,
          metadata: {
            ...currentMetadata,
            languages: editProfileForm.languages
          },
          updated_at: new Date().toISOString()
        })
        .eq('auth_id', user.id)
        .eq('role', 'cashier');

      if (error) {
        console.error('Error updating profile:', error);
        toast.error('Failed to update profile');
        return;
      }

      console.log('✅ Profile updated successfully in database');

      // Reload profile from database to ensure sync
      await loadCashierProfile();

      toast.success('✅ Profile updated successfully!');
      setShowEditProfileModal(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile changes');
    } finally {
      setSavingProfile(false);
    }
  };

  // Load Settings from localStorage
  const loadSettings = () => {
    try {
      const savedSettings = localStorage.getItem('cashier_settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setSettingsForm(settings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  // Open Settings Modal
  const openSettingsModal = () => {
    loadSettings();
    setShowSettingsModal(true);
  };

  // Save Settings
  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      
      // Save to localStorage
      localStorage.setItem('cashier_settings', JSON.stringify(settingsForm));
      
      // Optionally save to database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('users')
          .update({
            metadata: {
              ...cashierProfile,
              settings: settingsForm
            }
          })
          .eq('auth_id', user.id);
      }

      toast.success('⚙️ Settings saved successfully!');
      setShowSettingsModal(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // Toggle Language in Edit Profile
  const toggleLanguage = (lang) => {
    setEditProfileForm(prev => {
      const languages = prev.languages.includes(lang)
        ? prev.languages.filter(l => l !== lang)
        : [...prev.languages, lang];
      return { ...prev, languages };
    });
  };

  // Clock timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Load performance metrics from Supabase
  const loadPerformanceMetrics = async () => {
    try {
      // Load all recent transactions (not filtered by cashier_id)
      // to match loadRecentTransactions behavior
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading performance metrics:', error);
        return;
      }

      if (transactions && transactions.length > 0) {
        // Calculate metrics from transactions
        const todaySales = transactions.reduce((sum, t) => sum + (t.total_amount || 0), 0);
        const todayTransactions = transactions.length;
        const averageBasketSize = todayTransactions > 0 ? todaySales / todayTransactions : 0;
        
        // Count total items sold
        const totalItems = transactions.reduce((sum, t) => sum + (t.items_count || 0), 0);
        
        // Count payment methods
        const mobileMoneyTransactions = transactions.filter(t => 
          t.payment_method === 'mtn_momo' || t.payment_method === 'airtel_money'
        ).length;
        const cashTransactions = transactions.filter(t => t.payment_method === 'cash').length;
        const cardTransactions = transactions.filter(t => 
          t.payment_method === 'card' || t.payment_method === 'visa'
        ).length;

        // Calculate efficiency (transactions per hour)
        const hoursWorked = new Date().getHours() - 7; // Assuming 7 AM start
        const efficiency = hoursWorked > 0 ? Math.min(100, (todayTransactions / (hoursWorked * 10)) * 100) : 0;

        setPerformanceMetrics({
          todaySales,
          todayTransactions,
          averageBasketSize,
          customersServed: todayTransactions,
          scanRate: todayTransactions > 0 ? (todayTransactions * 10) / (hoursWorked || 1) : 0,
          efficiency: Math.round(efficiency),
          mobileMoneyTransactions,
          cashTransactions,
          cardTransactions,
          totalItems,
          loyaltySignups: 0, // TODO: Add loyalty program tracking
          returnRate: 0 // TODO: Add returns tracking
        });

        console.log('✅ Loaded performance metrics:', { todaySales, todayTransactions, totalItems });
      }
    } catch (error) {
      console.error('Error loading performance metrics:', error);
    }
  };

  // Load Recent Transactions from Supabase
  const loadRecentTransactions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get last 5 transactions
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error loading recent transactions:', error);
        return;
      }

      if (transactions) {
        const formatted = transactions.map(t => ({
          id: t.transaction_id || t.id,
          customer: t.customer_name || 'Customer',
          amount: t.total_amount || 0,
          items: t.items_count || 0,
          time: new Date(t.created_at).toLocaleTimeString('en-UG', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          method: t.payment_method === 'mtn_momo' ? 'MTN MoMo' :
                 t.payment_method === 'airtel_money' ? 'Airtel Money' :
                 t.payment_method === 'cash' ? 'Cash' :
                 t.payment_method === 'card' ? 'Visa Card' :
                 t.payment_method || 'Cash',
          status: t.status || 'completed',
          currency: 'UGX'
        }));
        
        setRecentTransactions(formatted);
        console.log('✅ Loaded recent transactions:', formatted.length);
      }
    } catch (error) {
      console.error('Error loading recent transactions:', error);
    }
  };

  // Load Top Selling Products from Supabase
  const loadTopProducts = async () => {
    try {
      // Get all recent transactions (not just today)
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading top products:', error);
        // Set empty data instead of returning
        setTopProducts([]);
        return;
      }

      if (transactions && transactions.length > 0) {
        // Check if items are stored as JSON in a column or if we need to join with another table
        const productStats = {};
        
        transactions.forEach(transaction => {
          // Try different possible column names for items
          const items = transaction.items || transaction.transaction_items || transaction.line_items || [];
          
          if (items && Array.isArray(items)) {
            items.forEach(item => {
              const productName = item.name || item.product_name || 'Unknown Product';
              if (!productStats[productName]) {
                productStats[productName] = {
                  name: productName,
                  sales: 0,
                  revenue: 0
                };
              }
              productStats[productName].sales += item.quantity || 1;
              productStats[productName].revenue += (item.price || 0) * (item.quantity || 1);
            });
          }
        });

        // Convert to array and sort by sales
        const topProductsArray = Object.values(productStats)
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 5);

        setTopProducts(topProductsArray);
        console.log('✅ Loaded top products:', topProductsArray.length);
      }
    } catch (error) {
      console.error('Error loading top products:', error);
    }
  };

  // Load Weekly Performance Data from Supabase
  const loadWeeklyPerformance = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get last 7 days of data
      const weekData = [];
      const today = new Date();
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const { data: dayTransactions, error } = await supabase
          .from('transactions')
          .select('*')
          .gte('created_at', date.toISOString())
          .lt('created_at', nextDay.toISOString());

        if (!error && dayTransactions) {
          const sales = dayTransactions.reduce((sum, t) => sum + (t.total_amount || 0), 0);
          const transactions = dayTransactions.length;
          const momo = dayTransactions.filter(t => 
            t.payment_method === 'mtn_momo' || t.payment_method === 'airtel_money'
          ).length;

          weekData.push({
            name: date.toLocaleDateString('en-UG', { weekday: 'short' }),
            sales,
            transactions,
            momo
          });
        }
      }

      setWeeklyPerformance(weekData.length > 0 ? weekData : [
        { name: 'Mon', sales: 0, transactions: 0, momo: 0 },
        { name: 'Tue', sales: 0, transactions: 0, momo: 0 },
        { name: 'Wed', sales: 0, transactions: 0, momo: 0 },
        { name: 'Thu', sales: 0, transactions: 0, momo: 0 },
        { name: 'Fri', sales: 0, transactions: 0, momo: 0 },
        { name: 'Sat', sales: 0, transactions: 0, momo: 0 },
        { name: 'Sun', sales: 0, transactions: 0, momo: 0 }
      ]);
      
      console.log('✅ Loaded weekly performance:', weekData.length);
    } catch (error) {
      console.error('Error loading weekly performance:', error);
    }
  };

  // Load Department Sales from Supabase
  const loadDepartmentSales = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get today's transactions with items
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());

      if (error) {
        console.error('Error loading department sales:', error);
        return;
      }

      if (transactions && transactions.length > 0) {
        const categoryStats = {};
        
        transactions.forEach(transaction => {
          if (transaction.items && Array.isArray(transaction.items)) {
            transaction.items.forEach(item => {
              const category = item.category || item.categoryName || 'Other';
              if (!categoryStats[category]) {
                categoryStats[category] = 0;
              }
              categoryStats[category] += (item.price || 0) * (item.quantity || 1);
            });
          }
        });

        const colors = ['#22C55E', '#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];
        const totalSales = Object.values(categoryStats).reduce((sum, val) => sum + val, 0);
        
        const departmentData = Object.entries(categoryStats)
          .map(([name, value], index) => ({
            name,
            value,
            color: colors[index % colors.length],
            percentage: totalSales > 0 ? Math.round((value / totalSales) * 100) : 0
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);

        setDepartmentSales(departmentData);
        console.log('✅ Loaded department sales:', departmentData.length);
      }
    } catch (error) {
      console.error('Error loading department sales:', error);
    }
  };

  // Generate Achievements based on performance
  const loadAchievements = () => {
    const achievementsList = [
      {
        id: 1,
        title: 'Mobile Money Expert',
        description: 'Processed 100+ MoMo transactions',
        icon: '📱',
        earned: performanceMetrics.mobileMoneyTransactions >= 10
      },
      {
        id: 2,
        title: 'Customer Champion',
        description: 'Served 50+ customers today',
        icon: '⭐',
        earned: performanceMetrics.customersServed >= 50
      },
      {
        id: 3,
        title: 'Sales Star',
        description: 'Hit daily sales target',
        icon: '🏆',
        earned: performanceMetrics.todaySales >= 1000000
      },
      {
        id: 4,
        title: 'Efficiency Pro',
        description: 'Maintain 80%+ efficiency',
        icon: '⚡',
        earned: performanceMetrics.efficiency >= 80
      }
    ];

    setAchievements(achievementsList);
  };

  // Load Notifications from Supabase
  const loadNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Silently skip notifications - table may not exist
      console.log('📝 Notifications: Using system-generated notifications (table may not exist)');
      
      const systemNotifications = [
        {
          id: 1,
          title: 'Welcome to FAREDEAL',
          message: 'Your cashier portal is ready to use',
          time: new Date().toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' }),
          read: false,
          type: 'info'
        },
        {
          id: 2,
          title: 'System Status',
          message: 'All payment systems operational',
          time: new Date(Date.now() - 30 * 60000).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' }),
          read: false,
          type: 'info'
        },
        {
          id: 3,
          title: 'Performance Update',
          message: 'Check your daily performance metrics',
          time: new Date(Date.now() - 60 * 60000).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' }),
          read: true,
          type: 'info'
        }
      ];
      
      setNotifications(systemNotifications);
      console.log('✅ Notifications loaded:', systemNotifications.length);
      return;
      
      /* DISABLED: Notifications table doesn't exist in production
      // Attempt to load from Supabase if table exists
      const { data: notificationsData, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        // Silently use system notifications
        setNotifications(systemNotifications);
        return;
      }

      if (notificationsData && notificationsData.length > 0) {
        const formatted = notificationsData.map(n => ({
          id: n.id,
          title: n.title || 'Notification',
          message: n.message || '',
          time: new Date(n.created_at).toLocaleTimeString('en-UG', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          read: n.read || false,
          type: n.type || 'info'
        }));
        
        setNotifications(formatted);
        console.log('✅ Loaded notifications from database:', formatted.length);
      } else {
        setNotifications(systemNotifications);
      }
      */
    } catch (error) {
      console.log('ℹ️ Notifications: Using fallback system notifications');
      // Fallback to system notifications on any error
      setNotifications([
        {
          id: 1,
          title: 'Welcome!',
          message: 'You\'re all set up and ready to go',
          time: new Date().toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' }),
          read: false,
          type: 'info'
        }
      ]);
    }
  };

  // Generate Daily Tasks based on current time and shift
  const loadDailyTasks = () => {
    const currentHour = new Date().getHours();
    const tasks = [
      { id: 1, title: 'Clock In & Till Opening', completed: currentHour > 7, priority: 'high', time: '7:00 AM' },
      { id: 2, title: 'Count Starting Cash (UGX)', completed: currentHour > 7, priority: 'high', time: '7:15 AM' },
      { id: 3, title: 'Mobile Money System Check', completed: currentHour > 7, priority: 'medium', time: '7:30 AM' },
      { id: 4, title: 'Mid-Day Till Balance', completed: currentHour > 11, priority: 'medium', time: '11:30 AM' },
      { id: 5, title: 'Process Customer Returns', completed: currentHour > 13, priority: 'medium', time: '1:00 PM' },
      { id: 6, title: 'End of Shift Cash Count', completed: currentHour > 14, priority: 'high', time: '2:45 PM' },
      { id: 7, title: 'Clean & Sanitize Station', completed: currentHour > 14, priority: 'low', time: '2:55 PM' }
    ];
    setDailyTasks(tasks);
  };

  // Load Dashboard Data
  const loadDashboardData = () => {
    loadPerformanceMetrics();
    loadRecentTransactions();
    loadTopProducts();
    loadNotifications();
    loadDailyTasks();
  };

  // Load Performance Data (separate function for performance tab)
  const loadPerformanceData = () => {
    loadWeeklyPerformance();
    loadDepartmentSales();
    loadAchievements();
  };

  // Load cashier profile on mount
  useEffect(() => {
    loadCashierProfile();
    ensureProfileDataInDatabase(); // Ensure profile data exists and is complete
    loadDashboardData();
    
    // Refresh dashboard data every 30 seconds for real-time updates
    const dashboardInterval = setInterval(loadDashboardData, 30 * 1000);
    
    // Also subscribe to real-time transaction updates
    const subscription = supabase
      .channel('transactions-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'transactions'
      }, (payload) => {
        console.log('📊 Real-time update detected, refreshing metrics...', payload);
        loadDashboardData();
      })
      .subscribe();
    
    return () => {
      clearInterval(dashboardInterval);
      supabase.removeChannel(subscription);
    };
  }, []);

  // Load performance data when switching to performance tab
  useEffect(() => {
    if (activeTab === 'performance') {
      loadPerformanceData();
    }
  }, [activeTab]);

  // 🛒 Load Till Supplies and Order Stats
  useEffect(() => {
    loadTillSuppliesAndStats();
  }, []);

  const loadTillSuppliesAndStats = async () => {
    try {
      // Load till supplies inventory
      const suppliesResponse = await cashierOrdersService.getTillSupplies();
      setTillSupplies(suppliesResponse.supplies || []);

      // Get current user ID (assuming you have auth)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Load cashier's order statistics
        const statsResponse = await cashierOrdersService.getCashierOrders(user.id);
        setOrderStats({
          myOrders: statsResponse.orders?.length || 0,
          approved: statsResponse.approved || 0,
          totalPaid: statsResponse.totalPaid || 0,
          pending: statsResponse.pending || 0
        });
      }
    } catch (error) {
      console.error('❌ Error loading till supplies:', error);
      // Use fallback static data if Supabase fails
      setTillSupplies([
        { id: 1, item_name: 'Shopping Bags (Small)', current_stock: 150, minimum_stock: 50, item_category: 'bags', unit_cost: 50 },
        { id: 2, item_name: 'Receipt Paper Rolls', current_stock: 8, minimum_stock: 15, item_category: 'paper', unit_cost: 5000 },
        { id: 3, item_name: 'Coin Trays', current_stock: 3, minimum_stock: 5, item_category: 'equipment', unit_cost: 12000 },
        { id: 4, item_name: 'Hand Sanitizer (500ml)', current_stock: 12, minimum_stock: 10, item_category: 'cleaning', unit_cost: 8000 },
        { id: 5, item_name: 'Price Tags', current_stock: 25, minimum_stock: 30, item_category: 'stationery', unit_cost: 2000 },
        { id: 6, item_name: 'Batteries (AA)', current_stock: 6, minimum_stock: 8, item_category: 'equipment', unit_cost: 3000 }
      ]);
    }
  };

  // 🔥 ENHANCED POS Functions with Supabase Integration
  const addItemToTransaction = (product) => {
    // Check if product has enough stock
    const productStock = product.stock || product.available_stock || 0;
    const currentQuantity = currentTransaction.items.find(item => item.id === product.id)?.quantity || 0;
    
    if (productStock <= currentQuantity) {
      toast.error(`⚠️ Insufficient stock for ${product.name}. Available: ${productStock}`);
      return;
    }
    
    setCurrentTransaction(prev => {
      const existingItem = prev.items.find(item => item.id === product.id);
      let newItems;
      
      if (existingItem) {
        newItems = prev.items.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        // Use selling_price for Supabase products, price for sample products
        const price = product.selling_price || product.price;
        newItems = [...prev.items, { ...product, quantity: 1, price }];
      }
      
      const subtotal = newItems.reduce((sum, item) => {
        const itemPrice = item.selling_price || item.price || 0;
        return sum + (itemPrice * item.quantity);
      }, 0);
      const tax = subtotal * 0.18; // 18% VAT in Uganda
      const total = subtotal + tax;
      
      return {
        ...prev,
        items: newItems,
        subtotal,
        tax,
        total
      };
    });
    
    // Clear cash received when cart changes
    setCashReceived('');
    
    toast.success(`✅ Added ${product.name} to cart`);
  };

  // 🔥 Handle new product added - refresh products list
  const handleProductAdded = async (newProduct) => {
    console.log('✅ New product added:', newProduct);
    toast.success(`🎉 Product "${newProduct.name}" added successfully!`);
    
    // Reload products to include the new one
    await loadProductsFromSupabase();
  };

  const handleBarcodeScanned = (barcode) => {
    console.log(`🔍 Searching for barcode: ${barcode}`);
    console.log(`📦 Total products in system: ${products.length}`);
    
    // Normalize barcode for better matching
    const normalizedBarcode = barcode.trim().toLowerCase();
    
    // Search in real products from Supabase with multiple matching strategies
    let product = products.find(p => {
      const barcodeMatch = p.barcode?.toLowerCase().trim() === normalizedBarcode;
      const idMatch = p.id?.toString().toLowerCase() === normalizedBarcode;
      const nameMatch = p.name?.toLowerCase().includes(normalizedBarcode);
      
      if (barcodeMatch || idMatch || nameMatch) {
        console.log(`✅ Found product: ${p.name} (Barcode: ${p.barcode})`);
        return true;
      }
      return false;
    });

    if (!product) {
      // Fallback to sample products
      product = sampleProducts.find(p => 
        p.barcode === barcode || 
        p.id === barcode ||
        p.name.toLowerCase().includes(barcode.toLowerCase())
      );
    }
    
    if (product) {
      // Product found - add to transaction
      addItemToTransaction(product);
      // ⚡ DON'T close scanner in cashier mode - keep open for continuous scanning
      // setShowBarcodeScanner(false);  // REMOVED FOR CASHIER MODE
      toast.success(`✅ ${product.name} (${product.barcode}) scanned and added!`);
      console.log(`✅ Product ${product.name} scanned and added to transaction!`);
    } else {
      // Product NOT found - store barcode and show notification
      console.log(`❌ Product NOT found for barcode: ${barcode}`);
      console.log(`📊 Searched ${products.length} products in inventory`);
      
      // Store the missing barcode for quick product addition
      setLastScannedBarcode(barcode);
      
      // Show warning notification with clear instructions
      toast.warning(
        <div className="space-y-3">
          <div>
            <p className="font-bold text-lg">⚠️ Product Not in System</p>
            <p className="text-sm mt-1">Barcode: <span className="font-mono font-bold text-yellow-300">{barcode}</span></p>
          </div>
          <p className="text-sm">This barcode is not registered in the inventory yet.</p>
          <div className="pt-2 border-t border-yellow-300">
            <p className="text-sm font-semibold text-yellow-100">📦 Action Required:</p>
            <p className="text-xs text-gray-200 mt-1">Please add this product to the system using the "Add Product" button to proceed with sales.</p>
          </div>
        </div>,
        { autoClose: 7000, pauseOnHover: true }
      );
      
      // Scanner stays open for user to try again or scan different product
    }
  };

  const removeItemFromTransaction = (productId) => {
    setCurrentTransaction(prev => {
      const newItems = prev.items.filter(item => item.id !== productId);
      const subtotal = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const tax = subtotal * 0.18;
      const total = subtotal + tax;
      
      return {
        ...prev,
        items: newItems,
        subtotal,
        tax,
        total
      };
    });
    
    // Clear cash received when cart changes
    setCashReceived('');
  };

  const updateItemQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeItemFromTransaction(productId);
      return;
    }
    
    setCurrentTransaction(prev => {
      const newItems = prev.items.map(item =>
        item.id === productId
          ? { ...item, quantity: newQuantity }
          : item
      );
      
      const subtotal = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const tax = subtotal * 0.18;
      const total = subtotal + tax;
      
      return {
        ...prev,
        items: newItems,
        subtotal,
        tax,
        total
      };
    });
    
    // Clear cash received when cart changes
    setCashReceived('');
  };

  const processPayment = async (paymentMethodId) => {
    setPaymentProcessing(true);
    const paymentMethod = paymentMethods.find(pm => pm.id === paymentMethodId);
    
    try {
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
      
      // Calculate fees
      const fee = currentTransaction.total * paymentMethod.fee;
      const finalAmount = currentTransaction.total + fee;
      
      // Check limits
      if (finalAmount > paymentMethod.limit) {
        throw new Error(`Amount exceeds ${paymentMethod.name} limit of ${formatUGX(paymentMethod.limit)}`);
      }
      
      // Simulate different payment scenarios
      const successRate = paymentMethodId === 'cash_ugx' ? 1 : 0.95; // Cash always succeeds
      const isSuccessful = Math.random() < successRate;
      
      if (!isSuccessful) {
        const errors = [
          'Insufficient funds',
          'Network timeout',
          'Invalid PIN',
          'Transaction declined by bank',
          'Service temporarily unavailable'
        ];
        throw new Error(errors[Math.floor(Math.random() * errors.length)]);
      }
      
      const saleId = `SALE_${Date.now()}`;
      
      const result = {
        success: true,
        transactionId: `${paymentMethodId.toUpperCase()}_${Date.now()}`,
        amount: currentTransaction.total,
        fee: fee,
        finalAmount: finalAmount,
        paymentMethod: paymentMethod.name,
        timestamp: new Date().toISOString(),
        receipt: {
          items: currentTransaction.items,
          subtotal: currentTransaction.subtotal,
          tax: currentTransaction.tax,
          total: currentTransaction.total,
          cashier: cashierProfile.name,
          register: cashierProfile.register
        }
      };
      
      setPaymentResult(result);
      
      // 🔥 NEW: Save transaction to database
      let receiptSaved = false;
      let savedReceiptNumber = null;
      
      try {
        const saveResult = await transactionService.saveTransaction({
          items: currentTransaction.items,
          subtotal: currentTransaction.subtotal,
          tax: currentTransaction.tax,
          total: currentTransaction.total,
          paymentMethod: paymentMethod,
          paymentReference: result.transactionId,
          paymentFee: fee,
          amountPaid: cashReceived ? parseFloat(cashReceived) : finalAmount,
          changeGiven: cashReceived ? parseFloat(cashReceived) - currentTransaction.total : 0,
          customer: currentTransaction.customer || { name: 'Walk-in Customer' },
          cashier: cashierProfile,
          register: cashierProfile.register,
          location: cashierProfile.location || 'Kampala Main Branch'
        });
        
        if (saveResult && saveResult.success) {
          console.log('✅ Transaction saved:', saveResult.receiptNumber);
          receiptSaved = true;
          savedReceiptNumber = saveResult.receiptNumber || `RCP-${Date.now()}`;
          
          // Set receipt data for display
          setReceiptData({
            ...result,
            receiptNumber: savedReceiptNumber,
            transactionId: saveResult.transactionId || result.transactionId,
            amountPaid: cashReceived ? parseFloat(cashReceived) : finalAmount,
            changeGiven: cashReceived ? parseFloat(cashReceived) - currentTransaction.total : 0
          });
          
          // 💾 Save receipt to Supabase using receipt service
          const receiptData = {
            receiptNumber: savedReceiptNumber,
            transactionId: saveResult.transactionId || result.transactionId,
            timestamp: new Date().toISOString(),
            items: currentTransaction.items,
            subtotal: currentTransaction.subtotal,
            tax: currentTransaction.tax,
            total: currentTransaction.total,
            paymentMethod: paymentMethod.name,
            amountPaid: cashReceived ? parseFloat(cashReceived) : finalAmount,
            changeGiven: cashReceived ? parseFloat(cashReceived) - currentTransaction.total : 0,
            cashier: cashierProfile.name
          };
          
          // Save to Supabase via receipt service
          try {
            const receiptSaveResult = await receiptService.saveReceipt({
              receiptNumber: savedReceiptNumber,
              transactionId: saveResult.transactionId || result.transactionId,
              cashierId: user?.id,
              cashierName: cashierProfile.name,
              customerName: result.customer?.name || 'Walk-in Customer',
              totalAmount: currentTransaction.total,
              paymentMethod: paymentMethod.name,
              itemsJson: currentTransaction.items,
              subtotal: currentTransaction.subtotal,
              taxAmount: currentTransaction.tax,
              amountPaid: cashReceived ? parseFloat(cashReceived) : finalAmount,
              changeGiven: cashReceived ? parseFloat(cashReceived) - currentTransaction.total : 0,
              registerNumber: cashierProfile.register || 'POS-001',
              storeLocation: cashierProfile.location || 'Kampala Main Branch'
            });
            
            if (receiptSaveResult.success) {
              console.log('✅ Receipt saved to Supabase:', receiptSaveResult.receipt);
            } else {
              console.warn('⚠️ Could not save receipt to Supabase:', receiptSaveResult.error);
            }
          } catch (supabaseError) {
            console.warn('⚠️ Supabase receipt save failed:', supabaseError);
          }
          
          // Also save to localStorage as backup
          try {
            const existingReceipts = JSON.parse(localStorage.getItem('receipts') || '[]');
            existingReceipts.unshift(receiptData);
            localStorage.setItem('receipts', JSON.stringify(existingReceipts.slice(0, 100))); // Keep last 100
            console.log('💾 Receipt saved to local storage as backup');
          } catch (storageError) {
            console.warn('⚠️ Could not save to localStorage:', storageError);
          }
          
          // Show receipt modal after a brief delay
          setTimeout(() => {
            setShowReceiptModal(true);
          }, 500);
          
          toast.success(`✅ Payment successful! Receipt: ${savedReceiptNumber}`);
        } else {
          console.error('❌ Failed to save transaction:', saveResult?.error);
          
          // Fallback: Create receipt with temporary number
          savedReceiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
          console.warn('⚠️ Using fallback receipt number:', savedReceiptNumber);
          
          setReceiptData({
            ...result,
            receiptNumber: savedReceiptNumber,
            transactionId: result.transactionId,
            amountPaid: cashReceived ? parseFloat(cashReceived) : finalAmount,
            changeGiven: cashReceived ? parseFloat(cashReceived) - currentTransaction.total : 0
          });
          
          // 💾 Save fallback receipt to localStorage
          try {
            const existingReceipts = JSON.parse(localStorage.getItem('receipts') || '[]');
            existingReceipts.unshift({
              receiptNumber: savedReceiptNumber,
              transactionId: result.transactionId,
              timestamp: new Date().toISOString(),
              items: currentTransaction.items,
              subtotal: currentTransaction.subtotal,
              tax: currentTransaction.tax,
              total: currentTransaction.total,
              paymentMethod: paymentMethod.name,
              amountPaid: cashReceived ? parseFloat(cashReceived) : finalAmount,
              changeGiven: cashReceived ? parseFloat(cashReceived) - currentTransaction.total : 0,
              cashier: cashierProfile.name,
              syncStatus: 'pending' // Mark for sync later
            });
            localStorage.setItem('receipts', JSON.stringify(existingReceipts.slice(0, 100)));
            console.log('💾 Fallback receipt saved to local storage');
            receiptSaved = true;
          } catch (storageError) {
            console.warn('⚠️ Could not save to localStorage:', storageError);
          }
          
          setTimeout(() => {
            setShowReceiptModal(true);
          }, 500);
          
          toast.warning('⚠️ Receipt saved locally - syncing with server...');
        }
      } catch (saveError) {
        console.error('❌ Error saving transaction:', saveError);
        
        // Fallback: Save to localStorage
        savedReceiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
        
        setReceiptData({
          ...result,
          receiptNumber: savedReceiptNumber,
          transactionId: result.transactionId,
          amountPaid: cashReceived ? parseFloat(cashReceived) : finalAmount,
          changeGiven: cashReceived ? parseFloat(cashReceived) - currentTransaction.total : 0
        });
        
        try {
          const existingReceipts = JSON.parse(localStorage.getItem('receipts') || '[]');
          existingReceipts.unshift({
            receiptNumber: savedReceiptNumber,
            transactionId: result.transactionId,
            timestamp: new Date().toISOString(),
            items: currentTransaction.items,
            subtotal: currentTransaction.subtotal,
            tax: currentTransaction.tax,
            total: currentTransaction.total,
            paymentMethod: paymentMethod.name,
            amountPaid: cashReceived ? parseFloat(cashReceived) : finalAmount,
            changeGiven: cashReceived ? parseFloat(cashReceived) - currentTransaction.total : 0,
            cashier: cashierProfile.name,
            syncStatus: 'pending'
          });
          localStorage.setItem('receipts', JSON.stringify(existingReceipts.slice(0, 100)));
          receiptSaved = true;
          console.log('💾 Receipt saved to local storage (error fallback)');
        } catch (storageError) {
          console.warn('⚠️ Could not save to localStorage:', storageError);
        }
        
        setTimeout(() => {
          setShowReceiptModal(true);
        }, 500);
        
        toast.warning('⚠️ Receipt saved locally - will sync when online');
      }
      
      // 🔥 Update stock in Supabase after successful payment
      try {
        const itemsForStockUpdate = currentTransaction.items.map(item => ({
          product_id: item.id,
          quantity: item.quantity
        }));
        
        const stockUpdated = await inventoryService.adjustStockAfterSale(itemsForStockUpdate, saleId);
        
        if (stockUpdated) {
          console.log('✅ Stock updated successfully in Supabase');
          
          // Reload products to reflect updated stock
          setTimeout(() => {
            loadProductsFromSupabase();
          }, 1000);
        } else {
          console.warn('⚠️ Stock update failed, but payment successful');
          toast.warning('⚠️ Payment successful but stock update failed. Please check inventory.');
        }
      } catch (stockError) {
        console.error('❌ Error updating stock:', stockError);
        toast.warning('⚠️ Payment successful but stock update failed.');
      }
      
      // Clear transaction after successful payment
      setTimeout(() => {
        setCurrentTransaction({
          items: [],
          subtotal: 0,
          tax: 0,
          total: 0,
          paymentMethod: null,
          customer: null
        });
        setPaymentModal(false);
        setPaymentResult(null);
      }, 3000);
      
    } catch (error) {
      setPaymentResult({
        success: false,
        error: error.message,
        paymentMethod: paymentMethod.name
      });
    } finally {
      setPaymentProcessing(false);
    }
  };

  const formatUGX = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Custom label renderer for pie charts with percentage
  const renderCustomLabel = (entry) => {
    const percent = ((entry.value / entry.payload.total) * 100).toFixed(1);
    return `${percent}%`;
  };

  // Get performance metrics pie data with totals
  const getPerformanceMetricsData = () => {
    const values = [
      performanceMetrics.todaySales || 1,
      performanceMetrics.customersServed || 1,
      performanceMetrics.averageBasketSize || 1,
      performanceMetrics.todayTransactions || 1,
      performanceMetrics.totalItems || 1
    ];
    const total = values.reduce((a, b) => a + b, 0);
    
    return [
      { name: `Sales: ${formatUGX(performanceMetrics.todaySales)}`, value: performanceMetrics.todaySales || 1, color: '#10b981', total },
      { name: `Customers: ${performanceMetrics.customersServed}`, value: performanceMetrics.customersServed || 1, color: '#3b82f6', total },
      { name: `Avg Basket: ${formatUGX(performanceMetrics.averageBasketSize)}`, value: performanceMetrics.averageBasketSize || 1, color: '#a855f7', total },
      { name: `Transactions: ${performanceMetrics.todayTransactions}`, value: performanceMetrics.todayTransactions || 1, color: '#f59e0b', total },
      { name: `Items: ${performanceMetrics.totalItems || 0}`, value: performanceMetrics.totalItems || 1, color: '#ef4444', total }
    ];
  };

  // Get payment methods pie data with totals
  const getPaymentMethodsData = () => {
    const values = [
      performanceMetrics.mobileMoneyTransactions || 1,
      performanceMetrics.cashTransactions || 1,
      performanceMetrics.mobileMoneyTransactions || 1,
      performanceMetrics.cardTransactions || 1
    ];
    const total = values.reduce((a, b) => a + b, 0);
    
    return [
      { name: `MTN Mobile: ${performanceMetrics.mobileMoneyTransactions}`, value: performanceMetrics.mobileMoneyTransactions || 1, color: '#f59e0b', total },
      { name: `Cash: ${performanceMetrics.cashTransactions}`, value: performanceMetrics.cashTransactions || 1, color: '#10b981', total },
      { name: `Airtel Money: ${performanceMetrics.mobileMoneyTransactions}`, value: performanceMetrics.mobileMoneyTransactions || 1, color: '#dc2626', total },
      { name: `Card: ${performanceMetrics.cardTransactions}`, value: performanceMetrics.cardTransactions || 1, color: '#3b82f6', total }
    ];
  };

  // Custom label renderer for pie slices
  const renderLabel = (entry) => {
    const percent = ((entry.value / entry.total) * 100).toFixed(1);
    return `${percent}%`;
  };

  // 🛒 ORDER SUBMISSION FUNCTION
  const submitSupplyOrder = async (orderDataFromModal) => {
    try {
      setSubmittingOrder(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('❌ You must be logged in to submit orders');
        return;
      }

      // Prepare order data (use camelCase as expected by service)
      const orderData = {
        cashierId: user.id,
        cashierName: user.user_metadata?.full_name || user.email || 'Cashier',
        registerNumber: 'POS-01', // You can make this dynamic
        location: 'Kampala Main Branch',
        items: orderDataFromModal.items.map(item => ({
          name: item.item_name,
          category: item.item_category,
          quantity: item.quantity,
          unitCost: item.unit_cost,
          supplyId: item.id
        })),
        priority: orderDataFromModal.priority,
        notes: orderDataFromModal.notes
      };

      // Submit order to Supabase
      const result = await cashierOrdersService.createOrder(orderData);

      if (result.success) {
        toast.success(`✅ Order ${result.orderNumber} submitted successfully!`);
        setShowOrderModal(false);
        
        // Reload order stats
        await loadTillSuppliesAndStats();
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      console.error('❌ Error submitting order:', error);
      toast.error(`Failed to submit order: ${error.message}`);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getShiftStatus = () => {
    const hour = currentTime.getHours();
    if (hour >= 7 && hour < 15) return { status: 'On Shift', icon: '🛒', color: 'text-green-600' };
    if (hour >= 15 && hour < 23) return { status: 'Off Shift', icon: '🏠', color: 'text-blue-600' };
    return { status: 'Closed', icon: '🌙', color: 'text-purple-600' };
  };

  const toggleTask = (taskId) => {
    setDailyTasks(tasks => 
      tasks.map(task => 
        task.id === taskId 
          ? { ...task, completed: !task.completed }
          : task
      )
    );
  };

  const renderPOS = () => (
    <div className="space-y-3 md:space-y-6 animate-fadeInUp container-glass shadow-xl rounded-lg md:rounded-2xl p-2 md:p-6 border border-yellow-200">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 md:gap-6">
        {/* Product Selection */}
        <div className="lg:col-span-2 bg-white rounded-lg md:rounded-xl p-2 md:p-6 shadow-lg">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 md:mb-6 gap-3">
            <h3 className="text-lg md:text-xl font-bold text-gray-900 flex items-center">
              🛒 Product Selection
            </h3>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <button
                onClick={loadProductsFromSupabase}
                disabled={refreshingProducts}
                className={`px-3 py-2 md:px-4 ${refreshingProducts ? 'bg-gray-400' : 'bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700'} text-white rounded-lg font-bold transition-all duration-300 transform hover:scale-105 flex items-center justify-center md:justify-start space-x-2 shadow-lg text-sm md:text-base`}
                title="Refresh products from Manager Portal"
              >
                <FiRefreshCw className={`h-4 w-4 md:h-5 md:w-5 ${refreshingProducts ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{refreshingProducts ? 'Loading...' : 'Load POS'}</span>
              </button>
              <button
                onClick={() => setShowAddProductModal(true)}
                className="px-3 py-2 md:px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-bold hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2 shadow-lg text-sm md:text-base"
              >
                <FiPlus className="h-4 w-4 md:h-5 md:w-5" />
                <span className="hidden xs:inline">Add Product</span>
              </button>
              <button
                onClick={() => setShowBarcodeScanner(true)}
                className="px-3 py-2 md:px-4 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg font-bold hover:from-blue-700 hover:to-green-700 transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2 shadow-lg text-sm md:text-base"
              >
                <FiCamera className="h-4 w-4 md:h-5 md:w-5" />
                <span className="hidden xs:inline">Scan</span>
              </button>
            </div>
          </div>
          
          {/* 🔥 SUPABASE PRODUCTS GRID - Real-time inventory */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2 md:gap-4 max-h-72 md:max-h-96 overflow-y-auto">
            {productsLoading ? (
              <div className="col-span-2 md:col-span-3 text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="text-gray-500 mt-2 text-sm">Loading products from database...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="col-span-2 md:col-span-3 text-center py-8">
                <p className="text-gray-500 text-sm">No products available</p>
                <button 
                  onClick={loadProductsFromSupabase}
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  <FiRefreshCw className="inline mr-2" />
                  Reload Products
                </button>
              </div>
            ) : (
              products.map((product) => {
                const productPrice = product.selling_price || product.price || 0;
                const productStock = product.stock || product.available_stock || 0;
                const categoryName = product.categoryName || product.category || 'General';
                const isLowStock = productStock <= (product.minStock || 10);
                const isOutOfStock = productStock === 0;
                
                return (
                  <div
                    key={product.id}
                    onClick={() => !isOutOfStock && addItemToTransaction(product)}
                    className={`border rounded-lg p-3 md:p-4 hover:shadow-md transition-all duration-300 ${
                      isOutOfStock 
                        ? 'cursor-not-allowed opacity-50 bg-gray-100 border-gray-300' 
                        : 'cursor-pointer hover:bg-yellow-50 border-gray-200 hover:border-yellow-300'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-xl md:text-2xl mb-1 md:mb-2">
                        {categoryName.toLowerCase().includes('produce') ? '🥬' :
                         categoryName.toLowerCase().includes('dairy') ? '🥛' :
                         categoryName.toLowerCase().includes('bakery') ? '🍞' :
                         categoryName.toLowerCase().includes('personal') ? '🧼' :
                         categoryName.toLowerCase().includes('electronics') ? '📱' : '🌾'}
                      </div>
                      <h4 className="font-semibold text-xs md:text-sm text-gray-900 mb-1 line-clamp-2">{product.name}</h4>
                      <p className="text-green-600 font-bold text-sm md:text-base">{formatUGX(productPrice)}</p>
                      <div className="flex items-center justify-center space-x-1 text-xs mt-1">
                        {isOutOfStock ? (
                          <span className="text-red-600 font-semibold text-xs">❌ Out</span>
                        ) : isLowStock ? (
                          <span className="text-orange-600 font-semibold text-xs">⚠️ {productStock}</span>
                        ) : (
                          <span className="text-gray-500 text-xs">✓ {productStock}</span>
                        )}
                      </div>
                      {product.sku && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-1">SKU: {product.sku}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Transaction Summary */}
        <div className="bg-white rounded-lg md:rounded-xl p-2 md:p-6 shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            🧾 Current Transaction
          </h3>
          
          {/* Transaction Items */}
          <div className="space-y-3 max-h-64 overflow-y-auto mb-6">
            {currentTransaction.items.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No items added</p>
            ) : (
              currentTransaction.items.map((item) => {
                const itemPrice = item.selling_price || item.price || 0;
                return (
                  <div key={item.id} className="flex items-center justify-between p-2 md:p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 text-xs md:text-sm">{item.name}</h4>
                      <p className="text-xs md:text-sm text-gray-600">{formatUGX(itemPrice)} x {item.quantity}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                        className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      <FiMinus />
                    </button>
                    <span className="w-8 text-center font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                      className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-green-600"
                    >
                      <FiPlus />
                    </button>
                  </div>
                  <button
                    onClick={() => removeItemFromTransaction(item.id)}
                    className="ml-2 text-red-500 hover:text-red-700"
                  >
                    <FiX className="h-4 w-4" />
                  </button>
                </div>
                );
              })
            )}
          </div>

          {/* Transaction Totals */}
          {currentTransaction.items.length > 0 && (
            <div className="border-t pt-2 md:pt-3 space-y-2 md:space-y-3">
              {/* Subtotal and Tax */}
              <div className="space-y-1 md:space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-semibold text-gray-900">{formatUGX(currentTransaction.subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">VAT (18%):</span>
                  <span className="font-semibold text-gray-900">{formatUGX(currentTransaction.tax)}</span>
                </div>
              </div>
              
              {/* Total Amount Due */}
              <div className="flex justify-between text-base md:text-xl font-bold border-t-2 border-b-2 border-gray-300 py-2 md:py-3 bg-gradient-to-r from-green-50 to-emerald-50">
                <span className="text-gray-900">TOTAL:</span>
                <span className="text-green-600">{formatUGX(currentTransaction.total)}</span>
              </div>
              
              {/* Cash Received Input */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg md:rounded-xl p-2 md:p-3 space-y-2 md:space-y-3">
                <label className="block text-xs font-semibold text-blue-900">
                  💵 Cash Received (UGX)
                </label>
                <input
                  type="number"
                  value={cashReceived}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCashReceived(value);
                  }}
                  onFocus={(e) => e.target.select()}
                  placeholder="Enter amount..."
                  className="w-full px-2 md:px-3 py-1 md:py-2 text-lg md:text-xl font-bold text-center border-2 border-blue-300 rounded-lg focus:ring-4 focus:ring-blue-500 focus:border-blue-500 bg-white"
                />
                
                {/* Quick Cash Buttons */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    Math.ceil(currentTransaction.total / 1000) * 1000, // Round up to nearest 1000
                    Math.ceil(currentTransaction.total / 5000) * 5000, // Round up to nearest 5000
                    Math.ceil(currentTransaction.total / 10000) * 10000, // Round up to nearest 10000
                  ].filter((amount, index, arr) => arr.indexOf(amount) === index && amount >= currentTransaction.total)
                   .slice(0, 3)
                   .map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setCashReceived(amount.toString())}
                      className="px-3 py-2 md:px-3 md:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 text-base md:text-base font-bold transform hover:scale-105 shadow-md whitespace-nowrap"
                    >
                      {formatUGX(amount)}
                    </button>
                  ))}
                </div>
                
                {/* Exact Amount Button */}
                <button
                  onClick={() => setCashReceived(currentTransaction.total.toString())}
                  className="w-full px-2 py-1 md:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 text-xs font-semibold"
                >
                  ✓ Exact Amount
                </button>
              </div>
              
              {/* Change Calculator */}
              {cashReceived && parseFloat(cashReceived) >= currentTransaction.total && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-lg md:rounded-xl p-2 md:p-3 animate-pulse">
                  <div className="flex items-center justify-between mb-1 md:mb-2">
                    <span className="text-xs md:text-base font-bold text-yellow-900">💰 CHANGE:</span>
                    <span className="text-lg md:text-2xl font-bold text-orange-600">
                      {formatUGX(parseFloat(cashReceived) - currentTransaction.total)}
                    </span>
                  </div>
                  
                  {/* Change Breakdown */}
                  {(() => {
                    const change = parseFloat(cashReceived) - currentTransaction.total;
                    const denominations = [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50];
                    let remaining = change;
                    const breakdown = [];
                    
                    denominations.forEach(denom => {
                      if (remaining >= denom) {
                        const count = Math.floor(remaining / denom);
                        breakdown.push({ denom, count });
                        remaining = remaining % denom;
                      }
                    });
                    
                    return breakdown.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-yellow-300">
                        <p className="text-xs font-semibold text-yellow-900 mb-2">💵 Breakdown:</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {breakdown.map(({ denom, count }) => (
                            <div key={denom} className="flex justify-between bg-white/50 rounded px-2 py-1">
                              <span className="font-semibold">{formatUGX(denom)}:</span>
                              <span className="text-yellow-900">{count}x</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              
              {/* Warning if insufficient cash */}
              {cashReceived && parseFloat(cashReceived) < currentTransaction.total && (
                <div className="bg-red-50 border-2 border-red-300 rounded-lg md:rounded-xl p-2 flex items-center space-x-2">
                  <FiAlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                  <span className="text-xs font-semibold text-red-900">
                    Need {formatUGX(currentTransaction.total - parseFloat(cashReceived))} more
                  </span>
                </div>
              )}
              
              {/* Process Payment Button */}
              <button
                onClick={() => setPaymentModal(true)}
                disabled={cashReceived && parseFloat(cashReceived) < currentTransaction.total}
                className={`w-full py-2 md:py-3 rounded-lg md:rounded-xl font-bold text-xs md:text-sm transition-all duration-300 mt-2 md:mt-3 transform hover:scale-105 shadow-lg ${
                  cashReceived && parseFloat(cashReceived) >= currentTransaction.total
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700'
                    : 'bg-gradient-to-r from-yellow-500 to-red-600 text-white hover:from-yellow-600 hover:to-red-700'
                }`}
              >
                {cashReceived && parseFloat(cashReceived) >= currentTransaction.total ? (
                  <>✅ Complete Sale</>
                ) : (
                  <>💳 Process Payment</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="space-y-4 md:space-y-6 animate-slideInLeft container-3d bg-white rounded-none md:rounded-2xl p-2 md:p-8 shadow-none md:shadow-2xl">
      {/* Ugandan-themed Welcome Section - Real Data */}
      <div className="bg-gradient-to-r from-yellow-500 via-red-600 to-black rounded-none md:rounded-xl p-2 md:p-4 text-white shadow-none md:shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-3xl font-bold mb-1 md:mb-2">
              {getGreeting()}, {cashierProfile?.name || 'Cashier'}! 🇺🇬
            </h1>
            <p className="text-yellow-100 text-lg">
              Welcome to your cashier portal - Ready to serve customers!
            </p>
            <div className="flex items-center mt-4 space-x-6 flex-wrap gap-3">
              <div className="flex items-center space-x-2">
                <FiClock className="h-5 w-5" />
                <span>{currentTime.toLocaleTimeString('en-UG')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <FiMapPin className="h-5 w-5" />
                <span>{cashierProfile?.location || 'Kampala Branch'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`font-semibold ${getShiftStatus().color}`}>
                  {getShiftStatus().icon} {getShiftStatus().status}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <FiShoppingCart className="h-5 w-5" />
                <span>Till #{cashierProfile?.register || '1'}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-5xl md:text-6xl mb-2">🏪</div>
            <p className="text-yellow-100 font-semibold">FAREDEAL</p>
            <p className="text-yellow-200 text-sm">Uganda</p>
            <p className="text-yellow-100 text-xs mt-1">Supermarket</p>
            
            {/* Quick Scanner Access */}
            <button
              onClick={() => setShowBarcodeScanner(true)}
              className="mt-2 px-4 py-2 md:px-6 md:py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-xl font-bold transition-all duration-300 transform hover:scale-105 flex items-center space-x-2 shadow-lg border border-white/30 text-sm md:text-base"
            >
              <FiCamera className="h-6 w-6" />
              <span>📱 Quick Scan</span>
            </button>
          </div>
        </div>
      </div>

      {/* Performance Metrics Pie Chart */}
      <div className="bg-white rounded-lg md:rounded-xl shadow-md md:shadow-lg p-2 md:p-4">
        <div className="border-b pb-2 md:pb-4 mb-2 md:mb-4 flex items-center justify-between">
          <h3 className="text-base md:text-lg font-bold text-gray-900 bg-gradient-to-r from-yellow-500 to-red-600 bg-clip-text text-transparent">📊 Today's Performance Breakdown</h3>
          <button
            onClick={() => loadPerformanceMetrics()}
            className="p-1 md:p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
            title="Refresh metrics"
          >
            <FiRefreshCw className="h-4 w-4 md:h-5 md:w-5" />
          </button>
        </div>
        <div className="h-80 flex items-center justify-center">
          {performanceMetrics.todayTransactions > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={getPerformanceMetricsData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderLabel}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {getPerformanceMetricsData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value, name, props) => {
                    const total = props.payload.total;
                    const percent = ((value / total) * 100).toFixed(1);
                    return [`${value} (${percent}%)`, props.payload.name];
                  }}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8">
              <FiPieChart className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No transactions yet</p>
              <p className="text-sm text-gray-400">Start processing sales to see metrics</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment Methods Pie Chart */}
      <div className="bg-white rounded-lg md:rounded-xl shadow-md md:shadow-lg p-2 md:p-4">
        <div className="border-b pb-2 md:pb-4 mb-2 md:mb-4 flex items-center justify-between">
          <h3 className="text-base md:text-lg font-bold text-gray-900">💳 Payment Methods Distribution (Today)</h3>
          <button
            onClick={() => loadPerformanceMetrics()}
            className="p-1 md:p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
            title="Refresh metrics"
          >
            <FiRefreshCw className="h-4 w-4 md:h-5 md:w-5" />
          </button>
        </div>
        <div className="h-80 flex items-center justify-center">
          {(performanceMetrics.mobileMoneyTransactions + performanceMetrics.cashTransactions + performanceMetrics.cardTransactions) > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={getPaymentMethodsData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderLabel}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {getPaymentMethodsData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value, name, props) => {
                    const total = props.payload.total;
                    const percent = ((value / total) * 100).toFixed(1);
                    return [`${value} transactions (${percent}%)`, props.payload.name];
                  }}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8">
              <FiPieChart className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No payment data yet</p>
              <p className="text-sm text-gray-400">Process payments to see distribution</p>
            </div>
          )}
        </div>
      </div>

      {/* Daily Tasks */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">📋 Daily Cashier Tasks</h3>
          {dailyTasks.length > 0 && (
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {dailyTasks.filter(t => t.completed).length} of {dailyTasks.length} completed
            </span>
          )}
        </div>
        <div className="space-y-3">
          {dailyTasks && dailyTasks.length > 0 ? (
            dailyTasks.map((task) => (
              <div key={task.id} className={`flex items-center p-4 border rounded-lg transition-all duration-300 ${
                task.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-gray-300'
              }`}>
                <button
                  onClick={() => toggleTask(task.id)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 transition-all duration-300 ${
                    task.completed 
                      ? 'bg-green-500 border-green-500 text-white' 
                      : 'border-gray-300 hover:border-green-500'
                  }`}
                >
                  {task.completed && <FiCheck className="h-4 w-4" />}
                </button>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className={`font-medium ${task.completed ? 'text-green-800 line-through' : 'text-gray-900'}`}>
                      {task.title}
                    </h4>
                    <span className="text-sm text-gray-500 font-mono">{task.time}</span>
                  </div>
                  <div className="flex items-center mt-1">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      task.priority === 'high' ? 'bg-red-100 text-red-800' :
                      task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {task.priority} priority
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <span className="text-4xl mb-2 block">📋</span>
              <p className="text-gray-500 font-medium">Loading daily tasks...</p>
              <p className="text-sm text-gray-400">Your shift tasks will appear shortly</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-4">
        <div className="bg-white rounded-lg md:rounded-xl p-2 md:p-4 shadow-md md:shadow-lg">
          <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2 md:mb-4">💳 Recent Transactions</h3>
          <div className="space-y-2">
            {recentTransactions.length > 0 ? (
              recentTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-2 md:p-3 border rounded-lg hover:shadow-md transition-all duration-300">
                  <div className="flex items-center space-x-2 md:space-x-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-r from-yellow-500 to-red-600 rounded-full flex items-center justify-center">
                      <FiShoppingCart className="h-4 w-4 md:h-5 md:w-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-1 md:space-x-2">
                        <span className="font-medium text-gray-900 text-xs md:text-sm truncate">{transaction.id}</span>
                        <span className={`inline-flex px-1 md:px-2 py-0.5 md:py-1 text-xs font-semibold rounded-full ${
                          transaction.method.includes('MoMo') || transaction.method.includes('Money') ? 'bg-orange-100 text-orange-800' :
                          transaction.method === 'Cash' ? 'bg-green-100 text-green-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {transaction.method}
                        </span>
                      </div>
                      <p className="text-xs md:text-sm text-gray-500">{transaction.items} items • {transaction.time}</p>
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    <p className="font-semibold text-gray-900 text-sm md:text-base">{formatUGX(transaction.amount)}</p>
                    <span className="inline-flex px-1 md:px-2 py-0.5 md:py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      {transaction.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <FiShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No transactions yet</p>
                <p className="text-sm text-gray-400">Start processing sales to see them here</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg md:rounded-xl p-2 md:p-4 shadow-md md:shadow-lg">
          <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2 md:mb-4">🥇 Top Products (Today)</h3>
          <div className="space-y-2">
            {topProducts.length > 0 ? (
              topProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-2 md:p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2 md:space-x-3">
                    <div className="w-6 h-6 md:w-8 md:h-8 bg-yellow-500 rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm md:text-base">{product.name}</p>
                      <p className="text-xs md:text-sm text-gray-500">{product.sales} units sold</p>
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    <p className="font-semibold text-gray-900 text-sm md:text-base">{formatUGX(product.revenue)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <FiShoppingBag className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No sales data yet</p>
                <p className="text-sm text-gray-400">Make some sales to see top products</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderProfile = () => {
    console.log('🎨 Rendering profile header - profilePicUrl:', profilePicUrl ? 'exists' : 'null', 'cashierProfile.avatar_url:', cashierProfile.avatar_url ? 'exists' : 'null');
    return (<div className="space-y-6 animate-fadeInUp">
      {/* Profile Header Card */}
      <div className="bg-gradient-to-r from-yellow-500 via-red-600 to-black rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-6">
              {/* Profile Avatar with Upload */}
              <div className="relative group">
                <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-xl overflow-hidden">
                  {(profilePicUrl || cashierProfile.avatar_url) ? (
                    <img 
                      key={`${profilePicUrl || cashierProfile.avatar_url}-${Date.now()}`}
                      src={profilePicUrl || cashierProfile.avatar_url} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error('❌ Image failed to load');
                        e.target.style.display = 'none';
                      }}
                      onLoad={() => console.log('✅ Image loaded successfully')}
                    />
                  ) : (
                    <span className="text-6xl">{cashierProfile.avatar}</span>
                  )}
                </div>
                
                {/* Upload Button Overlay */}
                <label 
                  htmlFor="cashier-profile-pic-upload"
                  className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300"
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
                    id="cashier-profile-pic-upload"
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
              </div>
              
              {/* Profile Info */}
              <div className="text-white">
                <h1 className="text-4xl font-bold mb-2">{cashierProfile.name}</h1>
                <p className="text-xl text-yellow-200 mb-4">{cashierProfile.role}</p>
                <div className="flex items-center space-x-6 text-sm">
                  <div className="flex items-center space-x-2">
                    <FiShield className="h-5 w-5" />
                    <span>ID: {cashierProfile.employeeId}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FiCalendar className="h-5 w-5" />
                    <span>Joined: {new Date(cashierProfile.joinDate).toLocaleDateString('en-US', { 
                      month: 'long', 
                      year: 'numeric' 
                    })}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <FiMapPin className="h-5 w-5" />
                    <span>{cashierProfile.location}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col space-y-2">
              <button 
                onClick={openEditProfileModal}
                className="px-4 py-2 bg-white text-red-600 rounded-lg hover:bg-gray-100 transition-all flex items-center space-x-2 font-medium"
              >
                <FiEdit className="h-4 w-4" />
                <span>Edit Profile</span>
              </button>
              <button 
                onClick={openSettingsModal}
                className="px-4 py-2 bg-white/20 backdrop-blur-sm text-white rounded-lg hover:bg-white/30 transition-all flex items-center space-x-2 font-medium"
              >
                <FiSettings className="h-4 w-4" />
                <span>Settings</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="bg-black/30 backdrop-blur-sm px-8 py-4">
          <div className="grid grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-yellow-200 text-sm mb-1">Today's Sales</p>
              <p className="text-white text-2xl font-bold">UGX {performanceMetrics.todaySales.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-yellow-200 text-sm mb-1">Transactions</p>
              <p className="text-white text-2xl font-bold">{performanceMetrics.todayTransactions}</p>
            </div>
            <div className="text-center">
              <p className="text-yellow-200 text-sm mb-1">Efficiency</p>
              <p className="text-white text-2xl font-bold">{performanceMetrics.efficiency}%</p>
            </div>
            <div className="text-center">
              <p className="text-yellow-200 text-sm mb-1">Scan Rate</p>
              <p className="text-white text-2xl font-bold">{performanceMetrics.scanRate} /min</p>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Personal Information */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Personal Information</h3>
            <FiUser className="h-6 w-6 text-gray-400" />
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Full Name</p>
              <p className="text-base font-semibold text-gray-900">{cashierProfile.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Employee ID</p>
              <p className="text-base font-semibold text-gray-900">{cashierProfile.employeeId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Department</p>
              <p className="text-base font-semibold text-gray-900">{cashierProfile.department}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Position</p>
              <p className="text-base font-semibold text-gray-900">{cashierProfile.role}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Join Date</p>
              <p className="text-base font-semibold text-gray-900">
                {new Date(cashierProfile.joinDate).toLocaleDateString('en-US', { 
                  day: 'numeric',
                  month: 'long', 
                  year: 'numeric' 
                })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Languages</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {cashierProfile.languages.map(lang => (
                  <span key={lang} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Work Details */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Work Details</h3>
            <FiClock className="h-6 w-6 text-gray-400" />
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Current Shift</p>
              <p className="text-base font-semibold text-gray-900">{cashierProfile.shift}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Assigned Register</p>
              <p className="text-base font-semibold text-gray-900">{cashierProfile.register}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Branch Location</p>
              <p className="text-base font-semibold text-gray-900">{cashierProfile.location}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Direct Manager</p>
              <p className="text-base font-semibold text-gray-900">{cashierProfile.manager}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Work Status</p>
              <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Permissions & Access */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Permissions & Access</h3>
            <FiShield className="h-6 w-6 text-gray-400" />
          </div>
          <div className="space-y-3">
            {Object.entries(cashierProfile.permissions).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                {value ? (
                  <span className="flex items-center text-green-600">
                    <FiCheckCircle className="h-5 w-5" />
                  </span>
                ) : (
                  <span className="flex items-center text-red-600">
                    <FiXCircle className="h-5 w-5" />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Overview */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Performance Overview</h3>
          <FiTrendingUp className="h-6 w-6 text-green-500" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
            <FiDollarSign className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <p className="text-sm text-blue-600 mb-1">Today's Sales</p>
            <p className="text-2xl font-bold text-gray-900">
              UGX {(performanceMetrics.todaySales / 1000).toFixed(0)}K
            </p>
            <p className="text-xs text-gray-600 mt-1">+12% from yesterday</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
            <FiShoppingCart className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-sm text-green-600 mb-1">Transactions</p>
            <p className="text-2xl font-bold text-gray-900">{performanceMetrics.todayTransactions}</p>
            <p className="text-xs text-gray-600 mt-1">+8% from yesterday</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl">
            <FiZap className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <p className="text-sm text-purple-600 mb-1">Efficiency</p>
            <p className="text-2xl font-bold text-gray-900">{performanceMetrics.efficiency}%</p>
            <p className="text-xs text-gray-600 mt-1">Above target</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl">
            <FiUsers className="h-8 w-8 text-orange-600 mx-auto mb-2" />
            <p className="text-sm text-orange-600 mb-1">Customers Served</p>
            <p className="text-2xl font-bold text-gray-900">{performanceMetrics.customersServed}</p>
            <p className="text-xs text-gray-600 mt-1">Great service!</p>
          </div>
        </div>
      </div>

      {/* Achievements & Badges */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Achievements & Recognition</h3>
          <FiAward className="h-6 w-6 text-yellow-500" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border-2 border-yellow-300">
            <div className="text-4xl mb-2">🏆</div>
            <p className="text-sm font-bold text-gray-900">Top Performer</p>
            <p className="text-xs text-gray-600">This Month</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-300">
            <div className="text-4xl mb-2">⭐</div>
            <p className="text-sm font-bold text-gray-900">Customer Favorite</p>
            <p className="text-xs text-gray-600">5-Star Rating</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-300">
            <div className="text-4xl mb-2">🎯</div>
            <p className="text-sm font-bold text-gray-900">100% Accuracy</p>
            <p className="text-xs text-gray-600">Last Week</p>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-300">
            <div className="text-4xl mb-2">💎</div>
            <p className="text-sm font-bold text-gray-900">Loyalty Expert</p>
            <p className="text-xs text-gray-600">Most Signups</p>
          </div>
        </div>
      </div>
    </div>
    );
  }

  const renderPerformance = () => (
    <div className="space-y-6 animate-slideInRight container-neon rounded-2xl p-8">
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-6">📈 Weekly Performance Trends (Real-time from Supabase)</h3>
        {weeklyPerformance.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={weeklyPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value, name) => name === 'sales' ? [formatUGX(value), 'Sales'] : [value, name]} />
              <Line type="monotone" dataKey="sales" stroke="#3B82F6" strokeWidth={3} name="Sales (UGX)" />
              <Line type="monotone" dataKey="transactions" stroke="#10B981" strokeWidth={3} name="Transactions" />
              <Line type="monotone" dataKey="momo" stroke="#F59E0B" strokeWidth={3} name="Mobile Money" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12">
            <FiTrendingUp className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No performance data yet</p>
            <p className="text-sm text-gray-400">Start making sales to see your weekly trends</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-6">🏪 Department Sales (Today - Supabase)</h3>
          {departmentSales.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={departmentSales}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name} ${percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {departmentSales.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [formatUGX(value), 'Sales']} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12">
              <FiPieChart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No sales by department yet</p>
              <p className="text-sm text-gray-400">Make sales to see department breakdown</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-6">🏆 Achievements (Based on Performance)</h3>
          <div className="grid grid-cols-1 gap-4">
            {achievements.length > 0 ? (
              achievements.map((achievement) => (
                <div key={achievement.id} className={`p-4 border rounded-lg text-center transition-all duration-300 ${
                  achievement.earned 
                    ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">{achievement.icon}</div>
                    <div className="text-left">
                      <h4 className="font-semibold text-gray-900">{achievement.title}</h4>
                      <p className="text-sm text-gray-600">{achievement.description}</p>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${
                        achievement.earned 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {achievement.earned ? '✅ Earned' : '🎯 In Progress'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <FiAward className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No achievements yet</p>
                <p className="text-sm text-gray-400">Start working to unlock achievements</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderInventory = () => (
    <div className="space-y-6 animate-zoomIn">
      {/* Enhanced Inventory Header */}
      <div className="bg-gradient-to-r from-blue-500 to-emerald-600 rounded-xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold mb-2">📦 Complete Inventory Management</h3>
            <p className="text-blue-100">Full product inventory with reorder and adjustment capabilities</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">6</div>
            <div className="text-blue-100 text-sm">Products Available</div>
          </div>
        </div>
      </div>


      {/* 
        COMMENTED OUT - TILL SUPPLIES ORDERING DISABLED FOR CASHIERS
        
        Till supplies are now managed exclusively through the Manager Portal's
        🇺🇬 Supplier Order Verification & Management system.
        
        Cashiers no longer need to request supplies directly.
        All supply chain management is handled by management layer.
        
        {/* Till Supplies - Simple Request Button for Cashiers *\/}
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 shadow-lg border-2 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xl font-bold text-gray-900 flex items-center mb-2">
                <span className="mr-3 text-2xl">🏪</span>
                Till & Station Supplies
              </h4>
              <p className="text-sm text-gray-600">⛔ Cashiers are not allowed to create orders. Contact management for supply requests.</p>
            </div>
            <button
              disabled
              className="px-8 py-4 bg-gray-400 text-white rounded-lg font-bold cursor-not-allowed opacity-60 flex items-center space-x-2 shadow-lg"
            >
              <FiShoppingCart className="h-6 w-6" />
              <span>Order Creation Disabled</span>
            </button>
          </div>
          
          {/* My Requests Status - Simple View *\/}
          {orderStats.myOrders > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-xs text-gray-600 mb-1">My Requests</p>
                <p className="text-2xl font-bold text-blue-600">{orderStats.myOrders}</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-xs text-gray-600 mb-1">✅ Approved</p>
                <p className="text-2xl font-bold text-green-600">{orderStats.approved}</p>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <p className="text-xs text-gray-600 mb-1">⏳ Pending</p>
                <p className="text-2xl font-bold text-orange-600">{orderStats.pending}</p>
              </div>
            </div>
          )}
        </div>
      */}

      {/* Full Product Inventory Interface */}
      <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200">
        <ProductInventoryInterface />
      </div>

      {/* Cashier Quick Actions */}
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <FiZap className="mr-2 h-5 w-5 text-yellow-500" />
          Quick Cashier Actions
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { 
              title: 'Price Check', 
              Icon: FiTag, 
              iconBg: 'bg-blue-500',
              color: 'bg-blue-600 hover:bg-blue-700', 
              action: () => {
                toast.info('🏷️ Price check scanner activated');
                setShowBarcodeScanner(true);
              }
            },
            { 
              title: 'Stock Alert', 
              Icon: FiAlertCircle, 
              iconBg: 'bg-yellow-500',
              color: 'bg-yellow-600 hover:bg-yellow-700', 
              action: () => {
                const lowStockItems = products.filter(p => p.stock <= p.minStock);
                if (lowStockItems.length > 0) {
                  toast.warning(`⚠️ ${lowStockItems.length} items are low on stock`);
                } else {
                  toast.success('✅ All items are well stocked');
                }
              }
            },
            { 
              title: 'Request Restock', 
              Icon: FiPhone, 
              iconBg: 'bg-green-500',
              color: 'bg-green-600 hover:bg-green-700', 
              action: () => {
                toast.success('📞 Restock request sent to manager');
                // Could open a modal or send notification
              }
            },
            { 
              title: 'Report Issue', 
              Icon: FiAlertCircle, 
              iconBg: 'bg-red-500',
              color: 'bg-red-600 hover:bg-red-700', 
              action: () => {
                toast.info('🚨 Issue reporting system opened');
                // Could open issue reporting modal
              }
            }
          ].map((action, index) => {
            const IconComponent = action.Icon;
            return (
              <button
                key={index}
                onClick={action.action}
                className={`${action.color} text-white p-6 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl flex flex-col items-center space-y-3 text-sm font-medium group`}
              >
                <div className={`${action.iconBg} w-14 h-14 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg`}>
                  <IconComponent className="h-7 w-7 text-white" />
                </div>
                <span className="font-semibold">{action.title}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="space-y-6 animate-slideInRight container-glass shadow-xl rounded-2xl p-8 border border-blue-200">
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-6">🔔 Notifications</h3>
        <div className="space-y-4">
          {notifications.map((notification) => (
            <div key={notification.id} className={`p-4 border rounded-lg transition-all duration-300 ${
              notification.read ? 'bg-gray-50 border-gray-200' : 
              notification.type === 'urgent' ? 'bg-red-50 border-red-200' :
              notification.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
              'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {!notification.read && (
                    <div className={`w-2 h-2 rounded-full ${
                      notification.type === 'urgent' ? 'bg-red-500' :
                      notification.type === 'warning' ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }`}></div>
                  )}
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-semibold text-gray-900">{notification.title}</h4>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        notification.type === 'urgent' ? 'bg-red-100 text-red-800' :
                        notification.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {notification.type}
                      </span>
                    </div>
                    <p className="text-gray-600">{notification.message}</p>
                    <p className="text-sm text-gray-500 mt-1">{notification.time}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'pos', label: 'POS System', icon: FiShoppingCart },
    { id: 'dashboard', label: 'Dashboard', icon: FiBarChart },
    { id: 'transactions', label: 'My Receipts', icon: FiPrinter },
    { id: 'profile', label: 'My Profile', icon: FiUser },
    { id: 'performance', label: 'Performance', icon: FiTrendingUp },
    // { id: 'inventory', label: 'Till Supplies', icon: FiPackage }, // DISABLED - Supply ordering removed from cashier portal
    { id: 'notifications', label: 'Notifications', icon: FiBell }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes slideInLeft {
            from { opacity: 0; transform: translateX(-50px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes slideInRight {
            from { opacity: 0; transform: translateX(50px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes zoomIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
          @keyframes glow {
            0%, 100% { box-shadow: 0 0 10px rgba(255, 193, 7, 0.5); }
            50% { box-shadow: 0 0 20px rgba(255, 193, 7, 0.8); }
          }
          @keyframes rotate3d {
            0% { transform: perspective(1000px) rotateX(0deg) rotateY(0deg); }
            100% { transform: perspective(1000px) rotateX(360deg) rotateY(360deg); }
          }
          @keyframes shimmer {
            0% { background-position: -100% 0; }
            100% { background-position: 100% 0; }
          }
          .animate-fadeInUp { animation: fadeInUp 0.8s ease-out; }
          .animate-slideInLeft { animation: slideInLeft 0.8s ease-out; }
          .animate-slideInRight { animation: slideInRight 0.8s ease-out; }
          .animate-zoomIn { animation: zoomIn 0.5s ease-out; }
          .animate-bounce { animation: bounce 2s infinite; }
          .animate-glow { animation: glow 2s infinite; }
          .animate-rotate3d { animation: rotate3d 10s linear infinite; }
          .animate-shimmer {
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            background-size: 200% 100%;
            animation: shimmer 2s infinite;
          }
          .container-3d {
            transform-style: preserve-3d;
            perspective: 1000px;
            transition: transform 0.5s;
          }
          .container-3d:hover {
            transform: rotateY(5deg) rotateX(5deg);
          }
          .container-glass {
            backdrop-filter: blur(10px);
            background: rgba(255, 255, 255, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.3);
          }
          .container-neon {
            box-shadow: 0 0 15px rgba(255, 193, 7, 0.5);
            border: 2px solid rgba(255, 193, 7, 0.3);
          }
          .container-gradient {
            background: linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(249,250,251,1) 100%);
          }
        `
      }} />
      
      {/* Mobile Header */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-yellow-600 to-red-600 shadow-lg z-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg border-2 border-white/30 transition-all"
            >
              <FiMenu className="h-6 w-6 text-white" />
            </button>
            
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🛒</span>
              <h1 className="text-lg font-bold text-white">Cashier Portal</h1>
            </div>
            
            <div className="w-10"></div>
          </div>
        </div>
      )}
      
      {/* Mobile Sidebar Menu */}
      {isMobile && showMobileMenu && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setShowMobileMenu(false)}>
          <div 
            className="w-80 max-w-[85vw] bg-white shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-yellow-600 to-red-600 text-white p-6">
              <button 
                onClick={() => setShowMobileMenu(false)}
                className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <FiX className="h-5 w-5" />
              </button>

              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/30">
                  <span className="text-2xl">🛒</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold">{cashierProfile.name}</h2>
                  <p className="text-yellow-100 text-sm">{cashierProfile.role}</p>
                </div>
              </div>
            </div>

            <nav className="p-4 space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setShowMobileMenu(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-yellow-500 to-red-500 text-white shadow-lg'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <tab.icon className="h-5 w-5" />
                  <span className="flex-1 text-left font-semibold">{tab.label}</span>
                  {activeTab === tab.id && (
                    <FiChevronDown className="h-5 w-5" />
                  )}
                </button>
              ))}
            </nav>
          </div>
          
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)}></div>
        </div>
      )}
      
      {/* Desktop Header */}
      {!isMobile && (
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <div className="h-10 w-10 bg-gradient-to-r from-yellow-500 to-red-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">🛒</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Cashier Portal 🇺🇬</h1>
                  <p className="text-gray-600">Uganda Supermarket Cashier Workspace</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => setActiveTab('profile')}
                  className="text-right hover:bg-gray-50 p-2 rounded-lg transition-all duration-300 cursor-pointer group"
                >
                  <p className="text-sm text-gray-600 group-hover:text-gray-900 font-medium">{cashierProfile.name}</p>
                  <p className="text-xs text-gray-500 group-hover:text-gray-700">{cashierProfile.role}</p>
                </button>
                <button className="p-2 text-gray-400 hover:text-gray-600 transition-all duration-300">
                  <FiBell className="h-6 w-6" />
                </button>
                <button 
                  onClick={() => setActiveTab('profile')}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-all duration-300"
                  title="Profile Settings"
                >
                  <FiSettings className="h-6 w-6" />
                </button>
                <button className="p-2 text-gray-400 hover:text-gray-600 transition-all duration-300">
                  <FiLogOut className="h-6 w-6" />
                </button>
              </div>
            </div>
          </div>
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
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300 ${
                    activeTab === tab.id
                      ? 'border-yellow-500 text-yellow-600'
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

      {/* Main Content */}
      <div className={`${isMobile ? 'w-full px-0' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'} ${isMobile ? 'pt-20 pb-6' : 'py-8'}`}>
        {activeTab === 'pos' && renderPOS()}
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'transactions' && (
          <div className="animate-fadeInUp">
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-gray-900 mb-2 flex items-center">
                🧾 My Transaction History
              </h2>
              <p className="text-gray-600">View and reprint your receipts (includes unsaved receipts)</p>
            </div>
            <TransactionHistory savedReceipts={savedReceipts} />
          </div>
        )}
        {activeTab === 'profile' && renderProfile()}
        {activeTab === 'performance' && renderPerformance()}
        {activeTab === 'inventory' && renderInventory()}
        {activeTab === 'notifications' && renderNotifications()}
      </div>

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">💳 Choose Payment Method</h3>
              <p className="text-gray-600">Total: {formatUGX(currentTransaction.total)}</p>
            </div>

            {!paymentProcessing && !paymentResult && (
              <div className="space-y-3">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => processPayment(method.id)}
                    className={`w-full p-4 rounded-lg text-white font-semibold transition-all duration-300 transform hover:scale-105 ${method.color}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{method.icon}</span>
                        <div className="text-left">
                          <div className="font-semibold">{method.name}</div>
                          <div className="text-sm opacity-90">{method.description}</div>
                        </div>
                      </div>
                      {method.fee > 0 && (
                        <div className="text-right text-sm">
                          <div>Fee: {(method.fee * 100).toFixed(1)}%</div>
                          <div>{formatUGX(currentTransaction.total * method.fee)}</div>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {paymentProcessing && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Processing payment...</p>
                <p className="text-sm text-gray-500 mt-2">Please wait while we process your transaction</p>
              </div>
            )}

            {paymentResult && (
              <div className="text-center py-8">
                {paymentResult.success ? (
                  <div>
                    <div className="text-6xl mb-4">✅</div>
                    <h3 className="text-xl font-bold text-green-600 mb-2">Payment Successful!</h3>
                    <p className="text-gray-600 mb-4">Transaction ID: {paymentResult.transactionId}</p>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-sm text-green-800">
                        Amount: {formatUGX(paymentResult.amount)}<br/>
                        {paymentResult.fee > 0 && `Fee: ${formatUGX(paymentResult.fee)}`}<br/>
                        Method: {paymentResult.paymentMethod}<br/>
                        Time: {new Date(paymentResult.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-6xl mb-4">❌</div>
                    <h3 className="text-xl font-bold text-red-600 mb-2">Payment Failed</h3>
                    <p className="text-gray-600 mb-4">{paymentResult.error}</p>
                    <button
                      onClick={() => {
                        setPaymentResult(null);
                        setPaymentProcessing(false);
                      }}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-all duration-300"
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </div>
            )}

            {!paymentProcessing && !paymentResult && (
              <button
                onClick={() => setPaymentModal(false)}
                className="w-full mt-4 bg-gray-500 text-white py-3 rounded-lg hover:bg-gray-600 transition-all duration-300"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add Product Modal - Supabase Connected */}
      <AddProductModal
        isOpen={showAddProductModal}
        onClose={() => {
          setShowAddProductModal(false);
          setLastScannedBarcode(null);
        }}
        onProductAdded={handleProductAdded}
        prefilledData={lastScannedBarcode ? { barcode: lastScannedBarcode, sku: lastScannedBarcode } : {}}
      />

      {/* 🧾 Receipt Modal - Show after successful payment */}
      {showReceiptModal && receiptData && (
        <Receipt
          transaction={{}}
          receiptData={receiptData}
          onClose={() => {
            setShowReceiptModal(false);
            setReceiptData(null);
            
            // Clear current transaction
            setCurrentTransaction({
              items: [],
              subtotal: 0,
              tax: 0,
              total: 0,
              paymentMethod: null,
              customer: null
            });
            
            // Clear cash received
            setCashReceived('');
            
            // Close payment modal
            setPaymentModal(false);
            setPaymentResult(null);
            
            toast.success('🎉 Transaction completed! Ready for next customer.');
          }}
        />
      )}

      {/* Order Supplies Modal */}
      <OrderSuppliesModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        tillSupplies={tillSupplies}
        onSubmitOrder={submitSupplyOrder}
        submitting={submittingOrder}
      />

      {/* Barcode Scanner Modal */}
      {showBarcodeScanner && (
        <DualScannerInterface
          onBarcodeScanned={handleBarcodeScanned}
          onClose={() => setShowBarcodeScanner(false)}
          context="cashier"
          inventoryProducts={products}
        />
      )}

      {/* Edit Profile Modal */}
      {showEditProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center space-x-3">
                <FiEdit className="h-6 w-6" />
                <h2 className="text-2xl font-bold">Edit Profile</h2>
              </div>
              <button
                onClick={() => setShowEditProfileModal(false)}
                className="text-white hover:bg-white/20 rounded-lg p-2 transition-all"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>

            {/* Form Content */}
            <div className="p-6 space-y-6">
              {/* Profile Picture Section */}
              <div className="flex items-center space-x-4 pb-4 border-b">
                <div className="relative">
                  {profilePicUrl || cashierProfile.avatar_url ? (
                    <img
                      src={profilePicUrl || cashierProfile.avatar_url}
                      alt="Profile"
                      className="w-20 h-20 rounded-full object-cover border-4 border-red-100"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-3xl border-4 border-red-100">
                      {cashierProfile.avatar}
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
                    <FiCheck className="h-3 w-3 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{cashierProfile.name}</h3>
                  <p className="text-sm text-gray-600">{cashierProfile.role}</p>
                  <p className="text-xs text-gray-500">{cashierProfile.employeeId}</p>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editProfileForm.name}
                  onChange={(e) => setEditProfileForm({ ...editProfileForm, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  placeholder="Enter your full name"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <FiPhone className="inline h-4 w-4 mr-1" />
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editProfileForm.phone}
                  onChange={(e) => setEditProfileForm({ ...editProfileForm, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  placeholder="+256 XXX XXX XXX"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <FiMail className="inline h-4 w-4 mr-1" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={editProfileForm.email}
                  onChange={(e) => setEditProfileForm({ ...editProfileForm, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  placeholder="your.email@example.com"
                />
              </div>

              {/* Languages */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <FiGlobe className="inline h-4 w-4 mr-1" />
                  Languages Spoken
                </label>
                <div className="flex flex-wrap gap-2">
                  {['English', 'Luganda', 'Swahili', 'Runyankole', 'Ateso', 'Lusoga'].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => toggleLanguage(lang)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        editProfileForm.languages.includes(lang)
                          ? 'bg-red-600 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 rounded-b-2xl">
              <button
                onClick={() => setShowEditProfileModal(false)}
                disabled={savingProfile}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:shadow-lg transition-all font-medium flex items-center space-x-2 disabled:opacity-50"
              >
                {savingProfile ? (
                  <>
                    <FiRefreshCw className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <FiCheck className="h-4 w-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center space-x-3">
                <FiSettings className="h-6 w-6" />
                <h2 className="text-2xl font-bold">Settings</h2>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-white hover:bg-white/20 rounded-lg p-2 transition-all"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>

            {/* Settings Content */}
            <div className="p-6 space-y-6">
              {/* Notifications */}
              <div className="flex items-center justify-between pb-4 border-b">
                <div className="flex items-center space-x-3">
                  <FiBell className="h-5 w-5 text-gray-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Notifications</h3>
                    <p className="text-sm text-gray-600">Enable desktop notifications</p>
                  </div>
                </div>
                <button
                  onClick={() => setSettingsForm({ ...settingsForm, notifications: !settingsForm.notifications })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settingsForm.notifications ? 'bg-red-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settingsForm.notifications ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Sound Effects */}
              <div className="flex items-center justify-between pb-4 border-b">
                <div className="flex items-center space-x-3">
                  <FiZap className="h-5 w-5 text-gray-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Sound Effects</h3>
                    <p className="text-sm text-gray-600">Play sounds for actions</p>
                  </div>
                </div>
                <button
                  onClick={() => setSettingsForm({ ...settingsForm, soundEffects: !settingsForm.soundEffects })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settingsForm.soundEffects ? 'bg-red-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settingsForm.soundEffects ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Receipt Printing */}
              <div className="pb-4 border-b">
                <div className="flex items-center space-x-3 mb-3">
                  <FiPrinter className="h-5 w-5 text-gray-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Receipt Printing</h3>
                    <p className="text-sm text-gray-600">Default printing behavior</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {[
                    { value: 'auto', label: 'Auto Print', icon: '🖨️' },
                    { value: 'ask', label: 'Ask Me', icon: '❓' },
                    { value: 'manual', label: 'Manual', icon: '👆' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSettingsForm({ ...settingsForm, receiptPrinting: option.value })}
                      className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                        settingsForm.receiptPrinting === option.value
                          ? 'bg-red-600 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span className="text-lg mr-2">{option.icon}</span>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme */}
              <div className="pb-4 border-b">
                <div className="flex items-center space-x-3 mb-3">
                  <FiEye className="h-5 w-5 text-gray-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Display Theme</h3>
                    <p className="text-sm text-gray-600">Choose your preferred theme</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {[
                    { value: 'light', label: 'Light', icon: '☀️' },
                    { value: 'dark', label: 'Dark', icon: '🌙' },
                    { value: 'auto', label: 'Auto', icon: '🔄' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSettingsForm({ ...settingsForm, theme: option.value })}
                      className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                        settingsForm.theme === option.value
                          ? 'bg-red-600 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span className="text-lg mr-2">{option.icon}</span>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div>
                <div className="flex items-center space-x-3 mb-3">
                  <FiGlobe className="h-5 w-5 text-gray-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Display Language</h3>
                    <p className="text-sm text-gray-600">Choose interface language</p>
                  </div>
                </div>
                <select
                  value={settingsForm.language}
                  onChange={(e) => setSettingsForm({ ...settingsForm, language: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                >
                  <option value="en">English</option>
                  <option value="lg">Luganda</option>
                  <option value="sw">Swahili</option>
                </select>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 rounded-b-2xl">
              <button
                onClick={() => setShowSettingsModal(false)}
                disabled={savingSettings}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-6 py-3 bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-lg hover:shadow-lg transition-all font-medium flex items-center space-x-2 disabled:opacity-50"
              >
                {savingSettings ? (
                  <>
                    <FiRefreshCw className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <FiCheck className="h-4 w-4" />
                    <span>Save Settings</span>
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

export default CashierPortal;

