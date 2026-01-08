import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { 
  FiTrendingUp, FiUsers, FiDollarSign, FiPackage, FiBarChart, 
  FiPieChart, FiTarget, FiAward, FiClock, FiAlertTriangle,
  FiCalendar, FiMail, FiBell, FiSettings, FiLogOut, FiSearch,
  FiFilter, FiDownload, FiRefreshCw, FiEye, FiEdit, FiTrash2,
  FiPlus, FiMinus, FiChevronRight, FiChevronDown, FiStar,
  FiHeart, FiZap, FiShield, FiGift, FiNavigation, FiMapPin,
  FiSmartphone, FiHeadphones, FiCamera, FiWatch, FiHome,
  FiCreditCard, FiMessageCircle, FiShare2, FiThumbsUp,
  FiBookmark, FiGrid, FiList, FiInfo, FiHelpCircle,
  FiMaximize, FiMinimize, FiRotateCw, FiUpload, FiPrinter,
  FiTag, FiHash, FiImage, FiCheckCircle, FiXCircle, FiTruck,
  FiX, FiSend, FiFileText, FiCopy, FiExternalLink
} from 'react-icons/fi';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, ComposedChart
} from 'recharts';
import InventoryManagement from '../components/InventoryManagement';
import { toast } from 'react-toastify';

// Lazy load the new components for better performance
const ManagerHeader = lazy(() => import('../components/ManagerHeader'));
const ManagerNavigation = lazy(() => import('../components/ManagerNavigation'));
const UgandaOverviewDashboard = lazy(() => import('../components/UgandaOverviewDashboard'));

// 🇺🇬 UGANDA CULTURAL ELEMENTS
const UGANDA_GREETINGS = {
  morning: { en: 'Good Morning', luganda: 'Wasuze otya nno', swahili: 'Habari za asubuhi' },
  afternoon: { en: 'Good Afternoon', luganda: 'Osiibye otya', swahili: 'Habari za mchana' },
  evening: { en: 'Good Evening', luganda: 'Oraire otya', swahili: 'Habari za jioni' }
};

const UGANDA_CURRENCY = {
  code: 'UGX',
  symbol: 'UGX',
  locale: 'en-UG'
};

const UGANDA_BUSINESS_HOURS = {
  weekdays: '8:00 AM - 8:00 PM',
  weekends: '9:00 AM - 6:00 PM',
  timezone: 'EAT (UTC+3)'
};

// Performance optimized color palette
const CHART_COLORS = {
  primary: '#3B82F6',
  secondary: '#8B5CF6', 
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#06B6D4',
  uganda: ['#FCCC04', '#000000', '#CE1126'] // Uganda flag colors
};

