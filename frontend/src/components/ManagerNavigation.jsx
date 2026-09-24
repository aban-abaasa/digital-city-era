// ManagerNavigation Component v3.0 - shared portal navigator (desktop pills, phone bottom sheet)
import React from 'react';
import PortalTabNavigator from './PortalTabNavigator';
import {
  FiBarChart, FiTruck, FiDollarSign, FiBriefcase
} from 'react-icons/fi';

const ManagerNavigation = ({ activeTab, setActiveTab, name, email }) => {
  const tabs = [
    {
      id: 'overview',
      label: 'Dashboard',
      icon: FiBarChart,
      description: 'Business overview',
      color: 'from-blue-500 to-blue-600',
      ugandaEmoji: '📊'
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: FiTruck,
      description: 'Order management',
      color: 'from-orange-500 to-orange-600',
      ugandaEmoji: '📦'
    },
    {
      id: 'business-operations',
      label: 'Payroll & Transport',
      icon: FiBriefcase,
      description: 'Workforce operations',
      color: 'from-indigo-500 to-blue-600',
      ugandaEmoji: '🏢'
    },
    {
      id: 'ican-wallet',
      label: 'IcanEra Wallet',
      icon: FiDollarSign,
      description: 'Wallet & rewards',
      color: 'from-violet-500 to-fuchsia-600',
      ugandaEmoji: '₡'
    }
  ];

  // Same navigator as the customer dashboard: pill tabs on desktop, a section
  // bar + bottom-sheet menu on phones (replaces the old slide-out drawer).
  return (
    <PortalTabNavigator
      tabs={tabs}
      activeTab={activeTab}
      onSelect={setActiveTab}
      name={name}
      email={email}
      initial={(name || 'M').charAt(0).toUpperCase()}
    />
  );
};

export default ManagerNavigation;
