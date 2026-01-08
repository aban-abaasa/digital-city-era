import React, { useState, useEffect } from 'react';
import { 
  FiTruck, FiPackage, FiUser, FiMail, FiPhone, FiMapPin, FiCalendar,
  FiClock, FiDollarSign, FiTrendingUp, FiTrendingDown, FiCheckCircle,
  FiAlertCircle, FiX, FiPlus, FiEdit, FiTrash2, FiEye, FiDownload,
  FiUpload, FiRefreshCw, FiSearch, FiFilter, FiStar, FiShield,
  FiHash, FiTag, FiTarget, FiZap, FiHeart, FiFileText, FiChevronDown,
  FiCheck, FiSettings, FiBarChart, FiActivity, FiMove, FiCopy
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import PaymentService from '../services/paymentService';

const SupplierManagement = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('suppliers');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [selectedSupplierForHistory, setSelectedSupplierForHistory] = useState(null);

  // Creative payment status helpers
  const getPaymentStatusColor = (status) => {
    switch(status) {
      case 'paid': return '#10B981'; // Green
      case 'unpaid': return '#EF4444'; // Red
      case 'partial': return '#F59E0B'; // Orange/Yellow
      default: return '#6B7280'; // Gray
    }
  };

  const getPaymentStatusIcon = (status) => {
    switch(status) {
      case 'paid': return '✅';
      case 'unpaid': return '❌';
      case 'partial': return '⚡';
      default: return '❓';
    }
  };

  const getPaymentMethodIcon = (method) => {
    switch(method) {
      case 'mobile_money': return '📱';
      case 'bank_transfer': return '🏦';
      case 'check': return '📝';
      case 'cash': return '💰';
      default: return '💳';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG', { 
      style: 'currency', 
      currency: 'UGX',
      minimumFractionDigits: 0 
    }).format(amount);
  };

  const getSupplierPaymentStats = (supplierId) => {
    const history = paymentHistory[supplierId] || [];
    const total = history.length;
    const paid = history.filter(p => p.status === 'paid').length;
    const unpaid = history.filter(p => p.status === 'unpaid').length;
    const partial = history.filter(p => p.status === 'partial').length;
    
    return { total, paid, unpaid, partial };
  };

  const getFilteredPaymentHistory = (supplierId) => {
    const history = paymentHistory[supplierId] || [];
    if (paymentFilter === 'all') return history;
    return history.filter(payment => payment.status === paymentFilter);
  }; // all, paid, unpaid, partial

  // Enhanced payment history data for suppliers
  const [paymentHistory] = useState({
    1: [ // Apple Inc.
      { id: 'PAY-001', date: '2024-01-15', amount: 125000, status: 'paid', dueDate: '2024-02-14', paymentMethod: 'bank_transfer', reference: 'BT-2024-001', daysOverdue: 0 },
      { id: 'PAY-002', date: '2024-01-10', amount: 87500, status: 'paid', dueDate: '2024-02-09', paymentMethod: 'mobile_money', reference: 'MTN-2024-002', daysOverdue: 0 },
      { id: 'PAY-003', date: '2024-01-05', amount: 156000, status: 'partial', dueDate: '2024-02-04', paymentMethod: 'check', reference: 'CHK-2024-003', daysOverdue: 2, paidAmount: 78000 },
      { id: 'PAY-004', date: '2023-12-28', amount: 234000, status: 'unpaid', dueDate: '2024-01-27', paymentMethod: 'bank_transfer', reference: 'BT-2024-004', daysOverdue: 15 },
      { id: 'PAY-005', date: '2023-12-20', amount: 98000, status: 'paid', dueDate: '2024-01-19', paymentMethod: 'mobile_money', reference: 'AIRTL-2024-005', daysOverdue: 0 }
    ],
    2: [ // Samsung Electronics
      { id: 'PAY-006', date: '2024-01-12', amount: 198000, status: 'paid', dueDate: '2024-01-27', paymentMethod: 'bank_transfer', reference: 'BT-2024-006', daysOverdue: 0 },
      { id: 'PAY-007', date: '2024-01-08', amount: 145000, status: 'unpaid', dueDate: '2024-01-23', paymentMethod: 'check', reference: 'CHK-2024-007', daysOverdue: 8 },
      { id: 'PAY-008', date: '2024-01-03', amount: 267000, status: 'partial', dueDate: '2024-01-18', paymentMethod: 'mobile_money', reference: 'MTN-2024-008', daysOverdue: 5, paidAmount: 133500 },
      { id: 'PAY-009', date: '2023-12-25', amount: 89000, status: 'paid', dueDate: '2024-01-09', paymentMethod: 'bank_transfer', reference: 'BT-2024-009', daysOverdue: 0 }
    ],
    3: [ // Microsoft Corporation
      { id: 'PAY-010', date: '2024-01-10', amount: 175000, status: 'paid', dueDate: '2024-02-09', paymentMethod: 'bank_transfer', reference: 'BT-2024-010', daysOverdue: 0 },
      { id: 'PAY-011', date: '2024-01-05', amount: 134000, status: 'unpaid', dueDate: '2024-02-04', paymentMethod: 'check', reference: 'CHK-2024-011', daysOverdue: 3 },
      { id: 'PAY-012', date: '2023-12-30', amount: 298000, status: 'partial', dueDate: '2024-01-29', paymentMethod: 'mobile_money', reference: 'AIRTL-2024-012', daysOverdue: 7, paidAmount: 149000 }
    ]
  });

  const [suppliers, setSuppliers] = useState([
    {
      id: 1,
      name: 'Apple Inc.',
      contact: 'John Smith',
      email: 'orders@apple.com',
      phone: '+1 (555) 123-4567',
      address: '1 Apple Park Way, Cupertino, CA 95014',
      category: 'Electronics',
      rating: 4.9,
      totalOrders: 45,
      totalValue: 1250000,
      lastOrder: '2024-01-15',
      status: 'active',
      paymentTerms: 'Net 30',
      leadTime: '7-14 days',
      image: '🍎',
      paymentScore: 85, // Payment reliability score
      outstandingAmount: 312000, // Total unpaid + partial amounts
      totalPaid: 938000,
      onTimePayments: 32,
      latePayments: 8
    },
    {
      id: 2,
      name: 'Samsung Electronics',
      contact: 'Emily Johnson',
      email: 'supply@samsung.com',
      phone: '+82 2 2255 0114',
      address: '129 Samsung-ro, Yeongtong-gu, Suwon-si',
      category: 'Electronics',
      rating: 4.7,
      totalOrders: 38,
      totalValue: 980000,
      lastOrder: '2024-01-12',
      status: 'active',
      paymentTerms: 'Net 15',
      leadTime: '10-21 days',
      image: '📱',
      paymentScore: 72,
      outstandingAmount: 278500,
      totalPaid: 701500,
      onTimePayments: 25,
      latePayments: 13
    },
    {
      id: 3,
      name: 'Microsoft Corporation',
      contact: 'Robert Davis',
      email: 'procurement@microsoft.com',
      phone: '+1 (425) 882-8080',
      address: 'One Microsoft Way, Redmond, WA 98052',
      category: 'Software',
      rating: 4.8,
      totalOrders: 29,
      totalValue: 750000,
      lastOrder: '2024-01-10',
      status: 'active',
      paymentTerms: 'Net 45',
      leadTime: '5-10 days',
      image: '💻',
      paymentScore: 78,
      outstandingAmount: 432000,
      totalPaid: 318000,
      onTimePayments: 21,
      latePayments: 8
    }
  ]);

  // Enhanced order management states
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [orderFilter, setOrderFilter] = useState('all');
  const [orderSortBy, setOrderSortBy] = useState('date');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [inventoryFilter, setInventoryFilter] = useState('all');
  const [showStockAdjustment, setShowStockAdjustment] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null);
  const [showAddProduct, setShowAddProduct] = useState(false);

  const [orders, setOrders] = useState([
    {
      id: 1,
      supplierId: 1,
      supplierName: 'Apple Inc.',
      orderNumber: 'PO-2024-001',
      date: '2024-01-15',
      expectedDate: '2024-01-29',
      actualDeliveryDate: null,
      status: 'pending',
      paymentStatus: 'not-paid',
      paidAmount: 0,
      total: 37499.30,
      subtotal: 36499.30,
      tax: 1000.00,
      currency: 'UGX',
      items: [
        { 
          id: 1, 
          name: 'iPhone 15 Pro Max 256GB', 
          sku: 'IPH15PM256',
          quantity: 20, 
          unitPrice: 1199.99, 
          totalPrice: 23999.80,
          category: 'Smartphones',
          description: 'Latest iPhone model with advanced camera system',
          received: 0,
          damaged: 0
        },
        { 
          id: 2, 
          name: 'AirPods Pro 3rd Gen', 
          sku: 'APPRO3',
          quantity: 50, 
          unitPrice: 249.99, 
          totalPrice: 12499.50,
          category: 'Audio',
          description: 'Wireless earbuds with active noise cancellation',
          received: 0,
          damaged: 0
        }
      ],
      priority: 'high',
      requestedBy: 'Catherine Nakiyonga',
      approvedBy: null,
      deliveryAddress: {
        street: 'Plot 15, Industrial Area',
        city: 'Kampala',
        district: 'Kampala',
        country: 'Uganda',
        postalCode: '00256'
      },
      deliveryInstructions: 'Handle with care - fragile electronics',
      paymentTerms: 'Net 30',
      notes: 'Urgent order for holiday season stock',
      trackingNumber: null,
      documents: ['purchase_order.pdf', 'supplier_quote.pdf'],
      timeline: [
        { date: '2024-01-15', event: 'Order Created', user: 'Catherine Nakiyonga', status: 'info' },
        { date: '2024-01-15', event: 'Pending Approval', user: 'System', status: 'warning' }
      ]
    },
    {
      id: 2,
      supplierId: 2,
      supplierName: 'Samsung Electronics',
      orderNumber: 'PO-2024-002',
      date: '2024-01-12',
      expectedDate: '2024-01-22',
      actualDeliveryDate: '2024-01-21',
      status: 'shipped',
      paymentStatus: 'half-paid',
      paidAmount: 12498.77,
      total: 24997.55,
      subtotal: 23997.55,
      tax: 1000.00,
      currency: 'UGX',
      items: [
        { 
          id: 3, 
          name: 'Galaxy S24 Ultra 512GB', 
          sku: 'GAL24U512',
          quantity: 15, 
          unitPrice: 1199.99, 
          totalPrice: 17999.85,
          category: 'Smartphones',
          description: 'Premium Android smartphone with S Pen',
          received: 15,
          damaged: 0
        },
        { 
          id: 4, 
          name: 'Galaxy Buds Pro 2', 
          sku: 'GALPRO2',
          quantity: 30, 
          unitPrice: 199.99, 
          totalPrice: 5999.70,
          category: 'Audio',
          description: 'Premium wireless earbuds with ANC',
          received: 30,
          damaged: 1
        }
      ],
      priority: 'medium',
      requestedBy: 'John Mukasa',
      approvedBy: 'Catherine Nakiyonga',
      deliveryAddress: {
        street: 'Plot 25, Nakawa Industrial Area',
        city: 'Kampala',
        district: 'Kampala',
        country: 'Uganda',
        postalCode: '00256'
      },
      deliveryInstructions: 'Deliver between 9 AM - 5 PM',
      paymentTerms: 'Net 15',
      notes: 'Fast-moving inventory for Q1 sales',
      trackingNumber: 'TRK-SAM-2024-002',
      documents: ['purchase_order.pdf', 'shipping_manifest.pdf', 'payment_receipt.pdf'],
      timeline: [
        { date: '2024-01-12', event: 'Order Created', user: 'John Mukasa', status: 'info' },
        { date: '2024-01-12', event: 'Approved', user: 'Catherine Nakiyonga', status: 'success' },
        { date: '2024-01-18', event: 'Shipped', user: 'Samsung Logistics', status: 'info' },
        { date: '2024-01-21', event: 'Delivered', user: 'DHL Uganda', status: 'success' }
      ]
    },
    {
      id: 3,
      supplierId: 3,
      supplierName: 'Microsoft Corporation',
      orderNumber: 'PO-2024-003',
      date: '2024-01-10',
      expectedDate: '2024-01-17',
      actualDeliveryDate: '2024-01-16',
      status: 'delivered',
      paymentStatus: 'paid',
      paidAmount: 13199.90,
      total: 13199.90,
      subtotal: 11999.90,
      tax: 1200.00,
      currency: 'UGX',
      items: [
        { 
          id: 5, 
          name: 'Surface Pro 9 i7 512GB', 
          sku: 'SURF9I7512',
          quantity: 10, 
          unitPrice: 1199.99, 
          totalPrice: 11999.90,
          category: 'Computers',
          description: 'Premium 2-in-1 laptop with detachable keyboard',
          received: 10,
          damaged: 0
        }
      ],
      priority: 'low',
      requestedBy: 'Grace Namukasa',
      approvedBy: 'Catherine Nakiyonga',
      deliveryAddress: {
        street: 'Plot 40, Bugolobi',
        city: 'Kampala',
        district: 'Kampala',
        country: 'Uganda',
        postalCode: '00256'
      },
      deliveryInstructions: 'Secure delivery required - high-value items',
      paymentTerms: 'Net 45',
      notes: 'For corporate client orders',
      trackingNumber: 'TRK-MS-2024-003',
      documents: ['purchase_order.pdf', 'delivery_receipt.pdf', 'warranty_cards.pdf', 'invoice.pdf'],
      timeline: [
        { date: '2024-01-10', event: 'Order Created', user: 'Grace Namukasa', status: 'info' },
        { date: '2024-01-10', event: 'Approved', user: 'Catherine Nakiyonga', status: 'success' },
        { date: '2024-01-14', event: 'Shipped', user: 'Microsoft Logistics', status: 'info' },
        { date: '2024-01-16', event: 'Delivered', user: 'FedEx Uganda', status: 'success' },
        { date: '2024-01-16', event: 'Quality Check Passed', user: 'John Mukasa', status: 'success' }
      ]
    }
  ]);

  // Inventory Management Data
  const [inventory, setInventory] = useState([
    {
      id: 1,
      sku: 'IPH15PM256',
      name: 'iPhone 15 Pro Max 256GB',
      category: 'Smartphones',
      supplier: 'Apple Inc.',
      currentStock: 45,
      reorderLevel: 20,
      maxStock: 100,
      unitCost: 1199.99,
      sellingPrice: 1499.99,
      location: 'A-01-15',
      lastRestocked: '2024-01-10',
      status: 'in-stock',
      reserved: 12,
      available: 33,
      totalValue: 53999.55,
      movement: 'incoming',
      lastSold: '2024-01-14',
      fastMoving: true
    },
    {
      id: 2,
      sku: 'GAL24U512',
      name: 'Galaxy S24 Ultra 512GB',
      category: 'Smartphones',
      supplier: 'Samsung Electronics',
      currentStock: 15,
      reorderLevel: 25,
      maxStock: 80,
      unitCost: 1199.99,
      sellingPrice: 1449.99,
      location: 'A-02-08',
      lastRestocked: '2024-01-08',
      status: 'low-stock',
      reserved: 8,
      available: 7,
      totalValue: 17999.85,
      movement: 'outgoing',
      lastSold: '2024-01-15',
      fastMoving: true
    },
    {
      id: 3,
      sku: 'SURF9I7512',
      name: 'Surface Pro 9 i7 512GB',
      category: 'Tablets',
      supplier: 'Microsoft Corporation',
      currentStock: 0,
      reorderLevel: 15,
      maxStock: 60,
      unitCost: 1199.99,
      sellingPrice: 1399.99,
      location: 'B-01-12',
      lastRestocked: '2023-12-20',
      status: 'out-of-stock',
      reserved: 0,
      available: 0,
      totalValue: 0,
      movement: 'critical',
      lastSold: '2024-01-13',
      fastMoving: false
    },
    {
      id: 4,
      sku: 'APPRO3',
      name: 'AirPods Pro 3rd Gen',
      category: 'Audio',
      supplier: 'Apple Inc.',
      currentStock: 85,
      reorderLevel: 30,
      maxStock: 150,
      unitCost: 249.99,
      sellingPrice: 329.99,
      location: 'C-03-22',
      lastRestocked: '2024-01-12',
      status: 'in-stock',
      reserved: 15,
      available: 70,
      totalValue: 21249.15,
      movement: 'stable',
      lastSold: '2024-01-15',
      fastMoving: true
    },
    {
      id: 5,
      sku: 'GALPRO2',
      name: 'Galaxy Buds Pro 2',
      category: 'Audio',
      supplier: 'Samsung Electronics',
      currentStock: 120,
      reorderLevel: 20,
      maxStock: 200,
      unitCost: 199.99,
      sellingPrice: 279.99,
      location: 'C-02-18',
      lastRestocked: '2024-01-11',
      status: 'overstocked',
      reserved: 5,
      available: 115,
      totalValue: 23998.8,
      movement: 'slow',
      lastSold: '2024-01-12',
      fastMoving: false
    }
  ]);

  // Order management helper functions
  const getOrderStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'shipped': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'delivered': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getOrderStatusIcon = (status) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'approved': return '✅';
      case 'shipped': return '🚛';
      case 'delivered': return '📦';
      case 'cancelled': return '❌';
      default: return '📋';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  const getOrderProgress = (order) => {
    const statuses = ['pending', 'approved', 'shipped', 'delivered'];
    const currentIndex = statuses.indexOf(order.status);
    return ((currentIndex + 1) / statuses.length) * 100;
  };

  const getPaymentProgress = (order) => {
    if (!order.paidAmount || order.paidAmount === 0) return 0;
    if (order.paidAmount >= order.total) return 100;
    return (order.paidAmount / order.total) * 100;
  };

  const getPaymentProgressColor = (paymentStatus) => {
    switch (paymentStatus) {
      case 'paid': return 'from-green-500 to-emerald-500';
      case 'half-paid': return 'from-yellow-500 to-orange-500';
      case 'not-paid': return 'from-red-500 to-red-600';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  // Document handling functions
  const handleDocumentView = (document) => {
    setSelectedDocument(document);
    setShowDocumentViewer(true);
    toast.success(`Opening document: ${document}`, {
      position: "top-right",
      autoClose: 2000,
    });
  };

  const handleDocumentDownload = (document) => {
    toast.success(`Downloading: ${document}`, {
      position: "top-right",
      autoClose: 2000,
    });
    
    // Generate and download the actual document
    const docContent = getDocumentContent(document);
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${docContent.title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            color: #333;
          }
          h2 {
            color: #1a365d;
            text-align: center;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 10px;
            margin-bottom: 30px;
          }
          h3 {
            color: #2d3748;
            margin: 25px 0 15px 0;
          }
          .document-header {
            background-color: #f7fafc;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            text-align: center;
          }
          .document-section {
            margin: 20px 0;
            padding: 15px 0;
          }
          .document-footer {
            background-color: #f7fafc;
            padding: 20px;
            border-radius: 8px;
            margin-top: 30px;
            border-top: 2px solid #e2e8f0;
          }
          .order-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            border: 1px solid #e2e8f0;
          }
          .order-table th,
          .order-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
          }
          .order-table th {
            background-color: #edf2f7;
            font-weight: 600;
          }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        ${docContent.content}
        <div style="margin-top: 40px; text-align: center; color: #666; font-size: 12px;">
          Generated by FareDeal Management System - ${new Date().toLocaleDateString('en-UG')}
        </div>
      </body>
      </html>
    `;

    // Create blob and download
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    
    // Create temporary download link
    const link = document.createElement('a');
    link.href = url;
    link.download = document.replace('.pdf', '.html');
    link.style.display = 'none';
    
    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL
    window.URL.revokeObjectURL(url);
    
    console.log('Downloaded document:', document);
  };

  const handleDownloadAllDocuments = (order) => {
    if (!order.documents || order.documents.length === 0) {
      toast.warning('No documents available to download', {
        position: "top-right",
        autoClose: 2000,
      });
      return;
    }

    toast.info(`Downloading ${order.documents.length} documents...`, {
      position: "top-right",
      autoClose: 3000,
    });

    // Create a combined document with all order documents
    const allDocumentsContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Order ${order.orderNumber} - All Documents</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            color: #333;
          }
          .document-separator {
            page-break-before: always;
            border-top: 3px solid #2d3748;
            margin: 40px 0 20px 0;
            padding-top: 20px;
          }
          .document-separator:first-child {
            border-top: none;
            page-break-before: auto;
          }
          h1 {
            color: #1a365d;
            text-align: center;
            margin-bottom: 10px;
          }
          h2 {
            color: #1a365d;
            text-align: center;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 10px;
            margin-bottom: 30px;
          }
          h3 {
            color: #2d3748;
            margin: 25px 0 15px 0;
          }
          .document-header {
            background-color: #f7fafc;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            text-align: center;
          }
          .document-section {
            margin: 20px 0;
            padding: 15px 0;
          }
          .document-footer {
            background-color: #f7fafc;
            padding: 20px;
            border-radius: 8px;
            margin-top: 30px;
            border-top: 2px solid #e2e8f0;
          }
          .order-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            border: 1px solid #e2e8f0;
          }
          .order-table th,
          .order-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
          }
          .order-table th {
            background-color: #edf2f7;
            font-weight: 600;
          }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>Complete Document Package</h1>
        <div style="text-align: center; margin-bottom: 40px; color: #666;">
          <strong>Order:</strong> ${order.orderNumber} | 
          <strong>Supplier:</strong> ${order.supplierName} | 
          <strong>Date:</strong> ${new Date(order.date).toLocaleDateString('en-UG')}
        </div>
        
        ${order.documents.map((doc, index) => {
          const docContent = getDocumentContent(doc);
          return `
            <div class="document-separator">
              <h2 style="color: #2d3748; margin-bottom: 20px;">
                ${index + 1}. ${docContent.title}
              </h2>
              ${docContent.content}
            </div>
          `;
        }).join('')}
        
        <div style="margin-top: 60px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          Complete Document Package Generated by FareDeal Management System<br>
          Generated on: ${new Date().toLocaleDateString('en-UG')} at ${new Date().toLocaleTimeString('en-UG')}
        </div>
      </body>
      </html>
    `;

    // Create blob and download
    const blob = new Blob([allDocumentsContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    
    // Create temporary download link
    const link = document.createElement('a');
    link.href = url;
    link.download = `${order.orderNumber}_All_Documents.html`;
    link.style.display = 'none';
    
    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL
    window.URL.revokeObjectURL(url);
    
    // Show success message
    setTimeout(() => {
      toast.success(`Downloaded ${order.documents.length} documents successfully!`, {
        position: "top-right",
        autoClose: 3000,
      });
    }, 500);
  };

  // Inventory Management Functions
  const getStockStatusColor = (status) => {
    switch (status) {
      case 'in-stock': return 'bg-green-100 text-green-800 border-green-200';
      case 'low-stock': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'out-of-stock': return 'bg-red-100 text-red-800 border-red-200';
      case 'overstocked': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStockStatusIcon = (status) => {
    switch (status) {
      case 'in-stock': return '✅';
      case 'low-stock': return '⚠️';
      case 'out-of-stock': return '❌';
      case 'overstocked': return '📈';
      default: return '❓';
    }
  };

  const getMovementColor = (movement) => {
    switch (movement) {
      case 'incoming': return 'text-green-600';
      case 'outgoing': return 'text-blue-600';
      case 'stable': return 'text-gray-600';
      case 'slow': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getMovementIcon = (movement) => {
    switch (movement) {
      case 'incoming': return '⬆️';
      case 'outgoing': return '⬇️';
      case 'stable': return '➡️';
      case 'slow': return '🐌';
      case 'critical': return '🚨';
      default: return '❓';
    }
  };

  const handleStockAdjustment = (item, newStock, reason) => {
    const updatedInventory = inventory.map(inv => {
      if (inv.id === item.id) {
        const updatedItem = {
          ...inv,
          currentStock: newStock,
          available: newStock - inv.reserved,
          totalValue: newStock * inv.unitCost,
          lastRestocked: new Date().toISOString().split('T')[0],
          status: newStock === 0 ? 'out-of-stock' : 
                  newStock <= inv.reorderLevel ? 'low-stock' :
                  newStock >= inv.maxStock ? 'overstocked' : 'in-stock'
        };
        return updatedItem;
      }
      return inv;
    });

    setInventory(updatedInventory);
    setShowStockAdjustment(false);
    setSelectedInventoryItem(null);
    
    toast.success(`Stock adjusted for ${item.name}. New stock: ${newStock}`, {
      position: "top-right",
      autoClose: 3000,
    });
  };

  const handleQuickReorder = (item) => {
    const suggestedQuantity = item.maxStock - item.currentStock;
    const orderValue = suggestedQuantity * item.unitCost;
    
    // Create a reorder confirmation with detailed information
    const confirmReorder = () => {
      // Simulate creating a purchase order
      const newOrder = {
        id: orders.length + 1,
        supplierId: suppliers.find(s => s.name === item.supplier)?.id || 1,
        supplierName: item.supplier,
        orderNumber: `PO-2024-${String(orders.length + 1).padStart(3, '0')}`,
        date: new Date().toISOString().split('T')[0],
        expectedDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        actualDeliveryDate: null,
        status: 'pending',
        paymentStatus: 'not-paid',
        paidAmount: 0,
        total: orderValue * 1.18, // Including 18% tax
        subtotal: orderValue,
        tax: orderValue * 0.18,
        currency: 'UGX',
        items: [{
          id: item.id,
          name: item.name,
          sku: item.sku,
          quantity: suggestedQuantity,
          unitPrice: item.unitCost,
          totalPrice: orderValue,
          category: item.category,
          description: `Reorder for ${item.name}`,
          received: 0,
          damaged: 0
        }],
        priority: item.currentStock === 0 ? 'high' : 'medium',
        requestedBy: 'System Auto-Reorder',
        approvedBy: null,
        deliveryAddress: {
          street: 'Plot 15, Industrial Area',
          city: 'Kampala',
          district: 'Kampala',
          country: 'Uganda',
          postalCode: '00256'
        },
        deliveryInstructions: 'Auto-generated reorder - standard delivery',
        paymentTerms: 'Net 30',
        notes: `Auto-reorder generated for low stock item: ${item.name}`,
        trackingNumber: null,
        documents: [],
        timeline: [
          { date: new Date().toISOString().split('T')[0], event: 'Auto-Reorder Created', user: 'System', status: 'info' },
          { date: new Date().toISOString().split('T')[0], event: 'Pending Approval', user: 'System', status: 'warning' }
        ]
      };

      // Add the new order to the orders list
      setOrders(prevOrders => [...prevOrders, newOrder]);
      
      toast.success(
        <div>
          <div className="font-bold">Reorder Created Successfully!</div>
          <div className="text-sm">Order: {newOrder.orderNumber}</div>
          <div className="text-sm">Quantity: {suggestedQuantity} units</div>
          <div className="text-sm">Value: {formatCurrency(orderValue)}</div>
        </div>, 
        {
          position: "top-right",
          autoClose: 5000,
        }
      );
    };

    // Show detailed reorder confirmation
    toast.info(
      <div>
        <div className="font-bold mb-2">🔄 Quick Reorder for {item.name}</div>
        <div className="space-y-1 text-sm">
          <div>Supplier: {item.supplier}</div>
          <div>Current Stock: {item.currentStock}</div>
          <div>Suggested Quantity: {suggestedQuantity}</div>
          <div>Estimated Cost: {formatCurrency(orderValue)}</div>
        </div>
        <button
          onClick={confirmReorder}
          className="mt-3 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Create Purchase Order
        </button>
      </div>,
      {
        position: "top-right",
        autoClose: false,
        closeButton: true,
      }
    );
  };

  const handleInventoryAlert = (item) => {
    const daysUntilReorder = Math.ceil((item.currentStock - item.reorderLevel) / (item.fastMoving ? 5 : 2));
    const stockPercentage = (item.currentStock / item.maxStock) * 100;
    
    if (item.status === 'out-of-stock') {
      toast.error(
        <div>
          <div className="font-bold text-lg">🚨 CRITICAL STOCK ALERT</div>
          <div className="font-semibold">{item.name}</div>
          <div className="space-y-1 text-sm mt-2">
            <div>• Status: OUT OF STOCK</div>
            <div>• Location: {item.location}</div>
            <div>• Reserved Orders: {item.reserved}</div>
            <div>• Last Sold: {new Date(item.lastSold).toLocaleDateString('en-UG')}</div>
            <div>• Potential Revenue Loss: {formatCurrency(item.sellingPrice * item.reserved)}</div>
          </div>
          <div className="mt-3 space-y-2">
            <button
              onClick={() => handleQuickReorder(item)}
              className="w-full bg-red-600 text-white py-2 px-3 rounded text-sm hover:bg-red-700"
            >
              🔄 Emergency Reorder
            </button>
            <button
              onClick={() => {
                setSelectedInventoryItem(item);
                setShowStockAdjustment(true);
              }}
              className="w-full bg-blue-600 text-white py-2 px-3 rounded text-sm hover:bg-blue-700"
            >
              📝 Adjust Stock
            </button>
          </div>
        </div>, 
        {
          position: "top-right",
          autoClose: false,
          closeButton: true,
        }
      );
    } else if (item.status === 'low-stock') {
      toast.warning(
        <div>
          <div className="font-bold">⚠️ LOW STOCK ALERT</div>
          <div className="font-semibold">{item.name}</div>
          <div className="space-y-1 text-sm mt-2">
            <div>• Current: {item.currentStock} units ({stockPercentage.toFixed(1)}%)</div>
            <div>• Reorder Level: {item.reorderLevel}</div>
            <div>• Available: {item.available}</div>
            <div>• Estimated Days Left: {daysUntilReorder > 0 ? daysUntilReorder : 'Critical'}</div>
          </div>
          <button
            onClick={() => handleQuickReorder(item)}
            className="mt-3 w-full bg-yellow-600 text-white py-2 px-3 rounded text-sm hover:bg-yellow-700"
          >
            🔄 Reorder Now
          </button>
        </div>, 
        {
          position: "top-right",
          autoClose: 8000,
        }
      );
    } else if (item.status === 'overstocked') {
      toast.info(
        <div>
          <div className="font-bold">📈 OVERSTOCK ALERT</div>
          <div className="font-semibold">{item.name}</div>
          <div className="space-y-1 text-sm mt-2">
            <div>• Current: {item.currentStock} units ({stockPercentage.toFixed(1)}%)</div>
            <div>• Max Capacity: {item.maxStock}</div>
            <div>• Excess: {item.currentStock - item.maxStock} units</div>
            <div>• Tied Capital: {formatCurrency((item.currentStock - item.maxStock) * item.unitCost)}</div>
          </div>
          <div className="mt-3 text-xs text-gray-600">
            Consider promotion or redistribution strategies
          </div>
        </div>, 
        {
          position: "top-right",
          autoClose: 6000,
        }
      );
    } else {
      toast.success(
        <div>
          <div className="font-bold">✅ HEALTHY STOCK</div>
          <div className="font-semibold">{item.name}</div>
          <div className="space-y-1 text-sm mt-2">
            <div>• Current: {item.currentStock} units ({stockPercentage.toFixed(1)}%)</div>
            <div>• Available: {item.available}</div>
            <div>• Movement: {item.movement.toUpperCase()}</div>
            <div>• Status: Optimal levels maintained</div>
          </div>
        </div>, 
        {
          position: "top-right",
          autoClose: 3000,
        }
      );
    }
  };

  const filteredInventory = inventory.filter(item => {
    if (inventoryFilter === 'all') return true;
    if (inventoryFilter === 'low-stock') return item.status === 'low-stock' || item.status === 'out-of-stock';
    if (inventoryFilter === 'fast-moving') return item.fastMoving;
    if (inventoryFilter === 'overstocked') return item.status === 'overstocked';
    return item.status === inventoryFilter;
  });

  const inventoryStats = {
    totalItems: inventory.length,
    totalValue: inventory.reduce((sum, item) => sum + item.totalValue, 0),
    lowStockItems: inventory.filter(item => item.status === 'low-stock' || item.status === 'out-of-stock').length,
    fastMovingItems: inventory.filter(item => item.fastMoving).length,
    averageStockLevel: inventory.reduce((sum, item) => sum + (item.currentStock / item.maxStock * 100), 0) / inventory.length
  };

  // Enhanced Bulk Operations
  const handleBulkAlertCheck = () => {
    const alertSummary = {
      critical: filteredInventory.filter(item => item.status === 'out-of-stock'),
      warning: filteredInventory.filter(item => item.status === 'low-stock'),
      overstocked: filteredInventory.filter(item => item.status === 'overstocked'),
      healthy: filteredInventory.filter(item => item.status === 'in-stock')
    };

    const totalAlerts = alertSummary.critical.length + alertSummary.warning.length + alertSummary.overstocked.length;

    if (totalAlerts === 0) {
      toast.success(
        <div>
          <div className="font-bold">✅ ALL CLEAR!</div>
          <div className="text-sm mt-1">
            All {filteredInventory.length} items have healthy stock levels
          </div>
        </div>,
        { position: "top-right", autoClose: 3000 }
      );
      return;
    }

    // Show comprehensive alert summary
    toast.info(
      <div>
        <div className="font-bold text-lg">📊 INVENTORY ALERT SUMMARY</div>
        <div className="space-y-2 mt-3">
          {alertSummary.critical.length > 0 && (
            <div className="bg-red-100 p-2 rounded">
              <div className="font-semibold text-red-800">🚨 Critical ({alertSummary.critical.length})</div>
              <div className="text-sm text-red-700">
                {alertSummary.critical.map(item => item.name).join(', ')}
              </div>
            </div>
          )}
          {alertSummary.warning.length > 0 && (
            <div className="bg-yellow-100 p-2 rounded">
              <div className="font-semibold text-yellow-800">⚠️ Low Stock ({alertSummary.warning.length})</div>
              <div className="text-sm text-yellow-700">
                {alertSummary.warning.slice(0, 3).map(item => item.name).join(', ')}
                {alertSummary.warning.length > 3 && ` +${alertSummary.warning.length - 3} more`}
              </div>
            </div>
          )}
          {alertSummary.overstocked.length > 0 && (
            <div className="bg-blue-100 p-2 rounded">
              <div className="font-semibold text-blue-800">📈 Overstocked ({alertSummary.overstocked.length})</div>
              <div className="text-sm text-blue-700">
                {alertSummary.overstocked.slice(0, 2).map(item => item.name).join(', ')}
                {alertSummary.overstocked.length > 2 && ` +${alertSummary.overstocked.length - 2} more`}
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 space-y-2">
          <button
            onClick={() => {
              [...alertSummary.critical, ...alertSummary.warning].forEach(item => 
                setTimeout(() => handleInventoryAlert(item), Math.random() * 2000)
              );
            }}
            className="w-full bg-red-600 text-white py-2 px-3 rounded text-sm hover:bg-red-700"
          >
            🔍 Show Detailed Alerts
          </button>
          {(alertSummary.critical.length > 0 || alertSummary.warning.length > 0) && (
            <button
              onClick={() => handleAutoReorder()}
              className="w-full bg-blue-600 text-white py-2 px-3 rounded text-sm hover:bg-blue-700"
            >
              🔄 Auto Reorder All
            </button>
          )}
        </div>
      </div>,
      {
        position: "top-right",
        autoClose: false,
        closeButton: true,
      }
    );
  };

  const handleAutoReorder = () => {
    const itemsToReorder = filteredInventory.filter(item => 
      item.status === 'low-stock' || item.status === 'out-of-stock'
    );

    if (itemsToReorder.length === 0) {
      toast.info('No items need reordering at this time', {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    const totalOrderValue = itemsToReorder.reduce((sum, item) => {
      const quantity = item.maxStock - item.currentStock;
      return sum + (quantity * item.unitCost);
    }, 0);

    // Show confirmation dialog
    toast.info(
      <div>
        <div className="font-bold text-lg">🔄 AUTO REORDER CONFIRMATION</div>
        <div className="space-y-2 mt-3">
          <div className="text-sm">
            <strong>{itemsToReorder.length}</strong> items need reordering
          </div>
          <div className="text-sm">
            Total estimated value: <strong>{formatCurrency(totalOrderValue)}</strong>
          </div>
          <div className="bg-gray-100 p-2 rounded text-xs">
            <div className="font-semibold mb-1">Items to reorder:</div>
            {itemsToReorder.slice(0, 4).map(item => (
              <div key={item.id}>• {item.name} ({item.maxStock - item.currentStock} units)</div>
            ))}
            {itemsToReorder.length > 4 && (
              <div>• +{itemsToReorder.length - 4} more items...</div>
            )}
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <button
            onClick={() => {
              // Process auto reorders with delay for better UX
              itemsToReorder.forEach((item, index) => {
                setTimeout(() => {
                  handleQuickReorder(item);
                }, index * 1000); // Stagger the reorders
              });
              
              toast.success(
                `Processing ${itemsToReorder.length} auto-reorders...`,
                { position: "top-right", autoClose: 3000 }
              );
            }}
            className="w-full bg-green-600 text-white py-2 px-3 rounded text-sm hover:bg-green-700"
          >
            ✅ Confirm Auto Reorder
          </button>
          <button
            onClick={() => {
              // Show individual items for selective reordering
              itemsToReorder.forEach(item => handleInventoryAlert(item));
            }}
            className="w-full bg-blue-600 text-white py-2 px-3 rounded text-sm hover:bg-blue-700"
          >
            🎯 Review Individual Items
          </button>
        </div>
      </div>,
      {
        position: "top-right",
        autoClose: false,
        closeButton: true,
      }
    );
  };

  const handleAddProduct = (productData) => {
    const newProduct = {
      id: Math.max(...inventory.map(item => item.id)) + 1,
      sku: productData.sku,
      name: productData.name,
      category: productData.category,
      supplier: productData.supplier,
      currentStock: parseInt(productData.initialStock),
      reorderLevel: parseInt(productData.reorderLevel),
      maxStock: parseInt(productData.maxStock),
      unitCost: parseFloat(productData.unitCost),
      sellingPrice: parseFloat(productData.sellingPrice),
      location: productData.location,
      lastRestocked: new Date().toISOString().split('T')[0],
      status: parseInt(productData.initialStock) === 0 ? 'out-of-stock' : 
              parseInt(productData.initialStock) <= parseInt(productData.reorderLevel) ? 'low-stock' :
              parseInt(productData.initialStock) >= parseInt(productData.maxStock) ? 'overstocked' : 'in-stock',
      reserved: 0,
      available: parseInt(productData.initialStock),
      totalValue: parseInt(productData.initialStock) * parseFloat(productData.unitCost),
      movement: 'stable',
      lastSold: null,
      fastMoving: false
    };

    setInventory(prevInventory => [...prevInventory, newProduct]);
    setShowAddProduct(false);

    toast.success(
      <div>
        <div className="font-bold">✅ Product Added Successfully!</div>
        <div className="text-sm mt-1">
          <div>{newProduct.name} has been added to inventory</div>
          <div>Initial Stock: {newProduct.currentStock} units</div>
          <div>Location: {newProduct.location}</div>
        </div>
      </div>,
      {
        position: "top-right",
        autoClose: 4000,
      }
    );
  };

  // Enhanced Inventory Management States
  const [showEditProduct, setShowEditProduct] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showQuickAdjust, setShowQuickAdjust] = useState(false);
  const [showSmartReorder, setShowSmartReorder] = useState(false);
  const [showInventoryAnalytics, setShowInventoryAnalytics] = useState(false);
  const [bulkOperation, setBulkOperation] = useState('');
  const [quickAdjustData, setQuickAdjustData] = useState({ productId: null, adjustment: 0, reason: '' });

  // Advanced inventory management functions
  const handleQuickStockAdjust = (productId, adjustment, reason) => {
    setInventory(prev => prev.map(item => {
      if (item.id === productId) {
        const newStock = Math.max(0, item.currentStock + adjustment);
        const newStatus = newStock === 0 ? 'out-of-stock' : 
                         newStock <= item.reorderLevel ? 'low-stock' :
                         newStock >= item.maxStock * 0.9 ? 'overstocked' : 'in-stock';
        
        return {
          ...item,
          currentStock: newStock,
          available: Math.max(0, newStock - item.reserved),
          totalValue: newStock * item.unitCost,
          status: newStatus,
          lastRestocked: adjustment > 0 ? new Date().toISOString().split('T')[0] : item.lastRestocked
        };
      }
      return item;
    }));
    
    const product = inventory.find(p => p.id === productId);
    toast.success(
      <div>
        <div className="font-bold">📦 Stock Adjustment Applied</div>
        <div className="text-sm mt-1">
          <div>{product?.name}: {adjustment > 0 ? '+' : ''}{adjustment} units</div>
          <div>Reason: {reason}</div>
        </div>
      </div>,
      { autoClose: 3000 }
    );
  };

  const handleSmartReorder = (productId) => {
    const product = inventory.find(item => item.id === productId);
    if (!product) return;

    // Calculate optimal reorder quantity based on movement patterns
    const optimalQuantity = Math.ceil((product.maxStock - product.currentStock) * 1.2);
    const estimatedCost = optimalQuantity * product.unitCost;
    
    toast.info(
      <div>
        <div className="font-bold">🎯 Initiating Smart Reorder</div>
        <div className="text-sm mt-1">
          <div>{product.name}: +{optimalQuantity} units</div>
          <div>Estimated Cost: {formatCurrency(estimatedCost)}</div>
          <div>Processing...</div>
        </div>
      </div>,
      { autoClose: 2000 }
    );
    
    // Simulate reorder process
    setTimeout(() => {
      setInventory(prev => prev.map(item => {
        if (item.id === productId) {
          return {
            ...item,
            currentStock: item.currentStock + optimalQuantity,
            available: item.available + optimalQuantity,
            totalValue: (item.currentStock + optimalQuantity) * item.unitCost,
            status: 'in-stock',
            lastRestocked: new Date().toISOString().split('T')[0]
          };
        }
        return item;
      }));
      
      toast.success(
        <div>
          <div className="font-bold">🚀 Smart Reorder Completed!</div>
          <div className="text-sm mt-1">
            <div>{product.name}: +{optimalQuantity} units added</div>
            <div>Total Cost: {formatCurrency(estimatedCost)}</div>
            <div>Status: Restocked ✅</div>
          </div>
        </div>,
        { autoClose: 4000 }
      );
    }, 2000);
  };

  const handleBulkOperation = (operation, itemIds) => {
    const selectedProducts = inventory.filter(item => itemIds.includes(item.id));
    
    switch (operation) {
      case 'reorder':
        itemIds.forEach(id => handleSmartReorder(id));
        toast.info(`🔄 Processing bulk reorder for ${itemIds.length} items...`);
        break;
      case 'mark-fast':
        setInventory(prev => prev.map(item => 
          itemIds.includes(item.id) ? { ...item, fastMoving: true } : item
        ));
        toast.success(`⚡ ${itemIds.length} items marked as fast-moving`);
        break;
      case 'update-location':
        toast.info('🏪 Location update feature would open bulk location editor');
        break;
      case 'export':
        const exportData = selectedProducts.map(p => ({
          SKU: p.sku,
          Name: p.name,
          Category: p.category,
          Stock: p.currentStock,
          Value: formatCurrency(p.totalValue),
          Status: p.status
        }));
        console.log('Export Data:', exportData);
        toast.success('📊 Selected inventory data exported to console');
        break;
      case 'adjust-stock':
        setShowQuickAdjust(true);
        break;
      default:
        break;
    }
    setSelectedItems([]);
    setShowBulkActions(false);
  };

  const handleSelectItem = (itemId) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === filteredInventory.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredInventory.map(item => item.id));
    }
  };

  const handleDeleteProduct = (productId) => {
    const product = inventory.find(p => p.id === productId);
    if (window.confirm(`Are you sure you want to delete "${product?.name}"? This action cannot be undone.`)) {
      setInventory(prev => prev.filter(item => item.id !== productId));
      toast.success(`🗑️ Product "${product?.name}" removed from inventory`);
    }
  };

  const handleEditProduct = (product) => {
    setSelectedInventoryItem(product);
    setShowEditProduct(true);
  };

  const handleGenerateInvoice = (order) => {
    toast.info('Generating invoice...', { autoClose: 2000 });

    const invoiceContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${order.orderNumber}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            color: #333;
          }
          .invoice-header {
            text-align: center;
            border-bottom: 3px solid #2d3748;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .company-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          .invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          .invoice-table th,
          .invoice-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
          }
          .invoice-table th {
            background-color: #f8f9fa;
            font-weight: bold;
          }
          .total-section {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
          }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-header">
          <h1>INVOICE</h1>
          <p><strong>Invoice Number:</strong> INV-${order.orderNumber}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-UG')}</p>
          <p><strong>Order Reference:</strong> ${order.orderNumber}</p>
        </div>

        <div class="company-info">
          <div>
            <h3>From:</h3>
            <p><strong>FareDeal Ltd.</strong><br>
            Plot 15, Industrial Area<br>
            Kampala, Uganda<br>
            Phone: +256 700 123 456<br>
            Email: billing@faredeal.ug</p>
          </div>
          <div>
            <h3>To:</h3>
            <p><strong>${order.supplierName}</strong><br>
            ${order.deliveryAddress.street}<br>
            ${order.deliveryAddress.city}, ${order.deliveryAddress.district}<br>
            ${order.deliveryAddress.country}</p>
          </div>
        </div>

        <table class="invoice-table">
          <thead>
            <tr>
              <th>Item Description</th>
              <th>SKU</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>${item.sku}</td>
                <td>${item.quantity}</td>
                <td>UGX ${item.unitPrice.toLocaleString()}</td>
                <td>UGX ${item.totalPrice.toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total-section">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span>Subtotal:</span>
            <span>UGX ${order.subtotal.toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span>Tax (18%):</span>
            <span>UGX ${order.tax.toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 18px; border-top: 2px solid #333; padding-top: 10px;">
            <span>Total Amount:</span>
            <span>UGX ${order.total.toLocaleString()}</span>
          </div>
        </div>

        <div style="margin-top: 40px;">
          <h3>Payment Information:</h3>
          <p><strong>Payment Status:</strong> ${order.paymentStatus.toUpperCase().replace('-', ' ')}</p>
          <p><strong>Amount Paid:</strong> UGX ${(order.paidAmount || 0).toLocaleString()}</p>
          <p><strong>Balance Due:</strong> UGX ${(order.total - (order.paidAmount || 0)).toLocaleString()}</p>
          <p><strong>Payment Terms:</strong> ${order.paymentTerms}</p>
        </div>

        <div style="margin-top: 40px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 20px;">
          Generated by FareDeal Management System on ${new Date().toLocaleDateString('en-UG')}
        </div>
      </body>
      </html>
    `;

    // Create blob and download
    const blob = new Blob([invoiceContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    
    // Create temporary download link
    const link = document.createElement('a');
    link.href = url;
    link.download = `Invoice_${order.orderNumber}.html`;
    link.style.display = 'none';
    
    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL
    window.URL.revokeObjectURL(url);

    toast.success(`Invoice generated for ${order.orderNumber}!`, {
      position: "top-right",
      autoClose: 3000,
    });
  };

  const handleUploadDocument = (orderId) => {
    toast.info('Document upload feature would open here', {
      position: "top-right",
      autoClose: 2000,
    });
    // In a real app, this would open a file picker
    console.log('Upload document for order:', orderId);
  };

  const getDocumentIcon = (filename) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf': return '📄';
      case 'doc':
      case 'docx': return '📝';
      case 'xls':
      case 'xlsx': return '📊';
      case 'jpg':
      case 'jpeg':
      case 'png': return '🖼️';
      case 'zip':
      case 'rar': return '🗜️';
      default: return '📎';
    }
  };

  const getDocumentSize = (filename) => {
    // Mock file sizes - in real app would come from server
    const sizes = {
      'purchase_order.pdf': '245 KB',
      'shipping_manifest.pdf': '189 KB',
      'delivery_receipt.pdf': '156 KB',
      'warranty_cards.pdf': '324 KB',
      'invoice.pdf': '298 KB',
      'payment_receipt.pdf': '167 KB',
      'supplier_quote.pdf': '198 KB'
    };
    return sizes[filename] || '0 KB';
  };

  const getDocumentContent = (filename) => {
    // Mock document content - in real app would fetch from server
    const content = {
      'purchase_order.pdf': {
        type: 'Purchase Order',
        title: 'Purchase Order #PO-2024-001',
        content: `
          <div class="document-header">
            <h2>PURCHASE ORDER</h2>
            <p><strong>Order Number:</strong> PO-2024-001</p>
            <p><strong>Date:</strong> January 15, 2024</p>
            <p><strong>Supplier:</strong> Apple Inc.</p>
          </div>
          
          <div class="document-section">
            <h3>Billing Address:</h3>
            <p>FareDeal Ltd.<br>
            Plot 15, Industrial Area<br>
            Kampala, Uganda<br>
            P.O. Box 12345</p>
          </div>

          <div class="document-section">
            <h3>Items Ordered:</h3>
            <table class="order-table">
              <thead>
                <tr><th>Item</th><th>SKU</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>iPhone 15 Pro Max 256GB</td>
                  <td>IPH15PM256</td>
                  <td>20</td>
                  <td>UGX 1,199.99</td>
                  <td>UGX 23,999.80</td>
                </tr>
                <tr>
                  <td>AirPods Pro 3rd Gen</td>
                  <td>APPRO3</td>
                  <td>50</td>
                  <td>UGX 249.99</td>
                  <td>UGX 12,499.50</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="document-footer">
            <p><strong>Total Amount:</strong> UGX 37,499.30</p>
            <p><strong>Payment Terms:</strong> Net 30 days</p>
            <p><strong>Expected Delivery:</strong> January 29, 2024</p>
          </div>
        `
      },
      'invoice.pdf': {
        type: 'Invoice',
        title: 'Invoice #INV-2024-003',
        content: `
          <div class="document-header">
            <h2>INVOICE</h2>
            <p><strong>Invoice Number:</strong> INV-2024-003</p>
            <p><strong>Date:</strong> January 16, 2024</p>
            <p><strong>Due Date:</strong> February 15, 2024</p>
          </div>
          
          <div class="document-section">
            <h3>Bill To:</h3>
            <p>Microsoft Corporation<br>
            Technology Division<br>
            Redmond, WA 98052<br>
            USA</p>
          </div>

          <div class="document-section">
            <h3>Services/Products:</h3>
            <table class="order-table">
              <thead>
                <tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>Surface Pro 9 i7 512GB</td>
                  <td>10</td>
                  <td>UGX 1,199.99</td>
                  <td>UGX 11,999.90</td>
                </tr>
                <tr>
                  <td>Tax (18%)</td>
                  <td>-</td>
                  <td>-</td>
                  <td>UGX 1,200.00</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="document-footer">
            <p><strong>Total Amount Due:</strong> UGX 13,199.90</p>
            <p><strong>Status:</strong> PAID</p>
          </div>
        `
      },
      'delivery_receipt.pdf': {
        type: 'Delivery Receipt',
        title: 'Delivery Receipt #DR-2024-003',
        content: `
          <div class="document-header">
            <h2>DELIVERY RECEIPT</h2>
            <p><strong>Receipt Number:</strong> DR-2024-003</p>
            <p><strong>Delivery Date:</strong> January 16, 2024</p>
            <p><strong>Order Number:</strong> PO-2024-003</p>
          </div>
          
          <div class="document-section">
            <h3>Delivery Details:</h3>
            <p><strong>Delivered To:</strong> FareDeal Warehouse<br>
            Plot 15, Industrial Area<br>
            Kampala, Uganda</p>
            <p><strong>Received By:</strong> John Mukasa<br>
            <strong>Signature:</strong> J. Mukasa<br>
            <strong>Time:</strong> 14:30 EAT</p>
          </div>

          <div class="document-section">
            <h3>Items Delivered:</h3>
            <table class="order-table">
              <thead>
                <tr><th>Item</th><th>Ordered</th><th>Delivered</th><th>Status</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>Surface Pro 9 i7 512GB</td>
                  <td>10</td>
                  <td>10</td>
                  <td>✅ Complete</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="document-footer">
            <p><strong>Condition:</strong> All items received in good condition</p>
            <p><strong>Notes:</strong> Delivered on schedule, no damages reported</p>
          </div>
        `
      }
    };
    
    return content[filename] || {
      type: 'Document',
      title: filename,
      content: `
        <div class="document-header">
          <h2>DOCUMENT PREVIEW</h2>
          <p><strong>File:</strong> ${filename}</p>
          <p><strong>Type:</strong> ${filename.split('.').pop()?.toUpperCase()}</p>
        </div>
        
        <div class="document-section">
          <p>This is a preview of ${filename}. In a production environment, 
          this would display the actual document content or use a PDF viewer 
          to render the document properly.</p>
          
          <p>Document features would include:</p>
          <ul>
            <li>Full document rendering</li>
            <li>Zoom controls</li>
            <li>Page navigation</li>
            <li>Download options</li>
            <li>Print functionality</li>
          </ul>
        </div>
      `
    };
  };

  const calculateOrderMetrics = () => {
    return {
      totalOrders: orders.length,
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      shippedOrders: orders.filter(o => o.status === 'shipped').length,
      deliveredOrders: orders.filter(o => o.status === 'delivered').length,
      totalValue: orders.reduce((sum, order) => sum + order.total, 0),
      averageOrderValue: orders.length > 0 ? orders.reduce((sum, order) => sum + order.total, 0) / orders.length : 0
    };
  };

  const [analytics, setAnalytics] = useState({
    totalSuppliers: 24,
    activeSuppliers: 18,
    pendingOrders: 5,
    totalOrderValue: 125000,
    averageLeadTime: 8.5,
    topSupplier: 'Apple Inc.',
    monthlySavings: 15000
  });

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.contact.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredOrders = orders.filter(order =>
    order.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'shipped': return 'bg-blue-100 text-blue-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCreateOrder = (supplier) => {
    setSelectedSupplier(supplier);
    setShowOrderModal(true);
  };

  const handleViewSupplier = (supplier) => {
    setSelectedSupplier(supplier);
    setShowSupplierModal(true);
  };

  const handleUpdateOrderStatus = (orderId, newStatus) => {
    setOrders(orders.map(order =>
      order.id === orderId ? { ...order, status: newStatus } : order
    ));
    toast.success(`Order status updated to ${newStatus}`);
  };

  const handleDeleteSupplier = (supplierId) => {
    setSuppliers(suppliers.filter(supplier => supplier.id !== supplierId));
    toast.success('Supplier deleted successfully');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <FiTruck className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-3xl font-bold">Supplier Management</h2>
                <p className="text-green-100">Manage suppliers, orders, and procurement</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <FiX className="h-8 w-8" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex space-x-1 p-4">
            {[
              { id: 'suppliers', label: 'Suppliers', icon: FiUser },
              { id: 'orders', label: 'Orders', icon: FiPackage },
              { id: 'inventory', label: 'Inventory', icon: FiTruck },
              { id: 'analytics', label: 'Analytics', icon: FiTrendingUp }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {/* Suppliers Tab */}
          {activeTab === 'suppliers' && (
            <div className="h-full flex flex-col">
              {/* Search and Actions */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1 max-w-md relative">
                    <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                      type="text"
                      placeholder="Search suppliers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={() => setShowSupplierModal(true)}
                    className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    <FiPlus className="h-5 w-5" />
                    <span>Add Supplier</span>
                  </button>
                </div>
              </div>

              {/* Suppliers Grid */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredSuppliers.map(supplier => (
                    <div key={supplier.id} className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-all duration-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="text-3xl">{supplier.image}</div>
                          <div>
                            <h3 className="font-bold text-gray-900">{supplier.name}</h3>
                            <p className="text-sm text-gray-600">{supplier.category}</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(supplier.status)}`}>
                          {supplier.status}
                        </span>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <FiUser className="h-4 w-4" />
                          <span>{supplier.contact}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <FiMail className="h-4 w-4" />
                          <span>{supplier.email}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <FiPhone className="h-4 w-4" />
                          <span>{supplier.phone}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-1">
                          <FiStar className="h-4 w-4 text-yellow-400 fill-current" />
                          <span className="text-sm font-medium">{supplier.rating}</span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {supplier.totalOrders} orders
                        </div>
                      </div>

                      {/* Payment Score & Stats */}
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Payment Score</span>
                          <span className={`text-sm font-bold ${
                            supplier.paymentScore >= 80 ? 'text-green-600' :
                            supplier.paymentScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {supplier.paymentScore}/100
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              supplier.paymentScore >= 80 ? 'bg-green-500' :
                              supplier.paymentScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${supplier.paymentScore}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600 mt-1">
                          <span>Outstanding: {formatCurrency(supplier.outstandingAmount)}</span>
                          <span>On-time: {supplier.onTimePayments}/{supplier.onTimePayments + supplier.latePayments}</span>
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleViewSupplier(supplier)}
                          className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600 transition-colors"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => {
                            setSelectedSupplierForHistory(supplier);
                            setShowPaymentHistory(true);
                          }}
                          className="bg-purple-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-purple-600 transition-colors"
                          title="Payment History"
                        >
                          💰
                        </button>
                        <button
                          onClick={() => handleCreateOrder(supplier)}
                          className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-600 transition-colors"
                        >
                          New Order
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <div className="h-full flex flex-col">
              {/* Search and Filters */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1 max-w-md relative">
                    <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                      type="text"
                      placeholder="Search orders..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <button className="flex items-center space-x-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors">
                      <FiFilter className="h-5 w-5" />
                      <span>Filter</span>
                    </button>
                    <button className="flex items-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
                      <FiPlus className="h-5 w-5" />
                      <span>New Order</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Orders List */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-4">
                  {filteredOrders.map(order => (
                    <div key={order.id} className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-all duration-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="text-2xl">📦</div>
                          <div>
                            <h3 className="font-bold text-gray-900">{order.orderNumber}</h3>
                            <p className="text-sm text-gray-600">{order.supplierName}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(order.priority)}`}>
                            {order.priority}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600">Order Date</p>
                          <p className="font-medium">{order.date}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Expected Date</p>
                          <p className="font-medium">{order.expectedDate}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Total Value</p>
                          <p className="font-medium">${order.total.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Items</p>
                          <p className="font-medium">{order.items.length}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex space-x-2">
                          {order.status === 'pending' && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'shipped')}
                              className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600 transition-colors"
                            >
                              Mark Shipped
                            </button>
                          )}
                          {order.status === 'shipped' && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}
                              className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-600 transition-colors"
                            >
                              Mark Delivered
                            </button>
                          )}
                          <button 
                            onClick={() => setSelectedOrder(order)}
                            className="bg-gray-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-600 transition-colors"
                          >
                            View Details
                          </button>
                        </div>
                        <div className="flex space-x-2">
                          <button className="text-blue-600 hover:text-blue-800 transition-colors">
                            <FiEye className="h-5 w-5" />
                          </button>
                          <button className="text-green-600 hover:text-green-800 transition-colors">
                            <FiDownload className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="h-full overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-6 text-white">
                  <h3 className="text-lg font-bold mb-2">Total Suppliers</h3>
                  <p className="text-3xl font-bold">{analytics.totalSuppliers}</p>
                  <p className="text-blue-100 text-sm">+2 this month</p>
                </div>
                <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-6 text-white">
                  <h3 className="text-lg font-bold mb-2">Active Suppliers</h3>
                  <p className="text-3xl font-bold">{analytics.activeSuppliers}</p>
                  <p className="text-green-100 text-sm">75% active rate</p>
                </div>
                <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white">
                  <h3 className="text-lg font-bold mb-2">Pending Orders</h3>
                  <p className="text-3xl font-bold">{analytics.pendingOrders}</p>
                  <p className="text-orange-100 text-sm">$125K value</p>
                </div>
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-6 text-white">
                  <h3 className="text-lg font-bold mb-2">Monthly Savings</h3>
                  <p className="text-3xl font-bold">${analytics.monthlySavings.toLocaleString()}</p>
                  <p className="text-purple-100 text-sm">+12% from last month</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-2xl p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Top Suppliers</h3>
                  <div className="space-y-4">
                    {suppliers.slice(0, 5).map((supplier, index) => (
                      <div key={supplier.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{supplier.name}</p>
                            <p className="text-sm text-gray-600">{supplier.totalOrders} orders</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">${supplier.totalValue.toLocaleString()}</p>
                          <div className="flex items-center space-x-1">
                            <FiStar className="h-3 w-3 text-yellow-400 fill-current" />
                            <span className="text-sm text-gray-600">{supplier.rating}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Order Status Distribution</h3>
                  <div className="space-y-4">
                    {[
                      { status: 'Delivered', count: 15, color: 'bg-green-500', percentage: 60 },
                      { status: 'Shipped', count: 6, color: 'bg-blue-500', percentage: 24 },
                      { status: 'Pending', count: 4, color: 'bg-yellow-500', percentage: 16 }
                    ].map(item => (
                      <div key={item.status} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-4 h-4 rounded-full ${item.color}`}></div>
                          <span className="font-medium text-gray-900">{item.status}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${item.color}`}
                              style={{ width: `${item.percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-600 w-8">{item.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Inventory Management Tab */}
          {activeTab === 'inventory' && (
            <div className="h-full flex flex-col">
              {/* Inventory Header */}
              <div className="p-6 bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-4xl">📦</div>
                    <div>
                      <h2 className="text-2xl font-bold">Inventory Management</h2>
                      <p className="text-emerald-100">Track stock levels, movements, and optimize inventory</p>
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowAddProduct(true)}
                      className="flex items-center space-x-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                    >
                      <FiPlus className="h-5 w-5" />
                      <span>Add Product</span>
                    </button>
                    <button
                      onClick={() => {
                        toast.info('Bulk import functionality would open here', { autoClose: 2000 });
                      }}
                      className="flex items-center space-x-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                    >
                      <FiUpload className="h-5 w-5" />
                      <span>Import Stock</span>
                    </button>
                    <button
                      onClick={() => {
                        toast.info('Stock report generation started', { autoClose: 2000 });
                      }}
                      className="flex items-center space-x-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                    >
                      <FiDownload className="h-5 w-5" />
                      <span>Export Report</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Inventory Stats Cards */}
              <div className="p-6 bg-gray-50 border-b">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">📊</div>
                      <div>
                        <div className="text-2xl font-bold text-gray-900">{inventoryStats.totalItems}</div>
                        <div className="text-sm text-gray-600">Total Items</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">💰</div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">{formatCurrency(inventoryStats.totalValue)}</div>
                        <div className="text-sm text-gray-600">Total Value</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">⚠️</div>
                      <div>
                        <div className="text-2xl font-bold text-red-600">{inventoryStats.lowStockItems}</div>
                        <div className="text-sm text-gray-600">Low Stock</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">🚀</div>
                      <div>
                        <div className="text-2xl font-bold text-blue-600">{inventoryStats.fastMovingItems}</div>
                        <div className="text-sm text-gray-600">Fast Moving</div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">📈</div>
                      <div>
                        <div className="text-2xl font-bold text-purple-600">{inventoryStats.averageStockLevel.toFixed(1)}%</div>
                        <div className="text-sm text-gray-600">Avg Stock Level</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Inventory Controls */}
              <div className="p-6 border-b bg-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    {/* Enhanced Search */}
                    <div className="relative">
                      <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 w-80 text-sm"
                        placeholder="Search by name, SKU, category, location..."
                      />
                    </div>
                    
                    {/* Advanced Filter */}
                    <select
                      value={inventoryFilter}
                      onChange={(e) => setInventoryFilter(e.target.value)}
                      className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
                    >
                      <option value="all">All Items ({inventory.length})</option>
                      <option value="in-stock">In Stock ({inventory.filter(i => i.status === 'in-stock').length})</option>
                      <option value="low-stock">Low Stock ({inventory.filter(i => i.status === 'low-stock').length})</option>
                      <option value="out-of-stock">Out of Stock ({inventory.filter(i => i.status === 'out-of-stock').length})</option>
                      <option value="overstocked">Overstocked ({inventory.filter(i => i.status === 'overstocked').length})</option>
                      <option value="fast-moving">Fast Moving ({inventory.filter(i => i.fastMoving).length})</option>
                    </select>

                    {/* Bulk Selection Indicator */}
                    {selectedItems.length > 0 && (
                      <div className="flex items-center space-x-2 px-3 py-2 bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-200">
                        <span>✓</span>
                        <span className="text-sm font-medium">{selectedItems.length} selected</span>
                      </div>
                    )}
                  </div>

                  {/* Manager Action Buttons */}
                  <div className="flex items-center space-x-2">
                    {selectedItems.length > 0 ? (
                      /* Bulk Actions Menu */
                      <>
                        <button
                          onClick={() => setShowBulkActions(!showBulkActions)}
                          className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm relative"
                        >
                          <span>⚙️</span>
                          <span>Bulk Actions</span>
                          <FiChevronDown className="h-4 w-4" />
                        </button>
                        
                        <button
                          onClick={() => setSelectedItems([])}
                          className="flex items-center space-x-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                        >
                          <FiX className="h-4 w-4" />
                          <span>Clear</span>
                        </button>
                      </>
                    ) : (
                      /* Standard Action Buttons */
                      <>
                        <button
                          onClick={() => setShowInventoryAnalytics(true)}
                          className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                        >
                          <span>📊</span>
                          <span>Analytics</span>
                        </button>
                        
                        <button
                          onClick={() => handleBulkAlertCheck()}
                          className="flex items-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                        >
                          <span>🚨</span>
                          <span>Alert Check</span>
                        </button>
                        
                        <button
                          onClick={() => setShowSmartReorder(true)}
                          className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          <span>🧠</span>
                          <span>Smart Reorder</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Bulk Actions Dropdown */}
                {showBulkActions && selectedItems.length > 0 && (
                  <div className="absolute right-6 top-32 bg-white border border-gray-200 rounded-xl shadow-xl z-50 min-w-48">
                    <div className="p-2">
                      <button
                        onClick={() => handleBulkOperation('reorder', selectedItems)}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 rounded-lg flex items-center space-x-3 text-sm"
                      >
                        <span>🔄</span>
                        <div>
                          <div className="font-medium text-blue-700">Smart Reorder</div>
                          <div className="text-gray-500 text-xs">Optimal quantity calculation</div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => handleBulkOperation('adjust-stock', selectedItems)}
                        className="w-full text-left px-4 py-3 hover:bg-green-50 rounded-lg flex items-center space-x-3 text-sm"
                      >
                        <span>📦</span>
                        <div>
                          <div className="font-medium text-green-700">Adjust Stock</div>
                          <div className="text-gray-500 text-xs">Bulk stock adjustment</div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => handleBulkOperation('mark-fast', selectedItems)}
                        className="w-full text-left px-4 py-3 hover:bg-purple-50 rounded-lg flex items-center space-x-3 text-sm"
                      >
                        <span>⚡</span>
                        <div>
                          <div className="font-medium text-purple-700">Mark Fast-Moving</div>
                          <div className="text-gray-500 text-xs">Update movement status</div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => handleBulkOperation('update-location', selectedItems)}
                        className="w-full text-left px-4 py-3 hover:bg-orange-50 rounded-lg flex items-center space-x-3 text-sm"
                      >
                        <span>🏪</span>
                        <div>
                          <div className="font-medium text-orange-700">Update Location</div>
                          <div className="text-gray-500 text-xs">Change warehouse position</div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => handleBulkOperation('export', selectedItems)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-lg flex items-center space-x-3 text-sm"
                      >
                        <span>📊</span>
                        <div>
                          <div className="font-medium text-gray-700">Export Data</div>
                          <div className="text-gray-500 text-xs">Download selected items</div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick Stats Bar */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center space-x-6 text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span className="text-gray-600">
                        Showing {filteredInventory.length} of {inventory.length} items
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      <span className="text-gray-600">
                        Total Value: {formatCurrency(filteredInventory.reduce((sum, item) => sum + item.totalValue, 0))}
                      </span>
                    </div>

                    {selectedItems.length > 0 && (
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                        <span className="text-purple-600 font-medium">
                          Selected Value: {formatCurrency(
                            inventory.filter(item => selectedItems.includes(item.id))
                              .reduce((sum, item) => sum + item.totalValue, 0)
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Select All Toggle */}
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center space-x-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <div className={`w-4 h-4 border rounded ${
                      selectedItems.length === filteredInventory.length 
                        ? 'bg-emerald-500 border-emerald-500' 
                        : selectedItems.length > 0 
                        ? 'bg-emerald-200 border-emerald-300' 
                        : 'border-gray-300'
                    }`}>
                      {selectedItems.length > 0 && (
                        <FiCheck className="w-3 h-3 text-white m-0.5" />
                      )}
                    </div>
                    <span>
                      {selectedItems.length === filteredInventory.length ? 'Deselect All' : 'Select All'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Enhanced Inventory Grid */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {filteredInventory.map(item => (
                    <div 
                      key={item.id} 
                      className={`bg-white border-2 rounded-2xl p-6 hover:shadow-xl transition-all duration-300 cursor-pointer ${
                        selectedItems.includes(item.id) 
                          ? 'border-emerald-500 bg-emerald-50 shadow-lg' 
                          : 'border-gray-200 hover:border-emerald-300'
                      }`}
                    >
                      {/* Enhanced Item Header with Selection */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          {/* Selection Checkbox */}
                          <button
                            onClick={() => handleSelectItem(item.id)}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              selectedItems.includes(item.id)
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-gray-300 hover:border-emerald-400'
                            }`}
                          >
                            {selectedItems.includes(item.id) && <FiCheck className="w-3 h-3" />}
                          </button>

                          {/* Product Icon & Details */}
                          <div className="text-3xl">
                            {item.category === 'Smartphones' ? '📱' :
                             item.category === 'Audio' ? '🎧' :
                             item.category === 'Tablets' ? '📟' :
                             item.category === 'Laptops' ? '💻' : '📦'}
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 text-lg">{item.name}</h3>
                            <div className="flex items-center space-x-3 text-sm text-gray-600">
                              <span>SKU: {item.sku}</span>
                              <span>•</span>
                              <span>📍 {item.location}</span>
                              {item.fastMoving && <span className="text-orange-500 font-medium">⚡ Fast Moving</span>}
                            </div>
                          </div>
                        </div>

                        {/* Status Badge with Enhanced Styling */}
                        <div className="flex flex-col items-end space-y-2">
                          <span className={`px-4 py-2 rounded-xl text-sm font-bold border-2 ${getStockStatusColor(item.status)}`}>
                            {getStockStatusIcon(item.status)} {item.status.toUpperCase().replace('-', ' ')}
                          </span>
                          {item.currentStock <= item.reorderLevel && item.currentStock > 0 && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg border border-yellow-200">
                              ⚠️ Reorder Soon
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stock Level Progress */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600">Stock Level</span>
                          <span className="text-sm font-medium text-gray-900">
                            {item.currentStock} / {item.maxStock}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className={`h-3 rounded-full transition-all duration-300 ${
                              item.currentStock === 0 ? 'bg-red-500' :
                              item.currentStock <= item.reorderLevel ? 'bg-yellow-500' :
                              item.currentStock >= item.maxStock ? 'bg-blue-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${Math.min((item.currentStock / item.maxStock) * 100, 100)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>Reorder: {item.reorderLevel}</span>
                          <span>Max: {item.maxStock}</span>
                        </div>
                      </div>

                      {/* Item Details Grid */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <div className="text-sm text-gray-600">Available</div>
                          <div className="font-bold text-green-600">{item.available}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Reserved</div>
                          <div className="font-bold text-blue-600">{item.reserved}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Total Value</div>
                          <div className="font-bold text-gray-900">{formatCurrency(item.totalValue)}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600">Movement</div>
                          <div className={`font-bold ${getMovementColor(item.movement)}`}>
                            {getMovementIcon(item.movement)} {item.movement.toUpperCase()}
                          </div>
                        </div>
                      </div>

                      {/* Enhanced Quick Actions */}
                      <div className="pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-xs text-gray-500">
                            Last restocked: {new Date(item.lastRestocked).toLocaleDateString('en-UG')}
                            {item.lastSold && (
                              <span className="ml-2">• Last sold: {new Date(item.lastSold).toLocaleDateString('en-UG')}</span>
                            )}
                          </div>
                          <div className="text-xs font-medium text-gray-700">
                            Supplier: {item.supplier}
                          </div>
                        </div>

                        {/* Action Buttons Grid */}
                        <div className="grid grid-cols-2 gap-2">
                          {/* Quick Adjust Actions */}
                          <div className="space-y-2">
                            <button
                              onClick={() => handleQuickStockAdjust(item.id, 10, 'Manager adjustment (+10)')}
                              className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                            >
                              <span>📦</span>
                              <span>+10 Stock</span>
                            </button>

                            <button
                              onClick={() => handleSmartReorder(item.id)}
                              className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                              disabled={item.status === 'overstocked'}
                            >
                              <span>🧠</span>
                              <span>Smart Reorder</span>
                            </button>
                          </div>

                          {/* Management Actions */}
                          <div className="space-y-2">
                            <button
                              onClick={() => {
                                setQuickAdjustData({ productId: item.id, adjustment: 0, reason: '' });
                                setShowQuickAdjust(true);
                              }}
                              className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium"
                            >
                              <span>⚙️</span>
                              <span>Custom Adjust</span>
                            </button>

                            <div className="flex space-x-1">
                              <button
                                onClick={() => handleEditProduct(item)}
                                className="flex-1 flex items-center justify-center space-x-1 px-2 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs font-medium"
                              >
                                <FiEdit className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              
                              <button
                                onClick={() => handleDeleteProduct(item.id)}
                                className="flex-1 flex items-center justify-center space-x-1 px-2 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-xs font-medium"
                              >
                                <FiTrash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Smart Suggestions */}
                        {item.status === 'low-stock' && (
                          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="text-sm text-yellow-800">
                              <strong>💡 Suggestion:</strong> Stock is running low. Consider reordering {Math.ceil(item.maxStock - item.currentStock)} units.
                            </div>
                          </div>
                        )}
                        
                        {item.status === 'out-of-stock' && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="text-sm text-red-800">
                              <strong>🚨 Critical:</strong> Item is out of stock! Immediate reorder recommended.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Empty State */}
                {filteredInventory.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📦</div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">No inventory items found</h3>
                    <p className="text-gray-600 mb-4">Try adjusting your search or filter criteria</p>
                    <button
                      onClick={() => {
                        setInventoryFilter('all');
                        setSearchTerm('');
                      }}
                      className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      Reset Filters
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Creative Payment History Modal */}
        {showPaymentHistory && selectedSupplierForHistory && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
                      💰
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">Payment History</h3>
                      <p className="text-purple-100">
                        {selectedSupplierForHistory.name} • Payment Tracking Dashboard
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPaymentHistory(false)}
                    className="text-white/80 hover:text-white transition-colors"
                  >
                    <FiX className="h-8 w-8" />
                  </button>
                </div>
              </div>

              {/* Payment Stats Overview */}
              <div className="p-6 border-b border-gray-200">
                {(() => {
                  const stats = getSupplierPaymentStats(selectedSupplierForHistory.id);
                  const paidPercentage = stats.total > 0 ? Math.round((stats.paid / stats.total) * 100) : 0;
                  const partialPercentage = stats.total > 0 ? Math.round((stats.partial / stats.total) * 100) : 0;
                  const unpaidPercentage = stats.total > 0 ? Math.round((stats.unpaid / stats.total) * 100) : 0;
                  
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600">{stats.paid}</div>
                        <div className="text-sm text-gray-600">Paid ({paidPercentage}%)</div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{ width: `${paidPercentage}%` }}></div>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-orange-500">{stats.partial}</div>
                        <div className="text-sm text-gray-600">Partial ({partialPercentage}%)</div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${partialPercentage}%` }}></div>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-red-500">{stats.unpaid}</div>
                        <div className="text-sm text-gray-600">Unpaid ({unpaidPercentage}%)</div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div className="bg-red-500 h-2 rounded-full" style={{ width: `${unpaidPercentage}%` }}></div>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
                        <div className="text-sm text-gray-600">Total Payments</div>
                        <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: '100%' }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Filter Buttons */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex flex-wrap gap-3">
                  {[
                    { value: 'all', label: 'All Payments', color: 'bg-gray-100 text-gray-800', icon: '📋' },
                    { value: 'paid', label: 'Paid', color: 'bg-green-100 text-green-800', icon: '✅' },
                    { value: 'partial', label: 'Partial', color: 'bg-orange-100 text-orange-800', icon: '⚡' },
                    { value: 'unpaid', label: 'Unpaid', color: 'bg-red-100 text-red-800', icon: '❌' }
                  ].map(filter => (
                    <button
                      key={filter.value}
                      onClick={() => setPaymentFilter(filter.value)}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        paymentFilter === filter.value
                          ? 'ring-2 ring-blue-500 ' + filter.color
                          : filter.color + ' hover:opacity-80'
                      }`}
                    >
                      <span>{filter.icon}</span>
                      <span>{filter.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment History List */}
              <div className="flex-1 overflow-y-auto max-h-96 p-6">
                <div className="space-y-4">
                  {getFilteredPaymentHistory(selectedSupplierForHistory.id).map(payment => (
                    <div key={payment.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="text-3xl" title={`Status: ${payment.status}`}>
                            {getPaymentStatusIcon(payment.status)}
                          </div>
                          <div>
                            <div className="flex items-center space-x-3">
                              <span className="font-bold text-gray-900">{payment.reference}</span>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium`} style={{ 
                                backgroundColor: getPaymentStatusColor(payment.status) + '20',
                                color: getPaymentStatusColor(payment.status)
                              }}>
                                {payment.status.toUpperCase()}
                              </span>
                            </div>
                            <div className="flex items-center space-x-4 mt-1">
                              <span className="text-sm text-gray-600">
                                {getPaymentMethodIcon(payment.paymentMethod)} {payment.paymentMethod.replace('_', ' ').toUpperCase()}
                              </span>
                              <span className="text-sm text-gray-600">
                                📅 {new Date(payment.date).toLocaleDateString('en-UG')}
                              </span>
                              {payment.daysOverdue > 0 && (
                                <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">
                                  {payment.daysOverdue} days overdue
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg text-gray-900">
                            {formatCurrency(payment.amount)}
                          </div>
                          {payment.status === 'partial' && payment.paidAmount && (
                            <div className="text-sm text-gray-600">
                              Paid: {formatCurrency(payment.paidAmount)}
                              <div className="text-xs text-orange-600">
                                Remaining: {formatCurrency(payment.amount - payment.paidAmount)}
                              </div>
                            </div>
                          )}
                          <div className="text-sm text-gray-500">
                            Due: {new Date(payment.dueDate).toLocaleDateString('en-UG')}
                          </div>
                        </div>
                      </div>
                      
                      {/* Progress Bar for Partial Payments */}
                      {payment.status === 'partial' && payment.paidAmount && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>Payment Progress</span>
                            <span>{Math.round((payment.paidAmount / payment.amount) * 100)}% Complete</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-orange-400 to-orange-500 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${(payment.paidAmount / payment.amount) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {getFilteredPaymentHistory(selectedSupplierForHistory.id).length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">💸</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Payment Records</h3>
                    <p className="text-gray-600">
                      {paymentFilter === 'all' ? 'No payment history available for this supplier.' : `No ${paymentFilter} payments found.`}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    Showing {getFilteredPaymentHistory(selectedSupplierForHistory.id).length} payment(s)
                  </div>
                  <div className="flex space-x-3">
                    <button className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors">
                      📊 Generate Report
                    </button>
                    <button className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors">
                      💬 Send Reminder
                    </button>
                    <button
                      onClick={() => setShowPaymentHistory(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Comprehensive Order Details Modal */}
        {selectedOrder && selectedOrder.items && selectedOrder.timeline && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
                      {getOrderStatusIcon(selectedOrder.status)}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">{selectedOrder.orderNumber}</h3>
                      <p className="text-blue-100">
                        {selectedOrder.supplierName} • Order Details & Tracking
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="text-white/80 hover:text-white transition-colors"
                  >
                    <FiX className="h-8 w-8" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex flex-col h-[80vh]">
                {/* Payment Progress */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-bold text-gray-900">Payment Progress</h4>
                    <span className={`px-4 py-2 rounded-full text-sm font-medium border ${getPaymentStatusColor(selectedOrder.paymentStatus)}`}>
                      {getPaymentStatusIcon(selectedOrder.paymentStatus)} {selectedOrder.paymentStatus.toUpperCase().replace('-', ' ')}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
                    <div
                      className={`bg-gradient-to-r ${getPaymentProgressColor(selectedOrder.paymentStatus)} h-4 rounded-full transition-all duration-500 flex items-center justify-center`}
                      style={{ width: `${getPaymentProgress(selectedOrder)}%` }}
                    >
                      {getPaymentProgress(selectedOrder) > 20 && (
                        <span className="text-xs font-bold text-white">
                          {getPaymentProgress(selectedOrder).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Payment Status Cards */}
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className={`p-4 rounded-lg border-2 transition-all ${
                      selectedOrder.paymentStatus === 'not-paid' 
                        ? 'bg-red-50 border-red-200 text-red-700' 
                        : 'bg-gray-50 border-gray-200 text-gray-500'
                    }`}>
                      <div className="text-2xl mb-2">❌</div>
                      <div className="text-sm font-medium">Not Paid</div>
                      <div className="text-xs mt-1">{formatCurrency(0)}</div>
                    </div>
                    
                    <div className={`p-4 rounded-lg border-2 transition-all ${
                      selectedOrder.paymentStatus === 'half-paid' 
                        ? 'bg-yellow-50 border-yellow-200 text-yellow-700' 
                        : 'bg-gray-50 border-gray-200 text-gray-500'
                    }`}>
                      <div className="text-2xl mb-2">⚠️</div>
                      <div className="text-sm font-medium">Half Paid</div>
                      <div className="text-xs mt-1">{formatCurrency(selectedOrder.paidAmount || 0)}</div>
                    </div>
                    
                    <div className={`p-4 rounded-lg border-2 transition-all ${
                      selectedOrder.paymentStatus === 'paid' 
                        ? 'bg-green-50 border-green-200 text-green-700' 
                        : 'bg-gray-50 border-gray-200 text-gray-500'
                    }`}>
                      <div className="text-2xl mb-2">✅</div>
                      <div className="text-sm font-medium">Fully Paid</div>
                      <div className="text-xs mt-1">{formatCurrency(selectedOrder.total)}</div>
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div className="mt-4 bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-600">Amount Paid:</div>
                        <div className="text-lg font-bold text-green-600">
                          {formatCurrency(selectedOrder.paidAmount || 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Remaining Balance:</div>
                        <div className="text-lg font-bold text-red-600">
                          {formatCurrency(selectedOrder.total - (selectedOrder.paidAmount || 0))}
                        </div>
                      </div>
                    </div>
                    {selectedOrder.paymentStatus !== 'paid' && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-xs text-gray-600">
                          Payment Status: <span className="font-medium capitalize">
                            {selectedOrder.paymentStatus.replace('-', ' ')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Order Content Tabs */}
                <div className="flex-1 overflow-hidden">
                  <div className="grid grid-cols-1 lg:grid-cols-3 h-full">
                    {/* Main Content */}
                    <div className="lg:col-span-2 p-6 overflow-y-auto">
                      {/* Order Summary */}
                      <div className="mb-6">
                        <h4 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-blue-50 rounded-lg p-4">
                            <div className="text-2xl font-bold text-blue-600">{selectedOrder.items.length}</div>
                            <div className="text-sm text-blue-700">Items</div>
                          </div>
                          <div className="bg-green-50 rounded-lg p-4">
                            <div className="text-2xl font-bold text-green-600">{formatCurrency(selectedOrder.total)}</div>
                            <div className="text-sm text-green-700">Total Value</div>
                          </div>
                          <div className="bg-purple-50 rounded-lg p-4">
                            <div className="text-2xl font-bold text-purple-600">{getPriorityIcon(selectedOrder.priority)}</div>
                            <div className="text-sm text-purple-700">{selectedOrder.priority} Priority</div>
                          </div>
                          <div className="bg-yellow-50 rounded-lg p-4">
                            <div className="text-2xl font-bold text-yellow-600">
                              {selectedOrder.expectedDate ? 
                                Math.ceil((new Date(selectedOrder.expectedDate) - new Date(selectedOrder.date)) / (1000 * 60 * 60 * 24))
                                : 'N/A'
                              }
                            </div>
                            <div className="text-sm text-yellow-700">Lead Days</div>
                          </div>
                        </div>
                      </div>

                      {/* Order Items */}
                      <div className="mb-6">
                        <h4 className="text-lg font-bold text-gray-900 mb-4">Order Items</h4>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="space-y-4">
                            {selectedOrder.items && selectedOrder.items.map((item, index) => (
                              <div key={item.id || index} className="bg-white rounded-lg p-4 border border-gray-200">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-3">
                                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                        <span className="text-lg font-bold text-blue-600">#{index + 1}</span>
                                      </div>
                                      <div>
                                        <h5 className="font-bold text-gray-900">{item.name}</h5>
                                        <p className="text-sm text-gray-600">{item.description}</p>
                                        <div className="flex items-center space-x-4 mt-1">
                                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                            SKU: {item.sku}
                                          </span>
                                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                                            {item.category}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-bold text-lg text-gray-900">
                                      {formatCurrency(item.totalPrice)}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      {item.quantity} × {formatCurrency(item.unitPrice)}
                                    </div>
                                    {selectedOrder.status === 'delivered' && (
                                      <div className="mt-2 space-y-1">
                                        <div className="text-xs text-green-600">
                                          ✅ Received: {item.received}/{item.quantity}
                                        </div>
                                        {item.damaged > 0 && (
                                          <div className="text-xs text-red-600">
                                            ⚠️ Damaged: {item.damaged}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Order Totals */}
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="space-y-2">
                              <div className="flex justify-between text-gray-600">
                                <span>Subtotal:</span>
                                <span>{formatCurrency(selectedOrder.subtotal)}</span>
                              </div>
                              <div className="flex justify-between text-gray-600">
                                <span>Tax (18%):</span>
                                <span>{formatCurrency(selectedOrder.tax)}</span>
                              </div>
                              <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t">
                                <span>Total:</span>
                                <span>{formatCurrency(selectedOrder.total)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Delivery Information */}
                      <div className="mb-6">
                        <h4 className="text-lg font-bold text-gray-900 mb-4">Delivery Information</h4>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2">Delivery Address</h5>
                              <div className="text-sm text-gray-600">
                                <p>{selectedOrder.deliveryAddress.street}</p>
                                <p>{selectedOrder.deliveryAddress.city}, {selectedOrder.deliveryAddress.district}</p>
                                <p>{selectedOrder.deliveryAddress.country} {selectedOrder.deliveryAddress.postalCode}</p>
                              </div>
                            </div>
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2">Delivery Schedule</h5>
                              <div className="text-sm text-gray-600">
                                <p><strong>Expected:</strong> {new Date(selectedOrder.expectedDate).toLocaleDateString('en-UG')}</p>
                                {selectedOrder.actualDeliveryDate && (
                                  <p><strong>Actual:</strong> {new Date(selectedOrder.actualDeliveryDate).toLocaleDateString('en-UG')}</p>
                                )}
                                {selectedOrder.trackingNumber && (
                                  <p><strong>Tracking:</strong> {selectedOrder.trackingNumber}</p>
                                )}
                              </div>
                            </div>
                          </div>
                          {selectedOrder.deliveryInstructions && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <h5 className="font-medium text-gray-900 mb-2">Special Instructions</h5>
                              <p className="text-sm text-gray-600">{selectedOrder.deliveryInstructions}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Sidebar */}
                    <div className="border-l border-gray-200 p-6 bg-gray-50 overflow-y-auto">
                      {/* Order Timeline */}
                      <div className="mb-6">
                        <h4 className="text-lg font-bold text-gray-900 mb-4">Order Timeline</h4>
                        <div className="space-y-4">
                          {selectedOrder.timeline && selectedOrder.timeline.map((event, index) => (
                            <div key={index} className="flex items-start space-x-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                event.status === 'success' ? 'bg-green-100 text-green-700' :
                                event.status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                                event.status === 'error' ? 'bg-red-100 text-red-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                                {index + 1}
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{event.event}</div>
                                <div className="text-sm text-gray-600">{event.user}</div>
                                <div className="text-xs text-gray-500">{new Date(event.date).toLocaleDateString('en-UG')}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Order Details */}
                      <div className="mb-6">
                        <h4 className="text-lg font-bold text-gray-900 mb-4">Order Details</h4>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Requested by:</span>
                            <span className="text-sm font-medium text-gray-900">{selectedOrder.requestedBy}</span>
                          </div>
                          {selectedOrder.approvedBy && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Approved by:</span>
                              <span className="text-sm font-medium text-gray-900">{selectedOrder.approvedBy}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Payment Terms:</span>
                            <span className="text-sm font-medium text-gray-900">{selectedOrder.paymentTerms}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Priority:</span>
                            <span className={`text-sm font-medium px-2 py-1 rounded ${getPriorityColor(selectedOrder.priority)}`}>
                              {getPriorityIcon(selectedOrder.priority)} {selectedOrder.priority}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Documents */}
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-bold text-gray-900">Documents</h4>
                          <button
                            onClick={() => handleUploadDocument(selectedOrder.id)}
                            className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                          >
                            <FiUpload className="h-4 w-4" />
                            <span>Upload</span>
                          </button>
                        </div>
                        
                        <div className="space-y-3">
                          {selectedOrder.documents && selectedOrder.documents.length > 0 ? (
                            selectedOrder.documents.map((doc, index) => (
                              <div key={index} className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-200 hover:shadow-sm transition-all">
                                <div className="text-2xl">{getDocumentIcon(doc)}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium text-gray-900 truncate">{doc}</span>
                                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                      {getDocumentSize(doc)}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    Uploaded on {new Date().toLocaleDateString('en-UG')}
                                  </div>
                                </div>
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleDocumentView(doc)}
                                    className="flex items-center justify-center w-8 h-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="View Document"
                                  >
                                    <FiEye className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDocumentDownload(doc)}
                                    className="flex items-center justify-center w-8 h-8 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                                    title="Download Document"
                                  >
                                    <FiDownload className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8">
                              <div className="text-4xl mb-3">📋</div>
                              <div className="text-sm text-gray-500 mb-3">No documents uploaded yet</div>
                              <button
                                onClick={() => handleUploadDocument(selectedOrder.id)}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                              >
                                Upload your first document
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Document Quick Actions */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="text-sm font-medium text-gray-900 mb-2">Quick Actions</div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                toast.info('Generating purchase order...', { autoClose: 2000 });
                              }}
                              className="flex items-center space-x-1 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-xs"
                            >
                              <span>📄</span>
                              <span>Generate PO</span>
                            </button>
                            <button
                              onClick={() => handleGenerateInvoice(selectedOrder)}
                              className="flex items-center space-x-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-xs"
                            >
                              <span>💰</span>
                              <span>Invoice</span>
                            </button>
                            <button
                              onClick={() => handleDownloadAllDocuments(selectedOrder)}
                              className="flex items-center space-x-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-xs"
                            >
                              <span>📦</span>
                              <span>Download All</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      {selectedOrder.notes && (
                        <div>
                          <h4 className="text-lg font-bold text-gray-900 mb-4">Notes</h4>
                          <div className="bg-white rounded-lg p-4 border border-gray-200">
                            <p className="text-sm text-gray-600">{selectedOrder.notes}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-6 border-t border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Last updated: {selectedOrder.timeline && selectedOrder.timeline.length > 0 ? 
                        new Date(selectedOrder.timeline[selectedOrder.timeline.length - 1]?.date).toLocaleDateString('en-UG') :
                        'Not available'
                      }
                    </div>
                    <div className="flex space-x-3">
                      {selectedOrder.status === 'pending' && (
                        <>
                          <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                            ✅ Approve Order
                          </button>
                          <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                            ❌ Reject Order
                          </button>
                        </>
                      )}
                      {selectedOrder.status === 'shipped' && (
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                          🚛 Track Shipment
                        </button>
                      )}
                      <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                        📄 Print Details
                      </button>
                      <button
                        onClick={() => setSelectedOrder(null)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Document Viewer Modal */}
        {showDocumentViewer && selectedDocument && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">{getDocumentIcon(selectedDocument)}</div>
                    <div>
                      <h3 className="text-xl font-bold">{getDocumentContent(selectedDocument).title}</h3>
                      <p className="text-slate-200 text-sm">
                        {getDocumentContent(selectedDocument).type} • {getDocumentSize(selectedDocument)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleDocumentDownload(selectedDocument)}
                      className="flex items-center space-x-1 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm"
                    >
                      <FiDownload className="h-4 w-4" />
                      <span>Download</span>
                    </button>
                    <button
                      onClick={() => setShowDocumentViewer(false)}
                      className="text-white/80 hover:text-white p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      <FiX className="h-6 w-6" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex flex-col h-[80vh]">
                {/* Document Toolbar */}
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <span className="text-sm font-medium text-gray-700">Document Tools:</span>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => toast.info('Zoom in functionality', { autoClose: 1500 })}
                          className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          title="Zoom In"
                        >
                          <FiPlus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toast.info('Zoom out functionality', { autoClose: 1500 })}
                          className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          title="Zoom Out"
                        >
                          <span className="text-sm font-bold">−</span>
                        </button>
                        <button
                          onClick={() => window.print()}
                          className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          title="Print"
                        >
                          🖨️
                        </button>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      Page 1 of 1
                    </div>
                  </div>
                </div>

                {/* Document Content */}
                <div className="flex-1 overflow-auto p-6 bg-white">
                  <div className="max-w-4xl mx-auto">
                    <div 
                      className="document-content bg-white border border-gray-200 rounded-lg p-8 shadow-sm"
                      dangerouslySetInnerHTML={{ __html: getDocumentContent(selectedDocument).content }}
                      style={{
                        fontFamily: 'Arial, sans-serif',
                        lineHeight: '1.6',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Document: {selectedDocument} • Last modified: {new Date().toLocaleDateString('en-UG')}
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleDocumentDownload(selectedDocument)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <FiDownload className="h-4 w-4 inline mr-2" />
                        Download
                      </button>
                      <button
                        onClick={() => setShowDocumentViewer(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stock Adjustment Modal */}
        {showStockAdjustment && selectedInventoryItem && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl">
                <h3 className="text-xl font-bold">Adjust Stock Level</h3>
                <p className="text-blue-100">{selectedInventoryItem.name}</p>
              </div>
              
              <div className="p-6">
                <StockAdjustmentForm 
                  item={selectedInventoryItem}
                  onAdjust={handleStockAdjustment}
                  onCancel={() => {
                    setShowStockAdjustment(false);
                    setSelectedInventoryItem(null);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Add Product Modal */}
        {showAddProduct && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-3xl">📦</div>
                    <div>
                      <h3 className="text-xl font-bold">Add New Product</h3>
                      <p className="text-emerald-100">Add a new product to inventory</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAddProduct(false)}
                    className="text-white/80 hover:text-white p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <FiX className="h-6 w-6" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[calc(95vh-120px)]">
                <AddProductForm 
                  onAddProduct={handleAddProduct}
                  onCancel={() => setShowAddProduct(false)}
                  suppliers={suppliers}
                />
              </div>
            </div>
          </div>
        )}

        {/* Quick Adjust Modal */}
        <QuickAdjustModal
          isOpen={showQuickAdjust}
          onClose={() => setShowQuickAdjust(false)}
          productId={quickAdjustData.productId}
          inventory={inventory}
          onAdjust={handleQuickStockAdjust}
        />

        {/* Inventory Analytics Modal */}
        <InventoryAnalyticsModal
          isOpen={showInventoryAnalytics}
          onClose={() => setShowInventoryAnalytics(false)}
          inventory={inventory}
        />

      </div>
    </div>
  );
};

// Stock Adjustment Form Component
const StockAdjustmentForm = ({ item, onAdjust, onCancel }) => {
  const [newStock, setNewStock] = useState(item.currentStock);
  const [adjustmentType, setAdjustmentType] = useState('set');
  const [adjustmentAmount, setAdjustmentAmount] = useState(0);
  const [reason, setReason] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    let finalStock = newStock;
    
    if (adjustmentType === 'add') {
      finalStock = item.currentStock + parseInt(adjustmentAmount);
    } else if (adjustmentType === 'subtract') {
      finalStock = Math.max(0, item.currentStock - parseInt(adjustmentAmount));
    }
    
    onAdjust(item, finalStock, reason);
  };

  const getStockStatus = (stock) => {
    if (stock === 0) return { text: 'Out of Stock', color: 'text-red-600' };
    if (stock <= item.reorderLevel) return { text: 'Low Stock', color: 'text-yellow-600' };
    if (stock >= item.maxStock) return { text: 'Overstocked', color: 'text-blue-600' };
    return { text: 'In Stock', color: 'text-green-600' };
  };

  const currentStatus = getStockStatus(adjustmentType === 'set' ? newStock : 
    adjustmentType === 'add' ? item.currentStock + parseInt(adjustmentAmount || 0) :
    Math.max(0, item.currentStock - parseInt(adjustmentAmount || 0)));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Current Stock Info */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Current Stock:</span>
            <div className="font-bold text-lg">{item.currentStock}</div>
          </div>
          <div>
            <span className="text-gray-600">Available:</span>
            <div className="font-bold text-lg text-green-600">{item.available}</div>
          </div>
          <div>
            <span className="text-gray-600">Reserved:</span>
            <div className="font-bold text-lg text-blue-600">{item.reserved}</div>
          </div>
          <div>
            <span className="text-gray-600">Reorder Level:</span>
            <div className="font-bold text-lg text-yellow-600">{item.reorderLevel}</div>
          </div>
        </div>
      </div>

      {/* Adjustment Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Adjustment Type</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'set', label: 'Set To', icon: '🎯' },
            { value: 'add', label: 'Add', icon: '➕' },
            { value: 'subtract', label: 'Remove', icon: '➖' }
          ].map(type => (
            <button
              key={type.value}
              type="button"
              onClick={() => setAdjustmentType(type.value)}
              className={`p-3 rounded-lg border-2 text-center transition-all ${
                adjustmentType === type.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-lg">{type.icon}</div>
              <div className="text-sm font-medium">{type.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Stock Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {adjustmentType === 'set' ? 'New Stock Level' : 'Adjustment Amount'}
        </label>
        <input
          type="number"
          min="0"
          max={adjustmentType === 'set' ? item.maxStock : undefined}
          value={adjustmentType === 'set' ? newStock : adjustmentAmount}
          onChange={(e) => {
            if (adjustmentType === 'set') {
              setNewStock(parseInt(e.target.value) || 0);
            } else {
              setAdjustmentAmount(parseInt(e.target.value) || 0);
            }
          }}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder={adjustmentType === 'set' ? 'Enter new stock level' : 'Enter amount'}
          required
        />
      </div>

      {/* Status Preview */}
      <div className="bg-blue-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">New Status:</span>
          <span className={`font-bold ${currentStatus.color}`}>
            {currentStatus.text}
          </span>
        </div>
        <div className="mt-2 text-sm text-gray-600">
          Final Stock: <span className="font-bold">
            {adjustmentType === 'set' ? newStock : 
             adjustmentType === 'add' ? item.currentStock + parseInt(adjustmentAmount || 0) :
             Math.max(0, item.currentStock - parseInt(adjustmentAmount || 0))}
          </span>
        </div>
      </div>

      {/* Reason */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Reason for Adjustment</label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        >
          <option value="">Select a reason...</option>
          <option value="stock-take">Stock Take Correction</option>
          <option value="damaged">Damaged Goods</option>
          <option value="theft">Theft/Loss</option>
          <option value="expired">Expired Items</option>
          <option value="return">Customer Return</option>
          <option value="manual">Manual Adjustment</option>
          <option value="system-error">System Error Correction</option>
        </select>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <button
          type="submit"
          className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Apply Adjustment
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

// Add Product Form Component
const AddProductForm = ({ onAddProduct, onCancel, suppliers }) => {
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: '',
    supplier: '',
    initialStock: '',
    reorderLevel: '',
    maxStock: '',
    unitCost: '',
    sellingPrice: '',
    location: ''
  });

  const [errors, setErrors] = useState({});

  const categories = [
    'Smartphones',
    'Audio',
    'Tablets',
    'Laptops',
    'Accessories',
    'Wearables',
    'Gaming',
    'Home & Garden',
    'Electronics',
    'Other'
  ];

  const warehouseLocations = [
    'A-01-01', 'A-01-02', 'A-01-03', 'A-01-04', 'A-01-05',
    'A-02-01', 'A-02-02', 'A-02-03', 'A-02-04', 'A-02-05',
    'B-01-01', 'B-01-02', 'B-01-03', 'B-01-04', 'B-01-05',
    'C-01-01', 'C-01-02', 'C-01-03', 'C-01-04', 'C-01-05'
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.sku.trim()) newErrors.sku = 'SKU is required';
    if (!formData.name.trim()) newErrors.name = 'Product name is required';
    if (!formData.category) newErrors.category = 'Category is required';
    if (!formData.supplier) newErrors.supplier = 'Supplier is required';
    if (!formData.location) newErrors.location = 'Warehouse location is required';
    
    if (!formData.initialStock || parseInt(formData.initialStock) < 0) {
      newErrors.initialStock = 'Valid initial stock is required';
    }
    
    if (!formData.reorderLevel || parseInt(formData.reorderLevel) < 0) {
      newErrors.reorderLevel = 'Valid reorder level is required';
    }
    
    if (!formData.maxStock || parseInt(formData.maxStock) <= 0) {
      newErrors.maxStock = 'Valid max stock is required';
    }
    
    if (!formData.unitCost || parseFloat(formData.unitCost) <= 0) {
      newErrors.unitCost = 'Valid unit cost is required';
    }
    
    if (!formData.sellingPrice || parseFloat(formData.sellingPrice) <= 0) {
      newErrors.sellingPrice = 'Valid selling price is required';
    }

    // Business logic validations
    if (formData.reorderLevel && formData.maxStock && 
        parseInt(formData.reorderLevel) >= parseInt(formData.maxStock)) {
      newErrors.reorderLevel = 'Reorder level must be less than max stock';
    }

    if (formData.unitCost && formData.sellingPrice && 
        parseFloat(formData.unitCost) >= parseFloat(formData.sellingPrice)) {
      newErrors.sellingPrice = 'Selling price must be higher than unit cost';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onAddProduct(formData);
    }
  };

  const generateSKU = () => {
    const categoryCode = formData.category.substring(0, 3).toUpperCase();
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const generatedSKU = `${categoryCode}${randomNum}`;
    setFormData(prev => ({
      ...prev,
      sku: generatedSKU
    }));
  };

  const calculateMargin = () => {
    if (formData.unitCost && formData.sellingPrice) {
      const cost = parseFloat(formData.unitCost);
      const price = parseFloat(formData.sellingPrice);
      const margin = ((price - cost) / price * 100).toFixed(1);
      return margin;
    }
    return 0;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Product Information Section */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Product Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* SKU */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SKU <span className="text-red-500">*</span>
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                  errors.sku ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter SKU"
              />
              <button
                type="button"
                onClick={generateSKU}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                disabled={!formData.category}
              >
                Generate
              </button>
            </div>
            {errors.sku && <p className="text-red-500 text-sm mt-1">{errors.sku}</p>}
          </div>

          {/* Product Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter product name"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                errors.category ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select category...</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {errors.category && <p className="text-red-500 text-sm mt-1">{errors.category}</p>}
          </div>

          {/* Supplier */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Supplier <span className="text-red-500">*</span>
            </label>
            <select
              name="supplier"
              value={formData.supplier}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                errors.supplier ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select supplier...</option>
              {suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.name}>{supplier.name}</option>
              ))}
            </select>
            {errors.supplier && <p className="text-red-500 text-sm mt-1">{errors.supplier}</p>}
          </div>
        </div>
      </div>

      {/* Stock Information Section */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Stock Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Initial Stock */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Initial Stock <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="initialStock"
              value={formData.initialStock}
              onChange={handleChange}
              min="0"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                errors.initialStock ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="0"
            />
            {errors.initialStock && <p className="text-red-500 text-sm mt-1">{errors.initialStock}</p>}
          </div>

          {/* Reorder Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reorder Level <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="reorderLevel"
              value={formData.reorderLevel}
              onChange={handleChange}
              min="0"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                errors.reorderLevel ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="0"
            />
            {errors.reorderLevel && <p className="text-red-500 text-sm mt-1">{errors.reorderLevel}</p>}
          </div>

          {/* Max Stock */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Stock <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="maxStock"
              value={formData.maxStock}
              onChange={handleChange}
              min="1"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                errors.maxStock ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="0"
            />
            {errors.maxStock && <p className="text-red-500 text-sm mt-1">{errors.maxStock}</p>}
          </div>
        </div>
      </div>

      {/* Pricing Information Section */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Pricing Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Unit Cost */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unit Cost (UGX) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="unitCost"
              value={formData.unitCost}
              onChange={handleChange}
              min="0"
              step="0.01"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                errors.unitCost ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="0.00"
            />
            {errors.unitCost && <p className="text-red-500 text-sm mt-1">{errors.unitCost}</p>}
          </div>

          {/* Selling Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selling Price (UGX) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="sellingPrice"
              value={formData.sellingPrice}
              onChange={handleChange}
              min="0"
              step="0.01"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                errors.sellingPrice ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="0.00"
            />
            {errors.sellingPrice && <p className="text-red-500 text-sm mt-1">{errors.sellingPrice}</p>}
          </div>
        </div>

        {/* Profit Margin Display */}
        {formData.unitCost && formData.sellingPrice && (
          <div className="mt-3 p-3 bg-green-50 rounded-lg">
            <div className="text-sm text-green-800">
              <strong>Profit Margin: {calculateMargin()}%</strong>
              {parseFloat(calculateMargin()) < 10 && (
                <span className="ml-2 text-yellow-600">(Consider higher margin)</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Location Information Section */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Warehouse Location</h4>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Storage Location <span className="text-red-500">*</span>
          </label>
          <select
            name="location"
            value={formData.location}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
              errors.location ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">Select location...</option>
            {warehouseLocations.map(location => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
          {errors.location && <p className="text-red-500 text-sm mt-1">{errors.location}</p>}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-4 pt-6 border-t">
        <button
          type="submit"
          className="flex-1 bg-emerald-600 text-white py-3 rounded-lg hover:bg-emerald-700 transition-colors font-medium"
        >
          Add Product to Inventory
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

// Quick Adjust Stock Modal
const QuickAdjustModal = ({ isOpen, onClose, productId, inventory, onAdjust }) => {
  const [adjustment, setAdjustment] = useState(0);
  const [reason, setReason] = useState('');
  
  const product = inventory.find(p => p.id === productId);
  
  if (!isOpen || !product) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (adjustment !== 0 && reason.trim()) {
      onAdjust(productId, parseInt(adjustment), reason);
      onClose();
      setAdjustment(0);
      setReason('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          Quick Stock Adjustment
        </h3>
        
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="font-medium text-gray-900">{product.name}</div>
          <div className="text-sm text-gray-600">Current Stock: {product.currentStock} units</div>
          <div className="text-sm text-gray-600">SKU: {product.sku}</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Adjustment Amount
            </label>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setAdjustment(-10)}
                className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
              >
                -10
              </button>
              <button
                type="button"
                onClick={() => setAdjustment(-5)}
                className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
              >
                -5
              </button>
              <input
                type="number"
                value={adjustment}
                onChange={(e) => setAdjustment(parseInt(e.target.value) || 0)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="0"
              />
              <button
                type="button"
                onClick={() => setAdjustment(5)}
                className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm"
              >
                +5
              </button>
              <button
                type="button"
                onClick={() => setAdjustment(10)}
                className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm"
              >
                +10
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Adjustment
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              required
            >
              <option value="">Select reason...</option>
              <option value="Stock count correction">Stock count correction</option>
              <option value="Damaged goods removal">Damaged goods removal</option>
              <option value="Emergency restock">Emergency restock</option>
              <option value="Return from customer">Return from customer</option>
              <option value="Transfer between locations">Transfer between locations</option>
              <option value="Manager override">Manager override</option>
            </select>
          </div>

          {adjustment !== 0 && (
            <div className={`p-3 rounded-lg ${adjustment > 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className={`text-sm ${adjustment > 0 ? 'text-green-800' : 'text-red-800'}`}>
                <strong>Preview:</strong> Stock will change from {product.currentStock} to {product.currentStock + adjustment} units
              </div>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              disabled={adjustment === 0 || !reason.trim()}
              className="flex-1 bg-emerald-600 text-white py-3 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Apply Adjustment
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Inventory Analytics Modal
const InventoryAnalyticsModal = ({ isOpen, onClose, inventory }) => {
  if (!isOpen) return null;

  const analytics = {
    totalValue: inventory.reduce((sum, item) => sum + item.totalValue, 0),
    totalItems: inventory.length,
    averageValue: inventory.reduce((sum, item) => sum + item.totalValue, 0) / inventory.length,
    stockTurnover: inventory.filter(item => item.fastMoving).length / inventory.length * 100,
    categories: [...new Set(inventory.map(item => item.category))].map(cat => ({
      name: cat,
      count: inventory.filter(item => item.category === cat).length,
      value: inventory.filter(item => item.category === cat).reduce((sum, item) => sum + item.totalValue, 0)
    }))
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-900">📊 Inventory Analytics Dashboard</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <FiX className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-xl">
            <div className="text-2xl font-bold">{analytics.totalItems}</div>
            <div className="text-blue-100">Total Products</div>
          </div>
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-xl">
            <div className="text-2xl font-bold">{formatCurrency(analytics.totalValue)}</div>
            <div className="text-green-100">Total Inventory Value</div>
          </div>
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 rounded-xl">
            <div className="text-2xl font-bold">{formatCurrency(analytics.averageValue)}</div>
            <div className="text-purple-100">Average Product Value</div>
          </div>
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 rounded-xl">
            <div className="text-2xl font-bold">{analytics.stockTurnover.toFixed(1)}%</div>
            <div className="text-orange-100">Fast-Moving Items</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-50 p-4 rounded-xl">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Category Breakdown</h4>
            <div className="space-y-3">
              {analytics.categories.map(cat => (
                <div key={cat.name} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{cat.name}</div>
                    <div className="text-sm text-gray-600">{cat.count} items</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-900">{formatCurrency(cat.value)}</div>
                    <div className="text-sm text-gray-600">
                      {((cat.value / analytics.totalValue) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Stock Status Overview</h4>
            <div className="space-y-3">
              {['in-stock', 'low-stock', 'out-of-stock', 'overstocked'].map(status => {
                const count = inventory.filter(item => item.status === status).length;
                const percentage = (count / inventory.length) * 100;
                return (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`w-3 h-3 rounded-full ${
                        status === 'in-stock' ? 'bg-green-500' :
                        status === 'low-stock' ? 'bg-yellow-500' :
                        status === 'out-of-stock' ? 'bg-red-500' : 'bg-blue-500'
                      }`}></span>
                      <span className="capitalize font-medium">{status.replace('-', ' ')}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{count} items</div>
                      <div className="text-sm text-gray-600">{percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierManagement;
