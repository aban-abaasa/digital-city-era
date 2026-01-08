import React, { useState } from 'react';
import { FiX, FiMessageSquare, FiMail, FiDownload, FiBarChart, FiCalendar, FiFilter, FiClock, FiUsers, FiPackage, FiDollarSign, FiTrendingUp, FiSettings } from 'react-icons/fi';
import AdvancedReportService from '../services/advancedReportService';
import { toast } from 'react-toastify';

const ReportModal = ({ isOpen, onClose }) => {
  const [reportConfig, setReportConfig] = useState({
    type: 'sales',
    dateRange: 'last30days',
    customStartDate: '',
    customEndDate: '',
    recipients: {
      sms: '',
      email: ''
    }
  });
  const [activeTab, setActiveTab] = useState('configure');
  const [generatedReport, setGeneratedReport] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const reportTypes = [
    { value: 'sales', label: '📈 Sales Report', description: 'Revenue, orders, and customer analytics', icon: FiTrendingUp },
    { value: 'inventory', label: '📦 Inventory Report', description: 'Stock levels, turnover, and reorder alerts', icon: FiPackage },
    { value: 'employees', label: '👥 Employee Report', description: 'Performance, attendance, and productivity metrics', icon: FiUsers },
    { value: 'financial', label: '💰 Financial Report', description: 'Profit, expenses, and cash flow analysis', icon: FiDollarSign },
    { value: 'customers', label: '👤 Customer Report', description: 'Customer insights, satisfaction, and retention', icon: FiUsers },
    { value: 'suppliers', label: '🤝 Supplier Report', description: 'Performance, delivery, and partnership metrics', icon: FiPackage },
    { value: 'dashboard', label: '📊 Dashboard Report', description: 'Comprehensive business overview and KPIs', icon: FiBarChart }
  ];

  const dateRanges = [
    { value: 'today', label: 'Today', icon: '📅' },
    { value: 'yesterday', label: 'Yesterday', icon: '📅' },
    { value: 'last7days', label: 'Last 7 Days', icon: '📅' },
    { value: 'last30days', label: 'Last 30 Days', icon: '📅' },
    { value: 'thismonth', label: 'This Month', icon: '📅' },
    { value: 'lastmonth', label: 'Last Month', icon: '📅' },
    { value: 'thisyear', label: 'This Year', icon: '📅' },
    { value: 'lastyear', label: 'Last Year', icon: '📅' },
    { value: 'custom', label: 'Custom Range', icon: '📅' }
  ];

  const generateReport = async () => {
    try {
      setLoading(true);
      
      const customRange = reportConfig.dateRange === 'custom' && reportConfig.customStartDate && reportConfig.customEndDate ? {
        start: new Date(reportConfig.customStartDate),
        end: new Date(reportConfig.customEndDate)
      } : null;

      const reportData = await AdvancedReportService.generateComprehensiveReport(
        reportConfig.type,
        reportConfig.dateRange,
        customRange,
        { includeCharts: true, includeInsights: true }
      );

      setGeneratedReport(reportData);
      setActiveTab('preview');
      toast.success('Report generated successfully!');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendSMS = async () => {
    if (!reportConfig.recipients.sms) {
      toast.error('Please enter a phone number for SMS');
      return;
    }
    
    if (!generatedReport) {
      toast.error('Please generate a report first');
      return;
    }

    const result = await AdvancedReportService.sendReportViaSMS(reportConfig.recipients.sms, generatedReport);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  const handleSendEmail = async () => {
    if (!reportConfig.recipients.email) {
      toast.error('Please enter an email address');
      return;
    }
    
    if (!generatedReport) {
      toast.error('Please generate a report first');
      return;
    }

    const result = await AdvancedReportService.sendReportViaEmail(reportConfig.recipients.email, generatedReport);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  const handleDownloadPDF = () => {
    if (!generatedReport) {
      toast.error('Please generate a report first');
      return;
    }

    const doc = AdvancedReportService.generateReportPDF(generatedReport);
    doc.save(`faredeal-${generatedReport.reportType}-report-${Date.now()}.pdf`);
    toast.success('Report PDF downloaded successfully!');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 p-6 text-white rounded-t-2xl flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
              <FiBarChart className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">📊 Business Reports</h2>
              <p className="text-purple-100">Generate and send comprehensive business analytics</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:text-gray-200 bg-white/20 p-2 rounded-lg">
            <FiX className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button
            className={`flex-1 py-3 text-center font-medium text-sm transition-all ${
              activeTab === 'configure' ? 'border-b-2 border-purple-600 text-purple-700 bg-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
            onClick={() => setActiveTab('configure')}
          >
            <FiFilter className="inline-block mr-2" /> Configure Report
          </button>
          <button
            className={`flex-1 py-3 text-center font-medium text-sm transition-all ${
              activeTab === 'preview' ? 'border-b-2 border-purple-600 text-purple-700 bg-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
            onClick={() => setActiveTab('preview')}
            disabled={!generatedReport}
          >
            <FiBarChart className="inline-block mr-2" /> Preview Report
          </button>
          <button
            className={`flex-1 py-3 text-center font-medium text-sm transition-all ${
              activeTab === 'send' ? 'border-b-2 border-purple-600 text-purple-700 bg-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
            onClick={() => setActiveTab('send')}
            disabled={!generatedReport}
          >
            <FiMail className="inline-block mr-2" /> Send Report
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'configure' && (
            <div className="space-y-6">
              {/* Report Type Selection */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">📋 Select Report Type</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reportTypes.map((type) => (
                    <div
                      key={type.value}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        reportConfig.type === type.value
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300 hover:bg-purple-25'
                      }`}
                      onClick={() => setReportConfig({...reportConfig, type: type.value})}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-gray-800">{type.label}</p>
                          <p className="text-sm text-gray-600">{type.description}</p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          reportConfig.type === type.value 
                            ? 'border-purple-500 bg-purple-500' 
                            : 'border-gray-300'
                        }`}>
                          {reportConfig.type === type.value && (
                            <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Date Range Selection */}
              <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-xl p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">📅 Select Date Range</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {dateRanges.map((range) => (
                    <button
                      key={range.value}
                      onClick={() => setReportConfig({...reportConfig, dateRange: range.value})}
                      className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        reportConfig.dateRange === range.value
                          ? 'border-green-500 bg-green-100 text-green-700'
                          : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>

                {reportConfig.dateRange === 'custom' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                      <input
                        type="date"
                        value={reportConfig.customStartDate}
                        onChange={(e) => setReportConfig({...reportConfig, customStartDate: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                      <input
                        type="date"
                        value={reportConfig.customEndDate}
                        onChange={(e) => setReportConfig({...reportConfig, customEndDate: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Generate Button */}
              <div className="text-center">
                <button
                  onClick={generateReport}
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 font-bold text-lg transition-all transform hover:scale-105 shadow-lg"
                >
                  <FiBarChart className="inline h-5 w-5 mr-2" />
                  {loading ? 'Generating...' : 'Generate Report'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'preview' && generatedReport && (
            <div className="space-y-6">
              {/* Report Header */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-2">
                  {generatedReport.reportType.charAt(0).toUpperCase() + generatedReport.reportType.slice(1)} Report
                </h3>
                <p className="text-gray-600">{generatedReport.title}</p>
                <p className="text-sm text-gray-500 mt-2">
                  Period: {generatedReport.dateRange} | Generated: {new Date(generatedReport.generatedAt).toLocaleString('en-UG')}
                </p>
              </div>

              {/* Summary Cards */}
              {generatedReport.summary && (
                <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-xl p-6">
                  <h4 className="text-lg font-bold text-gray-800 mb-4">📊 Executive Summary</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Object.entries(generatedReport.summary).map(([key, value]) => {
                      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                      const formattedValue = (typeof value === 'number' && (key.includes('amount') || key.includes('total') || key.includes('revenue'))) 
                        ? formatCurrency(value) 
                        : value;
                      
                      return (
                        <div key={key} className="bg-white p-4 rounded-lg text-center shadow-sm">
                          <p className="text-sm text-gray-600 mb-1">{label}</p>
                          <p className="text-xl font-bold text-green-600">{formattedValue}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Insights Section */}
              {generatedReport.insights && generatedReport.insights.length > 0 && (
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6">
                  <h4 className="text-lg font-bold text-gray-800 mb-4">💡 Key Insights</h4>
                  <div className="space-y-3">
                    {generatedReport.insights.map((insight, index) => (
                      <div key={index} className="bg-white p-4 rounded-lg shadow-sm">
                        <p className="text-gray-700">{insight}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Table Preview */}
              {generatedReport.data && generatedReport.data[generatedReport.reportType] && generatedReport.data[generatedReport.reportType].length > 0 && (
                <div className="bg-white rounded-xl border-2 border-gray-200">
                  <div className="p-4 bg-gray-50 border-b">
                    <h4 className="text-lg font-bold text-gray-800">📈 Data Preview (First 5 Records)</h4>
                  </div>
                  <div className="p-4 overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b">
                          {Object.keys(generatedReport.data[generatedReport.reportType][0]).map((key) => (
                            <th key={key} className="text-left py-2 px-4 font-bold text-gray-700 text-sm">
                              {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {generatedReport.data[generatedReport.reportType].slice(0, 5).map((row, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            {Object.entries(row).map(([key, value]) => {
                              const formattedValue = (typeof value === 'number' && (key.includes('amount') || key.includes('total') || key.includes('price') || key.includes('revenue'))) 
                                ? formatCurrency(value) 
                                : value;
                              
                              return (
                                <td key={key} className="py-2 px-4 text-sm text-gray-600">
                                  {formattedValue}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {generatedReport.data[generatedReport.reportType].length > 5 && (
                      <p className="text-center text-gray-500 text-sm mt-4 italic">
                        Showing 5 of {generatedReport.data[generatedReport.reportType].length} records. Full data available in PDF download.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'send' && generatedReport && (
            <div className="space-y-6">
              {/* Report Summary */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 text-center">
                <h3 className="text-lg font-bold text-gray-800 mb-2">📊 Ready to Send</h3>
                <p className="text-gray-600">
                  {generatedReport.reportType.charAt(0).toUpperCase() + generatedReport.reportType.slice(1)} Report | {generatedReport.dateRange}
                </p>
              </div>

              {/* Recipient Configuration */}
              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">👥 Configure Recipients</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">SMS Phone Number</label>
                    <input
                      type="tel"
                      value={reportConfig.recipients.sms}
                      onChange={(e) => setReportConfig({
                        ...reportConfig, 
                        recipients: {...reportConfig.recipients, sms: e.target.value}
                      })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      placeholder="+256 700 123 456"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                    <input
                      type="email"
                      value={reportConfig.recipients.email}
                      onChange={(e) => setReportConfig({
                        ...reportConfig, 
                        recipients: {...reportConfig.recipients, email: e.target.value}
                      })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      placeholder="manager@company.com"
                    />
                  </div>
                </div>
              </div>

              {/* Send Options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* SMS */}
                <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-blue-200">
                  <div className="text-center">
                    <FiMessageSquare className="h-12 w-12 mx-auto mb-4 text-blue-600" />
                    <h4 className="text-lg font-bold text-gray-800 mb-2">📱 Send via SMS</h4>
                    <p className="text-gray-600 text-sm mb-4">
                      Quick summary with key metrics
                    </p>
                    <button
                      onClick={handleSendSMS}
                      className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-bold transition-all"
                    >
                      Send SMS Summary
                    </button>
                  </div>
                </div>

                {/* Email */}
                <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-green-200">
                  <div className="text-center">
                    <FiMail className="h-12 w-12 mx-auto mb-4 text-green-600" />
                    <h4 className="text-lg font-bold text-gray-800 mb-2">📧 Send via Email</h4>
                    <p className="text-gray-600 text-sm mb-4">
                      Complete report with full details
                    </p>
                    <button
                      onClick={handleSendEmail}
                      className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold transition-all"
                    >
                      Send Full Report
                    </button>
                  </div>
                </div>

                {/* PDF */}
                <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-purple-200">
                  <div className="text-center">
                    <FiDownload className="h-12 w-12 mx-auto mb-4 text-purple-600" />
                    <h4 className="text-lg font-bold text-gray-800 mb-2">📄 Download PDF</h4>
                    <p className="text-gray-600 text-sm mb-4">
                      Professional PDF for printing
                    </p>
                    <button
                      onClick={handleDownloadPDF}
                      className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-bold transition-all"
                    >
                      Download PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
