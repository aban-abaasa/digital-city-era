import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
// import { useAuth } from '../contexts/AuthContext'; // Disabled for demo
import {
  FiHome,
  FiShoppingCart,
  FiPackage,
  FiUsers,
  FiUserCheck,
  FiTruck,
  FiFileText,
  FiMenu,
  FiX,
  FiLogOut,
  FiUser,
  FiSettings,
} from 'react-icons/fi';
import DemoNavigation from './DemoNavigation';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Mock user data for demo (no authentication needed)
  const user = { name: 'Manager', email: 'manager@faredeal.com' };
  const location = useLocation();

  const navigation = [
    { name: 'Main Landing', href: '/', icon: FiHome },
    { name: 'Dashboard', href: '/dashboard', icon: FiHome },
    { name: 'POS System', href: '/pos', icon: FiShoppingCart },
    { name: 'Products', href: '/products', icon: FiPackage },
    { name: 'Sales', href: '/sales', icon: FiShoppingCart },
    { name: 'Customers', href: '/customers', icon: FiUsers },
    { name: 'Employees', href: '/employees', icon: FiUserCheck },
    { name: 'Suppliers', href: '/suppliers', icon: FiTruck },
    { name: 'Inventory', href: '/inventory', icon: FiPackage },
    { name: 'Reports', href: '/reports', icon: FiFileText },
  ];

  const customerNavigation = [
    { name: 'Customer Portal', href: '/customer-dashboard', icon: FiUser },
    { name: 'Customer Landing', href: '/customer', icon: FiUsers },
  ];

  const portalNavigation = [
    { name: 'Main Landing Site', href: '/', icon: FiHome },
    { name: 'Portal Landing', href: '/portals', icon: FiUser },
    { name: 'Portal Test', href: '/portal-test', icon: FiSettings },
    { name: 'Manager Portal', href: '/manager-portal', icon: FiUserCheck },
    { name: 'Cashier Portal', href: '/cashier-portal', icon: FiUsers },
    { name: 'Supplier Portal', href: '/supplier-portal', icon: FiTruck },
  ];

  const handleLogout = () => {
    // Mock logout for demo
    console.log('Logout clicked (demo mode)');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DemoNavigation />
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
          <div className="flex h-16 items-center justify-between px-4">
            <h1 className="text-xl font-bold text-blue-600">FAREDEAL</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <FiX className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
            
            {/* Customer Navigation Section */}
            <div className="pt-4 mt-4 border-t border-gray-200">
              <div className="px-2 py-1">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer Portal</h3>
              </div>
              {customerNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? 'bg-green-100 text-green-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </div>

            {/* Professional Portals Section */}
            <div className="pt-4 mt-4 border-t border-gray-200">
              <div className="px-2 py-1">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Professional Portals</h3>
              </div>
              {portalNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <div className="flex h-16 items-center px-4">
            <h1 className="text-xl font-bold text-blue-600">FAREDEAL</h1>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
            
            {/* Customer Navigation Section */}
            <div className="pt-4 mt-4 border-t border-gray-200">
              <div className="px-2 py-1">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer Portal</h3>
              </div>
              {customerNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? 'bg-green-100 text-green-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </div>

            {/* Professional Portals Section */}
            <div className="pt-4 mt-4 border-t border-gray-200">
              <div className="px-2 py-1">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Professional Portals</h3>
              </div>
              {portalNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <FiMenu className="h-6 w-6" />
          </button>

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1"></div>
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* User menu */}
              <div className="relative">
                <div className="flex items-center gap-x-2">
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">
                      {user?.firstName} {user?.lastName}
                    </div>
                    <div className="text-gray-500 capitalize">{user?.role}</div>
                  </div>
                  <div className="flex items-center gap-x-2">
                    <button className="p-2 text-gray-400 hover:text-gray-600">
                      <FiUser className="h-5 w-5" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-600">
                      <FiSettings className="h-5 w-5" />
                    </button>
                    <button
                      onClick={handleLogout}
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      <FiLogOut className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
