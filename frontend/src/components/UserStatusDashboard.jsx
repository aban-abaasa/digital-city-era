import React, { useState, useEffect } from 'react';
import {
  FiUsers, FiShield, FiUserPlus, FiUserMinus,
  FiCheckCircle, FiXCircle, FiAlertTriangle, FiClock,
  FiFilter, FiRefreshCw, FiDownload, FiUpload
} from 'react-icons/fi';
import { notificationService } from '../services/notificationService';

const UserStatusDashboard = ({ users, onAction }) => {
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    userType: 'all',
    verificationStatus: 'all',
    search: ''
  });
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [statsVisible, setStatsVisible] = useState(true);

  // Statistics calculation
  const stats = {
    total: users?.length || 0,
    active: users?.filter(u => u.status === 'active').length || 0,
    pending: users?.filter(u => u.status === 'pending').length || 0,
    suspended: users?.filter(u => u.status === 'suspended').length || 0
  };

  // Filter users based on current filters
  const filteredUsers = users?.filter(user => {
    if (filters.status !== 'all' && user.status !== filters.status) return false;
    if (filters.userType !== 'all' && user.type !== filters.userType) return false;
    if (filters.verificationStatus !== 'all' && user.verificationStatus !== filters.verificationStatus) return false;
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      return (
        user.name?.toLowerCase().includes(searchTerm) ||
        user.email?.toLowerCase().includes(searchTerm) ||
        user.id?.toString().includes(searchTerm)
      );
    }
    return true;
  }) || [];

  const handleBulkAction = async (action) => {
    if (!selectedUsers.length) {
      notificationService.show('Please select users first', 'warning');
      return;
    }

    try {
      setLoading(true);
      await onAction?.(action, selectedUsers);
      setSelectedUsers([]);
      notificationService.show(`Bulk ${action} completed successfully`, 'success');
    } catch (error) {
      notificationService.show(`Failed to perform bulk ${action}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const getUserStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'green';
      case 'pending':
        return 'yellow';
      case 'suspended':
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-4 gap-6 transition-all duration-500 ${
        statsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'
      }`}>
        {[
          {
            title: 'Total Users',
            value: stats.total,
            icon: FiUsers,
            color: 'blue',
            increase: '+12%'
          },
          {
            title: 'Active Users',
            value: stats.active,
            icon: FiCheckCircle,
            color: 'green',
            increase: '+8%'
          },
          {
            title: 'Pending Verification',
            value: stats.pending,
            icon: FiClock,
            color: 'yellow',
            increase: '-5%'
          },
          {
            title: 'Suspended Users',
            value: stats.suspended,
            icon: FiXCircle,
            color: 'red',
            increase: '-2%'
          }
        ].map((stat, index) => (
          <div
            key={index}
            className={`bg-white rounded-xl shadow-sm p-6 border border-${stat.color}-100 hover:shadow-lg transition-shadow`}
          >
            <div className="flex items-center justify-between">
              <div className={`p-3 rounded-lg bg-${stat.color}-50`}>
                <stat.icon className={`h-6 w-6 text-${stat.color}-600`} />
              </div>
              <span className={`text-sm font-medium ${
                stat.increase.startsWith('+') ? 'text-green-600' : 'text-red-600'
              }`}>
                {stat.increase}
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mt-4">{stat.value}</h3>
            <p className="text-sm text-gray-600">{stat.title}</p>
            <div className="mt-4 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full bg-${stat.color}-500 rounded-full`}
                style={{ width: `${(stat.value / stats.total) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Filters and Actions */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <input
                type="text"
                placeholder="Search users..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            </div>
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-4">
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>

            <select
              value={filters.userType}
              onChange={(e) => setFilters(prev => ({ ...prev, userType: e.target.value }))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="customer">Customer</option>
              <option value="employee">Employee</option>
              <option value="supplier">Supplier</option>
              <option value="admin">Admin</option>
            </select>

            <select
              value={filters.verificationStatus}
              onChange={(e) => setFilters(prev => ({ ...prev, verificationStatus: e.target.value }))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Verification</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
              <option value="in_progress">In Progress</option>
            </select>
          </div>

          {/* Bulk Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkAction('activate')}
              disabled={loading || !selectedUsers.length}
              className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <FiUserPlus className="h-5 w-5" />
              <span>Activate</span>
            </button>
            <button
              onClick={() => handleBulkAction('suspend')}
              disabled={loading || !selectedUsers.length}
              className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              <FiUserMinus className="h-5 w-5" />
              <span>Suspend</span>
            </button>
          </div>
        </div>
      </div>

      {/* User Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === filteredUsers.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUsers(filteredUsers.map(u => u.id));
                      } else {
                        setSelectedUsers([]);
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Verification
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user, index) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers(prev => [...prev, user.id]);
                        } else {
                          setSelectedUsers(prev => prev.filter(id => id !== user.id));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0">
                        {user.avatar ? (
                          <img
                            src={user.avatar}
                            alt=""
                            className="h-10 w-10 rounded-full"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                            <FiUser className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.name}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {user.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-${getUserStatusColor(user.status)}-100 text-${getUserStatusColor(user.status)}-800`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.verificationStatus === 'verified'
                        ? 'bg-green-100 text-green-800'
                        : user.verificationStatus === 'in_progress'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.verificationStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => onAction?.('view', user.id)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </button>
                      <button
                        onClick={() => onAction?.('edit', user.id)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onAction?.('delete', user.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {filteredUsers.length === 0 && (
          <div className="p-12 text-center">
            <FiUsers className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserStatusDashboard;