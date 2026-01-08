import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { 
  FiPlus, 
  FiSearch, 
  FiEdit, 
  FiTrash2, 
  FiUsers, 
  FiPhone, 
  FiMail, 
  FiRefreshCw,
  FiBell,
  FiTrendingUp,
  FiDollarSign,
  FiUserCheck,
  FiActivity,
  FiStar,
  FiShield,
  FiEye,
  FiCalendar,
  FiMapPin
} from 'react-icons/fi';
import AnimatedCounter from '../components/AnimatedCounter';
import { useApp } from '../contexts/AppContext';

const Customers = () => {
  const { state } = useApp();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [customerMetrics, setCustomerMetrics] = useState({
    totalCustomers: 0,
    newCustomers: 0,
    activeCustomers: 0,
    totalSpent: 0,
    averageSpent: 0,
    loyaltyMembers: 0
  });
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
    },
    dateOfBirth: '',
    gender: '',
  });

  useEffect(() => {
    fetchCustomers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Live time updates
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await axios.get('/api/customers', { params: { limit: 100 } });
      const customersData = response.data.customers;
      setCustomers(customersData);
      calculateCustomerMetrics(customersData);
    } catch (err) {
      toast.error('Failed to fetch customers');
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateCustomerMetrics = (customersData) => {
    const today = new Date();
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const newCustomers = customersData.filter(customer => {
      const customerDate = new Date(customer.createdAt || customer.dateCreated);
      return customerDate >= thisMonth;
    }).length;

    const activeCustomers = customersData.filter(customer => {
      const lastVisit = new Date(customer.lastVisit || customer.updatedAt);
      const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
      return lastVisit >= thirtyDaysAgo;
    }).length;

    const totalSpent = customersData.reduce((sum, customer) => sum + (customer.totalSpent || 0), 0);
    const averageSpent = customersData.length > 0 ? totalSpent / customersData.length : 0;
    const loyaltyMembers = customersData.filter(customer => 
      customer.membershipLevel && customer.membershipLevel !== 'bronze'
    ).length;

    setCustomerMetrics({
      totalCustomers: customersData.length,
      newCustomers,
      activeCustomers,
      totalSpent,
      averageSpent,
      loyaltyMembers
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (showEditModal) {
        await axios.put(`/api/customers/${selectedCustomer._id}`, formData);
        toast.success('Customer updated successfully');
      } else {
        await axios.post('/api/customers', formData);
        toast.success('Customer created successfully');
      }
      fetchCustomers();
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save customer');
      console.error('Error saving customer:', err);
    }
  };

  const handleDelete = async (customerId) => {
    if (!window.confirm('Are you sure you want to delete this customer?')) return;
    try {
      await axios.delete(`/api/customers/${customerId}`);
      toast.success('Customer deleted successfully');
      fetchCustomers();
    } catch (err) {
      toast.error('Failed to delete customer');
      console.error('Error deleting customer:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: { street: '', city: '', state: '', zipCode: '' },
      dateOfBirth: '',
      gender: '',
    });
    setShowAddModal(false);
    setShowEditModal(false);
    setSelectedCustomer(null);
  };

  const openEditModal = (customer) => {
    setSelectedCustomer(customer);
    setFormData({
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email || '',
      phone: customer.phone,
      address: customer.address || { street: '', city: '', state: '', zipCode: '' },
      dateOfBirth: customer.dateOfBirth ? customer.dateOfBirth.split('T')[0] : '',
      gender: customer.gender || '',
    });
    setShowEditModal(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: state.settings?.currency || 'UGX'
    }).format(amount);
  };

  const filteredCustomers = customers.filter(customer =>
    (customer.firstName && customer.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (customer.lastName && customer.lastName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (customer.phone && customer.phone.includes(searchTerm))
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700">Loading Customers...</h2>
          <p className="text-gray-500">Fetching customer data and analytics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center">
              👥 Customer Management
              <span className="ml-3 text-2xl">📊</span>
            </h1>
            <p className="text-lg text-gray-600 mt-2">
              {currentTime.toLocaleDateString('en-UG', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })} • {currentTime.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={fetchCustomers}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FiRefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <FiPlus className="h-4 w-4 mr-2" />
              Add Customer
            </button>
            <div className="relative">
              <button className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                <FiBell className="h-4 w-4 mr-2" />
                Notifications
                {state.notifications?.length > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
                    {state.notifications.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications Banner */}
      {state.notifications?.length > 0 && (
        <div className="mb-6 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FiBell className="h-5 w-5 text-yellow-600 mr-3" />
              <span className="font-medium text-yellow-800">
                {state.notifications[0].message}
              </span>
            </div>
            <span className="text-xs text-yellow-600">
              {state.notifications.length} total notifications
            </span>
          </div>
        </div>
      )}

      {/* Customer Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100">Total Customers</p>
              <p className="text-3xl font-bold">
                <AnimatedCounter end={customerMetrics.totalCustomers} duration={2000} />
              </p>
              <p className="text-blue-200 text-sm flex items-center mt-2">
                <FiUsers className="h-4 w-4 mr-1" />
                {customerMetrics.newCustomers} new this month
              </p>
            </div>
            <FiUsers className="h-12 w-12 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100">Active Customers</p>
              <p className="text-3xl font-bold">
                <AnimatedCounter end={customerMetrics.activeCustomers} duration={1500} />
              </p>
              <p className="text-green-200 text-sm flex items-center mt-2">
                <FiTrendingUp className="h-4 w-4 mr-1" />
                Last 30 days
              </p>
            </div>
            <FiUserCheck className="h-12 w-12 text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100">Total Revenue</p>
              <p className="text-3xl font-bold">
                <AnimatedCounter end={customerMetrics.totalSpent} duration={1800} />
              </p>
              <p className="text-purple-200 text-sm flex items-center mt-2">
                <FiDollarSign className="h-4 w-4 mr-1" />
                Avg: {formatCurrency(customerMetrics.averageSpent)}
              </p>
            </div>
            <FiDollarSign className="h-12 w-12 text-purple-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100">Loyalty Members</p>
              <p className="text-3xl font-bold">
                <AnimatedCounter end={customerMetrics.loyaltyMembers} duration={1200} />
              </p>
              <p className="text-orange-200 text-sm flex items-center mt-2">
                <FiStar className="h-4 w-4 mr-1" />
                Premium & Gold tiers
              </p>
            </div>
            <FiStar className="h-12 w-12 text-orange-200" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">⚡ Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <button
            onClick={() => setShowAddModal(true)}
            className="group bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 hover:border-gray-200"
          >
            <div className="flex flex-col items-center text-center">
              <div className="bg-green-500 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                <FiPlus className="h-6 w-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                Add Customer
              </span>
            </div>
          </button>
          <button
            onClick={() => {/* Export functionality */}}
            className="group bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 hover:border-gray-200"
          >
            <div className="flex flex-col items-center text-center">
              <div className="bg-blue-500 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                <FiEye className="h-6 w-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                View Reports
              </span>
            </div>
          </button>
          <button
            onClick={() => {/* Loyalty program */}}
            className="group bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 hover:border-gray-200"
          >
            <div className="flex flex-col items-center text-center">
              <div className="bg-purple-500 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                <FiStar className="h-6 w-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                Loyalty Program
              </span>
            </div>
          </button>
          <button
            onClick={() => {/* Customer insights */}}
            className="group bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 hover:border-gray-200"
          >
            <div className="flex flex-col items-center text-center">
              <div className="bg-indigo-500 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                <FiActivity className="h-6 w-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                Analytics
              </span>
            </div>
          </button>
          <button
            onClick={() => {/* Communication */}}
            className="group bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 hover:border-gray-200"
          >
            <div className="flex flex-col items-center text-center">
              <div className="bg-teal-500 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                <FiMail className="h-6 w-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                Send Email
              </span>
            </div>
          </button>
          <button
            onClick={() => {/* Import customers */}}
            className="group bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 hover:border-gray-200"
          >
            <div className="flex flex-col items-center text-center">
              <div className="bg-orange-500 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                <FiUsers className="h-6 w-6 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                Import Data
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">👥 Customer Directory</h3>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiSearch className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Membership
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Spent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Points
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCustomers.map((customer) => (
                    <tr key={customer._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full flex items-center justify-center">
                              <FiUsers className="h-5 w-5 text-white" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {customer.firstName || ''} {customer.lastName || ''}
                            </div>
                            <div className="text-sm text-gray-500">
                              {customer.totalVisits || 0} visits
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 flex items-center">
                          <FiPhone className="h-4 w-4 mr-1" />
                          {customer.phone || 'N/A'}
                        </div>
                        {customer.email && (
                          <div className="text-sm text-gray-500 flex items-center">
                            <FiMail className="h-4 w-4 mr-1" />
                            {customer.email}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                          (customer.membershipLevel || 'bronze') === 'platinum' ? 'bg-purple-100 text-purple-800' :
                          (customer.membershipLevel || 'bronze') === 'gold' ? 'bg-yellow-100 text-yellow-800' :
                          (customer.membershipLevel || 'bronze') === 'silver' ? 'bg-gray-100 text-gray-800' :
                          'bg-orange-100 text-orange-800'
                        }`}>
                          {customer.membershipLevel || 'bronze'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {formatCurrency(customer.totalSpent || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {customer.loyaltyPoints || 0} pts
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => openEditModal(customer)}
                            className="text-indigo-600 hover:text-indigo-900 p-1 rounded hover:bg-indigo-50"
                          >
                            <FiEdit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(customer._id)}
                            className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Recent Activity */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FiActivity className="h-5 w-5 mr-2 text-blue-600" />
              Recent Activity
            </h3>
            <div className="space-y-3">
              {state.notifications?.slice(0, 5).map((notification, index) => (
                <div key={index} className="flex items-center space-x-3 text-sm">
                  <div className={`w-2 h-2 rounded-full ${
                    notification.type === 'success' ? 'bg-green-500' :
                    notification.type === 'warning' ? 'bg-yellow-500' :
                    notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                  }`} />
                  <span className="text-gray-700 flex-1">{notification.message}</span>
                  <span className="text-gray-400 text-xs">
                    {new Date(notification.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Customers */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FiStar className="h-5 w-5 mr-2 text-yellow-600" />
              Top Customers
            </h3>
            <div className="space-y-3">
              {customers
                .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
                .slice(0, 5)
                .map((customer, index) => (
                <div key={customer._id || index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full flex items-center justify-center">
                      <FiUsers className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-900">
                        {customer.firstName} {customer.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{customer.membershipLevel || 'bronze'}</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-green-600">
                    {formatCurrency(customer.totalSpent || 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Customer Insights */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FiShield className="h-5 w-5 mr-2 text-green-600" />
              Customer Insights
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">New This Month</span>
                <span className="flex items-center text-green-600 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  {customerMetrics.newCustomers}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Active Customers</span>
                <span className="flex items-center text-blue-600 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  {customerMetrics.activeCustomers}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Loyalty Members</span>
                <span className="flex items-center text-purple-600 text-sm">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                  {customerMetrics.loyaltyMembers}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Customer Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 shadow-lg rounded-xl bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  {showEditModal ? '✏️ Edit Customer' : '➕ Add New Customer'}
                </h3>
                <button
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                      className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                    <input
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                      className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({...formData, gender: e.target.value})}
                      className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2"
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Street"
                      value={formData.address.street}
                      onChange={(e) => setFormData({...formData, address: {...formData.address, street: e.target.value}})}
                      className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2"
                    />
                    <input
                      type="text"
                      placeholder="City"
                      value={formData.address.city}
                      onChange={(e) => setFormData({...formData, address: {...formData.address, city: e.target.value}})}
                      className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2"
                    />
                    <input
                      type="text"
                      placeholder="State"
                      value={formData.address.state}
                      onChange={(e) => setFormData({...formData, address: {...formData.address, state: e.target.value}})}
                      className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2"
                    />
                    <input
                      type="text"
                      placeholder="ZIP Code"
                      value={formData.address.zipCode}
                      onChange={(e) => setFormData({...formData, address: {...formData.address, zipCode: e.target.value}})}
                      className="block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    {showEditModal ? 'Update' : 'Create'} Customer
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
