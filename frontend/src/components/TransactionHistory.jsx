// ===================================================
// 📊 TRANSACTION HISTORY & REPORTS
// View past transactions, daily/weekly/monthly reports
// Works for Employee, Manager, and Admin portals
// ===================================================

import React, { useState, useEffect } from 'react';
import { FiSearch, FiCalendar, FiDownload, FiEye, FiPrinter, FiFilter, FiRefreshCw, FiDollarSign, FiTrendingUp, FiShoppingCart, FiUser } from 'react-icons/fi';
import { toast } from 'react-toastify';
import transactionService from '../services/transactionService';
import Receipt from './Receipt';
import useSupermarketBranding from '../hooks/useSupermarketBranding';

const TransactionHistory = ({ cashierId = null, supermarketId = null, managerId = null, viewMode = 'cashier', savedReceipts = [] }) => {
  const branding = useSupermarketBranding();
  const storeName = branding?.name || 'Your Supermarket';
  // viewMode: 'cashier' (own transactions), 'manager' (all transactions), 'admin' (all + analytics)
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all'); // all | unpaid | partial | paid — "customers who owe"
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [dailyReport, setDailyReport] = useState(null);
  const [statsData, setStatsData] = useState({
    totalTransactions: 0,
    totalSales: 0,
    averageBasket: 0,
    totalItems: 0
  });
  const [localReceiptsOnly, setLocalReceiptsOnly] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [collectingFor, setCollectingFor] = useState(null); // transaction being paid off
  const [collectAmount, setCollectAmount] = useState('');
  const [collecting, setCollecting] = useState(false);

  useEffect(() => {
    loadTransactions();
    loadDailyReport();
  }, [dateFilter, viewMode, supermarketId, managerId]);

  useEffect(() => {
    filterTransactions();
  }, [transactions, searchTerm, paymentFilter, invoiceStatusFilter]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const loadTransactions = async () => {
    setLoading(true);
    try {
      let result;
      
      // Only filter by cashier in cashier view mode; only filter by manager
      // in manager view mode (a manager sees only their own cashiers' sales,
      // never the whole supermarket's).
      const filterCashierId = viewMode === 'cashier' ? cashierId : null;
      const filterManagerId = viewMode === 'manager' ? managerId : null;

      switch (dateFilter) {
        case 'today':
          result = await transactionService.getTodaysTransactions(filterCashierId, supermarketId, filterManagerId);
          break;
        case 'week':
          const weekStart = new Date();
          weekStart.setDate(weekStart.getDate() - 7);
          result = await transactionService.getTransactionsByDateRange(
            weekStart.toISOString(),
            new Date().toISOString(),
            filterCashierId,
            supermarketId,
            filterManagerId
          );
          break;
        case 'month':
          const monthStart = new Date();
          monthStart.setDate(1);
          result = await transactionService.getTransactionsByDateRange(
            monthStart.toISOString(),
            new Date().toISOString(),
            filterCashierId,
            supermarketId,
            filterManagerId
          );
          break;
        case 'year':
          const yearStart = new Date();
          yearStart.setMonth(0, 1);
          result = await transactionService.getTransactionsByDateRange(
            yearStart.toISOString(),
            new Date().toISOString(),
            filterCashierId,
            supermarketId,
            filterManagerId
          );
          break;
        default:
          result = await transactionService.getTodaysTransactions(filterCashierId, supermarketId, filterManagerId);
      }

      if (result.success) {
        const txns = result.transactions || [];
        setTransactions(txns);
        setFilteredTransactions(txns);
        
        // Calculate stats from real data
        const totalAmount = txns.reduce((sum, t) => sum + (parseFloat(t.total_amount) || 0), 0);
        const itemCount = txns.reduce((sum, t) => sum + (parseInt(t.items_count) || 0), 0);
        
        setStatsData({
          totalTransactions: txns.length,
          totalSales: totalAmount,
          averageBasket: txns.length > 0 ? totalAmount / txns.length : 0,
          totalItems: itemCount
        });
        
        if (txns.length > 0) {
          toast.success(`✅ Loaded ${txns.length} transaction${txns.length !== 1 ? 's' : ''}`);
        } else {
          console.log('ℹ️ No transactions found for selected period');
        }
      } else {
        console.error('Failed to load transactions:', result.error);
        toast.error('❌ Failed to load transactions');
        setTransactions([]);
        setFilteredTransactions([]);
        setStatsData({
          totalTransactions: 0,
          totalSales: 0,
          averageBasket: 0,
          totalItems: 0
        });
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast.error('❌ Error loading transactions: ' + error.message);
      setTransactions([]);
      setFilteredTransactions([]);
      setStatsData({
        totalTransactions: 0,
        totalSales: 0,
        averageBasket: 0,
        totalItems: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDailyReport = async () => {
    try {
      const filterManagerId = viewMode === 'manager' ? managerId : null;
      const result = await transactionService.getDailyReport(new Date(), supermarketId, filterManagerId);
      if (result.success) {
        setDailyReport(result.report);
      }
    } catch (error) {
      console.error('Error loading daily report:', error);
    }
  };

  const openCollectPayment = (item) => {
    setCollectingFor(item);
    setCollectAmount(String(Math.round(parseFloat(item.balance_due_ugx) || 0)));
  };

  const handleCollectPayment = async () => {
    if (!collectingFor) return;
    setCollecting(true);
    try {
      const result = await transactionService.collectInvoicePayment(collectingFor.id, collectAmount);
      if (result.success) {
        toast.success(
          result.paymentStatus === 'paid'
            ? `✅ Invoice ${collectingFor.receipt_number} fully paid`
            : `✅ Payment recorded — balance due ${formatCurrency(result.balanceDue)}`
        );
        setCollectingFor(null);
        setCollectAmount('');
        await loadTransactions();
      } else {
        toast.error(result.error || 'Failed to record payment');
      }
    } catch (error) {
      toast.error('Failed to record payment: ' + error.message);
    } finally {
      setCollecting(false);
    }
  };

  const filterTransactions = () => {
    let filtered = [...transactions];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(t =>
        t.receipt_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.customer_phone?.includes(searchTerm)
      );
    }

    // Payment method filter
    if (paymentFilter !== 'all') {
      filtered = filtered.filter(t => {
        const method = String(t.payment_method || '').toLowerCase();
        const provider = String(t.payment_provider || '').toLowerCase();
        if (paymentFilter === 'cash') return method === 'cash' || provider === 'cash';
        if (paymentFilter === 'icanera_wallet') {
          return method === 'icanera_wallet' || method === 'ican_wallet' ||
            provider.includes('icanera') || provider.includes('ican wallet');
        }
        return method === paymentFilter;
      });
    }

    // Invoice status filter — "customers who owe" (unpaid/partial sales are
    // invoices; see ADD_TRANSACTION_PAYMENT_STATUS_AND_JOB_STATUS.sql).
    // Rows saved before this feature existed have no payment_status yet, so
    // treat a missing value as 'paid' rather than hiding them from "All".
    if (invoiceStatusFilter !== 'all') {
      filtered = filtered.filter(t => (t.payment_status || 'paid') === invoiceStatusFilter);
    }

    setFilteredTransactions(filtered);
  };

  const handleViewReceipt = async (transaction) => {
    try {
      // Get full transaction with items
      const filterManagerId = viewMode === 'manager' ? managerId : null;
      const result = await transactionService.getTransaction(transaction.id, supermarketId, filterManagerId);
      
      if (result.success) {
        const receiptData = {
          id: transaction.id,
          receiptNumber: transaction.receipt_number,
          transactionId: transaction.transaction_id,
          timestamp: transaction.transaction_date || transaction.created_at,
          amount: transaction.total_amount,
          paymentMethod: transaction.payment_provider,
          // Invoice vs. receipt — see Receipt.jsx's isInvoice. Without these
          // every past bill-later sale re-opened here rendered as a plain
          // paid receipt, hiding that money is still owed.
          paymentStatus: transaction.payment_status,
          amountPaid: transaction.amount_paid_ugx,
          balanceDue: transaction.balance_due_ugx,
          dueDate: transaction.due_date,
          jobStatus: transaction.job_status,
          receipt: {
            items: result.transaction.items,
            subtotal: transaction.subtotal,
            tax: transaction.tax_amount,
            total: transaction.total_amount,
            cashier: transaction.cashier_name,
            register: transaction.register_number
          }
        };

        setSelectedTransaction(receiptData);
        setShowReceipt(true);
      }
    } catch (error) {
      console.error('Error loading receipt:', error);
      toast.error('❌ Failed to load receipt');
    }
  };

  const handleDownloadReport = () => {
    if (!dailyReport) {
      toast.error('❌ No report data available');
      return;
    }

    const reportText = `
${storeName.toUpperCase()} - DAILY SALES REPORT
=====================================

Date: ${dailyReport.report_date}
Generated: ${new Date().toLocaleString('en-UG')}

SUMMARY
-------
Total Transactions: ${dailyReport.total_transactions}
Total Sales: ${formatCurrency(dailyReport.total_sales_ugx)}
Total Tax Collected: ${formatCurrency(dailyReport.total_tax_collected)}
Average Basket: ${formatCurrency(dailyReport.average_basket_size)}

PAYMENT METHODS
---------------
Cash: ${dailyReport.cash_transactions} transactions - ${formatCurrency(dailyReport.cash_amount)}
Mobile Money: ${dailyReport.momo_transactions} transactions - ${formatCurrency(dailyReport.momo_amount)}
Airtel Money: ${dailyReport.airtel_transactions} transactions - ${formatCurrency(dailyReport.airtel_amount)}
Card: ${dailyReport.card_transactions} transactions - ${formatCurrency(dailyReport.card_amount)}

PERFORMANCE
-----------
Largest Transaction: ${formatCurrency(dailyReport.largest_transaction)}
Smallest Transaction: ${formatCurrency(dailyReport.smallest_transaction)}
Total Items Sold: ${dailyReport.total_items_sold}

Generated by ${storeName} POS System
www.${storeName.toLowerCase().replace(/\s+/g, '')}.ug
    `.trim();

    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Daily-Report-${dailyReport.report_date}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success('📥 Report downloaded!');
  };

  const handlePrintReport = () => {
    if (!dailyReport) {
      toast.error('❌ No report data available');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Daily Report - ${dailyReport.report_date}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          h1 { text-align: center; color: #1e40af; border-bottom: 3px solid #1e40af; padding-bottom: 10px; }
          h2 { color: #059669; border-bottom: 2px solid #059669; padding-bottom: 5px; margin-top: 30px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #f3f4f6; font-weight: bold; }
          .total-row { font-weight: bold; background-color: #e5e7eb; }
          .header-info { text-align: center; margin-bottom: 20px; color: #6b7280; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <h1>🏪 ${storeName.toUpperCase()} - DAILY SALES REPORT</h1>
        <div class="header-info">
          <p><strong>Report Date:</strong> ${dailyReport.report_date}</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleString('en-UG')}</p>
        </div>

        <h2>📊 Sales Summary</h2>
        <table>
          <tr><th>Metric</th><th>Value</th></tr>
          <tr><td>Total Transactions</td><td>${dailyReport.total_transactions}</td></tr>
          <tr><td>Total Sales</td><td>${formatCurrency(dailyReport.total_sales_ugx)}</td></tr>
          <tr><td>Total Tax Collected</td><td>${formatCurrency(dailyReport.total_tax_collected)}</td></tr>
          <tr><td>Average Basket Size</td><td>${formatCurrency(dailyReport.average_basket_size)}</td></tr>
          <tr><td>Total Items Sold</td><td>${dailyReport.total_items_sold}</td></tr>
        </table>

        <h2>💳 Payment Methods Breakdown</h2>
        <table>
          <tr><th>Method</th><th>Transactions</th><th>Amount</th></tr>
          <tr><td>💵 Cash</td><td>${dailyReport.cash_transactions}</td><td>${formatCurrency(dailyReport.cash_amount)}</td></tr>
          <tr><td>📱 Mobile Money (MTN)</td><td>${dailyReport.momo_transactions}</td><td>${formatCurrency(dailyReport.momo_amount)}</td></tr>
          <tr><td>📱 Airtel Money</td><td>${dailyReport.airtel_transactions}</td><td>${formatCurrency(dailyReport.airtel_amount)}</td></tr>
          <tr><td>💳 Card</td><td>${dailyReport.card_transactions}</td><td>${formatCurrency(dailyReport.card_amount)}</td></tr>
        </table>

        <h2>📈 Performance Metrics</h2>
        <table>
          <tr><th>Metric</th><th>Value</th></tr>
          <tr><td>Largest Transaction</td><td>${formatCurrency(dailyReport.largest_transaction)}</td></tr>
          <tr><td>Smallest Transaction</td><td>${formatCurrency(dailyReport.smallest_transaction)}</td></tr>
        </table>

        <div style="margin-top: 40px; text-align: center; color: #6b7280; font-size: 12px;">
          <p>Generated by ${storeName} POS System | www.${storeName.toLowerCase().replace(/\s+/g, '')}.ug</p>
          <p>🇺🇬 Uganda's Leading Supermarket Management System</p>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Mobile Header - Compact */}
      {isMobile && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg p-3 shadow-lg">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FiShoppingCart className="h-5 w-5" />
            Transaction History
          </h2>
          <p className="text-xs text-blue-100 mt-1">View and reprint your receipts</p>
        </div>
      )}

      {/* Header Stats - Responsive Grid */}
      <div className={`grid gap-3 md:gap-4 ${isMobile ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-4'}`}>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg md:rounded-xl p-3 md:p-4 text-white shadow-md hover:shadow-lg transition-shadow">
          <FiShoppingCart className={`${isMobile ? 'h-5 w-5' : 'h-8 w-8'} mb-2 opacity-80`} />
          <p className={`opacity-80 ${isMobile ? 'text-xs' : 'text-sm'}`}>Transactions</p>
          <p className={`font-bold ${isMobile ? 'text-lg' : 'text-3xl'}`}>{statsData.totalTransactions}</p>
          <p className={`opacity-60 mt-1 ${isMobile ? 'text-xs' : 'text-xs'}`}>{dateFilter === 'today' ? 'Today' : dateFilter === 'week' ? 'This Week' : dateFilter === 'month' ? 'This Month' : 'This Year'}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg md:rounded-xl p-3 md:p-4 text-white shadow-md hover:shadow-lg transition-shadow">
          <FiDollarSign className={`${isMobile ? 'h-5 w-5' : 'h-8 w-8'} mb-2 opacity-80`} />
          <p className={`opacity-80 ${isMobile ? 'text-xs' : 'text-sm'}`}>Total Sales</p>
          <p className={`font-bold ${isMobile ? 'text-base' : 'text-2xl'}`}>{formatCurrency(statsData.totalSales)}</p>
          <p className={`opacity-60 mt-1 ${isMobile ? 'text-xs' : 'text-xs'}`}>Revenue</p>
        </div>
        {!isMobile && (
          <>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg md:rounded-xl p-3 md:p-4 text-white shadow-md hover:shadow-lg transition-shadow">
              <FiTrendingUp className={`h-8 w-8 mb-2 opacity-80`} />
              <p className={`opacity-80 text-sm`}>Avg Basket</p>
              <p className={`font-bold text-2xl`}>{formatCurrency(statsData.averageBasket)}</p>
              <p className={`opacity-60 mt-1 text-xs`}>Per Tx</p>
            </div>
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg md:rounded-xl p-3 md:p-4 text-white shadow-md hover:shadow-lg transition-shadow">
              <FiShoppingCart className={`h-8 w-8 mb-2 opacity-80`} />
              <p className={`opacity-80 text-sm`}>Items Sold</p>
              <p className={`font-bold text-3xl`}>{statsData.totalItems}</p>
              <p className={`opacity-60 mt-1 text-xs`}>Total Products</p>
            </div>
          </>
        )}
        {isMobile && (
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-3 text-white shadow-md hover:shadow-lg transition-shadow">
            <FiTrendingUp className="h-5 w-5 mb-2 opacity-80" />
            <p className="opacity-80 text-xs">Avg Basket</p>
            <p className="font-bold text-base">{formatCurrency(statsData.averageBasket)}</p>
          </div>
        )}
        {isMobile && (
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-3 text-white shadow-md hover:shadow-lg transition-shadow">
            <FiShoppingCart className="h-5 w-5 mb-2 opacity-80" />
            <p className="opacity-80 text-xs">Items Sold</p>
            <p className="font-bold text-lg">{statsData.totalItems}</p>
          </div>
        )}
      </div>

      {/* Daily Report Insights - Stacked for Mobile */}
      {dailyReport && (
        <div className={`grid gap-3 md:gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
          {/* Tax Collected */}
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg md:rounded-xl p-3 md:p-4 text-white shadow-md">
            <p className={`opacity-80 ${isMobile ? 'text-xs' : 'text-sm'}`}>💰 Tax Collected</p>
            <p className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>{formatCurrency(dailyReport.total_tax_collected || 0)}</p>
            <p className={`opacity-60 mt-1 ${isMobile ? 'text-xs' : 'text-xs'}`}>18% VAT</p>
          </div>

          {/* Payment Methods Summary */}
          <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg md:rounded-xl p-3 md:p-4 text-white shadow-md">
            <p className={`opacity-80 ${isMobile ? 'text-xs' : 'text-sm'}`}>📊 Payment Methods</p>
            <div className={`${isMobile ? 'text-xs' : 'text-sm'} mt-2 space-y-1`}>
              {dailyReport.cash_transactions > 0 && <p>💵 Cash: {dailyReport.cash_transactions}</p>}
              {dailyReport.momo_transactions > 0 && <p>📱 MTN: {dailyReport.momo_transactions}</p>}
              {dailyReport.airtel_transactions > 0 && <p>📱 Airtel: {dailyReport.airtel_transactions}</p>}
              {dailyReport.card_transactions > 0 && <p>💳 Card: {dailyReport.card_transactions}</p>}
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-lg md:rounded-xl p-3 md:p-4 text-white shadow-md">
            <p className={`opacity-80 ${isMobile ? 'text-xs' : 'text-sm'}`}>📈 Performance</p>
            <div className={`${isMobile ? 'text-xs' : 'text-sm'} mt-2 space-y-1`}>
              <p>🏆 {formatCurrency(dailyReport.largest_transaction || 0)}</p>
              <p>🔻 {formatCurrency(dailyReport.smallest_transaction || 0)}</p>
              <p>📦 {dailyReport.total_items_sold} items</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters & Actions - Mobile Optimized */}
      <div className={`bg-white rounded-lg md:rounded-xl shadow-md ${isMobile ? 'p-3' : 'p-6'}`}>
        <div className={`flex flex-col ${isMobile ? 'space-y-2' : 'md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0'} gap-2 ${!isMobile && 'md:gap-4'}`}>
          {/* Search */}
          <div className={`${isMobile ? 'w-full' : 'flex-1 max-w-md'}`}>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isMobile ? "Search..." : "Search receipt, customer..."}
                className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isMobile ? 'text-sm' : ''}`}
              />
            </div>
          </div>

          {/* Filters Row */}
          <div className={`flex items-center ${isMobile ? 'gap-2 w-full' : 'space-x-3'}`}>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className={`px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white flex-1 ${isMobile ? 'text-xs' : ''}`}
            >
              <option value="today">Today</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="year">Year</option>
            </select>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className={`px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 flex-1 ${isMobile ? 'text-xs' : ''}`}
            >
              <option value="all">All Payments</option>
              <option value="cash">Cash</option>
              <option value="icanera_wallet">IcanEra Wallet</option>
              <option value="momo">MTN Mobile Money</option>
              <option value="airtel">Airtel Money</option>
              <option value="card">Card</option>
            </select>

            <select
              value={invoiceStatusFilter}
              onChange={(e) => setInvoiceStatusFilter(e.target.value)}
              title="Filter by whether the customer has paid"
              className={`px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 flex-1 ${isMobile ? 'text-xs' : ''}`}
            >
              <option value="all">All (Paid & Owing)</option>
              <option value="unpaid">🧾 Unpaid</option>
              <option value="partial">🧾 Partially Paid</option>
              <option value="paid">✅ Paid</option>
            </select>

            <button
              onClick={loadTransactions}
              disabled={loading}
              className={`bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 ${isMobile ? 'px-3 py-2 text-sm' : 'px-4 py-2'}`}
            >
              <FiRefreshCw className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} ${loading ? 'animate-spin' : ''}`} />
              <span>{isMobile ? 'Refresh' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Report Actions & Toggle */}
        <div className={`mt-4 flex flex-col ${isMobile ? 'space-y-2' : 'md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0'} gap-2 ${!isMobile && 'md:gap-3'}`}>
          <div className={`flex items-center ${isMobile ? 'gap-2 w-full' : 'space-x-3'}`}>
            <button
              onClick={handleDownloadReport}
              className={`flex items-center space-x-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex-1 justify-center ${isMobile ? 'px-2 py-2 text-xs' : 'px-4 py-2'}`}
            >
              <FiDownload className={isMobile ? 'h-3 w-3' : 'h-4 w-4'} />
              <span>{isMobile ? 'Download' : 'Download Report'}</span>
            </button>
            
            <button
              onClick={handlePrintReport}
              className={`flex items-center space-x-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex-1 justify-center ${isMobile ? 'px-2 py-2 text-xs' : 'px-4 py-2'}`}
            >
              <FiPrinter className={isMobile ? 'h-3 w-3' : 'h-4 w-4'} />
              <span>{isMobile ? 'Print' : 'Print Report'}</span>
            </button>
          </div>

          {/* Show Local Receipts Toggle */}
          {savedReceipts && savedReceipts.length > 0 && (
            <button
              onClick={() => setLocalReceiptsOnly(!localReceiptsOnly)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors font-medium ${
                localReceiptsOnly
                  ? 'bg-orange-600 text-white hover:bg-orange-700'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              <span>⚠️ Unsaved Receipts</span>
              <span className="bg-white text-orange-600 px-2 py-1 rounded font-bold text-sm">{savedReceipts.length}</span>
            </button>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Show indicator when viewing unsaved receipts */}
        {localReceiptsOnly && (
          <div className={`bg-orange-50 border-b-2 border-orange-200 ${isMobile ? 'px-3 py-2' : 'px-6 py-3'}`}>
            <p className={`text-orange-800 flex items-start ${isMobile ? 'text-xs' : 'text-sm'} space-x-2`}>
              <span>⚠️</span>
              <span><strong>Viewing {savedReceipts.length} unsaved</strong> {isMobile ? 'receipt(s)' : 'receipt(s) - These are stored locally and may not be synced to the system yet'}</span>
            </p>
          </div>
        )}
        
        {/* Mobile Card View */}
        {isMobile ? (
          <div className="p-3 space-y-2">
            {(localReceiptsOnly ? savedReceipts : filteredTransactions).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FiShoppingCart className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                {localReceiptsOnly ? 'No unsaved receipts' : 'No transactions found'}
              </div>
            ) : (
              (localReceiptsOnly ? savedReceipts : filteredTransactions).map((item) => (
                <div key={localReceiptsOnly ? item.receiptNumber : item.id} className="bg-white rounded-lg p-3 border-l-4 border-blue-500 shadow-sm hover:shadow-md transition-shadow active:bg-gray-50">
                  {/* Receipt Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <p className={`font-bold text-sm ${localReceiptsOnly ? 'text-orange-600' : 'text-blue-600'}`}>
                        {localReceiptsOnly ? item.receiptNumber : item.receipt_number}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {localReceiptsOnly
                          ? new Date(item.timestamp).toLocaleDateString('en-UG', { month: 'short', day: 'numeric' })
                          : new Date(item.created_at || item.transaction_date).toLocaleDateString('en-UG', { month: 'short', day: 'numeric' })}
                        {' at '}
                        {localReceiptsOnly
                          ? new Date(item.timestamp).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })
                          : new Date(item.created_at || item.transaction_date).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (localReceiptsOnly) {
                          setSelectedTransaction({
                            receiptNumber: item.receiptNumber,
                            transactionId: item.transactionId,
                            timestamp: item.timestamp,
                            amount: item.total,
                            paymentMethod: item.paymentMethod,
                            receipt: {
                              items: item.items || [],
                              subtotal: item.subtotal,
                              tax: item.tax,
                              total: item.total,
                              cashier: item.cashier || 'Unknown',
                              register: item.register || 'N/A'
                            }
                          });
                        } else {
                          handleViewReceipt(item);
                        }
                        setShowReceipt(true);
                      }}
                      className="px-3 py-1 bg-blue-100 text-blue-600 hover:bg-blue-200 text-xs font-bold rounded"
                    >
                      View
                    </button>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-3 gap-2 text-xs mb-3 pb-3 border-b border-gray-200">
                    <div>
                      <p className="text-gray-500">Payment</p>
                      <p className="font-semibold text-gray-900 text-xs truncate">{localReceiptsOnly ? item.paymentMethod : item.payment_provider}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Items</p>
                      <p className="font-semibold text-gray-900">{localReceiptsOnly ? item.items?.length || 0 : item.items_count}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Status</p>
                      <p className={`font-semibold text-xs ${item.status === 'completed' ? 'text-green-600' : 'text-gray-600'}`}>
                        {item.status === 'completed' ? '✓ Done' : item.status || 'Done'}
                      </p>
                    </div>
                  </div>

                  {/* Amount & Actions */}
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-600">Total Amount</p>
                      <p className="font-bold text-green-600 text-lg">{formatCurrency(localReceiptsOnly ? item.total : item.total_amount)}</p>
                      {!localReceiptsOnly && item.payment_status && item.payment_status !== 'paid' && (
                        <p className="text-xs font-bold text-amber-700 mt-0.5">
                          🧾 {item.payment_status === 'partial' ? 'Partial' : 'Unpaid'} — owes {formatCurrency(item.balance_due_ugx || 0)}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {!localReceiptsOnly && item.payment_status && item.payment_status !== 'paid' && (
                        <button
                          onClick={() => openCollectPayment(item)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-100 text-amber-700 hover:bg-amber-200 rounded font-semibold"
                          title="Collect Payment"
                        >
                          <FiDollarSign className="h-3 w-3" />
                          <span>Collect</span>
                        </button>
                      )}
                      {!localReceiptsOnly && (
                        <button
                          onClick={() => handleViewReceipt(item)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-600 hover:bg-blue-200 rounded font-semibold"
                          title="View Receipt"
                        >
                          <FiEye className="h-3 w-3" />
                          <span>View</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          // Download receipt as JSON
                          const receiptData = localReceiptsOnly ? {
                            receiptNumber: item.receiptNumber,
                            date: new Date(item.timestamp).toLocaleString('en-UG'),
                            amount: item.total,
                            paymentMethod: item.paymentMethod,
                            items: item.items || [],
                            subtotal: item.subtotal,
                            tax: item.tax,
                            total: item.total,
                            status: item.syncStatus
                          } : item;
                          const dataStr = JSON.stringify(receiptData, null, 2);
                          const dataBlob = new Blob([dataStr], { type: 'application/json' });
                          const url = URL.createObjectURL(dataBlob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `Receipt-${localReceiptsOnly ? item.receiptNumber : item.receipt_number}.json`;
                          link.click();
                          toast.success('Receipt downloaded!');
                        }}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-100 text-purple-600 hover:bg-purple-200 rounded font-semibold"
                        title="Download"
                      >
                        <FiDownload className="h-3 w-3" />
                        <span>Download</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedTransaction(localReceiptsOnly ? {
                            receiptNumber: item.receiptNumber,
                            transactionId: item.transactionId,
                            timestamp: item.timestamp,
                            amount: item.total,
                            paymentMethod: item.paymentMethod,
                            receipt: {
                              items: item.items || [],
                              subtotal: item.subtotal,
                              tax: item.tax,
                              total: item.total,
                              cashier: item.cashier || 'Unknown',
                              register: item.register || 'N/A'
                            }
                          } : item);
                          setShowReceipt(true);
                        }}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-600 hover:bg-green-200 rounded font-semibold"
                        title="Print"
                      >
                        <FiPrinter className="h-3 w-3" />
                        <span>Print</span>
                      </button>
                    </div>
                  </div>

                  {/* Sync Status Badge */}
                  {localReceiptsOnly && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <span className={`px-2 py-1 text-xs font-semibold rounded inline-block ${
                        item.syncStatus === 'synced'
                          ? 'bg-green-100 text-green-800'
                          : item.syncStatus === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {item.syncStatus === 'synced' ? '✓ Synced' : item.syncStatus === 'pending' ? '⏳ Pending' : '✗ Failed'}
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          /* Desktop Table View */
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Receipt #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  {localReceiptsOnly && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={localReceiptsOnly ? "7" : "7"} className="px-6 py-8 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-gray-500 mt-2">Loading {localReceiptsOnly ? 'local receipts' : 'transactions'}...</p>
                  </td>
                </tr>
              ) : (localReceiptsOnly ? savedReceipts : filteredTransactions).length === 0 ? (
                <tr>
                  <td colSpan={localReceiptsOnly ? "7" : "7"} className="px-6 py-8 text-center text-gray-500">
                    {localReceiptsOnly ? 'No unsaved receipts' : 'No transactions found'}
                  </td>
                </tr>
              ) : (
                (localReceiptsOnly ? savedReceipts : filteredTransactions).map((item) => (
                  <tr key={localReceiptsOnly ? item.receiptNumber : item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${localReceiptsOnly ? 'text-orange-600' : 'text-gray-900'}`}>
                        {localReceiptsOnly ? item.receiptNumber : item.receipt_number}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {localReceiptsOnly
                          ? new Date(item.timestamp).toLocaleDateString('en-UG')
                          : new Date(item.transaction_date).toLocaleDateString('en-UG')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {localReceiptsOnly
                          ? new Date(item.timestamp).toLocaleTimeString('en-UG')
                          : new Date(item.transaction_date).toLocaleTimeString('en-UG')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        (localReceiptsOnly ? item.paymentMethod : item.payment_method) === 'cash' || (localReceiptsOnly ? item.paymentMethod : item.payment_method) === 'Cash' ? 'bg-green-100 text-green-800' :
                        (localReceiptsOnly ? item.paymentMethod : item.payment_method) === 'momo' || (localReceiptsOnly ? item.paymentMethod : item.payment_method) === 'MTN Mobile Money' ? 'bg-yellow-100 text-yellow-800' :
                        (localReceiptsOnly ? item.paymentMethod : item.payment_method) === 'airtel' || (localReceiptsOnly ? item.paymentMethod : item.payment_method) === 'Airtel Money' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {localReceiptsOnly ? item.paymentMethod : item.payment_provider}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {localReceiptsOnly ? item.items?.length || 0 : item.items_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(localReceiptsOnly ? item.total : item.total_amount)}
                      </span>
                      {!localReceiptsOnly && item.payment_status && item.payment_status !== 'paid' && (
                        <div className="mt-1">
                          <span className="px-2 py-0.5 inline-flex text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                            🧾 {item.payment_status === 'partial' ? 'Partial' : 'Unpaid'} · owes {formatCurrency(item.balance_due_ugx || 0)}
                          </span>
                        </div>
                      )}
                    </td>
                    {localReceiptsOnly && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          item.syncStatus === 'synced'
                            ? 'bg-green-100 text-green-800'
                            : item.syncStatus === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {item.syncStatus === 'synced' ? '✓ Synced' : item.syncStatus === 'pending' ? '⏳ Pending' : '✗ Failed'}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-3">
                        {!localReceiptsOnly && item.payment_status && item.payment_status !== 'paid' && (
                          <button
                            onClick={() => openCollectPayment(item)}
                            className="text-amber-700 hover:text-amber-900 flex items-center space-x-1"
                            title="Collect Payment"
                          >
                            <FiDollarSign className="h-4 w-4" />
                            <span>Collect</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (localReceiptsOnly) {
                              setSelectedTransaction({
                                receiptNumber: item.receiptNumber,
                                transactionId: item.transactionId,
                                timestamp: item.timestamp,
                                amount: item.total,
                                paymentMethod: item.paymentMethod,
                                receipt: {
                                  items: item.items || [],
                                  subtotal: item.subtotal,
                                  tax: item.tax,
                                  total: item.total,
                                  cashier: item.cashier || 'Unknown',
                                  register: item.register || 'N/A'
                                }
                              });
                            } else {
                              handleViewReceipt(item);
                            }
                            setShowReceipt(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 flex items-center space-x-1"
                        >
                          <FiEye className="h-4 w-4" />
                          <span>View</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Receipt Modal */}
      {showReceipt && selectedTransaction && (
        <Receipt
          transaction={{}}
          receiptData={selectedTransaction}
          onClose={() => setShowReceipt(false)}
        />
      )}

      {/* Collect Payment Modal — settle an open invoice's balance due */}
      {collectingFor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Collect Payment</h3>
            <p className="text-sm text-gray-500 mb-4">
              Receipt {collectingFor.receipt_number} · balance due{' '}
              <span className="font-semibold text-amber-700">
                {formatCurrency(collectingFor.balance_due_ugx || 0)}
              </span>
            </p>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Amount received now (UGX)
            </label>
            <input
              type="number"
              min="0"
              max={collectingFor.balance_due_ugx || undefined}
              value={collectAmount}
              onChange={(e) => setCollectAmount(e.target.value)}
              className="w-full mt-1 mb-4 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setCollectingFor(null); setCollectAmount(''); }}
                disabled={collecting}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCollectPayment}
                disabled={collecting || !collectAmount || parseFloat(collectAmount) <= 0}
                className="flex-1 px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-50"
              >
                {collecting ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;
