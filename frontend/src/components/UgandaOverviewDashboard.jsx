import React from 'react';
import { FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const UgandaOverviewDashboard = ({
  businessMetrics,
  currentTime,
  managerProfile,
  revenueData,
  topProducts,
  formatCurrency,
  timeRange,
  setTimeRange
}) => {

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const growth = businessMetrics.weeklyGrowth || 0;
  const isPositiveGrowth = growth >= 0;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {getGreeting()}, {managerProfile.name} <span className="align-middle">🇺🇬</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Kampala, Uganda • {currentTime.toLocaleTimeString('en-UG', {
              timeZone: 'Africa/Kampala',
              hour12: true
            })} EAT
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-sm text-gray-500">Today's Revenue</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(businessMetrics.todayRevenue)}</p>
          <span className={`inline-flex items-center gap-1 text-sm font-medium ${isPositiveGrowth ? 'text-green-600' : 'text-red-600'}`}>
            {isPositiveGrowth ? <FiTrendingUp className="h-3.5 w-3.5" /> : <FiTrendingDown className="h-3.5 w-3.5" />}
            {growth}% vs last week
          </span>
        </div>
      </div>

      {/* Revenue Graph */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Revenue Trend</h2>
          <div className="flex bg-gray-100 rounded-lg p-1">
            {['7d', '30d', '90d'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
              }}
              formatter={(value) => [formatCurrency(value), 'Revenue']}
            />
            <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Products</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {topProducts.slice(0, 6).map((product, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  {index + 1}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 text-sm">{product.name}</h4>
                  <p className="text-xs text-gray-500">{product.category}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(product.revenue)}</p>
                <p className="text-xs text-gray-500">{product.sales} sales</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
};

export default UgandaOverviewDashboard;