const ManagerPortal = () => {
  // Core State Management
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('7d');
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Navigation Tabs Configuration
  const tabs = [
    { id: 'overview', label: 'Overview', icon: FiHome },
    { id: 'analytics', label: 'Analytics', icon: FiBarChart },
    { id: 'team', label: 'Team Management', icon: FiUsers },
    { id: 'suppliers', label: 'Suppliers', icon: FiTruck },
    { id: 'orders', label: 'Orders', icon: FiPackage },
    { id: 'inventory', label: 'Inventory', icon: FiList },
    { id: 'reports', label: 'Reports', icon: FiFileText },
    { id: 'alerts', label: 'Alerts', icon: FiBell }
  ];
  
  // Modal and UI States
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [editModal, setEditModal] = useState({
    isOpen: false,
    type: '',
    data: null,
    mode: 'edit'
  });

  // Order Verification States
  const [orderFilter, setOrderFilter] = useState('all');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [dateRange, setDateRange] = useState('this_week');
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [showOrderDetails, setShowOrderDetails] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(null);
  const [bulkAction, setBulkAction] = useState('');
  const [sortBy, setSortBy] = useState('orderDate');
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');

  // Mobile-specific states
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [notificationCount, setNotificationCount] = useState(3);

  // Check for mobile device and handle outside clicks
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    const handleClickOutside = (event) => {
      if (showMobileMenu && !event.target.closest('.profile-menu')) {
        setShowMobileMenu(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showMobileMenu]);

  const [managerProfile] = useState({
    name: 'Nakiyonga Catherine',
    role: 'Store Manager',
    department: 'Operations Management',
    employeeId: 'MGR-UG001',
    joinDate: '2021-01-15',
    avatar: '👩‍💼',
    location: 'Kampala, Uganda',
    languages: ['English', 'Luganda', 'Swahili'],
    phoneNumber: '+256 700 123 456',
    email: 'catherine.nakiyonga@faredeal.ug',
    permissions: {
      analytics: true,
      teamManagement: true,
      inventory: true,
      suppliers: true,
      reports: true,
      financials: true,
      customers: true,
      mobileMoneyTransactions: true,
      foreignCurrency: true,
      exportImportPermits: true
    }
  });

  // Enhanced Ugandan Supermarket Business Metrics
  const [businessMetrics] = useState({
    totalRevenue: 480000000, // UGX (approximately $128,000 USD)
    totalOrders: 3247,
    activeCustomers: 4156,
    inventoryValue: 920000000, // UGX
    teamSize: 28,
    supplierCount: 45,
    avgOrderValue: 147000, // UGX
    customerSatisfaction: 4.7,
    todayRevenue: 18500000, // UGX
    todayOrders: 189,
    todayCustomers: 256,
    weeklyGrowth: 18.5,
    monthlyGrowth: 12.3,
    conversionRate: 72.5,
    avgResponseTime: 1.8,
    employeeSatisfaction: 4.6,
    operationalEfficiency: 94.2,
    mobileMoneyRatio: 67, // percentage of mobile money transactions
    cashTransactionRatio: 23,
    cardTransactionRatio: 10,
    supplierOnTimeDelivery: 89.5,
    localSupplierRatio: 78, // percentage of local suppliers
    internationalSupplierRatio: 22,
    averageCustomerAge: 32,
    returningCustomerRate: 68,
    newCustomerAcquisition: 12.4
  });

  const [revenueData] = useState([
    { name: 'Mon', revenue: 12000000, orders: 145, customers: 189, profit: 2400000, expenses: 9600000, momo: 87, cash: 35, card: 23 },
    { name: 'Tue', revenue: 15000000, orders: 152, customers: 195, profit: 3000000, expenses: 12000000, momo: 92, cash: 38, card: 22 },
    { name: 'Wed', revenue: 18000000, orders: 167, customers: 212, profit: 3600000, expenses: 14400000, momo: 108, cash: 41, card: 18 },
    { name: 'Thu', revenue: 16000000, orders: 158, customers: 198, profit: 3200000, expenses: 12800000, momo: 95, cash: 42, card: 21 },
    { name: 'Fri', revenue: 22000000, orders: 178, customers: 234, profit: 4400000, expenses: 17600000, momo: 115, cash: 48, card: 15 },
    { name: 'Sat', revenue: 25000000, orders: 189, customers: 256, profit: 5000000, expenses: 20000000, momo: 127, cash: 45, card: 17 },
    { name: 'Sun', revenue: 19000000, orders: 171, customers: 228, profit: 3800000, expenses: 15200000, momo: 112, cash: 38, card: 21 }
  ]);

  // Ugandan supermarket activity data
  const [realTimeActivity] = useState([
    { id: 1, type: 'sale', message: 'Large purchase: Matooke (50kg) + Posho (25kg) - UGX 185,000', time: '2 min ago', amount: 185000, icon: '�' },
    { id: 2, type: 'customer', message: 'New loyalty member: Namukasa Grace from Ntinda', time: '5 min ago', amount: null, icon: '👤' },
    { id: 3, type: 'inventory', message: 'Low stock alert: Sugar (Kakira) - Only 12 bags left', time: '8 min ago', amount: null, icon: '⚠️' },
    { id: 4, type: 'sale', message: 'MTN Mobile Money payment: UGX 125,000 processed successfully', time: '12 min ago', amount: 125000, icon: '�' },
    { id: 5, type: 'team', message: 'Nakato Sarah completed "Customer Service Excellence" training', time: '15 min ago', amount: null, icon: '🎓' },
    { id: 6, type: 'supplier', message: 'Fresh vegetables delivery from Wakiso suppliers arriving', time: '20 min ago', amount: null, icon: '🚛' },
    { id: 7, type: 'customer', message: 'Customer complaint resolved: Expired milk refunded', time: '25 min ago', amount: 8500, icon: '🔄' },
    { id: 8, type: 'sale', message: 'Bulk rice purchase: 10 bags - UGX 420,000', time: '30 min ago', amount: 420000, icon: '�' }
  ]);

  // Top performing products - Uganda specific
  const [topProducts] = useState([
    { name: 'Posho (Maize Flour)', sales: 245, revenue: 4900000, growth: '+22%', category: 'Cereals & Grains' },
    { name: 'Rice - Local (Tilda)', sales: 189, revenue: 5670000, growth: '+18%', category: 'Cereals & Grains' },
    { name: 'Sugar - Kakira (50kg)', sales: 156, revenue: 9360000, growth: '+15%', category: 'Sweeteners' },
    { name: 'Cooking Oil - Fresh Dairy', sales: 234, revenue: 11700000, growth: '+28%', category: 'Cooking Essentials' },
    { name: 'Beans - Red (Local)', sales: 167, revenue: 3340000, growth: '+12%', category: 'Pulses' },
    { name: 'Matooke (Green Bananas)', sales: 345, revenue: 5175000, growth: '+35%', category: 'Fresh Produce' },
    { name: 'Irish Potatoes', sales: 278, revenue: 4170000, growth: '+19%', category: 'Fresh Produce' },
    { name: 'Tomatoes', sales: 456, revenue: 6840000, growth: '+41%', category: 'Fresh Produce' }
  ]);

  // Performance indicators
  const [performanceIndicators] = useState([
    { name: 'Sales Target', current: 125000, target: 150000, unit: 'USD', color: 'blue' },
    { name: 'Customer Satisfaction', current: 4.7, target: 4.8, unit: 'stars', color: 'green' },
    { name: 'Team Efficiency', current: 94.2, target: 95.0, unit: '%', color: 'purple' },
    { name: 'Inventory Turnover', current: 8.5, target: 10.0, unit: 'times', color: 'orange' }
  ]);

  const [teamPerformance] = useState([
    { 
      id: 1,
      name: 'Sarah Johnson', 
      role: 'Cashier', 
      sales: 15000, 
      efficiency: 95, 
      satisfaction: 4.8,
      avatar: '👩‍💼',
      joinDate: '2022-03-15',
      department: 'Frontend',
      skills: ['Customer Service', 'POS Systems', 'Inventory Management'],
      achievements: ['Employee of the Month (Jan 2024)', 'Perfect Attendance (Q1 2024)'],
      goals: ['Increase sales by 15%', 'Complete advanced POS training'],
      schedule: { current: 'Morning Shift (8AM-4PM)', next: 'Evening Shift (4PM-12AM)' },
      training: { completed: 8, inProgress: 2, pending: 1 },
      performance: { trend: 'up', change: '+12%' },
      status: 'active'
    },
    { 
      id: 2,
      name: 'Mike Chen', 
      role: 'Stock Keeper', 
      sales: 8000, 
      efficiency: 88, 
      satisfaction: 4.6,
      avatar: '👨‍💼',
      joinDate: '2021-11-20',
      department: 'Backend',
      skills: ['Inventory Management', 'Warehouse Operations', 'Quality Control'],
      achievements: ['Zero Stock Discrepancies (Q4 2023)', 'Safety Award Winner'],
      goals: ['Improve efficiency to 95%', 'Lead inventory optimization project'],
      schedule: { current: 'Day Shift (9AM-5PM)', next: 'Day Shift (9AM-5PM)' },
      training: { completed: 6, inProgress: 3, pending: 2 },
      performance: { trend: 'stable', change: '+3%' },
      status: 'active'
    },
    { 
      id: 3,
      name: 'Emily Davis', 
      role: 'Cashier', 
      sales: 12000, 
      efficiency: 92, 
      satisfaction: 4.7,
      avatar: '👩‍💼',
      joinDate: '2023-01-10',
      department: 'Frontend',
      skills: ['Customer Service', 'Product Knowledge', 'Upselling'],
      achievements: ['Top Sales Performer (Dec 2023)', 'Customer Service Excellence'],
      goals: ['Become team lead', 'Complete management training'],
      schedule: { current: 'Evening Shift (4PM-12AM)', next: 'Morning Shift (8AM-4PM)' },
      training: { completed: 5, inProgress: 4, pending: 0 },
      performance: { trend: 'up', change: '+18%' },
      status: 'active'
    },
    { 
      id: 4,
      name: 'David Wilson', 
      role: 'Assistant Manager', 
      sales: 18000, 
      efficiency: 96, 
      satisfaction: 4.9,
      avatar: '👨‍💼',
      joinDate: '2020-08-05',
      department: 'Management',
      skills: ['Team Leadership', 'Operations Management', 'Strategic Planning'],
      achievements: ['Manager of the Year (2023)', 'Store Performance Excellence'],
      goals: ['Promote to Store Manager', 'Implement new training program'],
      schedule: { current: 'Full Day (8AM-6PM)', next: 'Full Day (8AM-6PM)' },
      training: { completed: 12, inProgress: 1, pending: 0 },
      performance: { trend: 'up', change: '+25%' },
      status: 'active'
    }
  ]);

  // Team analytics data
  const [teamAnalytics] = useState({
    totalMembers: 12,
    activeMembers: 11,
    onLeave: 1,
    averageEfficiency: 92.5,
    averageSatisfaction: 4.7,
    totalSales: 125000,
    topPerformer: 'David Wilson',
    departmentBreakdown: [
      { department: 'Frontend', count: 6, efficiency: 94.2 },
      { department: 'Backend', count: 4, efficiency: 89.8 },
      { department: 'Management', count: 2, efficiency: 96.5 }
    ]
  });

  // Training modules data
  const [trainingModules] = useState([
    { id: 1, title: 'Advanced POS Operations', category: 'Technical', duration: '4 hours', status: 'active', enrolled: 8 },
    { id: 2, title: 'Customer Service Excellence', category: 'Soft Skills', duration: '3 hours', status: 'active', enrolled: 12 },
    { id: 3, title: 'Inventory Management Best Practices', category: 'Operations', duration: '5 hours', status: 'active', enrolled: 6 },
    { id: 4, title: 'Leadership & Team Management', category: 'Management', duration: '8 hours', status: 'upcoming', enrolled: 3 },
    { id: 5, title: 'Safety & Security Protocols', category: 'Compliance', duration: '2 hours', status: 'active', enrolled: 11 }
  ]);

  // Schedule data
  const [scheduleData] = useState([
    { day: 'Monday', shifts: [
      { time: '8AM-4PM', members: ['Sarah Johnson', 'Mike Chen'], coverage: 'Full' },
      { time: '4PM-12AM', members: ['Emily Davis', 'David Wilson'], coverage: 'Full' }
    ]},
    { day: 'Tuesday', shifts: [
      { time: '8AM-4PM', members: ['Sarah Johnson', 'Mike Chen'], coverage: 'Full' },
      { time: '4PM-12AM', members: ['Emily Davis'], coverage: 'Partial' }
    ]},
    { day: 'Wednesday', shifts: [
      { time: '8AM-4PM', members: ['Mike Chen', 'David Wilson'], coverage: 'Full' },
      { time: '4PM-12AM', members: ['Sarah Johnson', 'Emily Davis'], coverage: 'Full' }
    ]},
    { day: 'Thursday', shifts: [
      { time: '8AM-4PM', members: ['Sarah Johnson', 'Emily Davis'], coverage: 'Full' },
      { time: '4PM-12AM', members: ['Mike Chen', 'David Wilson'], coverage: 'Full' }
    ]},
    { day: 'Friday', shifts: [
      { time: '8AM-4PM', members: ['David Wilson', 'Sarah Johnson'], coverage: 'Full' },
      { time: '4PM-12AM', members: ['Emily Davis', 'Mike Chen'], coverage: 'Full' }
    ]}
  ]);

  const [inventoryInsights] = useState({
    lowStock: 15,
    outOfStock: 3,
    overstock: 8,
    fastMoving: 25,
    slowMoving: 12,
    totalProducts: 1250
  });

  // Supplier performance data (for future use)
  // const [supplierPerformance] = useState([
  //   { name: 'Apple Inc.', orders: 45, onTime: 98, quality: 4.9, totalValue: 125000 },
  //   { name: 'Samsung Electronics', orders: 32, onTime: 95, quality: 4.7, totalValue: 89000 },
  //   { name: 'Sony Corporation', orders: 28, onTime: 92, quality: 4.6, totalValue: 67000 },
  //   { name: 'LG Electronics', orders: 35, onTime: 96, quality: 4.8, totalValue: 78000 }
  // ]);

  const [recentAlerts] = useState([
    {
      id: 1,
      type: 'critical',
      title: 'Low Stock Alert',
      message: 'iPhone 15 Pro Max - Only 2 units left',
      timestamp: '5 minutes ago',
      action: 'Reorder Now'
    },
    {
      id: 2,
      type: 'warning',
      title: 'Team Performance',
      message: 'Mike Chen efficiency dropped to 88%',
      timestamp: '1 hour ago',
      action: 'Review Performance'
    },
    {
      id: 3,
      type: 'info',
      title: 'New Customer',
      message: '25 new customers registered today',
      timestamp: '2 hours ago',
      action: 'View Details'
    }
  ]);

  // Supplier verification data
  const [pendingSuppliers, setPendingSuppliers] = useState([
    {
      id: 1,
      name: 'Tech Solutions Ltd',
      contactPerson: 'John Smith',
      email: 'john@techsolutions.com',
      phone: '+256 700 123 456',
      address: 'Kampala, Uganda',
      businessType: 'Electronics',
      registrationDate: '2024-01-15',
      documents: ['Business License', 'Tax Certificate', 'Bank Statement'],
      status: 'pending',
      rating: 0,
      notes: 'New supplier specializing in mobile devices'
    },
    {
      id: 2,
      name: 'Fresh Produce Co',
      contactPerson: 'Mary Nakato',
      email: 'mary@freshproduce.co.ug',
      phone: '+256 701 234 567',
      address: 'Entebbe, Uganda',
      businessType: 'Food & Beverages',
      registrationDate: '2024-01-20',
      documents: ['Business License', 'Health Certificate', 'Insurance'],
      status: 'pending',
      rating: 0,
      notes: 'Local organic produce supplier'
    },
    {
      id: 3,
      name: 'Office Supplies Plus',
      contactPerson: 'David Kato',
      email: 'david@officesupplies.ug',
      phone: '+256 702 345 678',
      address: 'Jinja, Uganda',
      businessType: 'Office Supplies',
      registrationDate: '2024-01-25',
      documents: ['Business License', 'Tax Certificate'],
      status: 'pending',
      rating: 0,
      notes: 'Bulk office supplies and stationery'
    }
  ]);

  // Supplier order verification data
  const [pendingOrders, setPendingOrders] = useState([
    {
      id: 1,
      orderNumber: 'PO-2024-001',
      supplierName: 'Tech Solutions Ltd',
      supplierId: 1,
      orderDate: '2024-01-28',
      expectedDelivery: '2024-02-05',
      totalValue: 1250000, // UGX
      status: 'pending_verification',
      priority: 'high',
      items: [
        { name: 'Samsung Galaxy A54', quantity: 25, unitPrice: 35000, total: 875000 },
        { name: 'iPhone 13', quantity: 15, unitPrice: 25000, total: 375000 }
      ],
      documents: ['Purchase Order', 'Quotation', 'Delivery Note'],
      requestedBy: 'Sarah Johnson',
      department: 'Electronics',
      notes: 'Urgent order for holiday season stock'
    },
    {
      id: 2,
      orderNumber: 'PO-2024-002',
      supplierName: 'Fresh Produce Co',
      supplierId: 2,
      orderDate: '2024-01-27',
      expectedDelivery: '2024-01-30',
      totalValue: 450000, // UGX
      status: 'pending_verification',
      priority: 'medium',
      items: [
        { name: 'Organic Bananas (50kg)', quantity: 10, unitPrice: 25000, total: 250000 },
        { name: 'Fresh Tomatoes (30kg)', quantity: 8, unitPrice: 25000, total: 200000 }
      ],
      documents: ['Purchase Order', 'Quality Certificate'],
      requestedBy: 'Mike Chen',
      department: 'Fresh Produce',
      notes: 'Weekly fresh produce order'
    },
    {
      id: 3,
      orderNumber: 'PO-2024-003',
      supplierName: 'Office Supplies Plus',
      supplierId: 3,
      orderDate: '2024-01-26',
      expectedDelivery: '2024-02-02',
      totalValue: 320000, // UGX
      status: 'pending_verification',
      priority: 'low',
      items: [
        { name: 'A4 Paper (Boxes)', quantity: 20, unitPrice: 12000, total: 240000 },
        { name: 'Printer Cartridges', quantity: 8, unitPrice: 10000, total: 80000 }
      ],
      documents: ['Purchase Order', 'Invoice'],
      requestedBy: 'Emily Davis',
      department: 'Administration',
      notes: 'Monthly office supplies replenishment'
    }
  ]);

  // Inventory access data
  const [inventoryStats, setInventoryStats] = useState({
    totalProducts: 1250,
    lowStockItems: 45,
    outOfStockItems: 12,
    totalValue: 85000000, // UGX
    categoriesCount: 15,
    suppliersCount: 28,
    lastUpdated: '2024-01-28 14:30',
    topCategories: [
      { name: 'Electronics', value: 35000000, percentage: 41.2 },
      { name: 'Food & Beverages', value: 25000000, percentage: 29.4 },
      { name: 'Clothing', value: 15000000, percentage: 17.6 },
      { name: 'Home & Garden', value: 10000000, percentage: 11.8 }
    ],
    recentActivities: [
      { type: 'stock_in', message: 'iPhone 13 - 15 units added', time: '10 min ago' },
      { type: 'stock_out', message: 'Samsung Galaxy A54 - 8 units sold', time: '25 min ago' },
      { type: 'low_stock', message: 'Printer Paper running low (5 remaining)', time: '1 hour ago' },
      { type: 'new_product', message: 'MacBook Air M2 added to inventory', time: '2 hours ago' }
    ]
  });

  // Report access management data
  const [reportAccess] = useState([
    {
      id: 1,
      user: 'Sarah Johnson',
      role: 'Cashier',
      currentAccess: ['Sales Reports', 'Customer Reports'],
      requestedAccess: ['Financial Reports', 'Inventory Reports'],
      requestDate: '2024-01-28',
      status: 'pending'
    },
    {
      id: 2,
      user: 'Mike Chen',
      role: 'Stock Keeper',
      currentAccess: ['Inventory Reports', 'Stock Reports'],
      requestedAccess: ['Sales Reports', 'Customer Reports'],
      requestDate: '2024-01-27',
      status: 'pending'
    },
    {
      id: 3,
      user: 'Emily Davis',
      role: 'Cashier',
      currentAccess: ['Sales Reports'],
      requestedAccess: ['Customer Reports', 'Financial Reports'],
      requestDate: '2024-01-26',
      status: 'pending'
    }
  ]);

  const [strategicGoals] = useState([
    { id: 1, title: 'Increase Monthly Revenue', target: 150000, current: 125000, deadline: '2024-12-31', progress: 83 },
    { id: 2, title: 'Improve Customer Satisfaction', target: 4.8, current: 4.7, deadline: '2024-11-30', progress: 98 },
    { id: 3, title: 'Reduce Inventory Costs', target: 400000, current: 450000, deadline: '2024-12-15', progress: 89 },
    { id: 4, title: 'Expand Team', target: 15, current: 12, deadline: '2024-12-31', progress: 80 }
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Keyboard shortcuts for tab navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only activate shortcuts when not typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      // Alt + number keys for quick tab switching
      if (e.altKey && !e.shiftKey && !e.ctrlKey) {
        const tabKeys = {
          '1': 'overview',
          '2': 'analytics', 
          '3': 'team',
          '4': 'suppliers',
          '5': 'orders',
          '6': 'inventory',
          '7': 'reports',
          '8': 'alerts'
        };
        
        if (tabKeys[e.key]) {
          e.preventDefault();
          setActiveTab(tabKeys[e.key]);
          toast.success(`🎯 Quick switch: ${tabs.find(t => t.id === tabKeys[e.key])?.label}`);
        }
      }
      
      // Ctrl + R for refresh (prevent browser refresh)
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        setNotificationCount(prev => prev + 1);
        toast.success('🔄 Data refreshed via keyboard shortcut!');
      }
      
      // Escape to close mobile menu
      if (e.key === 'Escape') {
        setShowMobileMenu(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [tabs]);

  // Show keyboard shortcuts help
  const showKeyboardHelp = () => {
    toast.info(
      '⌨️ Keyboard Shortcuts:\n' +
      'Alt + 1-8: Switch tabs\n' +
      'Ctrl + R: Refresh data\n' +
      'Esc: Close menus\n' +
      'Arrow keys: Navigate tabs'
    );
  };

  // Updated formatCurrency for UGX
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

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Supplier verification functions
  const handleSupplierApproval = (supplierId, action) => {
    setPendingSuppliers(prev => 
      prev.map(supplier => 
        supplier.id === supplierId 
          ? { ...supplier, status: action }
          : supplier
      )
    );
    
    // Show notification
    const supplier = pendingSuppliers.find(s => s.id === supplierId);
    const message = action === 'approved' 
      ? `✅ ${supplier.name} has been approved as a supplier`
      : `❌ ${supplier.name} has been rejected`;
    
    alert(message);
  };

  // Report access management functions
  const handleReportAccessApproval = (userId, action) => {
    // Update report access status
    const user = reportAccess.find(u => u.id === userId);
    const message = action === 'approved' 
      ? `✅ Report access granted to ${user.user}`
      : `❌ Report access denied for ${user.user}`;
    
    alert(message);
  };

  // Order verification functions
  const handleOrderApproval = (orderId, action) => {
    setPendingOrders(prev => 
      prev.map(order => 
        order.id === orderId 
          ? { ...order, status: action === 'approved' ? 'approved' : 'rejected' }
          : order
      )
    );
    
    const order = pendingOrders.find(o => o.id === orderId);
    const message = action === 'approved' 
      ? `✅ Order ${order.orderNumber} has been approved`
      : `❌ Order ${order.orderNumber} has been rejected`;
    
    alert(message);
  };

  // Inventory access functions
  const handleInventoryAction = (action, itemId = null) => {
    switch(action) {
      case 'refresh':
        setInventoryStats(prev => ({
          ...prev,
          lastUpdated: new Date().toLocaleString()
        }));
        alert('📊 Inventory data refreshed successfully');
        break;
      case 'low_stock_alert':
        alert('⚠️ Low stock alert sent to purchasing team');
        break;
      case 'generate_report':
        alert('📋 Inventory report generated and downloaded');
        break;
      case 'stock_adjustment':
        alert('📝 Stock adjustment form opened');
        break;
      default:
        break;
    }
  };

  // Edit modal functions
  const openEditModal = (type, data = null, mode = 'edit') => {
    setEditModal({
      isOpen: true,
      type,
      data,
      mode
    });
  };

  const closeEditModal = () => {
    setEditModal({
      isOpen: false,
      type: '',
      data: null,
      mode: 'edit'
    });
  };

  const handleSaveEdit = (formData) => {
    // Handle saving based on type
    switch (editModal.type) {
      case 'team':
        console.log('Saving team member:', formData);
        break;
      case 'supplier':
        console.log('Saving supplier:', formData);
        break;
      case 'schedule':
        console.log('Saving schedule:', formData);
        break;
      case 'training':
        console.log('Saving training:', formData);
        break;
      case 'permissions':
        console.log('Saving permissions:', formData);
        break;
      default:
        break;
    }
    
    // Show success message
    alert(`✅ ${editModal.type.charAt(0).toUpperCase() + editModal.type.slice(1)} ${editModal.mode === 'add' ? 'added' : 'updated'} successfully!`);
    closeEditModal();
  };

  // Order Verification Helper Functions
  const handleBulkApproval = (action) => {
    const selectedOrderDetails = pendingOrders.filter(o => selectedOrders.includes(o.id));
    const message = action === 'approve' 
      ? `✅ ${selectedOrders.length} orders approved successfully`
      : `❌ ${selectedOrders.length} orders rejected`;
    
    // Simulate API call
    setTimeout(() => {
      toast.success(message);
      setSelectedOrders([]);
      setBulkAction('');
    }, 1000);
  };

  const handleOrderSelect = (orderId) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];

  // Edit Modal Component
  const renderEditModal = () => {
    if (!editModal.isOpen) return null;

    const renderTeamEditForm = () => (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              defaultValue={editModal.data?.name || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              defaultValue={editModal.data?.role || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Role</option>
              <option value="Cashier">Cashier</option>
              <option value="Stock Keeper">Stock Keeper</option>
              <option value="Assistant Manager">Assistant Manager</option>
              <option value="Manager">Manager</option>
            </select>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select
              defaultValue={editModal.data?.department || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Department</option>
              <option value="Frontend">Frontend</option>
              <option value="Backend">Backend</option>
              <option value="Management">Management</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Join Date</label>
            <input
              type="date"
              defaultValue={editModal.data?.joinDate || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Skills</label>
          <input
            type="text"
            defaultValue={editModal.data?.skills?.join(', ') || ''}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter skills separated by commas"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Goals</label>
          <textarea
            defaultValue={editModal.data?.goals?.join('\n') || ''}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter goals (one per line)"
          />
        </div>
      </div>
    );

    const renderSupplierEditForm = () => (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
            <input
              type="text"
              defaultValue={editModal.data?.name || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter company name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
            <input
              type="text"
              defaultValue={editModal.data?.contactPerson || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter contact person name"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              defaultValue={editModal.data?.email || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter email address"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              defaultValue={editModal.data?.phone || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter phone number"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input
            type="text"
            defaultValue={editModal.data?.address || ''}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter address"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
            <select
              defaultValue={editModal.data?.businessType || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Business Type</option>
              <option value="Electronics">Electronics</option>
              <option value="Food & Beverages">Food & Beverages</option>
              <option value="Office Supplies">Office Supplies</option>
              <option value="Clothing">Clothing</option>
              <option value="Home & Garden">Home & Garden</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              defaultValue={editModal.data?.status || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            defaultValue={editModal.data?.notes || ''}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter additional notes"
          />
        </div>
      </div>
    );

    const renderTrainingEditForm = () => (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Training Title</label>
          <input
            type="text"
            defaultValue={editModal.data?.title || ''}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter training title"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              defaultValue={editModal.data?.category || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Category</option>
              <option value="Technical">Technical</option>
              <option value="Soft Skills">Soft Skills</option>
              <option value="Operations">Operations</option>
              <option value="Management">Management</option>
              <option value="Compliance">Compliance</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
            <input
              type="text"
              defaultValue={editModal.data?.duration || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., 4 hours"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            defaultValue={editModal.data?.status || ''}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="active">Active</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter training description"
          />
        </div>
      </div>
    );

    const renderScheduleEditForm = () => (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="">Select Day</option>
              <option value="Monday">Monday</option>
              <option value="Tuesday">Tuesday</option>
              <option value="Wednesday">Wednesday</option>
              <option value="Thursday">Thursday</option>
              <option value="Friday">Friday</option>
              <option value="Saturday">Saturday</option>
              <option value="Sunday">Sunday</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shift Time</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="">Select Shift</option>
              <option value="8AM-4PM">Morning Shift (8AM-4PM)</option>
              <option value="4PM-12AM">Evening Shift (4PM-12AM)</option>
              <option value="12AM-8AM">Night Shift (12AM-8AM)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Members</label>
          <div className="space-y-2">
            {teamPerformance.map((member) => (
              <label key={member.id} className="flex items-center space-x-2">
                <input type="checkbox" className="rounded border-gray-300" />
                <span className="text-sm text-gray-700">{member.name} ({member.role})</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Coverage Status</label>
          <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option value="Full">Full Coverage</option>
            <option value="Partial">Partial Coverage</option>
            <option value="Understaffed">Understaffed</option>
          </select>
        </div>
      </div>
    );

    const renderPermissionsEditForm = () => (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
          <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option value="">Select User</option>
            {teamPerformance.map((member) => (
              <option key={member.id} value={member.name}>{member.name} ({member.role})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Report Access Permissions</label>
          <div className="space-y-2">
            {['Sales Reports', 'Customer Reports', 'Financial Reports', 'Inventory Reports', 'Stock Reports', 'Performance Reports'].map((report) => (
              <label key={report} className="flex items-center space-x-2">
                <input type="checkbox" className="rounded border-gray-300" />
                <span className="text-sm text-gray-700">{report}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Access Level</label>
          <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option value="read">Read Only</option>
            <option value="write">Read & Write</option>
            <option value="admin">Full Admin Access</option>
          </select>
        </div>
      </div>
    );

    const getFormContent = () => {
      switch (editModal.type) {
        case 'team':
          return renderTeamEditForm();
        case 'supplier':
          return renderSupplierEditForm();
        case 'training':
          return renderTrainingEditForm();
        case 'schedule':
          return renderScheduleEditForm();
        case 'permissions':
          return renderPermissionsEditForm();
        default:
          return null;
      }
    };

    const getModalTitle = () => {
      const action = editModal.mode === 'add' ? 'Add' : 'Edit';
      const type = editModal.type.charAt(0).toUpperCase() + editModal.type.slice(1);
      return `${action} ${type}`;
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{getModalTitle()}</h2>
            <button
              onClick={closeEditModal}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <FiXCircle className="h-6 w-6" />
            </button>
          </div>
          
          <div className="mb-6">
            {getFormContent()}
          </div>
          
          <div className="flex items-center justify-end space-x-3">
            <button
              onClick={closeEditModal}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSaveEdit({})}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {editModal.mode === 'add' ? 'Add' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderOverview = () => (
    <div className="space-y-6 animate-fadeInUp">
      {/* Enhanced Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-xl p-8 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-3">
              <div className="text-4xl">👋</div>
              <div>
                <h1 className="text-4xl font-bold mb-1">
                  {getGreeting()}, {managerProfile.name}!
                </h1>
                <p className="text-blue-100 text-lg">
                  Welcome to your business command center
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-white bg-opacity-20 rounded-lg p-4 backdrop-blur-sm">
                <div className="flex items-center space-x-2">
                  <FiClock className="h-5 w-5" />
                  <div>
                    <p className="text-sm text-blue-100">Current Time</p>
                    <p className="font-semibold">{currentTime.toLocaleTimeString()}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white bg-opacity-20 rounded-lg p-4 backdrop-blur-sm">
                <div className="flex items-center space-x-2">
                  <FiCalendar className="h-5 w-5" />
                  <div>
                    <p className="text-sm text-blue-100">Today's Date</p>
                    <p className="font-semibold">{currentTime.toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white bg-opacity-20 rounded-lg p-4 backdrop-blur-sm">
                <div className="flex items-center space-x-2">
                  <FiTrendingUp className="h-5 w-5" />
                  <div>
                    <p className="text-sm text-blue-100">Today's Performance</p>
                    <p className="font-semibold">+{businessMetrics.weeklyGrowth}% vs last week</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="text-right ml-8">
            <div className="text-6xl mb-2">🚀</div>
            <p className="text-blue-100 text-lg font-medium">Business is booming!</p>
            <div className="mt-4 flex space-x-2">
              <button className="bg-white bg-opacity-20 px-4 py-2 rounded-lg hover:bg-opacity-30 transition-all duration-300 flex items-center space-x-2">
                <FiRefreshCw className="h-4 w-4" />
                <span>Refresh Data</span>
              </button>
              <button className="bg-white bg-opacity-20 px-4 py-2 rounded-lg hover:bg-opacity-30 transition-all duration-300 flex items-center space-x-2">
                <FiDownload className="h-4 w-4" />
                <span>Export Report</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { 
            title: 'Today\'s Revenue', 
            value: formatCurrency(businessMetrics.todayRevenue), 
            icon: FiDollarSign, 
            color: 'from-green-500 to-green-600', 
            change: `+${businessMetrics.weeklyGrowth}%`,
            subtitle: `vs ${formatCurrency(businessMetrics.totalRevenue)} total`
          },
          { 
            title: 'Today\'s Orders', 
            value: businessMetrics.todayOrders, 
            icon: FiPackage, 
            color: 'from-blue-500 to-blue-600', 
            change: `+${businessMetrics.monthlyGrowth}%`,
            subtitle: `vs ${businessMetrics.totalOrders} total`
          },
          { 
            title: 'Active Customers', 
            value: businessMetrics.todayCustomers, 
            icon: FiUsers, 
            color: 'from-purple-500 to-purple-600', 
            change: '+15.2%',
            subtitle: `vs ${businessMetrics.activeCustomers} total`
          },
          { 
            title: 'Conversion Rate', 
            value: `${businessMetrics.conversionRate}%`, 
            icon: FiTarget, 
            color: 'from-orange-500 to-orange-600', 
            change: '+3.2%',
            subtitle: 'Customer conversion'
          }
        ].map((metric, index) => (
          <div key={index} className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 border-l-4 border-transparent hover:border-blue-500">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-gray-600 text-sm font-medium">{metric.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{metric.value}</p>
                <p className="text-green-600 text-sm font-medium mt-1 flex items-center">
                  <FiTrendingUp className="h-3 w-3 mr-1" />
                  {metric.change}
                </p>
                <p className="text-gray-500 text-xs mt-1">{metric.subtitle}</p>
              </div>
              <div className={`p-4 rounded-xl bg-gradient-to-r ${metric.color} shadow-lg`}>
                <metric.icon className="h-8 w-8 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Real-time Activity Feed */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
            <FiBell className="h-6 w-6 text-blue-600" />
            <span>Real-time Activity</span>
          </h3>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">Live Updates</span>
          </div>
        </div>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {realTimeActivity.map((activity) => (
            <div key={activity.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all duration-300">
              <div className="text-2xl">{activity.icon}</div>
              <div className="flex-1">
                <p className="text-gray-900 font-medium">{activity.message}</p>
                <p className="text-sm text-gray-500">{activity.time}</p>
              </div>
              {activity.amount && (
                <div className="text-right">
                  <p className="font-semibold text-green-600">{formatCurrency(activity.amount)}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Enhanced Revenue Chart with Multiple Metrics */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Revenue & Performance Trends</h3>
          <div className="flex space-x-2">
            {['7d', '30d', '90d'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  timeRange === range
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" stroke="#666" />
            <YAxis yAxisId="left" stroke="#666" />
            <YAxis yAxisId="right" orientation="right" stroke="#666" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #e5e7eb', 
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }} 
            />
            <Area yAxisId="left" type="monotone" dataKey="revenue" fill="#3B82F6" fillOpacity={0.3} stroke="#3B82F6" strokeWidth={2} />
            <Line yAxisId="left" type="monotone" dataKey="orders" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }} />
            <Bar yAxisId="right" dataKey="profit" fill="#F59E0B" radius={[4, 4, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Top Performing Products */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Top Performing Products</h3>
          <button className="text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1">
            <span>View All</span>
            <FiChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">
          {topProducts.map((product, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all duration-300">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold">
                  {index + 1}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{product.name}</h4>
                  <p className="text-sm text-gray-600">{product.category}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">{product.sales} sales</p>
                <p className="text-sm text-gray-600">{formatCurrency(product.revenue)}</p>
              </div>
              <div className="text-right">
                <span className="px-2 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                  {product.growth}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Performance Indicators</h3>
          <div className="space-y-4">
            {performanceIndicators.map((indicator, index) => {
              const progress = (indicator.current / indicator.target) * 100;
              const colorClasses = {
                blue: 'from-blue-500 to-blue-600',
                green: 'from-green-500 to-green-600',
                purple: 'from-purple-500 to-purple-600',
                orange: 'from-orange-500 to-orange-600'
              };
              
              return (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">{indicator.name}</span>
                    <span className="text-sm text-gray-600">
                      {indicator.unit === 'USD' ? formatCurrency(indicator.current) : 
                       indicator.unit === 'stars' ? `${indicator.current}/5` :
                       `${indicator.current}${indicator.unit}`}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className={`bg-gradient-to-r ${colorClasses[indicator.color]} h-3 rounded-full transition-all duration-500`}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Target: {indicator.unit === 'USD' ? formatCurrency(indicator.target) : 
                              indicator.unit === 'stars' ? `${indicator.target}/5` :
                              `${indicator.target}${indicator.unit}`}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Strategic Goals */}
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Strategic Goals Progress</h3>
          <div className="space-y-4">
            {strategicGoals.map((goal) => (
              <div key={goal.id} className="border rounded-lg p-4 hover:shadow-md transition-all duration-300">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">{goal.title}</h4>
                  <span className="text-sm text-gray-500">{goal.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${goal.progress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Target: {typeof goal.target === 'number' && goal.target > 1000 ? formatCurrency(goal.target) : goal.target}</span>
                  <span>Current: {typeof goal.current === 'number' && goal.current > 1000 ? formatCurrency(goal.current) : goal.current}</span>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Deadline: {goal.deadline}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { title: 'Add Team Member', icon: FiUsers, color: 'bg-blue-600 hover:bg-blue-700', action: () => openEditModal('team', null, 'add') },
            { title: 'Approve Supplier', icon: FiCheckCircle, color: 'bg-green-600 hover:bg-green-700', action: () => setActiveTab('suppliers') },
            { title: 'Verify Orders', icon: FiTruck, color: 'bg-orange-600 hover:bg-orange-700', action: () => setActiveTab('orders') },
            { title: 'Inventory Access', icon: FiPackage, color: 'bg-purple-600 hover:bg-purple-700', action: () => setShowInventoryModal(true) },
            { title: 'View Reports', icon: FiBarChart, color: 'bg-indigo-600 hover:bg-indigo-700', action: () => setActiveTab('analytics') },
            { title: 'Manage Schedule', icon: FiCalendar, color: 'bg-pink-600 hover:bg-pink-700', action: () => setActiveTab('team') }
          ].map((action, index) => (
            <button
              key={index}
              onClick={action.action}
              className={`${action.color} text-white p-4 rounded-lg transition-all duration-300 transform hover:scale-105 flex flex-col items-center space-y-2`}
            >
              <action.icon className="h-6 w-6" />
              <span className="text-sm font-medium">{action.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6 animate-fadeInUp">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Performance */}
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Team Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={teamPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="sales" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Customer Satisfaction */}
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Customer Satisfaction</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Excellent (5⭐)', value: 45 },
                  { name: 'Good (4⭐)', value: 35 },
                  { name: 'Average (3⭐)', value: 15 },
                  { name: 'Poor (2⭐)', value: 5 }
                ]}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {[0, 1, 2, 3].map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Inventory Insights */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Inventory Insights</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Low Stock', value: inventoryInsights.lowStock, color: 'text-red-600', icon: '⚠️' },
            { label: 'Out of Stock', value: inventoryInsights.outOfStock, color: 'text-red-800', icon: '🚫' },
            { label: 'Overstock', value: inventoryInsights.overstock, color: 'text-yellow-600', icon: '📦' },
            { label: 'Fast Moving', value: inventoryInsights.fastMoving, color: 'text-green-600', icon: '🚀' },
            { label: 'Slow Moving', value: inventoryInsights.slowMoving, color: 'text-orange-600', icon: '🐌' },
            { label: 'Total Products', value: inventoryInsights.totalProducts, color: 'text-blue-600', icon: '📊' }
          ].map((item, index) => (
            <div key={index} className="text-center p-4 border rounded-lg hover:shadow-md transition-all duration-300">
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
              <div className="text-sm text-gray-600">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTeamManagement = () => (
    <div className="space-y-6 animate-fadeInUp">
      {/* Team Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Total Team Members', value: teamAnalytics.totalMembers, icon: FiUsers, color: 'from-blue-500 to-blue-600', change: '+2 this month' },
          { title: 'Average Efficiency', value: `${teamAnalytics.averageEfficiency}%`, icon: FiTarget, color: 'from-green-500 to-green-600', change: '+5.2%' },
          { title: 'Average Satisfaction', value: teamAnalytics.averageSatisfaction, icon: FiStar, color: 'from-yellow-500 to-yellow-600', change: '+0.3' },
          { title: 'Top Performer', value: teamAnalytics.topPerformer, icon: FiAward, color: 'from-purple-500 to-purple-600', change: 'This month' }
        ].map((metric, index) => (
          <div key={index} className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">{metric.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
                <p className="text-green-600 text-sm font-medium mt-1">{metric.change}</p>
              </div>
              <div className={`p-3 rounded-lg bg-gradient-to-r ${metric.color}`}>
                <metric.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Department Performance Chart */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Department Performance</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={teamAnalytics.departmentBreakdown}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="department" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="efficiency" fill="#3B82F6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Enhanced Team Performance Table */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Team Performance Dashboard</h3>
          <div className="flex space-x-3">
            <button 
              onClick={() => openEditModal('team', null, 'add')}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all duration-300 flex items-center space-x-2"
            >
              <FiPlus className="h-4 w-4" />
              <span>Add Member</span>
            </button>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-300 flex items-center space-x-2">
              <FiDownload className="h-4 w-4" />
              <span>Export Report</span>
            </button>
          </div>
        </div>
        
        <div className="space-y-4">
          {teamPerformance.map((member) => (
            <div key={member.id} className="border rounded-lg p-6 hover:shadow-md transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className="text-4xl">{member.avatar}</div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">{member.name}</h4>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {member.role}
                      </span>
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                        {member.department}
                      </span>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        member.performance.trend === 'up' ? 'bg-green-100 text-green-800' :
                        member.performance.trend === 'down' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {member.performance.change}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Joined: {member.joinDate}</p>
                  <p className="text-sm text-gray-600">Status: <span className="text-green-600 font-medium">Active</span></p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                {/* Performance Metrics */}
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Performance Metrics</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Sales</span>
                      <span className="font-medium">{formatCurrency(member.sales)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Efficiency</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${member.efficiency}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{member.efficiency}%</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Satisfaction</span>
                      <div className="flex items-center space-x-1">
                        <FiStar className="h-4 w-4 text-yellow-500" />
                        <span className="font-medium">{member.satisfaction}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Skills & Training */}
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Skills & Training</h5>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {member.skills.slice(0, 2).map((skill, index) => (
                        <span key={index} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                          {skill}
                        </span>
                      ))}
                      {member.skills.length > 2 && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">
                          +{member.skills.length - 2} more
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      Training: {member.training.completed} completed, {member.training.inProgress} in progress
                    </div>
                  </div>
                </div>

                {/* Schedule & Goals */}
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Schedule & Goals</h5>
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">
                      <strong>Current:</strong> {member.schedule.current}
                    </div>
                    <div className="text-sm text-gray-600">
                      <strong>Next:</strong> {member.schedule.next}
                    </div>
                    <div className="text-sm text-gray-600">
                      <strong>Goals:</strong> {member.goals.length} active
                    </div>
                  </div>
                </div>
              </div>

              {/* Achievements */}
              <div className="mb-4">
                <h5 className="font-medium text-gray-900 mb-2">Recent Achievements</h5>
                <div className="flex flex-wrap gap-2">
                  {member.achievements.map((achievement, index) => (
                    <span key={index} className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-full flex items-center space-x-1">
                      <FiAward className="h-3 w-3" />
                      <span>{achievement}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3">
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-300 flex items-center space-x-2">
                  <FiEye className="h-4 w-4" />
                  <span>View Details</span>
                </button>
                <button 
                  onClick={() => openEditModal('team', member, 'edit')}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all duration-300 flex items-center space-x-2"
                >
                  <FiEdit className="h-4 w-4" />
                  <span>Edit Profile</span>
                </button>
                <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-all duration-300 flex items-center space-x-2">
                  <FiMessageCircle className="h-4 w-4" />
                  <span>Send Message</span>
                </button>
                <button className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-all duration-300 flex items-center space-x-2">
                  <FiCalendar className="h-4 w-4" />
                  <span>Schedule</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Training Modules */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Training & Development</h3>
            <button 
              onClick={() => openEditModal('training', null, 'add')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-300 flex items-center space-x-2"
            >
              <FiPlus className="h-4 w-4" />
              <span>Add Training Module</span>
            </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trainingModules.map((module) => (
            <div key={module.id} className="border rounded-lg p-4 hover:shadow-md transition-all duration-300">
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-semibold text-gray-900">{module.title}</h4>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  module.status === 'active' ? 'bg-green-100 text-green-800' :
                  module.status === 'upcoming' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {module.status}
                </span>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <p><strong>Category:</strong> {module.category}</p>
                <p><strong>Duration:</strong> {module.duration}</p>
                <p><strong>Enrolled:</strong> {module.enrolled} members</p>
              </div>
              <div className="mt-3 flex space-x-2">
                <button className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-all duration-300 text-sm">
                  View Details
                </button>
                <button 
                  onClick={() => openEditModal('training', module, 'edit')}
                  className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-all duration-300 text-sm"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Schedule */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Weekly Schedule</h3>
          <button 
            onClick={() => openEditModal('schedule', null, 'edit')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-300 flex items-center space-x-2"
          >
            <FiCalendar className="h-4 w-4" />
            <span>Edit Schedule</span>
          </button>
        </div>
        
        <div className="space-y-4">
          {scheduleData.map((day, index) => (
            <div key={index} className="border rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">{day.day}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {day.shifts.map((shift, shiftIndex) => (
                  <div key={shiftIndex} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{shift.time}</span>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        shift.coverage === 'Full' ? 'bg-green-100 text-green-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {shift.coverage} Coverage
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <strong>Assigned:</strong> {shift.members.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAlerts = () => (
    <div className="space-y-6 animate-fadeInUp">
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Recent Alerts & Notifications</h3>
        <div className="space-y-4">
          {recentAlerts.map((alert) => (
            <div key={alert.id} className={`border-l-4 p-4 rounded-lg ${
              alert.type === 'critical' ? 'border-red-500 bg-red-50' :
              alert.type === 'warning' ? 'border-yellow-500 bg-yellow-50' :
              'border-blue-500 bg-blue-50'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">{alert.title}</h4>
                  <p className="text-gray-600">{alert.message}</p>
                  <p className="text-sm text-gray-500 mt-1">{alert.timestamp}</p>
                </div>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-300">
                  {alert.action}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSupplierVerification = () => (
    <div className="space-y-6 animate-fadeInUp">
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Supplier Verification</h3>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {pendingSuppliers.filter(s => s.status === 'pending').length} Pending Approval
            </span>
            <button 
              onClick={() => openEditModal('supplier', null, 'add')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-300 flex items-center space-x-2"
            >
              <FiPlus className="h-4 w-4" />
              <span>Add New Supplier</span>
            </button>
          </div>
        </div>
        
        <div className="space-y-6">
          {pendingSuppliers.map((supplier) => (
            <div key={supplier.id} className="border rounded-lg p-6 hover:shadow-md transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h4 className="text-lg font-semibold text-gray-900">{supplier.name}</h4>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      supplier.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      supplier.status === 'approved' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {supplier.status.charAt(0).toUpperCase() + supplier.status.slice(1)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>
                      <p><strong>Contact:</strong> {supplier.contactPerson}</p>
                      <p><strong>Email:</strong> {supplier.email}</p>
                      <p><strong>Phone:</strong> {supplier.phone}</p>
                    </div>
                    <div>
                      <p><strong>Business Type:</strong> {supplier.businessType}</p>
                      <p><strong>Address:</strong> {supplier.address}</p>
                      <p><strong>Registration Date:</strong> {supplier.registrationDate}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-sm text-gray-600"><strong>Notes:</strong> {supplier.notes}</p>
                  </div>
                </div>
              </div>
              
              <div className="mb-4">
                <h5 className="font-medium text-gray-900 mb-2">Required Documents:</h5>
                <div className="flex flex-wrap gap-2">
                  {supplier.documents.map((doc, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full flex items-center space-x-1">
                      <FiCheckCircle className="h-3 w-3" />
                      <span>{doc}</span>
                    </span>
                  ))}
                </div>
              </div>
              
              {supplier.status === 'pending' && (
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={() => handleSupplierApproval(supplier.id, 'approved')}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all duration-300 flex items-center space-x-2"
                  >
                    <FiCheckCircle className="h-4 w-4" />
                    <span>Approve</span>
                  </button>
                  <button 
                    onClick={() => handleSupplierApproval(supplier.id, 'rejected')}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-all duration-300 flex items-center space-x-2"
                  >
                    <FiXCircle className="h-4 w-4" />
                    <span>Reject</span>
                  </button>
                  <button 
                    onClick={() => openEditModal('supplier', supplier, 'edit')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-300 flex items-center space-x-2"
                  >
                    <FiEdit className="h-4 w-4" />
                    <span>Edit Supplier</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderReportAccess = () => (
    <div className="space-y-6 animate-fadeInUp">
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Report Access Management</h3>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {reportAccess.filter(r => r.status === 'pending').length} Pending Requests
            </span>
            <button 
              onClick={() => openEditModal('permissions', null, 'add')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-300 flex items-center space-x-2"
            >
              <FiSettings className="h-4 w-4" />
              <span>Access Settings</span>
            </button>
          </div>
        </div>
        
        <div className="space-y-6">
          {reportAccess.map((request) => (
            <div key={request.id} className="border rounded-lg p-6 hover:shadow-md transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h4 className="text-lg font-semibold text-gray-900">{request.user}</h4>
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {request.role}
                    </span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      request.status === 'approved' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">Request Date: {request.requestDate}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Current Access:</h5>
                  <div className="space-y-1">
                    {request.currentAccess.map((access, index) => (
                      <div key={index} className="flex items-center space-x-2 text-sm text-green-600">
                        <FiCheckCircle className="h-3 w-3" />
                        <span>{access}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Requested Access:</h5>
                  <div className="space-y-1">
                    {request.requestedAccess.map((access, index) => (
                      <div key={index} className="flex items-center space-x-2 text-sm text-blue-600">
                        <FiPlus className="h-3 w-3" />
                        <span>{access}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {request.status === 'pending' && (
                <div className="flex items-center space-x-3 mt-4">
                  <button 
                    onClick={() => handleReportAccessApproval(request.id, 'approved')}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all duration-300 flex items-center space-x-2"
                  >
                    <FiCheckCircle className="h-4 w-4" />
                    <span>Grant Access</span>
                  </button>
                  <button 
                    onClick={() => handleReportAccessApproval(request.id, 'denied')}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-all duration-300 flex items-center space-x-2"
                  >
                    <FiXCircle className="h-4 w-4" />
                    <span>Deny Access</span>
                  </button>
                  <button 
                    onClick={() => openEditModal('permissions', request, 'edit')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-300 flex items-center space-x-2"
                  >
                    <FiEdit className="h-4 w-4" />
                    <span>Edit Access</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderOrderVerification = () => {
    // Simple enhanced order data for Uganda context
    const enhancedOrders = pendingOrders.map(order => ({
      ...order,
      deliveryWindow: '8:00 AM - 6:00 PM',
      contactPerson: 'Supplier Contact',
      contactPhone: '+256-700-123456',
      paymentTerms: 'Cash on Delivery',
      vatRate: 18, // Uganda VAT
      tax: order.totalValue * 0.18,
      location: 'Kampala, Uganda',
      currency: 'UGX',
      approvalStatus: order.status === 'pending_verification' ? 'Pending Manager Approval' : order.status
    }));

    const filteredOrders = enhancedOrders.filter(order => {
      const matchesFilter = orderFilter === 'all' || order.status === orderFilter;
      const matchesSupplier = !selectedSupplier || order.supplierName === selectedSupplier;
      const matchesSearch = !searchTerm || 
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFilter && matchesSupplier && matchesSearch;
    });

    const orderStats = {
      total: enhancedOrders.length,
      pending: enhancedOrders.filter(o => o.status === 'pending_verification').length,
      approved: enhancedOrders.filter(o => o.status === 'approved').length,
      totalValue: enhancedOrders.reduce((sum, o) => sum + o.totalValue, 0)
    };

    const suppliers = [...new Set(enhancedOrders.map(o => o.supplierName))];

    // Print functionality
    const handlePrintOrder = (order) => {
      const printContent = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
          <h1 style="text-align: center; color: #2563eb;">📋 Supplier Order Verification</h1>
          <h2 style="text-align: center;">FAREDEAL Uganda</h2>
          <hr style="margin: 20px 0;">
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
            <div>
              <h3>📦 Order Information</h3>
              <p><strong>Order Number:</strong> ${order.orderNumber}</p>
              <p><strong>Supplier:</strong> ${order.supplierName}</p>
              <p><strong>Order Date:</strong> ${order.orderDate}</p>
              <p><strong>Expected Delivery:</strong> ${order.expectedDelivery}</p>
              <p><strong>Status:</strong> ${order.approvalStatus}</p>
            </div>
            <div>
              <h3>💰 Financial Details</h3>
              <p><strong>Subtotal:</strong> ${formatCurrency(order.totalValue - order.tax)}</p>
              <p><strong>VAT (18%):</strong> ${formatCurrency(order.tax)}</p>
              <p><strong>Total Amount:</strong> ${formatCurrency(order.totalValue)}</p>
              <p><strong>Payment Terms:</strong> ${order.paymentTerms}</p>
            </div>
          </div>
          
          <h3>📋 Order Items</h3>
          <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left;">Item</th>
                <th style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">Quantity</th>
                <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right;">Unit Price</th>
                <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map(item => `
                <tr>
                  <td style="border: 1px solid #d1d5db; padding: 8px;">${item.name}</td>
                  <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">${item.quantity}</td>
                  <td style="border: 1px solid #d1d5db; padding: 8px; text-align: right;">${formatCurrency(item.unitPrice)}</td>
                  <td style="border: 1px solid #d1d5db; padding: 8px; text-align: right;">${formatCurrency(item.total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div style="margin-top: 30px;">
            <p><strong>Requested By:</strong> ${order.requestedBy}</p>
            <p><strong>Department:</strong> ${order.department}</p>
            <p><strong>Contact:</strong> ${order.contactPhone}</p>
            <p><strong>Notes:</strong> ${order.notes}</p>
          </div>
          
          <div style="margin-top: 40px; text-align: center;">
            <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            <p style="font-size: 12px; color: #666;">FAREDEAL Uganda - Manager Portal</p>
          </div>
        </div>
      `;

      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Order ${order.orderNumber} - FAREDEAL</title>
            <style>
              body { margin: 0; padding: 20px; }
              @media print {
                body { margin: 0; }
              }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
      toast.success(`🖨️ Order ${order.orderNumber} sent to printer`);
    };

    // Email functionality
    const handleEmailOrder = (order) => {
      const emailSubject = `Supplier Order Verification - ${order.orderNumber}`;
      const emailBody = `
Dear Team,

Please find below the details for supplier order verification:

ORDER INFORMATION:
- Order Number: ${order.orderNumber}
- Supplier: ${order.supplierName}
- Order Date: ${order.orderDate}
- Expected Delivery: ${order.expectedDelivery}
- Total Amount: ${formatCurrency(order.totalValue)}

ITEMS ORDERED:
${order.items.map(item => `- ${item.name} (Qty: ${item.quantity}) - ${formatCurrency(item.total)}`).join('\n')}

CONTACT DETAILS:
- Requested By: ${order.requestedBy}
- Department: ${order.department}
- Contact: ${order.contactPhone}

Notes: ${order.notes}

Best regards,
FAREDEAL Uganda Management Team
      `;

      const mailtoLink = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
      window.open(mailtoLink);
      toast.success(`📧 Email drafted for order ${order.orderNumber}`);
    };

    const SimpleOrderCard = ({ order }) => (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-all duration-300">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={selectedOrders.includes(order.id)}
              onChange={() => handleOrderSelect(order.id)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <h3 className="text-lg font-bold text-gray-900">{order.orderNumber}</h3>
              <p className="text-sm text-gray-600">🏢 {order.supplierName}</p>
            </div>
          </div>
          
          <span className={`px-3 py-1 text-xs font-bold rounded-full ${
            order.status === 'pending_verification' ? 'bg-yellow-100 text-yellow-800' :
            order.status === 'approved' ? 'bg-green-100 text-green-800' :
            'bg-red-100 text-red-800'
          }`}>
            {order.approvalStatus}
          </span>
        </div>

        {/* Key Info */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <span className="text-gray-600">📅 Order Date:</span>
            <div className="font-medium">{order.orderDate}</div>
          </div>
          <div>
            <span className="text-gray-600">🚚 Expected Delivery:</span>
            <div className="font-medium">{order.expectedDelivery}</div>
          </div>
          <div>
            <span className="text-gray-600">👤 Requested By:</span>
            <div className="font-medium">{order.requestedBy}</div>
          </div>
          <div>
            <span className="text-gray-600">🏢 Department:</span>
            <div className="font-medium">{order.department}</div>
          </div>
        </div>

        {/* Amount */}
        <div className="bg-green-50 rounded-lg p-3 mb-4">
          <div className="text-sm text-green-600">Total Order Value</div>
          <div className="text-xl font-bold text-green-800">{formatCurrency(order.totalValue)}</div>
          <div className="text-xs text-green-600">Including 18% VAT: {formatCurrency(order.tax)}</div>
        </div>

        {/* Items Summary */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <div className="text-sm font-medium text-gray-700 mb-2">📦 Items ({order.items.length})</div>
          {order.items.slice(0, 2).map((item, index) => (
            <div key={index} className="flex justify-between text-xs text-gray-600">
              <span>{item.name} × {item.quantity}</span>
              <span>{formatCurrency(item.total)}</span>
            </div>
          ))}
          {order.items.length > 2 && (
            <div className="text-xs text-blue-600 mt-1">+{order.items.length - 2} more items...</div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {/* Print and Email Row */}
          <div className="flex space-x-2">
            <button
              onClick={() => handlePrintOrder(order)}
              className="flex-1 bg-gray-600 text-white py-2 px-3 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center space-x-2"
            >
              <FiPrinter className="h-4 w-4" />
              <span>Print</span>
            </button>
            <button
              onClick={() => handleEmailOrder(order)}
              className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
            >
              <FiMail className="h-4 w-4" />
              <span>Email</span>
            </button>
          </div>

          {/* Approval Actions */}
          {order.status === 'pending_verification' && (
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  handleOrderApproval(order.id, 'approved');
                  toast.success(`✅ Order ${order.orderNumber} approved!`);
                }}
                className="flex-1 bg-green-600 text-white py-2 px-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
              >
                <FiCheckCircle className="h-4 w-4" />
                <span>Approve</span>
              </button>
              <button
                onClick={() => {
                  handleOrderApproval(order.id, 'rejected');
                  toast.error(`❌ Order ${order.orderNumber} rejected`);
                }}
                className="flex-1 bg-red-600 text-white py-2 px-3 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center space-x-2"
              >
                <FiXCircle className="h-4 w-4" />
                <span>Reject</span>
              </button>
            </div>
          )}

          {/* View Details */}
          <button
            onClick={() => setShowOrderDetails(order)}
            className="w-full bg-purple-600 text-white py-2 px-3 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center space-x-2"
          >
            <FiEye className="h-4 w-4" />
            <span>View Details</span>
          </button>
        </div>
      </div>
    );

    return (
      <div className="space-y-6 animate-fadeInUp">
        {/* Simple Header for Uganda */}
        <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-xl p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">🇺🇬 Supplier Order Verification</h2>
              <p className="text-green-100">FAREDEAL Uganda - Manager Portal</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{orderStats.pending}</div>
              <div className="text-green-200 text-sm">Orders Pending</div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-white/20 rounded-lg p-4 text-center">
              <div className="text-2xl mb-1">📋</div>
              <div className="text-lg font-bold">{orderStats.total}</div>
              <div className="text-xs text-white/80">Total Orders</div>
            </div>
            <div className="bg-white/20 rounded-lg p-4 text-center">
              <div className="text-2xl mb-1">✅</div>
              <div className="text-lg font-bold">{orderStats.approved}</div>
              <div className="text-xs text-white/80">Approved</div>
            </div>
            <div className="bg-white/20 rounded-lg p-4 text-center">
              <div className="text-2xl mb-1">💰</div>
              <div className="text-lg font-bold">{formatCurrency(orderStats.totalValue)}</div>
              <div className="text-xs text-white/80">Total Value</div>
            </div>
          </div>
        </div>

        {/* Simple Filters */}
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="🔍 Search orders or suppliers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={orderFilter}
              onChange={(e) => setOrderFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Orders</option>
              <option value="pending_verification">🔄 Pending</option>
              <option value="approved">✅ Approved</option>
              <option value="rejected">❌ Rejected</option>
            </select>
            
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Suppliers</option>
              {suppliers.map(supplier => (
                <option key={supplier} value={supplier}>{supplier}</option>
              ))}
            </select>
          </div>

          {/* Bulk Actions for Uganda */}
          {selectedOrders.length > 0 && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800">
                  📋 {selectedOrders.length} orders selected
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleBulkApproval('approve')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    ✅ Approve All
                  </button>
                  <button
                    onClick={() => handleBulkApproval('reject')}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                  >
                    ❌ Reject All
                  </button>
                  <button
                    onClick={() => {
                      selectedOrders.forEach(id => {
                        const order = enhancedOrders.find(o => o.id === id);
                        if (order) handlePrintOrder(order);
                      });
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                  >
                    🖨️ Print All
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Orders Grid */}
        <div className="space-y-6">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-lg">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Orders Found</h3>
              <p className="text-gray-600">No orders match your current filters</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  📦 {filteredOrders.length} Orders Found
                </h3>
                <div className="text-sm text-gray-600">
                  Total: <span className="font-bold text-green-600">
                    {formatCurrency(filteredOrders.reduce((sum, o) => sum + o.totalValue, 0))}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredOrders.map(order => (
                  <SimpleOrderCard key={order.id} order={order} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Simple Modals */}
        {showOrderDetails && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-blue-600 to-green-600 text-white p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">📋 Order Details</h2>
                    <p className="text-blue-200">{showOrderDetails.orderNumber}</p>
                  </div>
                  <button
                    onClick={() => setShowOrderDetails(null)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Order Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-bold text-gray-900 mb-3">📊 Order Information</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-gray-600">Supplier:</span> <span className="font-medium">{showOrderDetails.supplierName}</span></div>
                      <div><span className="text-gray-600">Date:</span> <span className="font-medium">{showOrderDetails.orderDate}</span></div>
                      <div><span className="text-gray-600">Delivery:</span> <span className="font-medium">{showOrderDetails.expectedDelivery}</span></div>
                      <div><span className="text-gray-600">Requested By:</span> <span className="font-medium">{showOrderDetails.requestedBy}</span></div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-3">💰 Financial</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-gray-600">Subtotal:</span> <span className="font-medium">{formatCurrency(showOrderDetails.totalValue - showOrderDetails.tax)}</span></div>
                      <div><span className="text-gray-600">VAT (18%):</span> <span className="font-medium">{formatCurrency(showOrderDetails.tax)}</span></div>
                      <div><span className="text-gray-600">Total:</span> <span className="font-bold text-green-600">{formatCurrency(showOrderDetails.totalValue)}</span></div>
                      <div><span className="text-gray-600">Payment:</span> <span className="font-medium">{showOrderDetails.paymentTerms}</span></div>
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h3 className="font-bold text-gray-900 mb-3">📦 Items</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-200 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Item</th>
                          <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">Qty</th>
                          <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Price</th>
                          <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {showOrderDetails.items.map((item, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm text-gray-900">{item.name}</td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-center">{item.quantity}</td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCurrency(item.unitPrice)}</td>
                            <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">{formatCurrency(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    onClick={() => handlePrintOrder(showOrderDetails)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
                  >
                    <FiPrinter className="h-4 w-4" />
                    <span>Print</span>
                  </button>
                  <button
                    onClick={() => handleEmailOrder(showOrderDetails)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <FiMail className="h-4 w-4" />
                    <span>Email</span>
                  </button>
                  <button
                    onClick={() => setShowOrderDetails(null)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
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

  // Modal Components for Order Management
  const OrderDetailsModal = ({ order, onClose }) => {
    if (!order) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">📋 Order Details</h2>
                <p className="text-blue-200">{order.orderNumber}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Order Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900">📊 Order Information</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Order Number:</span>
                    <span className="font-medium">{order.orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Supplier:</span>
                    <span className="font-medium">{order.supplierName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Order Date:</span>
                    <span className="font-medium">{order.orderDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Expected Delivery:</span>
                    <span className="font-medium">{order.expectedDelivery}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Requested By:</span>
                    <span className="font-medium">{order.requestedBy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Department:</span>
                    <span className="font-medium">{order.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Contact Person:</span>
                    <span className="font-medium">{order.contactPerson}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Contact Phone:</span>
                    <span className="font-medium">{order.contactPhone}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900">💰 Financial Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(order.totalValue - order.tax)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax (18%):</span>
                    <span className="font-medium">{formatCurrency(order.tax)}</span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Discount ({order.discount}%):</span>
                      <span className="font-medium text-green-600">-{formatCurrency(order.totalValue * order.discount / 100)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-gray-900">Total:</span>
                    <span className="text-green-600">{formatCurrency(order.totalValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment Terms:</span>
                    <span className="font-medium">{order.paymentTerms}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Est. Profit:</span>
                    <span className="font-medium text-green-600">{formatCurrency(order.estimatedProfit)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">📦 Order Items</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">Quantity</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">Unit Price</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {order.items.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{item.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Approval Chain */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">✅ Approval Chain</h3>
              <div className="space-y-3">
                {order.approvalChain.map((approval, index) => (
                  <div key={index} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-4 h-4 rounded-full ${
                      approval.status === 'approved' ? 'bg-green-500' :
                      approval.status === 'pending' ? 'bg-yellow-500' :
                      'bg-gray-300'
                    }`}></div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{approval.role}</div>
                      <div className="text-sm text-gray-500">{approval.name}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${
                        approval.status === 'approved' ? 'text-green-600' :
                        approval.status === 'pending' ? 'text-yellow-600' :
                        'text-gray-500'
                      }`}>
                        {approval.status.toUpperCase()}
                      </div>
                      {approval.date && (
                        <div className="text-xs text-gray-500">{approval.date}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">📅 Order Timeline</h3>
              <div className="space-y-3">
                {order.timeline.map((event, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{event.event}</div>
                      <div className="text-sm text-gray-500">{event.date} by {event.user}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Documents */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">📄 Attachments</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {order.attachments.map((doc, index) => (
                  <div key={index} className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
                    <FiFileText className="h-5 w-5 text-blue-600" />
                    <span className="text-sm text-gray-700 truncate">{doc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => toast.success('📧 Order details exported')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <FiDownload className="h-4 w-4" />
                <span>Export Details</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ApprovalModal = ({ order, onClose, onApprove }) => {
    const [comments, setComments] = useState('');
    const [conditions, setConditions] = useState('');
    const [expediteDelivery, setExpediteDelivery] = useState(false);
    const [notifyStakeholders, setNotifyStakeholders] = useState(true);

    const handleApprove = () => {
      onApprove(order.id, { comments, conditions, expediteDelivery, notifyStakeholders });
      toast.success(`✅ Order ${order.orderNumber} approved successfully!`);
    };

    if (!order) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">✅ Approve Order</h2>
                <p className="text-green-200">{order.orderNumber} - {formatCurrency(order.totalValue)}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Approval Comments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📝 Approval Comments
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Add any comments or notes for this approval..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                rows={3}
              />
            </div>

            {/* Special Conditions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📋 Special Conditions or Instructions
              </label>
              <textarea
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                placeholder="Any special delivery instructions, quality requirements, or conditions..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                rows={2}
              />
            </div>

            {/* Options */}
            <div className="space-y-3">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={expediteDelivery}
                  onChange={(e) => setExpediteDelivery(e.target.checked)}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <span className="text-sm font-medium text-gray-700">🚀 Request expedited delivery</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={notifyStakeholders}
                  onChange={(e) => setNotifyStakeholders(e.target.checked)}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <span className="text-sm font-medium text-gray-700">📧 Notify all stakeholders</span>
              </label>
            </div>

            {/* Order Summary */}
            <div className="bg-green-50 rounded-lg p-4">
              <h4 className="font-medium text-green-900 mb-2">📊 Order Summary</h4>
              <div className="text-sm text-green-700 space-y-1">
                <div>Supplier: {order.supplierName}</div>
                <div>Items: {order.items.length} products</div>
                <div>Total Value: {formatCurrency(order.totalValue)}</div>
                <div>Expected Delivery: {order.expectedDelivery}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <FiCheckCircle className="h-4 w-4" />
                <span>Approve Order</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const RejectModal = ({ order, onClose, onReject }) => {
    const [reason, setReason] = useState('');
    const [selectedReason, setSelectedReason] = useState('');
    const [notifySupplier, setNotifySupplier] = useState(true);
    const [allowResubmission, setAllowResubmission] = useState(true);

    const predefinedReasons = [
      'Budget constraints',
      'Incorrect pricing',
      'Quality concerns',
      'Timeline not feasible',
      'Supplier compliance issues',
      'Duplicate order',
      'Specifications not met',
      'Other'
    ];

    const handleReject = () => {
      const finalReason = selectedReason === 'Other' ? reason : selectedReason;
      onReject(order.id, { reason: finalReason, notifySupplier, allowResubmission });
      toast.error(`❌ Order ${order.orderNumber} rejected: ${finalReason}`);
    };

    if (!order) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">❌ Reject Order</h2>
                <p className="text-red-200">{order.orderNumber} - {formatCurrency(order.totalValue)}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Rejection Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📋 Reason for Rejection
              </label>
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent mb-3"
              >
                <option value="">Select a reason...</option>
                {predefinedReasons.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              {selectedReason === 'Other' && (
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please specify the reason for rejection..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  rows={3}
                />
              )}
            </div>

            {/* Additional Comments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💬 Additional Comments (Optional)
              </label>
              <textarea
                placeholder="Provide additional feedback or suggestions for the supplier..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                rows={2}
              />
            </div>

            {/* Options */}
            <div className="space-y-3">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={notifySupplier}
                  onChange={(e) => setNotifySupplier(e.target.checked)}
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <span className="text-sm font-medium text-gray-700">📧 Notify supplier of rejection</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={allowResubmission}
                  onChange={(e) => setAllowResubmission(e.target.checked)}
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <span className="text-sm font-medium text-gray-700">🔄 Allow order resubmission</span>
              </label>
            </div>

            {/* Order Summary */}
            <div className="bg-red-50 rounded-lg p-4">
              <h4 className="font-medium text-red-900 mb-2">⚠️ Order to be Rejected</h4>
              <div className="text-sm text-red-700 space-y-1">
                <div>Supplier: {order.supplierName}</div>
                <div>Items: {order.items.length} products</div>
                <div>Total Value: {formatCurrency(order.totalValue)}</div>
                <div>Requested By: {order.requestedBy}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!selectedReason}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiXCircle className="h-4 w-4" />
                <span>Reject Order</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderInventoryAccess = () => (
    <div className="space-y-6 animate-fadeInUp">
      {/* Inventory Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Total Products', value: inventoryStats.totalProducts, icon: FiPackage, color: 'from-blue-500 to-blue-600', change: '+5.2%' },
          { title: 'Low Stock Items', value: inventoryStats.lowStockItems, icon: FiAlertTriangle, color: 'from-yellow-500 to-yellow-600', change: '-12%' },
          { title: 'Out of Stock', value: inventoryStats.outOfStockItems, icon: FiXCircle, color: 'from-red-500 to-red-600', change: '-8%' },
          { title: 'Total Value', value: formatCurrency(inventoryStats.totalValue), icon: FiDollarSign, color: 'from-green-500 to-green-600', change: '+15%' }
        ].map((metric, index) => (
          <div key={index} className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">{metric.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
                <p className="text-green-600 text-sm font-medium mt-1 flex items-center">
                  <FiTrendingUp className="h-3 w-3 mr-1" />
                  {metric.change}
                </p>
              </div>
              <div className={`p-3 rounded-lg bg-gradient-to-r ${metric.color}`}>
                <metric.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Inventory Management Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { title: 'Open Full Inventory', icon: FiPackage, color: 'bg-blue-600 hover:bg-blue-700', action: () => setShowInventoryModal(true) },
            { title: 'Refresh Data', icon: FiRefreshCw, color: 'bg-green-600 hover:bg-green-700', action: () => handleInventoryAction('refresh') },
            { title: 'Low Stock Alert', icon: FiAlertTriangle, color: 'bg-yellow-600 hover:bg-yellow-700', action: () => handleInventoryAction('low_stock_alert') },
            { title: 'Generate Report', icon: FiDownload, color: 'bg-purple-600 hover:bg-purple-700', action: () => handleInventoryAction('generate_report') }
          ].map((action, index) => (
            <button
              key={index}
              onClick={action.action}
              className={`${action.color} text-white p-4 rounded-lg transition-all duration-300 transform hover:scale-105 flex flex-col items-center space-y-2`}
            >
              <action.icon className="h-6 w-6" />
              <span className="text-sm font-medium">{action.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Category Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Top Categories by Value</h3>
          <div className="space-y-4">
            {inventoryStats.topCategories.map((category, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{category.name}</p>
                    <p className="text-sm text-gray-600">{category.percentage}% of total</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">{formatCurrency(category.value)}</p>
                  <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full"
                      style={{ width: `${category.percentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Recent Inventory Activities</h3>
          <div className="space-y-4">
            {inventoryStats.recentActivities.map((activity, index) => (
              <div key={index} className="flex items-center space-x-4">
                <div className={`p-2 rounded-full ${
                  activity.type === 'stock_in' ? 'bg-green-100 text-green-600' :
                  activity.type === 'stock_out' ? 'bg-blue-100 text-blue-600' :
                  activity.type === 'low_stock' ? 'bg-yellow-100 text-yellow-600' :
                  'bg-purple-100 text-purple-600'
                }`}>
                  {activity.type === 'stock_in' ? '📥' :
                   activity.type === 'stock_out' ? '📤' :
                   activity.type === 'low_stock' ? '⚠️' : '🆕'}
                </div>
                <div className="flex-1">
                  <p className="text-gray-900 font-medium">{activity.message}</p>
                  <p className="text-sm text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Inventory Stats */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Inventory Statistics</h3>
          <div className="text-sm text-gray-600">
            Last Updated: {inventoryStats.lastUpdated}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 border rounded-lg">
            <div className="text-3xl mb-2">📦</div>
            <div className="text-2xl font-bold text-blue-600">{inventoryStats.categoriesCount}</div>
            <div className="text-sm text-gray-600">Product Categories</div>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <div className="text-3xl mb-2">🏭</div>
            <div className="text-2xl font-bold text-green-600">{inventoryStats.suppliersCount}</div>
            <div className="text-sm text-gray-600">Active Suppliers</div>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <div className="text-3xl mb-2">📊</div>
            <div className="text-2xl font-bold text-purple-600">
              {((inventoryStats.totalProducts - inventoryStats.outOfStockItems) / inventoryStats.totalProducts * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Stock Availability</div>
          </div>
        </div>
      </div>

      {/* Access Full Inventory Button */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold mb-2">Full Inventory Management</h3>
            <p className="text-blue-100">Access the complete inventory system with advanced features</p>
          </div>
          <button
            onClick={() => setShowInventoryModal(true)}
            className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg transition-all duration-300 flex items-center space-x-2"
          >
            <FiPackage className="h-5 w-5" />
            <span>Open Inventory System</span>
          </button>
        </div>
      </div>
    </div>
  );

  
  // Component render function

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
          
          /* Custom scrollbar styles */
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          
          /* Smooth scroll for mobile navigation */
          .mobile-nav-scroll {
            scroll-behavior: smooth;
            scroll-snap-type: x mandatory;
          }
          .mobile-nav-scroll > * {
            scroll-snap-align: start;
          }
          
          /* Gradient background animation */
          @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          
          .animated-gradient {
            background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
            background-size: 400% 400%;
            animation: gradientShift 15s ease infinite;
          }
          
          /* Pulse animation for notifications */
          @keyframes notification-pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
            100% { transform: scale(1); opacity: 1; }
          }
          
          .notification-pulse {
            animation: notification-pulse 2s infinite;
          }
          
          /* Mobile touch improvements */
          @media (max-width: 640px) {
            .touch-target {
              min-height: 44px;
              min-width: 44px;
            }
          }
        `
      }} />
      
      {/* Enhanced Header Component */}
      <Suspense fallback={
        <div className="h-32 bg-gradient-to-r from-yellow-400 to-red-500 animate-pulse"></div>
      }>
        <ManagerHeader
          currentTime={currentTime}
          notificationCount={notificationCount}
          setNotificationCount={setNotificationCount}
          showMobileMenu={showMobileMenu}
          setShowMobileMenu={setShowMobileMenu}
          isMobile={isMobile}
        />
      </Suspense>

      {/* Enhanced Navigation Component */}
      <Suspense fallback={
        <div className="h-20 bg-white animate-pulse border-b border-gray-200"></div>
      }>
        <ManagerNavigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isMobile={isMobile}
        />
      </Suspense>

      {/* Enhanced Mobile-Friendly Navigation */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto">
          {/* Desktop Navigation */}
          <nav className="hidden sm:flex px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-2 lg:space-x-6 overflow-x-auto scrollbar-hide">
              {tabs.map((tab, index) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    // Haptic feedback simulation
                    if (navigator.vibrate) {
                      navigator.vibrate(30);
                    }
                    // Visual feedback with toast
                    toast.success(`🎯 ${tab.label} activated`);
                  }}
                  onKeyDown={(e) => {
                    // Keyboard navigation
                    if (e.key === 'ArrowRight' && index < tabs.length - 1) {
                      setActiveTab(tabs[index + 1].id);
                    } else if (e.key === 'ArrowLeft' && index > 0) {
                      setActiveTab(tabs[index - 1].id);
                    }
                  }}
                  className={`relative flex items-center space-x-2 py-3 px-3 lg:px-4 border-b-3 font-medium text-xs lg:text-sm transition-all duration-300 whitespace-nowrap group transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-md'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  style={{
                    animationDelay: `${index * 100}ms`,
                  }}
                >
                  {/* Ultra Creative Icon Containers - Each Tab Unique */}
                  <div className={`relative flex items-center justify-center transition-all duration-500 transform ${
                    // Overview - Hexagonal container with blue theme
                    tab.id === 'overview' ? (
                      activeTab === tab.id 
                        ? 'w-12 h-12 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 shadow-xl shadow-blue-500/40 rotate-45 scale-110' 
                        : 'w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-200 hover:from-blue-200 hover:to-indigo-300 rotate-45 hover:scale-110'
                    ) :
                    // Analytics - Diamond shape with pink theme
                    tab.id === 'analytics' ? (
                      activeTab === tab.id 
                        ? 'w-12 h-12 bg-gradient-to-br from-pink-500 via-rose-600 to-red-700 shadow-xl shadow-pink-500/40 transform rotate-12 scale-110' 
                        : 'w-10 h-10 bg-gradient-to-br from-pink-100 to-rose-200 hover:from-pink-200 hover:to-rose-300 transform rotate-12 hover:scale-110'
                    ) :
                    // Team - Circular with green theme
                    tab.id === 'team' ? (
                      activeTab === tab.id 
                        ? 'w-12 h-12 bg-gradient-to-br from-green-500 via-emerald-600 to-teal-700 shadow-xl shadow-green-500/40 rounded-full scale-110' 
                        : 'w-10 h-10 bg-gradient-to-br from-green-100 to-emerald-200 hover:from-green-200 hover:to-emerald-300 rounded-full hover:scale-110'
                    ) :
                    // Suppliers - Star shape with yellow theme
                    tab.id === 'suppliers' ? (
                      activeTab === tab.id 
                        ? 'w-12 h-12 bg-gradient-to-br from-yellow-500 via-orange-600 to-amber-700 shadow-xl shadow-yellow-500/40 transform -rotate-12 scale-110' 
                        : 'w-10 h-10 bg-gradient-to-br from-yellow-100 to-orange-200 hover:from-yellow-200 hover:to-orange-300 transform -rotate-12 hover:scale-110'
                    ) :
                    // Orders - Pentagon with indigo theme
                    tab.id === 'orders' ? (
                      activeTab === tab.id 
                        ? 'w-12 h-12 bg-gradient-to-br from-indigo-500 via-blue-600 to-cyan-700 shadow-xl shadow-indigo-500/40 transform rotate-6 scale-110' 
                        : 'w-10 h-10 bg-gradient-to-br from-indigo-100 to-blue-200 hover:from-indigo-200 hover:to-blue-300 transform rotate-6 hover:scale-110'
                    ) :
                    // Inventory - Octagon with purple theme
                    tab.id === 'inventory' ? (
                      activeTab === tab.id 
                        ? 'w-12 h-12 bg-gradient-to-br from-purple-500 via-violet-600 to-fuchsia-700 shadow-xl shadow-purple-500/40 transform -rotate-6 scale-110' 
                        : 'w-10 h-10 bg-gradient-to-br from-purple-100 to-violet-200 hover:from-purple-200 hover:to-violet-300 transform -rotate-6 hover:scale-110'
                    ) :
                    // Reports - Square with teal theme
                    tab.id === 'reports' ? (
                      activeTab === tab.id 
                        ? 'w-12 h-12 bg-gradient-to-br from-teal-500 via-cyan-600 to-sky-700 shadow-xl shadow-teal-500/40 transform rotate-45 scale-110' 
                        : 'w-10 h-10 bg-gradient-to-br from-teal-100 to-cyan-200 hover:from-teal-200 hover:to-cyan-300 transform rotate-45 hover:scale-110'
                    ) :
                    // Alerts - Triangle with red theme
                    tab.id === 'alerts' ? (
                      activeTab === tab.id 
                        ? 'w-12 h-12 bg-gradient-to-br from-red-500 via-pink-600 to-rose-700 shadow-xl shadow-red-500/40 transform rotate-180 scale-110' 
                        : 'w-10 h-10 bg-gradient-to-br from-red-100 to-pink-200 hover:from-red-200 hover:to-pink-300 transform rotate-180 hover:scale-110'
                    ) :
                    // Default fallback
                    'w-10 h-10 bg-gray-100 hover:bg-gray-200'
                  } rounded-xl hover:shadow-lg transition-all duration-500`}>
                    
                    {/* Icon with unique styling per tab */}
                    <div className={`flex items-center justify-center ${
                      activeTab === tab.id ? '-rotate-45' : ''
                    } transition-transform duration-500`}>
                      <tab.icon className={`transition-all duration-300 ${
                        activeTab === tab.id 
                          ? 'h-6 w-6 text-white drop-shadow-lg animate-pulse' 
                          : 'h-5 w-5 text-gray-600 group-hover:text-gray-800'
                      }`} />
                    </div>
                    
                    {/* Floating particles for active state */}
                    {activeTab === tab.id && (
                      <>
                        <div className="absolute -top-2 -right-2 w-3 h-3 bg-white rounded-full animate-ping opacity-75"></div>
                        <div className="absolute -bottom-2 -left-2 w-2 h-2 bg-yellow-300 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
                        <div className="absolute top-0 left-0 w-1.5 h-1.5 bg-blue-300 rounded-full animate-pulse" style={{animationDelay: '0.6s'}}></div>
                        <div className="absolute bottom-0 right-0 w-1 h-1 bg-green-300 rounded-full animate-ping" style={{animationDelay: '0.9s'}}></div>
                      </>
                    )}
                    
                    {/* Enhanced notification badges with unique positions */}
                    {tab.id === 'orders' && (
                      <div className="absolute -top-2 -right-2 w-5 h-5 bg-gradient-to-br from-red-500 to-red-600 border-2 border-white rounded-full flex items-center justify-center animate-bounce shadow-lg">
                        <span className="text-xs font-bold text-white">3</span>
                        <div className="absolute inset-0 bg-red-400 rounded-full animate-ping opacity-50"></div>
                      </div>
                    )}
                    {tab.id === 'alerts' && (
                      <div className="absolute -top-2 -right-2 w-5 h-5 bg-gradient-to-br from-orange-500 to-red-500 border-2 border-white rounded-full flex items-center justify-center animate-pulse shadow-lg">
                        <span className="text-xs font-bold text-white">!</span>
                        <div className="absolute inset-0 bg-orange-400 rounded-full animate-ping opacity-50"></div>
                      </div>
                    )}
                    {tab.id === 'inventory' && (
                      <div className="absolute -top-2 -right-2 w-5 h-5 bg-gradient-to-br from-yellow-500 to-orange-500 border-2 border-white rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-xs font-bold text-white">7</span>
                      </div>
                    )}
                    
                    {/* Inner glow effect for active state */}
                    {activeTab === tab.id && (
                      <div className="absolute inset-2 bg-white/20 rounded-lg animate-pulse"></div>
                    )}
                    
                    {/* Ripple effect on hover */}
                    <div className="absolute inset-0 rounded-xl overflow-hidden">
                      <div className={`absolute inset-0 transition-all duration-300 ${
                        activeTab === tab.id 
                          ? 'bg-white/10' 
                          : 'group-hover:bg-white/30 transform group-hover:scale-110'
                      }`}></div>
                    </div>
                  </div>
                  
                  {/* Tab Labels */}
                  <span className="hidden lg:inline font-semibold">{tab.label}</span>
                  <span className="lg:hidden font-semibold">{tab.label.split(' ')[0]}</span>
                  
                  {/* Active indicator with enhanced styling */}
                  {activeTab === tab.id && (
                    <div className="hidden lg:flex items-center space-x-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                      <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  )}
                  
                  {/* Notification badges for specific tabs */}
                  {tab.id === 'orders' && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-bounce">
                      3
                    </span>
                  )}
                  {tab.id === 'alerts' && (
                    <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                      !
                    </span>
                  )}
                  {tab.id === 'inventory' && (
                    <span className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      7
                    </span>
                  )}
                  
                  {/* Hover effect overlay */}
                  <div className={`absolute inset-0 rounded-lg transition-all duration-300 ${
                    activeTab === tab.id 
                      ? 'bg-gradient-to-r from-blue-100/50 to-indigo-100/50' 
                      : 'group-hover:bg-gray-100/50'
                  }`}></div>
                </button>
              ))}
              
              {/* Keyboard shortcuts help button */}
              <button
                onClick={showKeyboardHelp}
                className="flex items-center space-x-1 py-3 px-3 text-gray-400 hover:text-gray-600 transition-all duration-300 group ml-4"
                title="Keyboard Shortcuts (Alt + 1-8)"
              >
                <span className="text-sm">⌨️</span>
                <span className="text-xs hidden lg:inline group-hover:text-blue-500">Shortcuts</span>
              </button>
            </div>
          </nav>

          {/* Mobile Navigation - Enhanced Horizontal Scroll */}
          <nav className="sm:hidden px-3 py-3">
            <div className="flex space-x-3 overflow-x-auto scrollbar-hide mobile-nav-scroll pb-2">
              {tabs.map((tab, index) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    // Enhanced haptic feedback for mobile
                    if (navigator.vibrate) {
                      navigator.vibrate([50, 30, 50]);
                    }
                    // Enhanced toast with emoji
                    toast.success(`📱 ${tab.label} activated! 🎯`);
                  }}
                  onTouchStart={() => {
                    // Visual feedback on touch
                    if (navigator.vibrate) {
                      navigator.vibrate(20);
                    }
                  }}
                  className={
                    "relative flex flex-col items-center justify-center p-4 rounded-2xl min-w-[90px] transition-all duration-500 transform touch-target focus:outline-none focus:ring-2 focus:ring-blue-500 " + 
                    (activeTab === tab.id
                      ? 'bg-gradient-to-br from-blue-500 via-purple-500 to-green-500 text-white shadow-xl scale-110 -translate-y-1'
                      : 'bg-white text-gray-600 hover:bg-gray-50 shadow-md hover:shadow-lg hover:scale-105 active:scale-95')
                  }
                  style={{
                    animationDelay: (index * 50) + "ms",
                  }}
                >
                  {/* Ultra Creative Mobile Icon Containers - Each Tab Completely Unique */}
                  <div className={`relative mb-2 transition-all duration-700 ${
                    activeTab === tab.id ? 'animate-bounce' : 'hover:rotate-12'
                  }`}>
                    {/* Completely unique container for each tab */}
                    <div className={`relative flex items-center justify-center transition-all duration-700 transform ${
                      // Overview - Hexagonal glass morphism
                      tab.id === 'overview' ? (
                        activeTab === tab.id 
                          ? 'w-18 h-18 bg-gradient-to-br from-blue-500/90 via-indigo-600/90 to-purple-700/90 backdrop-blur-xl rounded-3xl border-2 border-white/50 shadow-2xl shadow-blue-500/50 rotate-45 scale-125' 
                          : 'w-14 h-14 bg-gradient-to-br from-blue-200/80 to-indigo-300/80 backdrop-blur-lg rounded-2xl border border-blue-300 shadow-lg hover:shadow-xl transform hover:scale-110 hover:rotate-45'
                      ) :
                      // Analytics - Floating diamond with particles
                      tab.id === 'analytics' ? (
                        activeTab === tab.id 
                          ? 'w-18 h-18 bg-gradient-to-br from-pink-500/90 via-rose-600/90 to-red-700/90 backdrop-blur-xl rounded-full border-4 border-white/60 shadow-2xl shadow-pink-500/50 scale-125' 
                          : 'w-14 h-14 bg-gradient-to-br from-pink-200/80 to-rose-300/80 backdrop-blur-lg rounded-full border-2 border-pink-300 shadow-lg hover:shadow-xl transform hover:scale-110'
                      ) :
                      // Team - Pulsing circle with ripples
                      tab.id === 'team' ? (
                        activeTab === tab.id 
                          ? 'w-18 h-18 bg-gradient-to-br from-green-500/90 via-emerald-600/90 to-teal-700/90 backdrop-blur-xl rounded-full border-4 border-white/60 shadow-2xl shadow-green-500/50 scale-125' 
                          : 'w-14 h-14 bg-gradient-to-br from-green-200/80 to-emerald-300/80 backdrop-blur-lg rounded-full border-2 border-green-300 shadow-lg hover:shadow-xl transform hover:scale-110'
                      ) :
                      // Suppliers - Star burst with golden rays
                      tab.id === 'suppliers' ? (
                        activeTab === tab.id 
                          ? 'w-18 h-18 bg-gradient-to-br from-yellow-500/90 via-orange-600/90 to-amber-700/90 backdrop-blur-xl rounded-2xl border-4 border-white/60 shadow-2xl shadow-yellow-500/50 transform -rotate-12 scale-125' 
                          : 'w-14 h-14 bg-gradient-to-br from-yellow-200/80 to-orange-300/80 backdrop-blur-lg rounded-2xl border-2 border-yellow-300 shadow-lg hover:shadow-xl transform hover:scale-110 hover:-rotate-12'
                      ) :
                      // Orders - Geometric pentagon with electric glow
                      tab.id === 'orders' ? (
                        activeTab === tab.id 
                          ? 'w-18 h-18 bg-gradient-to-br from-indigo-500/90 via-blue-600/90 to-cyan-700/90 backdrop-blur-xl rounded-3xl border-4 border-white/60 shadow-2xl shadow-indigo-500/50 transform rotate-6 scale-125' 
                          : 'w-14 h-14 bg-gradient-to-br from-indigo-200/80 to-blue-300/80 backdrop-blur-lg rounded-2xl border-2 border-indigo-300 shadow-lg hover:shadow-xl transform hover:scale-110 hover:rotate-6'
                      ) :
                      // Inventory - Crystalline octagon
                      tab.id === 'inventory' ? (
                        activeTab === tab.id 
                          ? 'w-18 h-18 bg-gradient-to-br from-purple-500/90 via-violet-600/90 to-fuchsia-700/90 backdrop-blur-xl rounded-2xl border-4 border-white/60 shadow-2xl shadow-purple-500/50 transform -rotate-6 scale-125' 
                          : 'w-14 h-14 bg-gradient-to-br from-purple-200/80 to-violet-300/80 backdrop-blur-lg rounded-2xl border-2 border-purple-300 shadow-lg hover:shadow-xl transform hover:scale-110 hover:-rotate-6'
                      ) :
                      // Reports - Holographic square
                      tab.id === 'reports' ? (
                        activeTab === tab.id 
                          ? 'w-18 h-18 bg-gradient-to-br from-teal-500/90 via-cyan-600/90 to-sky-700/90 backdrop-blur-xl rounded-lg border-4 border-white/60 shadow-2xl shadow-teal-500/50 transform rotate-45 scale-125' 
                          : 'w-14 h-14 bg-gradient-to-br from-teal-200/80 to-cyan-300/80 backdrop-blur-lg rounded-lg border-2 border-teal-300 shadow-lg hover:shadow-xl transform hover:scale-110 hover:rotate-45'
                      ) :
                      // Alerts - Pulsing triangle with warning glow
                      tab.id === 'alerts' ? (
                        activeTab === tab.id 
                          ? 'w-18 h-18 bg-gradient-to-br from-red-500/90 via-pink-600/90 to-rose-700/90 backdrop-blur-xl rounded-full border-4 border-white/60 shadow-2xl shadow-red-500/50 transform rotate-180 scale-125' 
                          : 'w-14 h-14 bg-gradient-to-br from-red-200/80 to-pink-300/80 backdrop-blur-lg rounded-full border-2 border-red-300 shadow-lg hover:shadow-xl transform hover:scale-110 hover:rotate-180'
                      ) :
                      // Default fallback
                      'w-14 h-14 bg-gray-200 rounded-xl'
                    }`}>
                      
                      {/* Icon with unique rotation and effects */}
                      <div className={`flex items-center justify-center transition-transform duration-500 ${
                        activeTab === tab.id ? '-rotate-45' : ''
                      }`}>
                        <tab.icon className={`transition-all duration-500 ${
                          activeTab === tab.id 
                            ? 'h-10 w-10 text-white drop-shadow-2xl filter brightness-125 animate-pulse' 
                            : 'h-7 w-7 text-gray-600'
                        }`} />
                      </div>
                      
                      {/* Advanced floating particles system */}
                      {activeTab === tab.id && (
                        <>
                          {/* Primary particles */}
                          <div className="absolute -top-3 -right-3 w-4 h-4 bg-white/80 rounded-full animate-ping opacity-75"></div>
                          <div className="absolute -bottom-3 -left-3 w-3 h-3 bg-yellow-400/80 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                          <div className="absolute top-1 left-1 w-2 h-2 bg-blue-400/80 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                          <div className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-green-400/80 rounded-full animate-ping" style={{animationDelay: '0.6s'}}></div>
                          
                          {/* Secondary particles */}
                          <div className="absolute -top-1 left-0 w-1 h-1 bg-pink-400/60 rounded-full animate-bounce" style={{animationDelay: '0.8s'}}></div>
                          <div className="absolute -right-1 top-0 w-1 h-1 bg-purple-400/60 rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
                          
                          {/* Orbital rings */}
                          <div className="absolute inset-0 border-2 border-white/30 rounded-full animate-spin" style={{animationDuration: '3s'}}></div>
                          <div className="absolute inset-2 border border-white/20 rounded-full animate-spin" style={{animationDuration: '2s', animationDirection: 'reverse'}}></div>
                        </>
                      )}
                      
                      {/* Premium notification badges with unique styling */}
                      {tab.id === 'orders' && (
                        <div className="absolute -top-3 -right-3 w-7 h-7 bg-gradient-to-br from-red-500 to-red-700 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-2xl animate-bounce border-3 border-white">
                          <span className="relative z-10">3</span>
                          <div className="absolute inset-0 bg-red-400 rounded-full animate-ping opacity-40"></div>
                          <div className="absolute inset-1 bg-red-300 rounded-full animate-pulse opacity-30"></div>
                        </div>
                      )}
                      {tab.id === 'alerts' && (
                        <div className="absolute -top-3 -right-3 w-7 h-7 bg-gradient-to-br from-orange-500 to-red-600 text-white text-sm font-bold rounded-full flex items-center justify-center shadow-2xl animate-pulse border-3 border-white">
                          <span className="relative z-10">!</span>
                          <div className="absolute inset-0 bg-orange-400 rounded-full animate-ping opacity-40"></div>
                        </div>
                      )}
                      {tab.id === 'inventory' && (
                        <div className="absolute -top-3 -right-3 w-7 h-7 bg-gradient-to-br from-yellow-500 to-orange-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-2xl border-3 border-white">
                          <span className="relative z-10">7</span>
                        </div>
                      )}
                      
                      {/* Inner holographic glow */}
                      {activeTab === tab.id && (
                        <>
                          <div className="absolute inset-3 bg-white/10 rounded-2xl animate-pulse"></div>
                          <div className="absolute inset-4 bg-gradient-to-br from-white/20 to-transparent rounded-xl"></div>
                        </>
                      )}
                      
                      {/* Outer energy field */}
                      {activeTab === tab.id && (
                        <div className="absolute -inset-1 bg-gradient-to-br from-white/20 via-transparent to-white/10 rounded-3xl blur-sm animate-pulse"></div>
                      )}
                    </div>
                  </div>
                          <span className="drop-shadow-sm">3</span>
                          <div className="absolute inset-0 bg-red-400 rounded-full animate-ping opacity-50"></div>
                        </div>
                      )}
                      {tab.id === 'alerts' && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg animate-pulse border-2 border-white">
                          <span className="drop-shadow-sm">!</span>
                          <div className="absolute inset-0 bg-orange-400 rounded-full animate-ping opacity-50"></div>
                        </div>
                      )}
                      {tab.id === 'inventory' && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-yellow-500 to-yellow-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                          <span className="drop-shadow-sm">7</span>
                        </div>
                      )}
                      
                      {/* Shimmer effect for active state */}
                      {activeTab === tab.id && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-2xl animate-pulse"></div>
                      )}
                    </div>
                    
                    {/* Floating particles effect for active tab */}
                    {activeTab === tab.id && (
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-2 left-2 w-1 h-1 bg-yellow-300 rounded-full animate-ping" style={{animationDelay: '0.5s'}}></div>
                        <div className="absolute bottom-3 right-4 w-1 h-1 bg-blue-300 rounded-full animate-ping" style={{animationDelay: '1s'}}></div>
                        <div className="absolute top-4 right-2 w-0.5 h-0.5 bg-green-300 rounded-full animate-ping" style={{animationDelay: '1.5s'}}></div>
                      </div>
                    )}
                  </div>
                  
                  {/* Enhanced label section */}
                  <div className="text-center mt-1">
                    <span className={
                      "text-xs font-bold leading-tight block " + 
                      (activeTab === tab.id ? 'text-white drop-shadow-sm' : 'text-gray-700')
                    }>
                      {tab.label.split(' ')[0]}
                    </span>
                    
                    {tab.label.includes(' ') && (
                      <span className={
                        "text-xs leading-tight block " + 
                        (activeTab === tab.id ? 'text-blue-100' : 'text-gray-500')
                      }>
                        {tab.label.split(' ').slice(1).join(' ')}
                      </span>
                    )}
                  </div>
                  
                  {/* Active indicator dot */}
                  {activeTab === tab.id && (
                    <div className="w-2 h-2 bg-yellow-400 rounded-full mt-1 animate-pulse shadow-lg"></div>
                  )}
                  
                  {/* Progress indicator for active tab */}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-yellow-300 rounded-full animate-pulse"></div>
                  )}
                </button>
              ))}
            </div>
            
            {/* Mobile Navigation Indicator */}
            <div className="flex justify-center mt-2">
              <div className="flex space-x-1">
                {tabs.map((tab, index) => (
                  <div
                    key={tab.id}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      activeTab === tab.id 
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 w-6' 
                        : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          </nav>

          {/* Enhanced Mobile Stats Bar with Real-time Data */}
          <div className="sm:hidden bg-gradient-to-r from-green-50 via-blue-50 to-purple-50 px-3 py-3 border-t border-gray-100">
            <div className="grid grid-cols-3 gap-3">
              <button 
                onClick={() => {
                  setActiveTab('analytics');
                  toast.success('📊 Revenue analytics activated!');
                }}
                className="relative bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition-all duration-300 transform hover:scale-105 active:scale-95 touch-target group"
              >
                <div className="flex items-center justify-center space-x-2">
                  {/* Creative icon container for stats */}
                  <div className="relative flex items-center justify-center w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-xl group-hover:from-green-200 group-hover:to-green-300 transition-all duration-300 shadow-inner">
                    <span className="text-lg group-hover:animate-bounce filter drop-shadow-sm">💰</span>
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  </div>
                  <div className="text-left">
                    <div className="text-xs text-gray-600 font-medium">Today</div>
                    <div className="text-sm font-bold text-green-600 group-hover:text-green-700">UGX 2.4M</div>
                    <div className="text-xs text-green-500">+12.5% ↗</div>
                  </div>
                </div>
                {/* Enhanced pulse indicator */}
                <div className="absolute top-1 right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse">
                  <div className="absolute inset-0 bg-green-300 rounded-full animate-ping opacity-50"></div>
                </div>
              </button>
              
              <button 
                onClick={() => {
                  setActiveTab('orders');
                  toast.success('📦 Order management activated!');
                }}
                className="relative bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition-all duration-300 transform hover:scale-105 active:scale-95 touch-target group"
              >
                <div className="flex items-center justify-center space-x-2">
                  {/* Creative icon container for orders */}
                  <div className="relative flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl group-hover:from-blue-200 group-hover:to-blue-300 transition-all duration-300 shadow-inner">
                    <span className="text-lg group-hover:animate-bounce filter drop-shadow-sm">📦</span>
                    {/* Alert indicator */}
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-bounce border border-white">
                      <div className="absolute inset-0 bg-red-400 rounded-full animate-ping opacity-50"></div>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-xs text-gray-600 font-medium">Orders</div>
                    <div className="text-sm font-bold text-blue-600 group-hover:text-blue-700">12</div>
                    <div className="text-xs text-orange-500">3 pending</div>
                  </div>
                </div>
                {/* Alert badge for pending orders */}
                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-bounce">
                  3
                </div>
              </button>
              
              <button 
                onClick={() => {
                  setActiveTab('team');
                  toast.success('👥 Team dashboard activated!');
                }}
                className="relative bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition-all duration-300 transform hover:scale-105 active:scale-95 touch-target group"
              >
                <div className="flex items-center justify-center space-x-2">
                  {/* Creative icon container for team */}
                  <div className="relative flex items-center justify-center w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl group-hover:from-purple-200 group-hover:to-purple-300 transition-all duration-300 shadow-inner">
                    <span className="text-lg group-hover:animate-bounce filter drop-shadow-sm">👥</span>
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  </div>
                  <div className="text-left">
                    <div className="text-xs text-gray-600 font-medium">Online</div>
                    <div className="text-sm font-bold text-purple-600 group-hover:text-purple-700">8</div>
                    <div className="text-xs text-green-500">2 active</div>
                  </div>
                </div>
                {/* Online status indicator */}
                <div className="absolute top-1 right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              </button>
            </div>
            
            {/* Enhanced Quick Action Bar */}
            <div className="mt-3 flex justify-center space-x-2">
              <button 
                onClick={() => {
                  // Simulate data refresh
                  setNotificationCount(prev => prev + 1);
                  toast.success('🔄 Data refreshed successfully!');
                }}
                className="relative flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-3 rounded-2xl text-xs font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-300 transform hover:scale-105 active:scale-95 touch-target shadow-lg group"
              >
                {/* Creative icon container */}
                <div className="flex items-center justify-center w-6 h-6 bg-white/20 rounded-lg backdrop-blur-sm">
                  <FiRefreshCw className="h-3 w-3 group-hover:animate-spin" />
                </div>
                <span>Refresh</span>
                {/* Shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
              <button 
                onClick={() => {
                  setNotificationCount(0);
                  toast.info('� Notifications cleared!');
                }}
                className="relative flex items-center space-x-1 bg-gradient-to-r from-purple-500 to-purple-600 text-white px-3 py-2 rounded-full text-xs font-medium hover:from-purple-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 active:scale-95 touch-target shadow-lg"
              >
                <FiBell className="h-3 w-3" />
                <span>Alerts</span>
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </button>
              <button 
                onClick={() => {
                  // Simulate report generation
                  setTimeout(() => {
                    toast.success('📊 Daily report generated successfully!');
                  }, 1000);
                  toast.info('📊 Generating report...');
                }}
                className="flex items-center space-x-1 bg-gradient-to-r from-green-500 to-green-600 text-white px-3 py-2 rounded-full text-xs font-medium hover:from-green-600 hover:to-green-700 transition-all duration-300 transform hover:scale-105 active:scale-95 touch-target shadow-lg"
              >
                <FiDownload className="h-3 w-3" />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-white rounded-2xl animate-pulse shadow-lg"></div>
            ))}
          </div>
        }>
          {/* Enhanced Overview Dashboard with Uganda Context */}
          {activeTab === 'overview' && (
            <UgandaOverviewDashboard
              businessMetrics={businessMetrics}
              currentTime={currentTime}
              managerProfile={managerProfile}
              revenueData={revenueData}
              realTimeActivity={realTimeActivity}
              topProducts={topProducts}
              performanceIndicators={performanceIndicators}
              strategicGoals={strategicGoals}
              formatCurrency={formatCurrency}
              timeRange={timeRange}
              setTimeRange={setTimeRange}
              setActiveTab={setActiveTab}
              setShowInventoryModal={setShowInventoryModal}
              openEditModal={openEditModal}
            />
          )}

          {/* Other Tab Content - Enhanced */}
          {activeTab === 'analytics' && renderAnalytics()}
          {activeTab === 'team' && renderTeamManagement()}
          {activeTab === 'suppliers' && renderSupplierVerification()}
          {activeTab === 'orders' && renderOrderVerification()}
          {activeTab === 'inventory' && renderInventoryAccess()}
          {activeTab === 'reports' && renderReportAccess()}
          {activeTab === 'alerts' && renderAlerts()}
        </Suspense>
      </div>

      {/* Edit Modal */}
      {renderEditModal()}

      {/* Inventory Management Modal */}
      <InventoryManagement 
        isOpen={showInventoryModal} 
        onClose={() => setShowInventoryModal(false)} 
      />

      {/* Floating Quick Access Button for Mobile */}
      <div className="fixed bottom-6 right-6 sm:hidden z-50">
        <button
          onClick={showKeyboardHelp}
          className="group relative flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-500 via-purple-500 to-green-500 text-white rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-110 active:scale-95"
        >
          {/* Animated icon container */}
          <div className="relative flex items-center justify-center w-8 h-8 bg-white/20 rounded-full backdrop-blur-sm">
            <span className="text-lg animate-pulse">⚡</span>
          </div>
          
          {/* Floating particles */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1 left-2 w-1 h-1 bg-yellow-300 rounded-full animate-ping" style={{animationDelay: '0.5s'}}></div>
            <div className="absolute bottom-2 right-1 w-0.5 h-0.5 bg-blue-300 rounded-full animate-ping" style={{animationDelay: '1s'}}></div>
            <div className="absolute top-3 right-3 w-0.5 h-0.5 bg-green-300 rounded-full animate-ping" style={{animationDelay: '1.5s'}}></div>
          </div>
          
          {/* Ripple effect */}
          <div className="absolute inset-0 bg-white/10 rounded-full scale-0 group-active:scale-100 transition-transform duration-300"></div>
          
          {/* Tooltip */}
          <div className="absolute right-full mr-3 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
            Quick Help ⌨️
          </div>
        </button>
      </div>
    </div>
  );
};

export default ManagerPortal;
