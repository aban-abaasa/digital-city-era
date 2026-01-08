import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import OrderModal from '../components/OrderModal';
import ReportModal from '../components/ReportModal';
import { 
  FiPlus, 
  FiSearch, 
  FiEdit, 
  FiTrash2, 
  FiTruck, 
  FiMail, 
  FiPhone,
  FiMapPin,
  FiGlobe,
  FiStar,
  FiAward,
  FiHeart,
  FiTrendingUp,
  FiTrendingDown,
  FiDollarSign,
  FiClock,
  FiCalendar,
  FiBarChart2,
  FiPieChart,
  FiActivity,
  FiTarget,
  FiZap,
  FiShield,
  FiGift,
  FiRefreshCw,
  FiFilter,
  FiEye,
  FiX,
  FiCheck,
  FiAlertCircle,
  FiUsers,
  FiPackage,
  FiShoppingCart,
  FiCreditCard,
  FiPercent,
  FiFlag,
  FiNavigation,
  FiWifi,
  FiSmartphone,
  FiSend,
  FiFileText
} from 'react-icons/fi';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [viewMode, setViewMode] = useState('cards'); // cards, table, analytics, orders
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterRating, setFilterRating] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [supplierStats, setSupplierStats] = useState(null);
  const [supplierHistory, setSupplierHistory] = useState({});
  const [paymentHistory, setPaymentHistory] = useState({});
  const [supplyOrders, setSupplyOrders] = useState({});
  const [recentOrders, setRecentOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [orderStats, setOrderStats] = useState(null);
  
  // Creative states
  const [weatherMood, setWeatherMood] = useState('sunny');
  const [partnershipGoals, setPartnershipGoals] = useState({
    totalSuppliers: { target: 50, current: 0 },
    localSuppliers: { target: 35, current: 0 },
    topRatedSuppliers: { target: 25, current: 0 }
  });

  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'Uganda'
    },
    website: '',
    paymentTerms: 'net_30',
    creditLimit: '',
    categories: '',
    rating: 5,
    isLocal: true,
    establishedYear: '',
    employeeCount: '',
    certifications: '',
    specialties: '',
    deliveryRadius: '',
    minimumOrder: '',
    leadTime: ''
  });

  useEffect(() => {
    fetchSuppliers();
    fetchSupplierStats();
    
    // Live clock
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    // Weather mood simulation
    const weatherTimer = setInterval(() => {
      const moods = ['sunny', 'cloudy', 'rainy'];
      setWeatherMood(moods[Math.floor(Math.random() * moods.length)]);
    }, 60000);
    
    return () => {
      clearInterval(timer);
      clearInterval(weatherTimer);
    };
  }, []);

  // Generate orders and notifications when suppliers are loaded
  useEffect(() => {
    if (suppliers.length > 0) {
      const orders = generateRecentOrders();
      const notifications = generateNotifications();
      
      setRecentOrders(orders);
      setNotifications(notifications);
      
      // Generate order stats based on the orders
      const stats = {
        totalOrders: orders.length,
        pendingOrders: orders.filter(order => order.status === 'Pending').length,
        deliveredOrders: orders.filter(order => order.status === 'Delivered').length,
        totalValue: orders.reduce((sum, order) => sum + order.amount, 0),
        avgOrderValue: orders.length > 0 ? orders.reduce((sum, order) => sum + order.amount, 0) / orders.length : 0,
        onTimeDelivery: Math.floor(Math.random() * 20) + 80,
        qualityScore: (Math.random() * 1 + 4).toFixed(1)
      };
      setOrderStats(stats);
    }
  }, [suppliers]);

  const fetchSuppliers = async () => {
    try {
      const response = await axios.get('/api/suppliers', { params: { limit: 100 } });
      setSuppliers(response.data.suppliers || []);
      
      // Update partnership goals
      const totalCount = response.data.suppliers?.length || 0;
      const localCount = response.data.suppliers?.filter(s => s.address?.country === 'Uganda').length || 0;
      const topRatedCount = response.data.suppliers?.filter(s => s.rating >= 4).length || 0;
      
      setPartnershipGoals(prev => ({
        totalSuppliers: { ...prev.totalSuppliers, current: totalCount },
        localSuppliers: { ...prev.localSuppliers, current: localCount },
        topRatedSuppliers: { ...prev.topRatedSuppliers, current: topRatedCount }
      }));
    } catch (error) {
      toast.error('Failed to fetch suppliers');
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSupplierStats = async () => {
    try {
      const response = await axios.get('/api/suppliers/stats');
      setSupplierStats(response.data.stats);
    } catch (error) {
      console.error('Failed to fetch supplier stats:', error);
    }
  };

  const fetchSupplierHistory = async (supplierId) => {
    try {
      const [ordersResponse, paymentsResponse] = await Promise.all([
        axios.get(`/api/suppliers/${supplierId}/orders`),
        axios.get(`/api/suppliers/${supplierId}/payments`)
      ]);
      
      setSupplyOrders(prev => ({
        ...prev,
        [supplierId]: ordersResponse.data.orders || generateMockOrders(supplierId)
      }));
      
      setPaymentHistory(prev => ({
        ...prev,
        [supplierId]: paymentsResponse.data.payments || generateMockPayments(supplierId)
      }));
    } catch (error) {
      console.error('Failed to fetch supplier history:', error);
      // Generate mock data for demo
      setSupplyOrders(prev => ({
        ...prev,
        [supplierId]: generateMockOrders(supplierId)
      }));
      setPaymentHistory(prev => ({
        ...prev,
        [supplierId]: generateMockPayments(supplierId)
      }));
    }
  };

  const generateMockOrders = (supplierId) => {
    const orders = [];
    const products = [
      { name: 'Ugandan Coffee Beans', category: 'Food', unit: 'kg' },
      { name: 'Fresh Matooke', category: 'Food', unit: 'bunches' },
      { name: 'Dairy Milk', category: 'Beverages', unit: 'liters' },
      { name: 'Rice', category: 'Food', unit: 'bags' },
      { name: 'Cooking Oil', category: 'Food', unit: 'liters' },
      { name: 'Sugar', category: 'Food', unit: 'kg' },
      { name: 'Posho (Maize Flour)', category: 'Food', unit: 'kg' },
      { name: 'Fresh Fish', category: 'Food', unit: 'kg' }
    ];

    for (let i = 0; i < 12; i++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const quantity = Math.floor(Math.random() * 500) + 50;
      const unitPrice = Math.floor(Math.random() * 10000) + 1000;
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 180));
      
      orders.push({
        id: `ORD-${supplierId}-${1000 + i}`,
        date: date.toISOString(),
        product: product.name,
        category: product.category,
        quantity,
        unit: product.unit,
        unitPrice,
        totalAmount: quantity * unitPrice,
        status: ['delivered', 'pending', 'shipped'][Math.floor(Math.random() * 3)],
        deliveryDate: new Date(date.getTime() + (Math.random() * 14 * 24 * 60 * 60 * 1000)).toISOString()
      });
    }
    
    return orders.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const generateMockPayments = (supplierId) => {
    const payments = [];
    const orders = generateMockOrders(supplierId);
    
    orders.forEach((order, index) => {
      if (order.status === 'delivered' || Math.random() > 0.3) {
        const paymentDate = new Date(order.deliveryDate);
        paymentDate.setDate(paymentDate.getDate() + Math.floor(Math.random() * 30));
        
        payments.push({
          id: `PAY-${supplierId}-${2000 + index}`,
          orderId: order.id,
          date: paymentDate.toISOString(),
          amount: order.totalAmount,
          method: ['bank_transfer', 'mobile_money', 'cash', 'check'][Math.floor(Math.random() * 4)],
          status: ['paid', 'pending', 'overdue'][Math.floor(Math.random() * 3)],
          reference: `REF-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
          dueDate: new Date(order.deliveryDate).toISOString()
        });
      }
    });
    
    return payments.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const generateRecentOrders = () => {
    const orders = [];
    const orderStatuses = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];
    const priorities = ['Low', 'Medium', 'High', 'Urgent'];
    
    for (let i = 0; i < 15; i++) {
      const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
      if (supplier) {
        orders.push({
          id: `ORD-${Date.now() + i}`,
          orderNumber: `PO-${String(Math.floor(Math.random() * 9000) + 1000)}`,
          supplier: supplier,
          items: Math.floor(Math.random() * 8) + 1,
          amount: Math.floor(Math.random() * 5000000) + 100000,
          status: orderStatuses[Math.floor(Math.random() * orderStatuses.length)],
          priority: priorities[Math.floor(Math.random() * priorities.length)],
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          deliveryDate: new Date(Date.now() + Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString(),
          notes: Math.random() > 0.7 ? 'Special handling required' : ''
        });
      }
    }
    
    return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  const generateNotifications = () => {
    const notifications = [];
    const types = ['order', 'payment', 'delivery', 'alert', 'report'];
    const priorities = ['low', 'medium', 'high'];
    
    const messages = {
      order: [
        'New order confirmation received from {supplier}',
        'Order {orderNumber} status updated to {status}',
        'Urgent order request from {supplier} needs approval'
      ],
      payment: [
        'Payment overdue from {supplier} - UGX {amount}',
        'Payment received from {supplier} - UGX {amount}',
        'Payment reminder sent to {supplier}'
      ],
      delivery: [
        'Delivery scheduled for {date} from {supplier}',
        'Late delivery alert - Order {orderNumber}',
        'Delivery completed for Order {orderNumber}'
      ],
      alert: [
        'Low stock alert - Reorder from {supplier}',
        'Quality issue reported with {supplier}',
        'New supplier {supplier} requires verification'
      ],
      report: [
        'Monthly supplier report generated',
        'Weekly performance summary available',
        'Quarterly review scheduled with {supplier}'
      ]
    };
    
    for (let i = 0; i < 12; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
      const messageTemplates = messages[type];
      const template = messageTemplates[Math.floor(Math.random() * messageTemplates.length)];
      
      let message = template;
      if (supplier) {
        message = message.replace('{supplier}', supplier.name);
      }
      message = message.replace('{orderNumber}', `PO-${Math.floor(Math.random() * 9000) + 1000}`);
      message = message.replace('{status}', ['Confirmed', 'Shipped', 'Delivered'][Math.floor(Math.random() * 3)]);
      message = message.replace('{amount}', formatCurrency(Math.floor(Math.random() * 2000000) + 100000));
      message = message.replace('{date}', new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-UG'));
      
      notifications.push({
        id: `NOTIF-${Date.now() + i}`,
        type,
        priority: priorities[Math.floor(Math.random() * priorities.length)],
        message,
        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        read: Math.random() > 0.3,
        supplier: supplier?.id
      });
    }
    
    return notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  };

  const generateOrderStats = () => {
    const totalOrders = recentOrders.length;
    const pendingOrders = recentOrders.filter(order => order.status === 'Pending').length;
    const deliveredOrders = recentOrders.filter(order => order.status === 'Delivered').length;
    const totalValue = recentOrders.reduce((sum, order) => sum + order.amount, 0);
    const avgOrderValue = totalOrders > 0 ? totalValue / totalOrders : 0;
    
    return {
      totalOrders,
      pendingOrders,
      deliveredOrders,
      totalValue,
      avgOrderValue,
      onTimeDelivery: Math.floor(Math.random() * 20) + 80, // 80-100%
      qualityScore: (Math.random() * 1 + 4).toFixed(1) // 4.0-5.0
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const supplierData = {
        ...formData,
        creditLimit: parseFloat(formData.creditLimit) || 0,
        categories: formData.categories.split(',').map(cat => cat.trim()).filter(cat => cat),
        certifications: formData.certifications.split(',').map(cert => cert.trim()).filter(cert => cert),
        specialties: formData.specialties.split(',').map(spec => spec.trim()).filter(spec => spec),
        establishedYear: parseInt(formData.establishedYear) || new Date().getFullYear(),
        employeeCount: parseInt(formData.employeeCount) || 0,
        deliveryRadius: parseInt(formData.deliveryRadius) || 0,
        minimumOrder: parseFloat(formData.minimumOrder) || 0,
        leadTime: parseInt(formData.leadTime) || 0
      };

      if (showEditModal) {
        await axios.put(`/api/suppliers/${selectedSupplier._id}`, supplierData);
        toast.success('🎉 Supplier updated successfully! Partnership strengthened!');
      } else {
        await axios.post('/api/suppliers', supplierData);
        toast.success('🇺🇬 New supplier partnership created! Welcome to FareDeal family!');
      }
      fetchSuppliers();
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save supplier');
    }
  };

  const handleDelete = async (supplierId) => {
    if (!window.confirm('Are you sure you want to end this supplier partnership?')) return;
    try {
      await axios.delete(`/api/suppliers/${supplierId}`);
      toast.success('Supplier partnership ended successfully');
      fetchSuppliers();
    } catch (error) {
      toast.error('Failed to delete supplier');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: { street: '', city: '', state: '', zipCode: '', country: 'Uganda' },
      website: '',
      paymentTerms: 'net_30',
      creditLimit: '',
      categories: '',
      rating: 5,
      isLocal: true,
      establishedYear: '',
      employeeCount: '',
      certifications: '',
      specialties: '',
      deliveryRadius: '',
      minimumOrder: '',
      leadTime: ''
    });
    setShowAddModal(false);
    setShowEditModal(false);
    setShowViewModal(false);
    setSelectedSupplier(null);
  };

  const openEditModal = (supplier) => {
    setSelectedSupplier(supplier);
    setFormData({
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address || { street: '', city: '', state: '', zipCode: '', country: 'Uganda' },
      website: supplier.website || '',
      paymentTerms: supplier.paymentTerms,
      creditLimit: supplier.creditLimit?.toString() || '',
      categories: supplier.categories?.join(', ') || '',
      rating: supplier.rating || 5,
      isLocal: supplier.address?.country === 'Uganda',
      establishedYear: supplier.establishedYear?.toString() || '',
      employeeCount: supplier.employeeCount?.toString() || '',
      certifications: supplier.certifications?.join(', ') || '',
      specialties: supplier.specialties?.join(', ') || '',
      deliveryRadius: supplier.deliveryRadius?.toString() || '',
      minimumOrder: supplier.minimumOrder?.toString() || '',
      leadTime: supplier.leadTime?.toString() || ''
    });
    setShowEditModal(true);
  };

  const openViewModal = (supplier) => {
    setSelectedSupplier(supplier);
    setShowViewModal(true);
    // Fetch supplier history when opening view modal
    fetchSupplierHistory(supplier._id);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTimeGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getWeatherEmoji = () => {
    const weather = {
      sunny: '☀️',
      cloudy: '⛅',
      rainy: '🌧️'
    };
    return weather[weatherMood] || '☀️';
  };

  const getSupplierIcon = (categories) => {
    if (!categories || categories.length === 0) return '🏪';
    const category = categories[0].toLowerCase();
    const icons = {
      'food': '🍎',
      'dairy': '🥛',
      'meat': '🥩',
      'beverages': '🥤',
      'electronics': '📱',
      'clothing': '👕',
      'furniture': '🪑',
      'automotive': '🚗',
      'medical': '🏥',
      'construction': '🏗️'
    };
    
    for (const [key, icon] of Object.entries(icons)) {
      if (category.includes(key)) return icon;
    }
    return '🏪';
  };

  const getLocationFlag = (country) => {
    const flags = {
      'Uganda': '🇺🇬',
      'Kenya': '🇰🇪',
      'Tanzania': '🇹🇿',
      'Rwanda': '🇷🇼',
      'South Sudan': '🇸🇸',
      'Democratic Republic of Congo': '🇨🇩'
    };
    return flags[country] || '🌍';
  };

  const getSupplierQualityBadge = (rating) => {
    if (rating >= 4.5) return { text: '🏆 Premium', color: 'bg-yellow-100 text-yellow-800' };
    if (rating >= 4.0) return { text: '⭐ Excellent', color: 'bg-green-100 text-green-800' };
    if (rating >= 3.5) return { text: '👍 Good', color: 'bg-blue-100 text-blue-800' };
    if (rating >= 3.0) return { text: '✅ Fair', color: 'bg-gray-100 text-gray-800' };
    return { text: '⚠️ Needs Improvement', color: 'bg-red-100 text-red-800' };
  };

  const getOrderStatusBadge = (status) => {
    const statusMap = {
      'delivered': { text: '✅ Delivered', color: 'bg-green-100 text-green-800' },
      'shipped': { text: '🚛 Shipped', color: 'bg-blue-100 text-blue-800' },
      'pending': { text: '⏳ Pending', color: 'bg-yellow-100 text-yellow-800' },
      'cancelled': { text: '❌ Cancelled', color: 'bg-red-100 text-red-800' }
    };
    return statusMap[status] || { text: status, color: 'bg-gray-100 text-gray-800' };
  };

  const getPaymentStatusBadge = (status) => {
    const statusMap = {
      'paid': { text: '💚 Paid', color: 'bg-green-100 text-green-800' },
      'pending': { text: '⏰ Pending', color: 'bg-yellow-100 text-yellow-800' },
      'overdue': { text: '🚨 Overdue', color: 'bg-red-100 text-red-800' },
      'partial': { text: '🔄 Partial', color: 'bg-orange-100 text-orange-800' }
    };
    return statusMap[status] || { text: status, color: 'bg-gray-100 text-gray-800' };
  };

  const getPaymentMethodIcon = (method) => {
    const methodMap = {
      'bank_transfer': '🏦',
      'mobile_money': '📱',
      'cash': '💵',
      'check': '📝'
    };
    return methodMap[method] || '💳';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-UG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'Africa/Kampala'
    });
  };

  const calculateSupplierTotals = (supplierId) => {
    const orders = supplyOrders[supplierId] || [];
    const payments = paymentHistory[supplierId] || [];
    
    const totalOrders = orders.length;
    const totalValue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, payment) => sum + payment.amount, 0);
    const totalPending = payments.filter(p => p.status === 'pending').reduce((sum, payment) => sum + payment.amount, 0);
    const totalOverdue = payments.filter(p => p.status === 'overdue').reduce((sum, payment) => sum + payment.amount, 0);
    
    return { totalOrders, totalValue, totalPaid, totalPending, totalOverdue };
  };

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(supplier => {
      const matchesSearch = !searchTerm || 
    (supplier.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (supplier.contactPerson?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (supplier.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      
      const matchesCategory = filterCategory === 'all' || 
        supplier.categories?.some(cat => cat.toLowerCase().includes(filterCategory.toLowerCase()));
      
      const matchesRating = filterRating === 'all' || 
        (filterRating === '4+' && supplier.rating >= 4) ||
        (filterRating === '3+' && supplier.rating >= 3);
      
      const matchesLocation = filterLocation === 'all' || 
        (filterLocation === 'local' && supplier.address?.country === 'Uganda') ||
        (filterLocation === 'international' && supplier.address?.country !== 'Uganda');
      
      return matchesSearch && matchesCategory && matchesRating && matchesLocation;
    });
  }, [suppliers, searchTerm, filterCategory, filterRating, filterLocation]);

  // Mock data for analytics
  const supplierPerformanceData = [
    { name: 'Jan', deliveryTime: 3.2, quality: 4.1, communication: 4.3 },
    { name: 'Feb', deliveryTime: 2.8, quality: 4.3, communication: 4.2 },
    { name: 'Mar', deliveryTime: 3.1, quality: 4.2, communication: 4.4 },
    { name: 'Apr', deliveryTime: 2.9, quality: 4.4, communication: 4.5 },
    { name: 'May', deliveryTime: 2.7, quality: 4.5, communication: 4.3 },
    { name: 'Jun', deliveryTime: 2.6, quality: 4.6, communication: 4.6 }
  ];

  const categoryDistribution = [
    { name: 'Food & Beverages', value: 35, color: '#10B981' },
    { name: 'Electronics', value: 20, color: '#3B82F6' },
    { name: 'Clothing', value: 15, color: '#F59E0B' },
    { name: 'Construction', value: 12, color: '#EF4444' },
    { name: 'Medical', value: 10, color: '#8B5CF6' },
    { name: 'Others', value: 8, color: '#6B7280' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-500 border-t-transparent mb-4 mx-auto"></div>
          <p className="text-xl font-bold text-gray-700">Loading supplier partnerships...</p>
          <p className="text-gray-500">Building Uganda's supply network 🇺🇬</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 p-6">
      {/* Creative Header */}
      <div className="bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 rounded-2xl shadow-2xl mb-8">
        <div className="p-8 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center space-x-6">
              <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm">
                <FiTruck className="h-12 w-12" />
              </div>
        <div>
                <h1 className="text-4xl font-bold flex items-center">
                  🇺🇬 Supplier Network
                  <span className="ml-3 text-2xl">{getWeatherEmoji()}</span>
                </h1>
                <p className="text-green-100 text-lg mt-2">
                  {getTimeGreeting()}! Building strong partnerships across Uganda
                </p>
                <div className="flex items-center space-x-4 mt-3 text-sm">
                  <span className="bg-white/20 px-3 py-1 rounded-full flex items-center">
                    <FiClock className="mr-2 h-4 w-4" />
                    {currentTime.toLocaleTimeString('en-UG')}
                  </span>
                  <span className="bg-green-500/30 px-3 py-1 rounded-full flex items-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
                    Live Network
                  </span>
        </div>
              </div>
      </div>

            {/* Quick Stats */}
            <div className="mt-6 lg:mt-0 grid grid-cols-3 gap-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                <FiUsers className="h-8 w-8 mx-auto mb-2 text-yellow-300" />
                <p className="text-2xl font-bold">{partnershipGoals.totalSuppliers.current}</p>
                <p className="text-green-200 text-sm">Total Partners</p>
          </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                <FiFlag className="h-8 w-8 mx-auto mb-2 text-green-300" />
                <p className="text-2xl font-bold">{partnershipGoals.localSuppliers.current}</p>
                <p className="text-green-200 text-sm">Local Partners</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                <FiAward className="h-8 w-8 mx-auto mb-2 text-purple-300" />
                <p className="text-2xl font-bold">{partnershipGoals.topRatedSuppliers.current}</p>
                <p className="text-green-200 text-sm">Top Rated</p>
              </div>
            </div>
          </div>

          {/* Partnership Goals Banner */}
          <div className="mt-6 bg-gradient-to-r from-yellow-400/20 to-orange-500/20 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FiTarget className="h-8 w-8 text-yellow-300" />
                <div>
                  <p className="font-bold text-lg">🎯 Partnership Goals Progress</p>
                  <p className="text-green-100">Building Uganda's strongest supply network!</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-green-200">Total Goal</p>
                  <p className="text-lg font-bold text-yellow-300">
                    {Math.round((partnershipGoals.totalSuppliers.current / partnershipGoals.totalSuppliers.target) * 100)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-green-200">Local Goal</p>
                  <p className="text-lg font-bold text-yellow-300">
                    {Math.round((partnershipGoals.localSuppliers.current / partnershipGoals.localSuppliers.target) * 100)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-green-200">Quality Goal</p>
                  <p className="text-lg font-bold text-yellow-300">
                    {Math.round((partnershipGoals.topRatedSuppliers.current / partnershipGoals.topRatedSuppliers.target) * 100)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls & Filters */}
      <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
                placeholder="🔍 Search suppliers, contacts, or companies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-gray-50"
          />
        </div>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-3 border-2 border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="all">🏪 All Categories</option>
              <option value="food">🍎 Food & Beverages</option>
              <option value="electronics">📱 Electronics</option>
              <option value="clothing">👕 Clothing</option>
              <option value="construction">🏗️ Construction</option>
              <option value="medical">🏥 Medical</option>
            </select>

            <select
              value={filterRating}
              onChange={(e) => setFilterRating(e.target.value)}
              className="px-4 py-3 border-2 border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="all">⭐ All Ratings</option>
              <option value="4+">🏆 4+ Stars</option>
              <option value="3+">👍 3+ Stars</option>
            </select>

            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="px-4 py-3 border-2 border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="all">🌍 All Locations</option>
              <option value="local">🇺🇬 Local (Uganda)</option>
              <option value="international">🌐 International</option>
            </select>
      </div>

          {/* View Mode & Add Button */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('analytics')}
              className={`px-4 py-2 rounded-lg font-bold transition-all ${
                viewMode === 'analytics' 
                  ? 'bg-green-600 text-white shadow-lg' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <FiBarChart2 className="inline h-4 w-4 mr-2" />
              Analytics
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-4 py-2 rounded-lg font-bold transition-all ${
                viewMode === 'cards' 
                  ? 'bg-green-600 text-white shadow-lg' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <FiActivity className="inline h-4 w-4 mr-2" />
              Cards
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 rounded-lg font-bold transition-all ${
                viewMode === 'table' 
                  ? 'bg-green-600 text-white shadow-lg' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <FiUsers className="inline h-4 w-4 mr-2" />
              Table
            </button>
            
            <button
              onClick={() => setViewMode('orders')}
              className={`px-4 py-2 rounded-lg font-bold transition-all ${
                viewMode === 'orders' 
                  ? 'bg-green-600 text-white shadow-lg' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <FiSend className="inline h-4 w-4 mr-2" />
              Orders & Reports
            </button>
            
            <button
              onClick={() => setShowReportModal(true)}
              className="px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 font-bold transition-all transform hover:scale-105 shadow-lg"
            >
              <FiFileText className="inline h-4 w-4 mr-2" />
              Reports
            </button>
            
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-xl hover:from-green-700 hover:to-blue-700 font-bold transition-all transform hover:scale-105 shadow-lg"
            >
              <FiPlus className="inline h-5 w-5 mr-2" />
              Add Supplier
            </button>
          </div>
        </div>
      </div>

      {/* Analytics View */}
      {viewMode === 'analytics' && (
        <div className="space-y-8">
          {/* Performance Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Supplier Performance Trend */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800 flex items-center">
                  <FiTrendingUp className="mr-3 h-6 w-6 text-green-600" />
                  📈 Supplier Performance Trends
                </h3>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Last 6 Months</p>
                  <p className="text-lg font-bold text-green-600">+12.5% Improvement</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={supplierPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="deliveryTime" stroke="#10B981" name="Delivery Time (days)" />
                  <Line type="monotone" dataKey="quality" stroke="#3B82F6" name="Quality Score" />
                  <Line type="monotone" dataKey="communication" stroke="#F59E0B" name="Communication Score" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Category Distribution */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <FiPieChart className="mr-3 h-6 w-6 text-blue-600" />
                🏪 Supplier Categories
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Supplier Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-green-600">4.2⭐</p>
                  <p className="text-gray-600">Average Rating</p>
                </div>
                <FiStar className="h-12 w-12 text-green-600" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-blue-600">2.8 days</p>
                  <p className="text-gray-600">Avg Delivery Time</p>
                </div>
                <FiClock className="h-12 w-12 text-blue-600" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-orange-600">98.5%</p>
                  <p className="text-gray-600">On-Time Delivery</p>
                </div>
                <FiTarget className="h-12 w-12 text-orange-600" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-purple-600">92%</p>
                  <p className="text-gray-600">Partnership Satisfaction</p>
                </div>
                <FiHeart className="h-12 w-12 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cards View */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSuppliers.map((supplier) => {
            const qualityBadge = getSupplierQualityBadge(supplier.rating || 4.0);
            return (
              <div
                key={supplier._id}
                className="bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 cursor-pointer overflow-hidden"
                onClick={() => openViewModal(supplier)}
              >
                <div className="bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 p-6">
                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center space-x-3">
                      <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                        <span className="text-2xl">{getSupplierIcon(supplier.categories)}</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{supplier.name}</h3>
                        <p className="text-green-100 text-sm">{supplier.contactPerson}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-1">
                        <FiStar className="h-5 w-5 text-yellow-300" />
                        <span className="text-lg font-bold">{supplier.rating || 4.0}</span>
                      </div>
                      <p className="text-green-100 text-sm flex items-center">
                        {getLocationFlag(supplier.address?.country || 'Uganda')}
                        <span className="ml-1">{supplier.address?.city || 'Kampala'}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="space-y-4">
                    {/* Contact Info */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-gray-600">
                        <FiPhone className="h-4 w-4" />
                        <span className="text-sm">{supplier.phone}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-600">
                        <FiMail className="h-4 w-4" />
                        <span className="text-sm">{supplier.email?.substring(0, 15)}...</span>
                      </div>
                    </div>

                    {/* Categories */}
                    <div className="flex flex-wrap gap-2">
                      {supplier.categories?.slice(0, 3).map((category, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold"
                        >
                          {category}
                        </span>
                      ))}
                      {supplier.categories?.length > 3 && (
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                          +{supplier.categories.length - 3} more
                        </span>
                      )}
                    </div>

                    {/* Quality Badge & Credit Limit */}
                    <div className="flex items-center justify-between">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${qualityBadge.color}`}>
                        {qualityBadge.text}
                      </span>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Credit Limit</p>
                        <p className="text-lg font-bold text-green-600">{formatCurrency(supplier.creditLimit || 0)}</p>
                      </div>
                    </div>

                    {/* Payment Terms */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm text-gray-600">Payment Terms:</span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-bold">
                        {supplier.paymentTerms?.replace('_', ' ') || 'Net 30'}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-3 gap-2 pt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSupplier(supplier);
                          setShowOrderModal(true);
                        }}
                        className="bg-purple-100 text-purple-600 px-2 py-2 rounded-lg text-xs font-bold hover:bg-purple-200 transition-all"
                      >
                        <FiSend className="inline h-3 w-3 mr-1" />
                        Order
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(supplier);
                        }}
                        className="bg-blue-100 text-blue-600 px-2 py-2 rounded-lg text-xs font-bold hover:bg-blue-200 transition-all"
                      >
                        <FiEdit className="inline h-3 w-3 mr-1" />
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openViewModal(supplier);
                        }}
                        className="bg-green-100 text-green-600 px-2 py-2 rounded-lg text-xs font-bold hover:bg-green-200 transition-all"
                      >
                        <FiEye className="inline h-3 w-3 mr-1" />
                        View
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-green-600 to-blue-600 text-white">
              <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">
                    🏪 Supplier Details
                </th>
                  <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">
                    📞 Contact Info
                </th>
                  <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">
                    📍 Location
                </th>
                  <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">
                    ⭐ Rating
                </th>
                  <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">
                    💰 Credit Limit
                </th>
                  <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">
                    💳 Payment Terms
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-bold uppercase tracking-wider">
                    ⚡ Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {filteredSuppliers.map((supplier, index) => (
                  <tr key={supplier._id} className={`hover:bg-green-50 transition-all ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="bg-green-100 p-2 rounded-lg">
                          <span className="text-2xl">{getSupplierIcon(supplier.categories)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{supplier.name}</p>
                          <p className="text-xs text-gray-500">{supplier.contactPerson}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {supplier.categories?.slice(0, 2).map((category, idx) => (
                              <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-600 rounded text-xs">
                                {category}
                              </span>
                            ))}
                      </div>
                        </div>
                        </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-sm text-gray-900">
                          <FiPhone className="h-4 w-4 text-green-500" />
                          <span>{supplier.phone}</span>
                      </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <FiMail className="h-4 w-4 text-blue-500" />
                          <span>{supplier.email}</span>
                        </div>
                        {supplier.website && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <FiGlobe className="h-4 w-4 text-purple-500" />
                            <span>Website</span>
                          </div>
                        )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">{getLocationFlag(supplier.address?.country || 'Uganda')}</span>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{supplier.address?.city || 'Kampala'}</p>
                          <p className="text-xs text-gray-500">{supplier.address?.country || 'Uganda'}</p>
                    </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                            <FiStar
                          key={i}
                              className={`h-4 w-4 ${i < (supplier.rating || 4) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-bold text-gray-900">{supplier.rating || 4.0}</span>
                      </div>
                      <div className="mt-1">
                        {(() => {
                          const badge = getSupplierQualityBadge(supplier.rating || 4.0);
                          return (
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${badge.color}`}>
                              {badge.text}
                            </span>
                          );
                        })()}
                    </div>
                  </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-lg font-bold text-green-600">
                        {formatCurrency(supplier.creditLimit || 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-3 py-1 text-sm font-bold rounded-full bg-gradient-to-r from-green-100 to-blue-100 text-green-800">
                        <FiCreditCard className="mr-2 h-4 w-4" />
                        {supplier.paymentTerms?.replace('_', ' ') || 'Net 30'}
                      </span>
                    </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => {
                            setSelectedSupplier(supplier);
                            setShowOrderModal(true);
                          }}
                          className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-2 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105"
                        >
                          <FiSend className="inline h-4 w-4 mr-1" />
                          Order
                        </button>
                        <button
                          onClick={() => openViewModal(supplier)}
                          className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-3 py-2 rounded-lg hover:from-green-700 hover:to-blue-700 transition-all transform hover:scale-105"
                        >
                          <FiEye className="inline h-4 w-4 mr-1" />
                          View
                        </button>
                        <button
                          onClick={() => openEditModal(supplier)}
                          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105"
                        >
                          <FiEdit className="inline h-4 w-4 mr-1" />
                          Edit
                        </button>
                      </div>
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Enhanced View Modal */}
      {showViewModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                    <span className="text-3xl">{getSupplierIcon(selectedSupplier.categories)}</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">🇺🇬 {selectedSupplier.name}</h3>
                    <p className="text-green-100">Supplier Partnership Details</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-all"
                >
                  <FiX className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {(() => {
                const supplierTotals = calculateSupplierTotals(selectedSupplier._id);
                const orders = supplyOrders[selectedSupplier._id] || [];
                const payments = paymentHistory[selectedSupplier._id] || [];
                
                return (
                  <div className="space-y-8">
                    {/* Partnership Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-xl p-4 text-center">
                        <FiShoppingCart className="h-8 w-8 mx-auto mb-2 text-green-600" />
                        <p className="text-2xl font-bold text-green-600">{supplierTotals.totalOrders}</p>
                        <p className="text-gray-600 text-sm">Total Orders</p>
                      </div>
                      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4 text-center">
                        <FiDollarSign className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                        <p className="text-2xl font-bold text-blue-600">{formatCurrency(supplierTotals.totalValue)}</p>
                        <p className="text-gray-600 text-sm">Total Value</p>
                      </div>
                      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-4 text-center">
                        <FiCheck className="h-8 w-8 mx-auto mb-2 text-green-600" />
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(supplierTotals.totalPaid)}</p>
                        <p className="text-gray-600 text-sm">Total Paid</p>
                      </div>
                      <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-4 text-center">
                        <FiAlertCircle className="h-8 w-8 mx-auto mb-2 text-red-600" />
                        <p className="text-2xl font-bold text-red-600">{formatCurrency(supplierTotals.totalOverdue)}</p>
                        <p className="text-gray-600 text-sm">Overdue</p>
                      </div>
                    </div>

                    {/* Supply History & Payment Tracking Tabs */}
                    <div className="bg-white rounded-xl border">
                      <div className="border-b">
                        <nav className="flex space-x-8 px-6">
                          <button
                            onClick={() => setSelectedSupplier({...selectedSupplier, activeTab: 'overview'})}
                            className={`py-4 px-2 border-b-2 font-medium text-sm ${
                              (!selectedSupplier.activeTab || selectedSupplier.activeTab === 'overview')
                                ? 'border-green-500 text-green-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            🏢 Overview
                          </button>
                          <button
                            onClick={() => setSelectedSupplier({...selectedSupplier, activeTab: 'supplies'})}
                            className={`py-4 px-2 border-b-2 font-medium text-sm ${
                              selectedSupplier.activeTab === 'supplies'
                                ? 'border-green-500 text-green-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            📦 Supply History ({orders.length})
                          </button>
                          <button
                            onClick={() => setSelectedSupplier({...selectedSupplier, activeTab: 'payments'})}
                            className={`py-4 px-2 border-b-2 font-medium text-sm ${
                              selectedSupplier.activeTab === 'payments'
                                ? 'border-green-500 text-green-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            💰 Payment History ({payments.length})
                          </button>
                          <button
                            onClick={() => setSelectedSupplier({...selectedSupplier, activeTab: 'analytics'})}
                            className={`py-4 px-2 border-b-2 font-medium text-sm ${
                              selectedSupplier.activeTab === 'analytics'
                                ? 'border-green-500 text-green-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            📊 Analytics
                          </button>
                        </nav>
                      </div>

                      <div className="p-6">
                        {/* Overview Tab */}
                        {(!selectedSupplier.activeTab || selectedSupplier.activeTab === 'overview') && (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Company Information */}
                            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6">
                              <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <FiUsers className="mr-2 h-5 w-5 text-blue-600" />
                                🏢 Company Information
                              </h4>
                              <div className="space-y-3">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Contact Person:</span>
                                  <span className="font-bold">{selectedSupplier.contactPerson}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Rating:</span>
                                  <div className="flex items-center space-x-1">
                                    <FiStar className="h-4 w-4 text-yellow-400 fill-current" />
                                    <span className="font-bold">{selectedSupplier.rating || 4.0}</span>
                                  </div>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Phone:</span>
                                  <span className="font-bold">{selectedSupplier.phone}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Email:</span>
                                  <span className="font-bold">{selectedSupplier.email}</span>
                                </div>
                              </div>
                            </div>

                            {/* Business Terms */}
                            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6">
                              <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <FiCreditCard className="mr-2 h-5 w-5 text-orange-600" />
                                💼 Business Terms
                              </h4>
                              <div className="space-y-3">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Payment Terms:</span>
                                  <span className="font-bold">{selectedSupplier.paymentTerms?.replace('_', ' ') || 'Net 30'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Credit Limit:</span>
                                  <span className="font-bold text-green-600">{formatCurrency(selectedSupplier.creditLimit || 0)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Location:</span>
                                  <span className="font-bold flex items-center">
                                    {getLocationFlag(selectedSupplier.address?.country || 'Uganda')}
                                    <span className="ml-1">{selectedSupplier.address?.city || 'Kampala'}</span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Categories */}
                            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 lg:col-span-2">
                              <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <FiPackage className="mr-2 h-5 w-5 text-purple-600" />
                                🏪 Products & Services
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {selectedSupplier.categories?.map((category, index) => (
                                  <span key={index} className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-bold">
                                    {category}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Supply History Tab */}
                        {selectedSupplier.activeTab === 'supplies' && (
                          <div className="space-y-6">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xl font-bold text-gray-800">📦 Supply History</h4>
                              <div className="text-sm text-gray-600">
                                Showing {orders.length} orders from last 6 months
                              </div>
                            </div>

                            <div className="overflow-hidden rounded-xl border">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gradient-to-r from-green-100 to-blue-100">
                                  <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {orders.slice(0, 10).map((order, index) => {
                                    const statusBadge = getOrderStatusBadge(order.status);
                                    return (
                                      <tr key={order.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                          {order.id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                          <div>
                                            <div className="text-sm font-medium text-gray-900">{order.product}</div>
                                            <div className="text-sm text-gray-500">{order.category}</div>
                                          </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                          {order.quantity} {order.unit}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                                          {formatCurrency(order.totalAmount)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                          <span className={`px-2 py-1 text-xs font-bold rounded-full ${statusBadge.color}`}>
                                            {statusBadge.text}
                                          </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                          {formatDate(order.date)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Payment History Tab */}
                        {selectedSupplier.activeTab === 'payments' && (
                          <div className="space-y-6">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xl font-bold text-gray-800">💰 Payment History</h4>
                              <div className="flex items-center space-x-4 text-sm">
                                <span className="text-green-600 font-bold">Paid: {formatCurrency(supplierTotals.totalPaid)}</span>
                                <span className="text-yellow-600 font-bold">Pending: {formatCurrency(supplierTotals.totalPending)}</span>
                                <span className="text-red-600 font-bold">Overdue: {formatCurrency(supplierTotals.totalOverdue)}</span>
                              </div>
                            </div>

                            <div className="overflow-hidden rounded-xl border">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gradient-to-r from-green-100 to-blue-100">
                                  <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {payments.slice(0, 10).map((payment, index) => {
                                    const statusBadge = getPaymentStatusBadge(payment.status);
                                    return (
                                      <tr key={payment.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                          {payment.id}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                          {payment.orderId}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                                          {formatCurrency(payment.amount)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                          <div className="flex items-center space-x-2">
                                            <span className="text-lg">{getPaymentMethodIcon(payment.method)}</span>
                                            <span className="text-sm text-gray-900 capitalize">
                                              {payment.method.replace('_', ' ')}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                          <span className={`px-2 py-1 text-xs font-bold rounded-full ${statusBadge.color}`}>
                                            {statusBadge.text}
                                          </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                          {formatDate(payment.date)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Analytics Tab */}
                        {selectedSupplier.activeTab === 'analytics' && (
                          <div className="space-y-6">
                            <h4 className="text-xl font-bold text-gray-800">📊 Partnership Analytics</h4>
                            
                            {/* Monthly Performance Chart */}
                            <div className="bg-white rounded-xl border p-6">
                              <h5 className="text-lg font-bold text-gray-800 mb-4">📈 Monthly Order Volume</h5>
                              <ResponsiveContainer width="100%" height={300}>
                                <AreaChart data={[
                                  { month: 'Jan', orders: 8, value: 2500000 },
                                  { month: 'Feb', orders: 12, value: 3200000 },
                                  { month: 'Mar', orders: 15, value: 4100000 },
                                  { month: 'Apr', orders: 10, value: 2800000 },
                                  { month: 'May', orders: 18, value: 5200000 },
                                  { month: 'Jun', orders: 14, value: 3900000 }
                                ]}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="month" />
                                  <YAxis />
                                  <Tooltip formatter={(value, name) => [
                                    name === 'value' ? formatCurrency(value) : value,
                                    name === 'value' ? 'Order Value' : 'Number of Orders'
                                  ]} />
                                  <Area type="monotone" dataKey="orders" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
                                  <Area type="monotone" dataKey="value" stackId="2" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>

                            {/* Performance Metrics */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-xl p-6 text-center">
                                <FiTrendingUp className="h-8 w-8 mx-auto mb-2 text-green-600" />
                                <p className="text-2xl font-bold text-green-600">96%</p>
                                <p className="text-gray-600 text-sm">On-Time Delivery</p>
                              </div>
                              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 text-center">
                                <FiStar className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                                <p className="text-2xl font-bold text-blue-600">4.8</p>
                                <p className="text-gray-600 text-sm">Quality Rating</p>
                              </div>
                              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 text-center">
                                <FiHeart className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                                <p className="text-2xl font-bold text-orange-600">94%</p>
                                <p className="text-gray-600 text-sm">Partnership Score</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  💡 Partnership with FareDeal Uganda
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowViewModal(false);
                      openEditModal(selectedSupplier);
                    }}
                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 font-bold transition-all transform hover:scale-105 shadow-lg"
                  >
                    <FiEdit className="inline h-4 w-4 mr-2" />
                    Edit Partnership
                  </button>
                  <button
                    onClick={() => setShowViewModal(false)}
                    className="px-6 py-2 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 font-bold transition-all transform hover:scale-105 shadow-lg"
                  >
                    ✅ Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 xl:w-2/3 shadow-lg rounded-2xl bg-white max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 text-white p-6 -m-5 mb-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                    <FiTruck className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">
                      {showEditModal ? '✏️ Edit Supplier Partnership' : '🤝 Create New Partnership'}
              </h3>
                    <p className="text-green-100">Building stronger supply networks across Uganda</p>
                  </div>
                </div>
                <button
                  onClick={resetForm}
                  className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-all"
                >
                  <FiX className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="max-h-[70vh] overflow-y-auto">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6">
                  <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <FiUsers className="mr-2 h-5 w-5 text-blue-600" />
                    🏢 Company Information
                  </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700">Company Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="mt-1 block w-full border-2 border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm p-3"
                        placeholder="Enter company name"
                    />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700">Contact Person *</label>
                    <input
                      type="text"
                      required
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
                        className="mt-1 block w-full border-2 border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm p-3"
                        placeholder="Primary contact person"
                    />
                  </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-xl p-6">
                  <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <FiPhone className="mr-2 h-5 w-5 text-green-600" />
                    📞 Contact Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700">Email *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="mt-1 block w-full border-2 border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm p-3"
                        placeholder="supplier@company.com"
                    />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700">Phone *</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="mt-1 block w-full border-2 border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm p-3"
                        placeholder="+256 700 123 456"
                    />
                  </div>
                    <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Website</label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({...formData, website: e.target.value})}
                        className="mt-1 block w-full border-2 border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm p-3"
                        placeholder="https://www.company.com"
                      />
                    </div>
                  </div>
                </div>

                {/* Address Information */}
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6">
                  <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <FiMapPin className="mr-2 h-5 w-5 text-orange-600" />
                    📍 Address Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Street Address</label>
                      <input
                        type="text"
                        value={formData.address.street}
                        onChange={(e) => setFormData({...formData, address: {...formData.address, street: e.target.value}})}
                        className="mt-1 block w-full border-2 border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm p-3"
                        placeholder="Street address"
                    />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700">City</label>
                      <input
                        type="text"
                        value={formData.address.city}
                        onChange={(e) => setFormData({...formData, address: {...formData.address, city: e.target.value}})}
                        className="mt-1 block w-full border-2 border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm p-3"
                        placeholder="Kampala"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Country</label>
                      <select
                        value={formData.address.country}
                        onChange={(e) => setFormData({...formData, address: {...formData.address, country: e.target.value}})}
                        className="mt-1 block w-full border-2 border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm p-3"
                      >
                        <option value="Uganda">🇺🇬 Uganda</option>
                        <option value="Kenya">🇰🇪 Kenya</option>
                        <option value="Tanzania">🇹🇿 Tanzania</option>
                        <option value="Rwanda">🇷🇼 Rwanda</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Business Terms */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6">
                  <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <FiCreditCard className="mr-2 h-5 w-5 text-purple-600" />
                    💼 Business Terms
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Payment Terms *</label>
                    <select
                      required
                      value={formData.paymentTerms}
                      onChange={(e) => setFormData({...formData, paymentTerms: e.target.value})}
                        className="mt-1 block w-full border-2 border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm p-3"
                      >
                        <option value="net_15">Net 15 days</option>
                        <option value="net_30">Net 30 days</option>
                        <option value="net_45">Net 45 days</option>
                        <option value="net_60">Net 60 days</option>
                      <option value="cash_on_delivery">Cash on Delivery</option>
                      <option value="prepaid">Prepaid</option>
                    </select>
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700">Credit Limit (UGX)</label>
                    <input
                      type="number"
                      value={formData.creditLimit}
                      onChange={(e) => setFormData({...formData, creditLimit: e.target.value})}
                        className="mt-1 block w-full border-2 border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm p-3"
                        placeholder="5000000"
                        min="0"
                    />
                  </div>
                </div>
                  </div>

                {/* Products & Services */}
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6">
                  <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <FiPackage className="mr-2 h-5 w-5 text-indigo-600" />
                    🏪 Products & Services
                  </h4>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Categories (comma separated) *</label>
                  <input
                    type="text"
                      required
                    value={formData.categories}
                    onChange={(e) => setFormData({...formData, categories: e.target.value})}
                      className="mt-1 block w-full border-2 border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm p-3"
                      placeholder="food, beverages, dairy, meat"
                  />
                </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-4 pt-6 border-t">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-3 border-2 border-gray-300 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-8 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-xl hover:from-green-700 hover:to-blue-700 font-bold transition-all transform hover:scale-105 shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    {showEditModal ? '✏️ Update Partnership' : '🤝 Create Partnership'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Orders & Reports Dashboard View */}
      {viewMode === 'orders' && (
        <div className="space-y-6">
          {/* Dashboard Header */}
          <div className="bg-gradient-to-br from-purple-600 via-blue-600 to-teal-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold mb-2">📊 Orders & Reports Dashboard</h2>
                <p className="text-purple-100">Manage orders, track deliveries, and generate comprehensive reports</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{recentOrders.length}</p>
                <p className="text-purple-100">Total Orders</p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          {orderStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-6 rounded-xl border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-600 text-sm font-medium">Total Orders</p>
                    <p className="text-3xl font-bold text-green-800">{orderStats.totalOrders}</p>
                  </div>
                  <div className="bg-green-500 p-3 rounded-full">
                    <FiPackage className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-yellow-50 to-orange-100 p-6 rounded-xl border-l-4 border-yellow-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-yellow-600 text-sm font-medium">Pending Orders</p>
                    <p className="text-3xl font-bold text-yellow-800">{orderStats.pendingOrders}</p>
                  </div>
                  <div className="bg-yellow-500 p-3 rounded-full">
                    <FiClock className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-cyan-100 p-6 rounded-xl border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-600 text-sm font-medium">Total Value</p>
                    <p className="text-2xl font-bold text-blue-800">{formatCurrency(orderStats.totalValue)}</p>
                  </div>
                  <div className="bg-blue-500 p-3 rounded-full">
                    <FiCreditCard className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-100 p-6 rounded-xl border-l-4 border-purple-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-600 text-sm font-medium">Avg Order Value</p>
                    <p className="text-2xl font-bold text-purple-800">{formatCurrency(orderStats.avgOrderValue)}</p>
                  </div>
                  <div className="bg-purple-500 p-3 rounded-full">
                    <FiTrendingUp className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">⚡ Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setShowOrderModal(true)}
                className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-4 rounded-xl hover:from-green-700 hover:to-blue-700 transition-all transform hover:scale-105 shadow-lg"
              >
                <FiPlus className="h-6 w-6 mx-auto mb-2" />
                <p className="font-bold">Create New Order</p>
                <p className="text-sm opacity-90">Place order with suppliers</p>
              </button>

              <button
                onClick={() => setShowReportModal(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105 shadow-lg"
              >
                <FiFileText className="h-6 w-6 mx-auto mb-2" />
                <p className="font-bold">Generate Reports</p>
                <p className="text-sm opacity-90">Create business analytics</p>
              </button>

              <button
                onClick={() => {
                  const orders = generateRecentOrders();
                  setRecentOrders(orders);
                  toast.success('Orders refreshed!');
                }}
                className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white p-4 rounded-xl hover:from-teal-700 hover:to-cyan-700 transition-all transform hover:scale-105 shadow-lg"
              >
                <FiRefreshCw className="h-6 w-6 mx-auto mb-2" />
                <p className="font-bold">Refresh Data</p>
                <p className="text-sm opacity-90">Update order status</p>
              </button>
            </div>
          </div>

          {/* Recent Orders */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4">
              <h3 className="text-xl font-bold text-white">📋 Recent Orders</h3>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-3 px-4 font-bold text-gray-700">Order #</th>
                      <th className="text-left py-3 px-4 font-bold text-gray-700">Supplier</th>
                      <th className="text-left py-3 px-4 font-bold text-gray-700">Items</th>
                      <th className="text-left py-3 px-4 font-bold text-gray-700">Amount</th>
                      <th className="text-left py-3 px-4 font-bold text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-bold text-gray-700">Priority</th>
                      <th className="text-left py-3 px-4 font-bold text-gray-700">Date</th>
                      <th className="text-left py-3 px-4 font-bold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.slice(0, 10).map((order, index) => (
                      <tr key={order.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="py-3 px-4 font-mono text-sm text-blue-600 font-bold">
                          {order.orderNumber}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <div className="bg-gradient-to-r from-green-400 to-blue-500 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs mr-3">
                              {order.supplier.name.charAt(0)}
                            </div>
                            <span className="font-medium text-gray-800">{order.supplier.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          <span className="bg-gray-100 px-2 py-1 rounded-full text-xs font-bold">
                            {order.items} items
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-green-600">
                          {formatCurrency(order.amount)}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            order.status === 'Delivered' ? 'bg-green-100 text-green-800' :
                            order.status === 'Shipped' ? 'bg-blue-100 text-blue-800' :
                            order.status === 'Confirmed' ? 'bg-yellow-100 text-yellow-800' :
                            order.status === 'Pending' ? 'bg-orange-100 text-orange-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            order.priority === 'Urgent' ? 'bg-red-100 text-red-800' :
                            order.priority === 'High' ? 'bg-orange-100 text-orange-800' :
                            order.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {order.priority}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {new Date(order.createdAt).toLocaleDateString('en-UG')}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                setSelectedSupplier(order.supplier);
                                setShowOrderModal(true);
                              }}
                              className="bg-blue-100 text-blue-600 px-2 py-1 rounded text-xs font-bold hover:bg-blue-200"
                            >
                              <FiEdit className="inline h-3 w-3" />
                            </button>
                            <button
                              onClick={() => toast.info(`Order ${order.orderNumber} details`)}
                              className="bg-green-100 text-green-600 px-2 py-1 rounded text-xs font-bold hover:bg-green-200"
                            >
                              <FiEye className="inline h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {recentOrders.length > 10 && (
                <div className="text-center mt-4">
                  <button className="text-blue-600 hover:text-blue-800 font-medium">
                    View all {recentOrders.length} orders →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Notifications Panel */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-orange-600 to-red-600 p-4">
              <h3 className="text-xl font-bold text-white">🔔 Recent Notifications</h3>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {notifications.slice(0, 8).map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-lg border-l-4 ${
                      notification.priority === 'high' ? 'border-red-500 bg-red-50' :
                      notification.priority === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                      'border-blue-500 bg-blue-50'
                    } ${!notification.read ? 'ring-2 ring-blue-200' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            notification.type === 'order' ? 'bg-green-100 text-green-800' :
                            notification.type === 'payment' ? 'bg-blue-100 text-blue-800' :
                            notification.type === 'delivery' ? 'bg-purple-100 text-purple-800' :
                            notification.type === 'alert' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {notification.type.toUpperCase()}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            notification.priority === 'high' ? 'bg-red-100 text-red-800' :
                            notification.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {notification.priority.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-gray-800 font-medium">{notification.message}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(notification.timestamp).toLocaleString('en-UG')}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {notifications.length > 8 && (
                <div className="text-center mt-4">
                  <button className="text-orange-600 hover:text-orange-800 font-medium">
                    View all {notifications.length} notifications →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredSuppliers.length === 0 && (
        <div className="text-center py-12">
          <div className="bg-white rounded-2xl shadow-xl p-12 max-w-md mx-auto">
            <div className="h-24 w-24 mx-auto bg-gradient-to-br from-green-100 to-blue-100 rounded-full flex items-center justify-center mb-6">
              <FiTruck className="h-12 w-12 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No Suppliers Found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || filterCategory !== 'all' || filterRating !== 'all' || filterLocation !== 'all'
                ? 'Try adjusting your search or filters' 
                : 'Start building your supplier network by adding your first partner'}
            </p>
            <button
              onClick={() => {
                if (searchTerm || filterCategory !== 'all' || filterRating !== 'all' || filterLocation !== 'all') {
                  setSearchTerm('');
                  setFilterCategory('all');
                  setFilterRating('all');
                  setFilterLocation('all');
                } else {
                  setShowAddModal(true);
                }
              }}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 font-bold transition-all transform hover:scale-105 shadow-lg"
            >
              {searchTerm || filterCategory !== 'all' || filterRating !== 'all' || filterLocation !== 'all' ? (
                <>
                  <FiRefreshCw className="inline h-4 w-4 mr-2" />
                  Reset Filters
                </>
              ) : (
                <>
                  <FiPlus className="inline h-4 w-4 mr-2" />
                  Add First Supplier
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Order Modal */}
      <OrderModal
        isOpen={showOrderModal}
        onClose={() => {
          setShowOrderModal(false);
          setSelectedSupplier(null);
        }}
        supplier={selectedSupplier}
      />

      {/* Report Modal */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
      />
    </div>
  );
};

export default Suppliers;
