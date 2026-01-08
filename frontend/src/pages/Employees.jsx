import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FiPlus, FiSearch, FiEdit, FiTrash2, FiUserCheck, FiMail, FiPhone } from 'react-icons/fi';

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    role: 'cashier',
    salary: '',
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await axios.get('/api/employees', { params: { limit: 100 } });
      setEmployees(response.data.employees);
    } catch {
      toast.error('Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (showEditModal) {
        await axios.put(`/api/employees/${selectedEmployee._id}`, formData);
        toast.success('Employee updated successfully');
      } else {
        await axios.post('/api/employees', formData);
        toast.success('Employee created successfully');
      }
      fetchEmployees();
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save employee');
    }
  };

  const handleDelete = async (employeeId) => {
    if (!window.confirm('Are you sure you want to deactivate this employee?')) return;
    try {
      await axios.delete(`/api/employees/${employeeId}`);
      toast.success('Employee deactivated successfully');
      fetchEmployees();
    } catch {
      toast.error('Failed to deactivate employee');
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      phone: '',
      address: '',
      role: 'cashier',
      salary: '',
    });
    setShowAddModal(false);
    setShowEditModal(false);
    setSelectedEmployee(null);
  };

  const openEditModal = (employee) => {
    setSelectedEmployee(employee);
    setFormData({
      username: employee.username,
      email: employee.email,
      password: '',
      firstName: employee.firstName,
      lastName: employee.lastName,
      phone: employee.phone,
      address: employee.address,
      role: employee.role,
      salary: employee.salary.toString(),
    });
    setShowEditModal(true);
  };

  const filteredEmployees = employees.filter(employee =>
    (employee.firstName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (employee.lastName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (employee.username?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center animate-fadeInUp">
          <div className="relative mb-8">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-purple-500 border-r-transparent rounded-full animate-spin mx-auto" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
            <div className="absolute inset-2 w-12 h-12 border-4 border-pink-500 border-b-transparent rounded-full animate-spin mx-auto" style={{animationDuration: '2s'}}></div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3 animate-pulse">👥 Loading Employees...</h2>
          <p className="text-gray-600 text-lg animate-bounce">Fetching employee data</p>
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
      <div className="flex justify-between items-center animate-fadeInUp">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 transform hover:scale-105 transition-all duration-300">👥 Employees</h1>
          <p className="mt-1 text-sm text-gray-500 animate-fadeInUp" style={{animationDelay: '0.2s'}}>Manage employee accounts and roles</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 transition-all duration-300 animate-shimmer"
        >
          <FiPlus className="h-4 w-4 mr-2 animate-bounce-custom" />
          Add Employee
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-4 animate-slideInFromRight" style={{animationDelay: '0.3s'}}>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="h-5 w-5 text-gray-400 animate-pulse" />
          </div>
          <input
            type="text"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-300 transform hover:scale-105 focus:scale-105"
          />
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden animate-fadeInUp" style={{animationDelay: '0.4s'}}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Salary
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEmployees.map((employee, index) => (
                <tr 
                  key={employee._id} 
                  className="hover:bg-gray-50 transition-all duration-300 transform hover:scale-105 animate-fadeInUp"
                  style={{animationDelay: `${0.5 + index * 0.1}s`}}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center transform hover:scale-110 transition-all duration-300 animate-pulse-custom">
                          <FiUserCheck className="h-5 w-5 text-white" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 transform hover:scale-105 transition-all duration-300">
                          {employee.firstName} {employee.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          @{employee.username}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 flex items-center transform hover:scale-105 transition-all duration-300">
                      <FiPhone className="h-4 w-4 mr-1 animate-pulse" />
                      {employee.phone}
                    </div>
                    <div className="text-sm text-gray-500 flex items-center transform hover:scale-105 transition-all duration-300">
                      <FiMail className="h-4 w-4 mr-1 animate-pulse" />
                      {employee.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full transform hover:scale-110 transition-all duration-300 animate-bounce-custom ${
                      employee.role === 'admin' ? 'bg-gradient-to-r from-red-100 to-red-200 text-red-800' :
                      employee.role === 'manager' ? 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800' :
                      employee.role === 'stock_keeper' ? 'bg-gradient-to-r from-green-100 to-green-200 text-green-800' :
                      'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800'
                    }`}>
                      {employee.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 transform hover:scale-105 transition-all duration-300">
                    💰 ${employee.salary.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full transform hover:scale-110 transition-all duration-300 animate-pulse-custom ${
                      employee.isActive
                        ? 'bg-gradient-to-r from-green-100 to-green-200 text-green-800'
                        : 'bg-gradient-to-r from-red-100 to-red-200 text-red-800'
                    }`}>
                      {employee.isActive ? '✅ Active' : '❌ Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => openEditModal(employee)}
                        className="text-indigo-600 hover:text-indigo-900 transform hover:scale-125 transition-all duration-300 animate-wiggle"
                      >
                        <FiEdit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(employee._id)}
                        className="text-red-600 hover:text-red-900 transform hover:scale-125 transition-all duration-300 animate-wiggle"
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

      {/* Add/Edit Employee Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 animate-fadeInUp">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 shadow-lg rounded-md bg-white animate-slideInFromRight">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4 transform hover:scale-105 transition-all duration-300 animate-fadeInUp">
                {showEditModal ? '✏️ Edit Employee' : '➕ Add New Employee'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="animate-fadeInUp" style={{animationDelay: '0.1s'}}>
                    <label className="block text-sm font-medium text-gray-700 transform hover:scale-105 transition-all duration-300">👤 Username</label>
                    <input
                      type="text"
                      required
                      value={formData.username}
                      onChange={(e) => setFormData({...formData, username: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-300 transform hover:scale-105 focus:scale-105"
                    />
                  </div>
                  <div className="animate-fadeInUp" style={{animationDelay: '0.2s'}}>
                    <label className="block text-sm font-medium text-gray-700 transform hover:scale-105 transition-all duration-300">📧 Email</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-300 transform hover:scale-105 focus:scale-105"
                    />
                  </div>
                  <div className="animate-fadeInUp" style={{animationDelay: '0.3s'}}>
                    <label className="block text-sm font-medium text-gray-700 transform hover:scale-105 transition-all duration-300">🔒 Password</label>
                    <input
                      type="password"
                      required={!showEditModal}
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-300 transform hover:scale-105 focus:scale-105"
                    />
                  </div>
                  <div className="animate-fadeInUp" style={{animationDelay: '0.4s'}}>
                    <label className="block text-sm font-medium text-gray-700 transform hover:scale-105 transition-all duration-300">👑 Role</label>
                    <select
                      required
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-300 transform hover:scale-105 focus:scale-105"
                    >
                      <option value="cashier">💰 Cashier</option>
                      <option value="stock_keeper">📦 Stock Keeper</option>
                      <option value="manager">👑 Manager</option>
                      <option value="admin">🔧 Admin</option>
                    </select>
                  </div>
                  <div className="animate-fadeInUp" style={{animationDelay: '0.5s'}}>
                    <label className="block text-sm font-medium text-gray-700 transform hover:scale-105 transition-all duration-300">👤 First Name</label>
                    <input
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-300 transform hover:scale-105 focus:scale-105"
                    />
                  </div>
                  <div className="animate-fadeInUp" style={{animationDelay: '0.6s'}}>
                    <label className="block text-sm font-medium text-gray-700 transform hover:scale-105 transition-all duration-300">👤 Last Name</label>
                    <input
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-300 transform hover:scale-105 focus:scale-105"
                    />
                  </div>
                  <div className="animate-fadeInUp" style={{animationDelay: '0.7s'}}>
                    <label className="block text-sm font-medium text-gray-700 transform hover:scale-105 transition-all duration-300">📱 Phone</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-300 transform hover:scale-105 focus:scale-105"
                    />
                  </div>
                  <div className="animate-fadeInUp" style={{animationDelay: '0.8s'}}>
                    <label className="block text-sm font-medium text-gray-700 transform hover:scale-105 transition-all duration-300">💰 Salary</label>
                    <input
                      type="number"
                      required
                      value={formData.salary}
                      onChange={(e) => setFormData({...formData, salary: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-300 transform hover:scale-105 focus:scale-105"
                    />
                  </div>
                </div>
                <div className="animate-fadeInUp" style={{animationDelay: '0.9s'}}>
                  <label className="block text-sm font-medium text-gray-700 transform hover:scale-105 transition-all duration-300">🏠 Address</label>
                  <textarea
                    required
                    rows={3}
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-300 transform hover:scale-105 focus:scale-105"
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4 animate-fadeInUp" style={{animationDelay: '1s'}}>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 transform hover:scale-105"
                  >
                    ❌ Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 transform hover:scale-105 animate-shimmer"
                  >
                    {showEditModal ? '✏️ Update' : '➕ Create'} Employee
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

export default Employees;
