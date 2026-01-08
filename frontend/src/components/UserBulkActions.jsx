import React, { useState } from 'react';
import {
  FiFilter, FiUserPlus, FiUserMinus, FiUserCheck,
  FiTrash2, FiMail, FiDownload, FiUpload, FiRefreshCw,
  FiCheckCircle, FiX, FiChevronDown, FiSearch
} from 'react-icons/fi';
import { notificationService } from '../services/notificationService';

const UserBulkActions = ({ selectedUsers, onAction }) => {
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: [],
    type: [],
    verificationStatus: [],
    registrationDate: {
      from: '',
      to: ''
    }
  });
  const [customFilters, setCustomFilters] = useState([]);

  const handleBulkAction = async (action) => {
    if (!selectedUsers.length) {
      notificationService.show('Please select users first', 'warning');
      return;
    }

    try {
      setLoading(true);
      await onAction?.(action, selectedUsers);
      notificationService.show(`Bulk ${action} completed successfully`, 'success');
    } catch (error) {
      notificationService.show(`Failed to perform bulk ${action}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const addCustomFilter = () => {
    setCustomFilters([
      ...customFilters,
      { field: '', operator: 'equals', value: '' }
    ]);
  };

  const removeCustomFilter = (index) => {
    setCustomFilters(customFilters.filter((_, i) => i !== index));
  };

  const updateCustomFilter = (index, field, value) => {
    const updatedFilters = [...customFilters];
    updatedFilters[index] = { ...updatedFilters[index], [field]: value };
    setCustomFilters(updatedFilters);
  };

  const clearFilters = () => {
    setFilters({
      status: [],
      type: [],
      verificationStatus: [],
      registrationDate: {
        from: '',
        to: ''
      }
    });
    setCustomFilters([]);
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions Bar */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Primary Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkAction('activate')}
              disabled={loading || !selectedUsers.length}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <FiUserCheck className="h-5 w-5" />
              <span>Activate Selected</span>
            </button>
            <button
              onClick={() => handleBulkAction('deactivate')}
              disabled={loading || !selectedUsers.length}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 flex items-center gap-2"
            >
              <FiUserMinus className="h-5 w-5" />
              <span>Deactivate Selected</span>
            </button>
            <button
              onClick={() => handleBulkAction('delete')}
              disabled={loading || !selectedUsers.length}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              <FiTrash2 className="h-5 w-5" />
              <span>Delete Selected</span>
            </button>
          </div>

          {/* Secondary Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkAction('email')}
              disabled={loading || !selectedUsers.length}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <FiMail className="h-5 w-5" />
              <span>Email Selected</span>
            </button>
            <button
              onClick={() => handleBulkAction('export')}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              <FiDownload className="h-5 w-5" />
              <span>Export Users</span>
            </button>
            <button
              onClick={() => handleBulkAction('import')}
              disabled={loading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
            >
              <FiUpload className="h-5 w-5" />
              <span>Import Users</span>
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2">
              <FiFilter className="h-5 w-5 text-gray-400" />
              <span className="font-medium text-gray-900">Advanced Filters</span>
            </div>
            <FiChevronDown
              className={`h-5 w-5 text-gray-400 transform transition-transform ${
                showFilters ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>

        {showFilters && (
          <div className="p-6 space-y-6">
            {/* Filter Groups */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Status Filters */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <div className="space-y-2">
                  {['active', 'inactive', 'pending', 'suspended'].map((status) => (
                    <label key={status} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.status.includes(status)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters(prev => ({
                              ...prev,
                              status: [...prev.status, status]
                            }));
                          } else {
                            setFilters(prev => ({
                              ...prev,
                              status: prev.status.filter(s => s !== status)
                            }));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-600 capitalize">
                        {status}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* User Type Filters */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User Type
                </label>
                <div className="space-y-2">
                  {['customer', 'employee', 'supplier', 'admin'].map((type) => (
                    <label key={type} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.type.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters(prev => ({
                              ...prev,
                              type: [...prev.type, type]
                            }));
                          } else {
                            setFilters(prev => ({
                              ...prev,
                              type: prev.type.filter(t => t !== type)
                            }));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-600 capitalize">
                        {type}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Registration Date Range
                </label>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-600">From</label>
                    <input
                      type="date"
                      value={filters.registrationDate.from}
                      onChange={(e) =>
                        setFilters(prev => ({
                          ...prev,
                          registrationDate: {
                            ...prev.registrationDate,
                            from: e.target.value
                          }
                        }))
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">To</label>
                    <input
                      type="date"
                      value={filters.registrationDate.to}
                      onChange={(e) =>
                        setFilters(prev => ({
                          ...prev,
                          registrationDate: {
                            ...prev.registrationDate,
                            to: e.target.value
                          }
                        }))
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Filters */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Custom Filters
                </label>
                <button
                  onClick={addCustomFilter}
                  className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  + Add Filter
                </button>
              </div>

              <div className="space-y-3">
                {customFilters.map((filter, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <select
                      value={filter.field}
                      onChange={(e) =>
                        updateCustomFilter(index, 'field', e.target.value)
                      }
                      className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                      <option value="">Select Field</option>
                      <option value="name">Name</option>
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                      <option value="location">Location</option>
                    </select>

                    <select
                      value={filter.operator}
                      onChange={(e) =>
                        updateCustomFilter(index, 'operator', e.target.value)
                      }
                      className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                      <option value="equals">Equals</option>
                      <option value="contains">Contains</option>
                      <option value="starts_with">Starts with</option>
                      <option value="ends_with">Ends with</option>
                    </select>

                    <input
                      type="text"
                      value={filter.value}
                      onChange={(e) =>
                        updateCustomFilter(index, 'value', e.target.value)
                      }
                      placeholder="Value"
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />

                    <button
                      onClick={() => removeCustomFilter(index)}
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      <FiX className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <button
                onClick={clearFilters}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Clear all filters
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFilters(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Apply filters
                    onAction?.('filter', { filters, customFilters });
                    setShowFilters(false);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Filters Display */}
      {(filters.status.length > 0 ||
        filters.type.length > 0 ||
        filters.registrationDate.from ||
        filters.registrationDate.to ||
        customFilters.length > 0) && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-500">Active Filters:</span>
            {filters.status.map((status) => (
              <span
                key={status}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2"
              >
                Status: {status}
                <button
                  onClick={() =>
                    setFilters(prev => ({
                      ...prev,
                      status: prev.status.filter(s => s !== status)
                    }))
                  }
                  className="hover:text-blue-600"
                >
                  <FiX className="h-4 w-4" />
                </button>
              </span>
            ))}
            {filters.type.map((type) => (
              <span
                key={type}
                className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm flex items-center gap-2"
              >
                Type: {type}
                <button
                  onClick={() =>
                    setFilters(prev => ({
                      ...prev,
                      type: prev.type.filter(t => t !== type)
                    }))
                  }
                  className="hover:text-purple-600"
                >
                  <FiX className="h-4 w-4" />
                </button>
              </span>
            ))}
            {filters.registrationDate.from && (
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm flex items-center gap-2">
                From: {filters.registrationDate.from}
                <button
                  onClick={() =>
                    setFilters(prev => ({
                      ...prev,
                      registrationDate: { ...prev.registrationDate, from: '' }
                    }))
                  }
                  className="hover:text-green-600"
                >
                  <FiX className="h-4 w-4" />
                </button>
              </span>
            )}
            {filters.registrationDate.to && (
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm flex items-center gap-2">
                To: {filters.registrationDate.to}
                <button
                  onClick={() =>
                    setFilters(prev => ({
                      ...prev,
                      registrationDate: { ...prev.registrationDate, to: '' }
                    }))
                  }
                  className="hover:text-green-600"
                >
                  <FiX className="h-4 w-4" />
                </button>
              </span>
            )}
            {customFilters.map((filter, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm flex items-center gap-2"
              >
                {filter.field} {filter.operator} {filter.value}
                <button
                  onClick={() => removeCustomFilter(index)}
                  className="hover:text-yellow-600"
                >
                  <FiX className="h-4 w-4" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserBulkActions;