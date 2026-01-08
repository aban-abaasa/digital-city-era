import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import DataAggregator from '../services/dataAggregator';
import { 
  FiTrendingUp, FiUsers, FiPackage, FiCalendar, FiDollarSign, 
  FiShoppingCart, FiBarChart, FiPieChart, FiDownload, FiFilter,
  FiRefreshCw, FiEye, FiPrinter, FiShare2, FiClock, FiTarget,
  FiAward, FiStar, FiHeart, FiZap, FiTrendingDown, FiActivity
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
  Area,
  ComposedChart,
  Scatter,
  ScatterChart,
  RadialBarChart,
  RadialBar,
} from 'recharts';

const Reports = () => {
  const [salesData, setSalesData] = useState([]);
  const [productData, setProductData] = useState([]);
  const [customerData, setCustomerData] = useState([]);
  const [inventoryData, setInventoryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState('overview');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  
  // Additional report data
  const [revenueData, setRevenueData] = useState([]);
  const [performanceData, setPerformanceData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [employeeData, setEmployeeData] = useState([]);

  useEffect(() => {
    fetchReportsData();
  }, [dateRange]);

  const fetchReportsData = async () => {
    setLoading(true);
    try {
      // Use our new data aggregator instead of direct API calls
      const [salesData, inventoryData, customerData, employeeData] = await Promise.all([
        DataAggregator.getSalesData('last30days'),
        DataAggregator.getInventoryData('last30days'),
        DataAggregator.getCustomerData('last30days'),
        DataAggregator.getEmployeeData('last30days')
      ]);

      // Transform data to match the expected format for the Reports component
      const transformedSalesData = salesData.sales.map((sale, index) => ({
        _id: { day: index + 1 },
        totalRevenue: sale.amount,
        totalItems: sale.quantity
      }));

      const transformedProductData = salesData.products.map((product, index) => ({
        _id: product.id.toString(),
        productName: product.name,
        totalQuantitySold: Math.floor(product.sales / product.price),
        totalRevenue: product.sales
      }));

      const transformedCustomerData = customerData.customers.map((customer, index) => ({
        _id: customer.id.toString(),
        customerName: customer.name,
        totalOrders: Math.floor(Math.random() * 15) + 5, // Random order count
        totalSpent: Math.floor(Math.random() * 2000) + 500 // Random spent amount
      }));

      const transformedInventoryData = {
        report: inventoryData.inventory.map((item, index) => ({
          _id: item.id.toString(),
          productName: item.name,
          currentStock: item.quantity,
          reorderLevel: item.reorderPoint,
          status: item.quantity < item.reorderPoint ? 'Low' : 'Good'
        }))
      };

      // Set the transformed data
      setSalesData(transformedSalesData);
      setProductData(transformedProductData);
      setCustomerData(transformedCustomerData);
      setInventoryData(transformedInventoryData);
      
      // Set additional data for comprehensive reporting
      setRevenueData(salesData.sales || []);
      setPerformanceData(employeeData.performance || []);
      setCategoryData(salesData.products || []);
      setEmployeeData(employeeData.employees || []);
      
      toast.success('📊 Reports data loaded successfully!', {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } catch (error) {
      console.error('Failed to fetch reports data:', error);
      toast.info('📊 Using demo data - Backend not available', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      // Set fallback data when API fails
      setSalesData([
        { _id: { day: 1 }, totalRevenue: 1200, totalItems: 45 },
        { _id: { day: 2 }, totalRevenue: 1800, totalItems: 67 },
        { _id: { day: 3 }, totalRevenue: 1500, totalItems: 52 },
        { _id: { day: 4 }, totalRevenue: 2200, totalItems: 78 },
        { _id: { day: 5 }, totalRevenue: 1900, totalItems: 63 },
        { _id: { day: 6 }, totalRevenue: 2500, totalItems: 89 },
        { _id: { day: 7 }, totalRevenue: 2100, totalItems: 71 }
      ]);
      setProductData([
        { _id: '1', productName: 'iPhone 15 Pro', totalQuantitySold: 25, totalRevenue: 29975 },
        { _id: '2', productName: 'Samsung Galaxy S24', totalQuantitySold: 18, totalRevenue: 17982 },
        { _id: '3', productName: 'MacBook Air M2', totalQuantitySold: 12, totalRevenue: 14388 },
        { _id: '4', productName: 'iPad Pro', totalQuantitySold: 15, totalRevenue: 11985 },
        { _id: '5', productName: 'AirPods Pro', totalQuantitySold: 32, totalRevenue: 6398 }
      ]);
      setCustomerData([
        { _id: '1', customerName: 'John Smith', totalVisits: 8, totalSpent: 2450 },
        { _id: '2', customerName: 'Sarah Johnson', totalVisits: 6, totalSpent: 1890 },
        { _id: '3', customerName: 'Mike Wilson', totalVisits: 5, totalSpent: 1650 },
        { _id: '4', customerName: 'Emily Davis', totalVisits: 7, totalSpent: 2100 },
        { _id: '5', customerName: 'David Brown', totalVisits: 4, totalSpent: 1200 }
      ]);
      setInventoryData({
        report: [
          { name: 'Electronics', totalRetailValue: 125000 },
          { name: 'Accessories', totalRetailValue: 45000 },
          { name: 'Computers', totalRetailValue: 89000 },
          { name: 'Audio', totalRetailValue: 32000 },
          { name: 'Mobile', totalRetailValue: 156000 }
        ]
      });
      
      // Additional fallback data
      setRevenueData([
        { month: 'Jan', revenue: 45000, profit: 12000, orders: 156 },
        { month: 'Feb', revenue: 52000, profit: 15000, orders: 189 },
        { month: 'Mar', revenue: 48000, profit: 13000, orders: 167 },
        { month: 'Apr', revenue: 61000, profit: 18000, orders: 203 },
        { month: 'May', revenue: 55000, profit: 16000, orders: 178 },
        { month: 'Jun', revenue: 67000, profit: 20000, orders: 234 }
      ]);
      
      setPerformanceData([
        { name: 'Sales Target', value: 85, target: 100 },
        { name: 'Customer Satisfaction', value: 92, target: 90 },
        { name: 'Inventory Turnover', value: 78, target: 80 },
        { name: 'Employee Performance', value: 88, target: 85 }
      ]);
      
      setCategoryData([
        { category: 'Electronics', sales: 45000, growth: 12.5, items: 234 },
        { category: 'Accessories', sales: 28000, growth: 8.3, items: 189 },
        { category: 'Computers', sales: 52000, growth: 15.2, items: 156 },
        { category: 'Audio', sales: 19000, growth: 6.7, items: 98 },
        { category: 'Mobile', sales: 38000, growth: 18.9, items: 167 }
      ]);
      
      setEmployeeData([
        { name: 'Sarah Johnson', sales: 25000, customers: 45, rating: 4.8 },
        { name: 'Mike Wilson', sales: 22000, customers: 38, rating: 4.6 },
        { name: 'Emily Davis', sales: 28000, customers: 52, rating: 4.9 },
        { name: 'David Brown', sales: 19000, customers: 34, rating: 4.5 },
        { name: 'Lisa Garcia', sales: 24000, customers: 41, rating: 4.7 }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString();
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center animate-fadeInUp">
          <div className="relative mb-8">
            <div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 w-20 h-20 border-4 border-purple-500 border-r-transparent rounded-full animate-spin mx-auto" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
            <div className="absolute inset-2 w-16 h-16 border-4 border-pink-500 border-b-transparent rounded-full animate-spin mx-auto" style={{animationDuration: '2s'}}></div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3 animate-pulse">📊 Loading Reports...</h2>
          <p className="text-gray-600 text-lg animate-bounce">Analyzing business data</p>
          <div className="mt-6 flex justify-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
            <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
            <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
      {/* Header */}
      <div className="flex justify-between items-center animate-fadeInUp">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 transform hover:scale-105 transition-all duration-300">📊 Reports & Analytics</h1>
          <p className="mt-1 text-sm text-gray-500 animate-fadeInUp" style={{animationDelay: '0.2s'}}>
            Comprehensive business insights and performance metrics
          </p>
        </div>
        <div className="flex space-x-4 animate-slideInFromRight" style={{animationDelay: '0.3s'}}>
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 transform hover:scale-105 focus:scale-105"
          />
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 transform hover:scale-105 focus:scale-105"
          />
          <button
            onClick={fetchReportsData}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-md hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 animate-shimmer"
          >
            <FiRefreshCw className="h-4 w-4 inline mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Report Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-lg p-4 animate-fadeInUp" style={{animationDelay: '0.4s'}}>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'overview', label: '📊 Overview', icon: FiBarChart },
            { id: 'sales', label: '💰 Sales', icon: FiDollarSign },
            { id: 'products', label: '📦 Products', icon: FiPackage },
            { id: 'customers', label: '👥 Customers', icon: FiUsers },
            { id: 'inventory', label: '📋 Inventory', icon: FiShoppingCart },
            { id: 'performance', label: '🎯 Performance', icon: FiTarget },
            { id: 'revenue', label: '📈 Revenue', icon: FiTrendingUp },
            { id: 'analytics', label: '🔍 Analytics', icon: FiActivity }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 ${
                activeReport === tab.id
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Report Content */}
      {activeReport === 'overview' && (
        <>
          {/* Sales Trend Chart */}
          <div className="bg-white shadow rounded-lg animate-fadeInUp" style={{animationDelay: '0.5s'}}>
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4 transform hover:scale-105 transition-all duration-300">
            📈 Sales Trend
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="_id.day" 
                  tickFormatter={(value) => `Day ${value}`}
                />
                <YAxis tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                  formatter={(value, name) => [formatCurrency(value), 'Revenue']}
                  labelFormatter={(label) => `Day ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="totalRevenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Products and Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white shadow rounded-lg animate-slideInFromLeft" style={{animationDelay: '0.5s'}}>
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4 transform hover:scale-105 transition-all duration-300">
              🏆 Top Selling Products
            </h3>
            <div className="space-y-3">
              {(productData || []).slice(0, 5).map((product, index) => (
                <div 
                  key={product._id} 
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-all duration-300 transform hover:scale-105 animate-fadeInUp"
                  style={{animationDelay: `${0.6 + index * 0.1}s`}}
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 bg-gradient-to-r from-blue-100 to-blue-200 rounded-full flex items-center justify-center transform hover:scale-110 transition-all duration-300 animate-pulse-custom">
                        <span className="text-sm font-medium text-blue-600">
                          {index + 1}
                        </span>
                      </div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900 transform hover:scale-105 transition-all duration-300">
                        {product.productName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {product.totalQuantitySold} sold
                      </p>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-gray-900 transform hover:scale-105 transition-all duration-300">
                    {formatCurrency(product.totalRevenue)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Customers */}
        <div className="bg-white shadow rounded-lg animate-slideInFromRight" style={{animationDelay: '0.5s'}}>
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4 transform hover:scale-105 transition-all duration-300">
              👥 Top Customers
            </h3>
            <div className="space-y-3">
              {(customerData || []).slice(0, 5).map((customer, index) => (
                <div 
                  key={customer._id} 
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-all duration-300 transform hover:scale-105 animate-fadeInUp"
                  style={{animationDelay: `${0.6 + index * 0.1}s`}}
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 bg-gradient-to-r from-green-100 to-green-200 rounded-full flex items-center justify-center transform hover:scale-110 transition-all duration-300 animate-pulse-custom">
                        <span className="text-sm font-medium text-green-600">
                          {index + 1}
                        </span>
                      </div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900 transform hover:scale-105 transition-all duration-300">
                        {customer.customerName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {customer.totalVisits} visits
                      </p>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-gray-900 transform hover:scale-105 transition-all duration-300">
                    {formatCurrency(customer.totalSpent)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Value by Category */}
      {inventoryData && (
        <div className="bg-white shadow rounded-lg animate-fadeInUp" style={{animationDelay: '0.7s'}}>
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4 transform hover:scale-105 transition-all duration-300">
              📦 Inventory Value by Category
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={inventoryData.report || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="totalRetailValue"
                  >
                    {(inventoryData.report || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white shadow rounded-lg p-6 animate-fadeInUp" style={{animationDelay: '0.8s'}}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FiTrendingUp className="h-8 w-8 text-blue-600 animate-pulse" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate transform hover:scale-105 transition-all duration-300">
                  💰 Total Sales
                </dt>
                <dd className="text-lg font-medium text-gray-900 transform hover:scale-105 transition-all duration-300">
                  {formatCurrency(salesData.reduce((sum, day) => sum + day.totalRevenue, 0))}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6 animate-fadeInUp" style={{animationDelay: '0.9s'}}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FiPackage className="h-8 w-8 text-green-600 animate-pulse" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate transform hover:scale-105 transition-all duration-300">
                  📦 Items Sold
                </dt>
                <dd className="text-lg font-medium text-gray-900 transform hover:scale-105 transition-all duration-300">
                  {salesData.reduce((sum, day) => sum + day.totalItems, 0).toLocaleString()}
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6 animate-fadeInUp" style={{animationDelay: '1s'}}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FiUsers className="h-8 w-8 text-purple-600 animate-pulse" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate transform hover:scale-105 transition-all duration-300">
                  👥 Active Customers
                </dt>
                <dd className="text-lg font-medium text-gray-900 transform hover:scale-105 transition-all duration-300">
                  {customerData.length}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
        </>
      )}

      {/* Sales Report */}
      {activeReport === 'sales' && (
        <div className="space-y-6 animate-fadeInUp" style={{animationDelay: '0.5s'}}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <FiDollarSign className="h-6 w-6 text-green-600 mr-2" />
                💰 Sales Performance
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="_id.day" tickFormatter={(value) => `Day ${value}`} />
                    <YAxis tickFormatter={(value) => `$${value}`} />
                    <Tooltip formatter={(value) => [formatCurrency(value), 'Revenue']} />
                    <Area type="monotone" dataKey="totalRevenue" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <FiShoppingCart className="h-6 w-6 text-blue-600 mr-2" />
                🛒 Orders Trend
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="_id.day" tickFormatter={(value) => `Day ${value}`} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="totalItems" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Products Report */}
      {activeReport === 'products' && (
        <div className="space-y-6 animate-fadeInUp" style={{animationDelay: '0.5s'}}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <FiPackage className="h-6 w-6 text-purple-600 mr-2" />
                📦 Top Products
              </h3>
              <div className="space-y-4">
                {(productData || []).map((product, index) => (
                  <div key={product._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all duration-300 transform hover:scale-105">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{product.productName}</p>
                        <p className="text-sm text-gray-500">{product.totalQuantitySold} sold</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{formatCurrency(product.totalRevenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <FiBarChart className="h-6 w-6 text-orange-600 mr-2" />
                📊 Category Performance
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(value) => `$${value}`} />
                    <YAxis dataKey="category" type="category" width={80} />
                    <Tooltip formatter={(value) => [formatCurrency(value), 'Sales']} />
                    <Bar dataKey="sales" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customers Report */}
      {activeReport === 'customers' && (
        <div className="space-y-6 animate-fadeInUp" style={{animationDelay: '0.5s'}}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <FiUsers className="h-6 w-6 text-blue-600 mr-2" />
                👥 Top Customers
              </h3>
              <div className="space-y-4">
                {(customerData || []).map((customer, index) => (
                  <div key={customer._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all duration-300 transform hover:scale-105">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{customer.customerName}</p>
                        <p className="text-sm text-gray-500">{customer.totalVisits} visits</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{formatCurrency(customer.totalSpent)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <FiHeart className="h-6 w-6 text-red-600 mr-2" />
                💝 Customer Satisfaction
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="80%" data={[
                    { name: 'Satisfied', value: 85, fill: '#10b981' },
                    { name: 'Neutral', value: 10, fill: '#f59e0b' },
                    { name: 'Dissatisfied', value: 5, fill: '#ef4444' }
                  ]}>
                    <RadialBar dataKey="value" cornerRadius={10} fill="#8884d8" />
                    <Tooltip />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Report */}
      {activeReport === 'inventory' && (
        <div className="space-y-6 animate-fadeInUp" style={{animationDelay: '0.5s'}}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <FiShoppingCart className="h-6 w-6 text-green-600 mr-2" />
                📋 Inventory Value
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={inventoryData?.report || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="totalRetailValue"
                    >
                      {(inventoryData?.report || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <FiPackage className="h-6 w-6 text-purple-600 mr-2" />
                📦 Stock Levels
              </h3>
              <div className="space-y-4">
                {[
                  { name: 'Electronics', stock: 85, min: 20, status: 'good' },
                  { name: 'Accessories', stock: 45, min: 30, status: 'warning' },
                  { name: 'Computers', stock: 15, min: 25, status: 'critical' },
                  { name: 'Audio', stock: 60, min: 15, status: 'good' },
                  { name: 'Mobile', stock: 25, min: 35, status: 'warning' }
                ].map((item, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-900">{item.name}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.status === 'good' ? 'bg-green-100 text-green-800' :
                        item.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          item.status === 'good' ? 'bg-green-500' :
                          item.status === 'warning' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${(item.stock / 100) * 100}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500 mt-1">
                      <span>Stock: {item.stock}</span>
                      <span>Min: {item.min}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Performance Report */}
      {activeReport === 'performance' && (
        <div className="space-y-6 animate-fadeInUp" style={{animationDelay: '0.5s'}}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <FiTarget className="h-6 w-6 text-blue-600 mr-2" />
                🎯 Performance Metrics
              </h3>
              <div className="space-y-4">
                {performanceData.map((metric, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-900">{metric.name}</span>
                      <span className="text-sm text-gray-500">{metric.value}% / {metric.target}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                        style={{ width: `${(metric.value / metric.target) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <FiAward className="h-6 w-6 text-yellow-600 mr-2" />
                🏆 Employee Performance
              </h3>
              <div className="space-y-4">
                {employeeData.map((employee, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all duration-300 transform hover:scale-105">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                        {employee.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{employee.name}</p>
                        <p className="text-sm text-gray-500">{employee.customers} customers</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{formatCurrency(employee.sales)}</p>
                      <div className="flex items-center">
                        <FiStar className="h-4 w-4 text-yellow-500 mr-1" />
                        <span className="text-sm text-gray-600">{employee.rating}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Report */}
      {activeReport === 'revenue' && (
        <div className="space-y-6 animate-fadeInUp" style={{animationDelay: '0.5s'}}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <FiTrendingUp className="h-6 w-6 text-green-600 mr-2" />
                📈 Revenue Trend
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" tickFormatter={(value) => `$${value}`} />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip formatter={(value, name) => [
                      name === 'revenue' || name === 'profit' ? formatCurrency(value) : value,
                      name === 'revenue' ? 'Revenue' : name === 'profit' ? 'Profit' : 'Orders'
                    ]} />
                    <Bar yAxisId="left" dataKey="revenue" fill="#10b981" />
                    <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <FiDollarSign className="h-6 w-6 text-green-600 mr-2" />
                💰 Profit Analysis
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => `$${value}`} />
                    <Tooltip formatter={(value) => [formatCurrency(value), 'Profit']} />
                    <Area type="monotone" dataKey="profit" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Report */}
      {activeReport === 'analytics' && (
        <div className="space-y-6 animate-fadeInUp" style={{animationDelay: '0.5s'}}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <FiActivity className="h-6 w-6 text-purple-600 mr-2" />
                📊 Growth Analysis
              </h3>
              <div className="space-y-4">
                {categoryData.map((category, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-900">{category.category}</span>
                      <span className={`text-sm font-medium ${
                        category.growth > 10 ? 'text-green-600' : 
                        category.growth > 5 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {category.growth > 0 ? '+' : ''}{category.growth}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          category.growth > 10 ? 'bg-green-500' : 
                          category.growth > 5 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(category.growth * 5, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500 mt-1">
                      <span>{formatCurrency(category.sales)}</span>
                      <span>{category.items} items</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <FiZap className="h-6 w-6 text-yellow-600 mr-2" />
                ⚡ Quick Stats
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 font-medium">Total Revenue</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {formatCurrency(revenueData.reduce((sum, item) => sum + item.revenue, 0))}
                      </p>
                    </div>
                    <FiDollarSign className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
                
                <div className="p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 font-medium">Total Orders</p>
                      <p className="text-2xl font-bold text-green-900">
                        {revenueData.reduce((sum, item) => sum + item.orders, 0).toLocaleString()}
                      </p>
                    </div>
                    <FiShoppingCart className="h-8 w-8 text-green-600" />
                  </div>
                </div>
                
                <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-600 font-medium">Avg Order Value</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {formatCurrency(revenueData.reduce((sum, item) => sum + item.revenue, 0) / revenueData.reduce((sum, item) => sum + item.orders, 0))}
                      </p>
                    </div>
                    <FiTrendingUp className="h-8 w-8 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <FiClock className="h-6 w-6 text-gray-600 mr-2" />
                🕒 Recent Activity
              </h3>
              <div className="space-y-3">
                {[
                  { action: 'New order received', time: '2 min ago', type: 'order' },
                  { action: 'Inventory updated', time: '15 min ago', type: 'inventory' },
                  { action: 'Customer registered', time: '1 hour ago', type: 'customer' },
                  { action: 'Report generated', time: '2 hours ago', type: 'report' },
                  { action: 'Payment processed', time: '3 hours ago', type: 'payment' }
                ].map((activity, index) => (
                  <div key={index} className="flex items-center p-2 bg-gray-50 rounded-lg">
                    <div className={`w-2 h-2 rounded-full mr-3 ${
                      activity.type === 'order' ? 'bg-green-500' :
                      activity.type === 'inventory' ? 'bg-blue-500' :
                      activity.type === 'customer' ? 'bg-purple-500' :
                      activity.type === 'report' ? 'bg-yellow-500' :
                      'bg-gray-500'
                    }`}></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
