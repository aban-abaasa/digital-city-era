import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { 
  FiShield, FiAlertTriangle, FiCheckCircle, FiXCircle, FiEye,
  FiActivity, FiTrendingUp, FiTrendingDown, FiClock, FiMapPin,
  FiSmartphone, FiCreditCard, FiDollarSign, FiUsers, FiPercent,
  FiPieChart, FiFilter, FiDownload, FiRefreshCw,
  FiInfo, FiZap, FiLock, FiSearch, FiCalendar, FiGlobe
} from 'react-icons/fi';
import paymentService from '../services/paymentService';

const PaymentSecurity = ({ isOpen, onClose }) => {
  const [securityData, setSecurityData] = useState({
    fraudAlerts: [],
    riskTransactions: [],
    securityMetrics: {},
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('24h');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    if (isOpen) {
      loadSecurityData();
    }
  }, [isOpen, selectedTimeframe]);

  const loadSecurityData = async () => {
    setLoading(true);
    try {
      // Simulate loading security data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockData = {
        fraudAlerts: [
          {
            id: 1,
            type: 'suspicious_location',
            severity: 'high',
            message: 'Payment from unusual location detected',
            timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
            amount: 1250.00,
            location: 'Unknown VPN',
            resolved: false
          },
          {
            id: 2,
            type: 'velocity_check',
            severity: 'medium',
            message: 'Multiple rapid transactions detected',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
            amount: 299.99,
            count: 5,
            resolved: true
          },
          {
            id: 3,
            type: 'device_mismatch',
            severity: 'low',
            message: 'Payment from new device',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
            amount: 49.99,
            device: 'iPhone 15 Pro',
            resolved: true
          }
        ],
        riskTransactions: [
          {
            id: 'txn_001',
            amount: 2500.00,
            riskScore: 85,
            riskLevel: 'high',
            paymentMethod: 'card',
            timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
            factors: ['High amount', 'New device', 'Unusual time'],
            status: 'under_review'
          },
          {
            id: 'txn_002',
            amount: 75.50,
            riskScore: 35,
            riskLevel: 'medium',
            paymentMethod: 'digital_wallet',
            timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
            factors: ['Multiple cards'],
            status: 'approved'
          }
        ],
        securityMetrics: {
          totalTransactions: 1547,
          fraudBlocked: 23,
          fraudRate: 1.49,
          averageRiskScore: 28,
          falsePositives: 3,
          detectionAccuracy: 96.7
        },
        recentActivity: [
          {
            id: 1,
            type: 'fraud_rule_triggered',
            message: 'High-value transaction rule triggered',
            timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
            severity: 'medium'
          },
          {
            id: 2,
            type: 'security_update',
            message: 'Payment security rules updated',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
            severity: 'info'
          }
        ]
      };
      
      setSecurityData(mockData);
    } catch (error) {
      toast.error('Failed to load security data');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveAlert = async (alertId) => {
    try {
      setSecurityData(prev => ({
        ...prev,
        fraudAlerts: prev.fraudAlerts.map(alert =>
          alert.id === alertId ? { ...alert, resolved: true } : alert
        )
      }));
      toast.success('Alert resolved successfully');
    } catch (error) {
      toast.error('Failed to resolve alert');
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-600 to-purple-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FiShield className="h-6 w-6 text-white mr-3" />
                <div>
                  <h3 className="text-xl font-bold text-white">
                    🔒 Payment Security Center
                  </h3>
                  <p className="text-red-100 text-sm">
                    Real-time fraud detection and transaction monitoring
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center bg-white/20 rounded-lg px-3 py-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
                  <span className="text-white text-sm font-medium">Live Monitoring</span>
                </div>
                <button
                  onClick={onClose}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <FiXCircle className="h-6 w-6" />
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading security data...</p>
            </div>
          ) : (
            <div className="p-6">
              {/* Controls */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Timeframe</label>
                    <select
                      value={selectedTimeframe}
                      onChange={(e) => setSelectedTimeframe(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="1h">Last Hour</option>
                      <option value="24h">Last 24 Hours</option>
                      <option value="7d">Last 7 Days</option>
                      <option value="30d">Last 30 Days</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Filter</label>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="all">All Alerts</option>
                      <option value="unresolved">Unresolved</option>
                      <option value="high">High Risk</option>
                      <option value="fraud">Fraud Detected</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={loadSecurityData}
                    className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <FiRefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </button>
                  <button className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                    <FiDownload className="h-4 w-4 mr-2" />
                    Export
                  </button>
                </div>
              </div>

              {/* Security Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-bold text-green-800">Fraud Detection</h4>
                      <div className="text-3xl font-bold text-green-600 mt-2">
                        {securityData.securityMetrics.detectionAccuracy}%
                      </div>
                      <p className="text-green-700 text-sm mt-1">Accuracy Rate</p>
                    </div>
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                      <FiShield className="h-8 w-8 text-white" />
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-green-700">Blocked:</span>
                      <span className="font-bold ml-1">{securityData.securityMetrics.fraudBlocked}</span>
                    </div>
                    <div>
                      <span className="text-green-700">False Positives:</span>
                      <span className="font-bold ml-1">{securityData.securityMetrics.falsePositives}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-bold text-blue-800">Transaction Volume</h4>
                      <div className="text-3xl font-bold text-blue-600 mt-2">
                        {securityData.securityMetrics.totalTransactions.toLocaleString()}
                      </div>
                      <p className="text-blue-700 text-sm mt-1">Processed Today</p>
                    </div>
                    <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">
                      <FiActivity className="h-8 w-8 text-white" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center">
                    <FiTrendingUp className="h-4 w-4 text-green-500 mr-1" />
                    <span className="text-sm text-green-600 font-medium">+12.5% from yesterday</span>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-bold text-yellow-800">Risk Score</h4>
                      <div className="text-3xl font-bold text-yellow-600 mt-2">
                        {securityData.securityMetrics.averageRiskScore}
                      </div>
                      <p className="text-yellow-700 text-sm mt-1">Average Risk</p>
                    </div>
                    <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center">
                      <FiAlertTriangle className="h-8 w-8 text-white" />
                    </div>
                  </div>
                  <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-yellow-500 h-2 rounded-full transition-all"
                      style={{ width: `${securityData.securityMetrics.averageRiskScore}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Fraud Alerts */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center">
                      <FiAlertTriangle className="h-5 w-5 mr-2 text-red-500" />
                      Active Fraud Alerts
                    </h3>
                    <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                      {securityData.fraudAlerts.filter(alert => !alert.resolved).length} Active
                    </span>
                  </div>
                  
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {securityData.fraudAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-4 rounded-xl border ${getSeverityColor(alert.severity)} ${
                          alert.resolved ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full mr-3 ${
                              alert.severity === 'high' ? 'bg-red-500' :
                              alert.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                            }`}></div>
                            <span className="font-medium text-sm uppercase tracking-wide">
                              {alert.type.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            {alert.resolved ? (
                              <FiCheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <button
                                onClick={() => handleResolveAlert(alert.id)}
                                className="text-xs bg-white px-3 py-1 rounded-full font-medium hover:bg-gray-50 transition-colors"
                              >
                                Resolve
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <p className="text-gray-800 font-medium mb-2">{alert.message}</p>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Amount:</span>
                            <span className="font-bold ml-1">${alert.amount?.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Time:</span>
                            <span className="font-medium ml-1">
                              {new Date(alert.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                        
                        {alert.location && (
                          <div className="mt-2 flex items-center text-sm">
                            <FiMapPin className="h-4 w-4 mr-1 text-gray-500" />
                            <span>{alert.location}</span>
                          </div>
                        )}
                        
                        {alert.device && (
                          <div className="mt-2 flex items-center text-sm">
                            <FiSmartphone className="h-4 w-4 mr-1 text-gray-500" />
                            <span>{alert.device}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Risk Transactions */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center">
                      <FiActivity className="h-5 w-5 mr-2 text-purple-500" />
                      High-Risk Transactions
                    </h3>
                    <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                      {securityData.riskTransactions.length} Flagged
                    </span>
                  </div>
                  
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {securityData.riskTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center">
                            <span className="font-mono text-sm text-gray-600">
                              {transaction.id}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              transaction.status === 'approved' ? 'bg-green-100 text-green-800' :
                              transaction.status === 'under_review' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {transaction.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <span className="text-gray-600 text-sm">Amount:</span>
                            <span className="font-bold text-lg ml-1">
                              ${transaction.amount.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600 text-sm">Risk Score:</span>
                            <span className={`font-bold text-lg ml-1 ${getRiskColor(transaction.riskLevel)}`}>
                              {transaction.riskScore}/100
                            </span>
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all ${
                                transaction.riskLevel === 'high' ? 'bg-red-500' :
                                transaction.riskLevel === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${transaction.riskScore}%` }}
                            ></div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center text-sm">
                            <FiCreditCard className="h-4 w-4 mr-2 text-gray-500" />
                            <span className="capitalize">{transaction.paymentMethod.replace('_', ' ')}</span>
                            <span className="mx-2">•</span>
                            <span>{new Date(transaction.timestamp).toLocaleTimeString()}</span>
                          </div>
                          
                          <div className="flex flex-wrap gap-1">
                            {transaction.factors.map((factor, index) => (
                              <span
                                key={index}
                                className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs"
                              >
                                {factor}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Security Activity */}
              <div className="mt-8">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <FiClock className="h-5 w-5 mr-2 text-blue-500" />
                  Recent Security Activity
                </h3>
                
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="space-y-3">
                    {securityData.recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                        <div className="flex items-center">
                          <div className={`w-2 h-2 rounded-full mr-3 ${
                            activity.severity === 'high' ? 'bg-red-500' :
                            activity.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                          }`}></div>
                          <span className="font-medium">{activity.message}</span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(activity.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <div className="flex items-center">
                  <FiShield className="h-4 w-4 mr-1" />
                  <span>Real-time monitoring active</span>
                </div>
                <div className="flex items-center">
                  <FiLock className="h-4 w-4 mr-1" />
                  <span>End-to-end encrypted</span>
                </div>
              </div>
              <div className="text-xs text-gray-400">
                Last updated: {new Date().toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSecurity;
