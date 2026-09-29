import jsPDF from 'jspdf';
import 'jspdf-autotable';
import QRCode from 'qrcode';
import { supabase } from './supabase';
import inventoryService from './inventorySupabaseService';
const FALLBACK_COMPANY_INFO = {
  name: 'Your Supermarket',
  address: '',
  phone: '',
  email: '',
  website: '',
  motto: 'Thank you for shopping with us.',
  logoUrl: null
};
class ReceiptService {
  constructor() {
    this._companyInfoPromise = null;
  }
  // Every generated receipt should carry the signed-in cashier's own
  // supermarket name, not a hardcoded brand — resolved once per session
  // and cached, mirroring useSupermarketBranding's approach outside React.
  async getCompanyInfo() {
    if (this._companyInfoPromise) return this._companyInfoPromise;
    this._companyInfoPromise = (async () => {
      try {
        const supermarketId = await inventoryService.getCurrentSupermarketId();
        if (!supermarketId) return FALLBACK_COMPANY_INFO;
        const { data: supermarket, error } = await supabase
          .from('supermarkets')
          .select('*')
          .eq('id', supermarketId)
          .maybeSingle();
        if (error || !supermarket?.name) return FALLBACK_COMPANY_INFO;
        let businessProfile = null;
        if (supermarket.pichin_business_profile_id) {
          const { data } = await supabase.from('cmms_company_profiles')
            .select('*')
            .eq('pichin_business_profile_id', supermarket.pichin_business_profile_id)
            .maybeSingle();
          businessProfile = data;
        }
        const publicWebsite = businessProfile?.id
          ? `${window.location.origin}/notices/${businessProfile.id}`
          : (supermarket.website_url || supermarket.website || '');
        return {
          name: supermarket.name,
          address: businessProfile?.address || businessProfile?.location || supermarket.address || '',
          phone: businessProfile?.contact_phone || businessProfile?.phone || supermarket.phone || '',
          email: businessProfile?.contact_email || businessProfile?.email || supermarket.support_email || supermarket.email || '',
          website: publicWebsite,
          motto: FALLBACK_COMPANY_INFO.motto,
          logoUrl: supermarket.logo_url || null
        };
      } catch (error) {
        console.error('Error loading supermarket branding for receipt:', error);
        return FALLBACK_COMPANY_INFO;
      }
    })();
    return this._companyInfoPromise;
  }
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
  formatDateTime(date) {
    return new Date(date).toLocaleString('en-UG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Kampala'
    });
  }
  generateReceiptData(saleData) {
    const items = (Array.isArray(saleData.items) ? saleData.items : []).map((item = {}) => {
      const quantity = Number(item.quantity ?? item.qty ?? item.count ?? 1) || 1;
      const lineTotal = Number(item.line_total ?? item.lineTotal ?? item.line_total_ugx ?? item.total ?? item.amount) || 0;
      const price = Number(item.price ?? item.selling_price ?? item.unit_price ?? item.unitPrice ?? item.price_ugx ?? item.product?.price ?? item.product?.selling_price ?? item.product?.unit_price)
        || (lineTotal ? lineTotal / quantity : 0);
      return {
        ...item,
        name: item.name || item.product_name || item.item_name || item.product?.name || item.description || 'Item details unavailable',
        quantity,
        price
      };
    });
    const receiptData = {
      id: saleData.id || null,
      receiptNumber: saleData.saleNumber || `RCP-${Date.now()}`,
      transactionId: saleData.transactionId || null,
      websiteUrl: saleData.websiteUrl || window.location.origin,
      date: this.formatDateTime(saleData.createdAt || new Date()),
      items,
      subtotal: saleData.subtotal || 0,
      tax: saleData.tax || 0,
      discount: saleData.discount || 0,
      total: saleData.total || 0,
      paymentMethod: saleData.paymentMethod || 'cash',
      change: saleData.change || 0,
      loyaltyPointsEarned: saleData.loyaltyPointsEarned || 0,
      customer: saleData.customer,
      cashier: saleData.cashier || 'System User',
      // Invoice vs. receipt: 'paid' prints a RECEIPT; 'partial'/'unpaid'
      // prints an INVOICE showing what's still owed.
      paymentStatus: saleData.paymentStatus || 'paid',
      amountPaid: saleData.amountPaid ?? saleData.total ?? 0,
      balanceDue: saleData.balanceDue || 0,
      dueDate: saleData.dueDate || null,
      jobStatus: saleData.jobStatus || null
    };
    return receiptData;
  }
  // SMS/Message Receipt
  async generateSMSReceipt(saleData) {
    const receipt = this.generateReceiptData(saleData);
    const companyInfo = await this.getCompanyInfo();
    const isInvoice = receipt.paymentStatus !== 'paid';
    let message = `🇺🇬 ${companyInfo.name}\n`;
    message += `📱 ${companyInfo.phone}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += isInvoice
      ? `🧾 INVOICE: ${receipt.receiptNumber}\n`
      : `🧾 Receipt: ${receipt.receiptNumber}\n`;
    message += `📅 ${receipt.date}\n`;
    
    if (receipt.customer) {
      message += `👤 Customer: ${receipt.customer.firstName} ${receipt.customer.lastName}\n`;
    }
    
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🛒 ITEMS:\n`;
    
    receipt.items.forEach((item, index) => {
      message += `${index + 1}. ${item.name}\n`;
      message += `   ${item.quantity}x ${this.formatCurrency(item.price)} = ${this.formatCurrency(item.quantity * item.price)}\n`;
    });
    
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💰 Subtotal: ${this.formatCurrency(receipt.subtotal)}\n`;
    
    if (receipt.tax > 0) {
      message += `📊 VAT (18%): ${this.formatCurrency(receipt.tax)}\n`;
    }
    
    if (receipt.discount > 0) {
      message += `🎉 Loyalty Discount: -${this.formatCurrency(receipt.discount)}\n`;
    }
    
    message += `💳 TOTAL: ${this.formatCurrency(receipt.total)}\n`;
    message += `💰 Payment: ${receipt.paymentMethod.toUpperCase()}\n`;
    if (receipt.change > 0) {
      message += `💵 Change: ${this.formatCurrency(receipt.change)}\n`;
    }
    if (isInvoice) {
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      message += `✅ Amount Paid: ${this.formatCurrency(receipt.amountPaid)}\n`;
      message += `⚠️ Balance Due: ${this.formatCurrency(receipt.balanceDue)}\n`;
      if (receipt.dueDate) {
        message += `📆 Due: ${receipt.dueDate}\n`;
      }
    }
    if (receipt.loyaltyPointsEarned > 0) {
      message += `⭐ Points Earned: ${receipt.loyaltyPointsEarned}\n`;
    }
    
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🙏 Webale nyo! (Thank you!)\n`;
    message += `Come back soon! 😊`;
    return message;
  }
  // Email Receipt HTML
  async generateEmailReceipt(saleData) {
    const receipt = this.generateReceiptData(saleData);
    const companyInfo = await this.getCompanyInfo();
    const websiteQr = await QRCode.toDataURL(receipt.websiteUrl || window.location.origin, { margin: 1, width: 240 });
    const isInvoice = receipt.paymentStatus !== 'paid';
    const docLabel = isInvoice ? 'Invoice' : 'Receipt';
    const statusBadge = isInvoice
      ? ` <span style="color:#b45309;">(${receipt.paymentStatus === 'partial' ? 'PARTIALLY PAID' : 'UNPAID'})</span>`
      : '';
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${docLabel} - ${receipt.receiptNumber}</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          max-width: 600px; 
          margin: 0 auto; 
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
        }
        .receipt-container {
          background: white;
          border-radius: 15px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .header { 
          background: linear-gradient(135deg, #ff6b6b, #ee5a24);
          color: white; 
          padding: 30px; 
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: bold;
        }
        .header .logo {
          width: 64px;
          height: 64px;
          object-fit: cover;
          border-radius: 12px;
          margin: 0 auto 10px;
          display: block;
          box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        }
        .header p { 
          margin: 5px 0; 
          opacity: 0.9;
        }
        .content { 
          padding: 30px; 
        }
        .receipt-info {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 10px;
          margin-bottom: 20px;
          border-left: 5px solid #007bff;
        }
        .items-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 20px 0;
          background: white;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        .items-table th { 
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white; 
          padding: 15px; 
          text-align: left;
          font-weight: 600;
        }
        .items-table td { 
          padding: 12px 15px; 
          border-bottom: 1px solid #eee;
        }
        .items-table tr:nth-child(even) {
          background: #f8f9fa;
        }
        .totals { 
          background: #f8f9fa;
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        }
        .totals .total-row { 
          display: flex; 
          justify-content: space-between; 
          margin: 8px 0;
          font-size: 16px;
        }
        .totals .final-total { 
          font-weight: bold; 
          font-size: 20px; 
          color: #28a745;
          border-top: 2px solid #dee2e6;
          padding-top: 10px;
          margin-top: 10px;
        }
        .footer { 
          text-align: center; 
          padding: 20px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
        }
        .loyalty-badge {
          background: linear-gradient(135deg, #ffd700, #ffed4e);
          color: #333;
          padding: 10px 20px;
          border-radius: 25px;
          display: inline-block;
          margin: 10px 0;
          font-weight: bold;
        }
        .balance-due-row {
          background: #fff3cd;
          border: 2px solid #ffc107;
          border-radius: 8px;
          padding: 12px 15px;
          margin-top: 10px;
        }
        .balance-due-row .total-row.final-total {
          color: #b45309;
        }
        .website-qr { margin: 18px auto 0; padding: 14px; max-width: 220px; text-align: center; border: 1px solid #c4a052; border-radius: 10px; background: #faf8f1; color: #312e81; }
        .website-qr img { width: 132px; height: 132px; background: #fff; padding: 6px; }
        @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        .uganda-flag { font-size: 24px; }
        .emoji { font-size: 18px; }
      </style>
    </head>
    <body>
      <div class="receipt-container">
        <div class="header">
          ${companyInfo.logoUrl ? `<img class="logo" src="${companyInfo.logoUrl}" alt="${companyInfo.name}" />` : ''}
          <h1><span class="uganda-flag">🇺🇬</span> ${companyInfo.name}</h1>
          <p>${companyInfo.motto}</p>
          <p><span class="emoji">📍</span> ${companyInfo.address}</p>
          <p>${[companyInfo.phone && `<span class="emoji">📱</span> ${companyInfo.phone}`, companyInfo.email && `<span class="emoji">📧</span> ${companyInfo.email}`].filter(Boolean).join(' | ')}</p>
        </div>
        
        <div class="content">
          <div class="receipt-info">
            <h2><span class="emoji">🧾</span> ${docLabel} Details${statusBadge}</h2>
            <p><strong>${docLabel} #:</strong> ${receipt.receiptNumber}</p>
            <p><strong>Date:</strong> ${receipt.date}</p>
            <p><strong>Cashier:</strong> ${receipt.cashier}</p>
            ${receipt.customer ? `<p><strong>Customer:</strong> ${receipt.customer.firstName} ${receipt.customer.lastName}</p>` : ''}
          </div>
          <h3><span class="emoji">🛒</span> Items Purchased</h3>
          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${receipt.items.map(item => `
                <tr>
                  <td><strong>${item.name}</strong></td>
                  <td>${item.quantity}</td>
                  <td>${this.formatCurrency(item.price)}</td>
                  <td><strong>${this.formatCurrency(item.quantity * item.price)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="totals">
            <div class="total-row">
              <span><span class="emoji">💰</span> Subtotal:</span>
              <span>${this.formatCurrency(receipt.subtotal)}</span>
            </div>
            ${receipt.tax > 0 ? `
            <div class="total-row">
              <span><span class="emoji">📊</span> VAT (18%):</span>
              <span>${this.formatCurrency(receipt.tax)}</span>
            </div>
            ` : ''}
            ${receipt.discount > 0 ? `
            <div class="total-row">
              <span><span class="emoji">🎉</span> Loyalty Discount:</span>
              <span>-${this.formatCurrency(receipt.discount)}</span>
            </div>
            ` : ''}
            <div class="total-row final-total">
              <span><span class="emoji">💳</span> TOTAL:</span>
              <span>${this.formatCurrency(receipt.total)}</span>
            </div>
            <div class="total-row">
              <span><span class="emoji">💰</span> Payment Method:</span>
              <span>${receipt.paymentMethod.toUpperCase()}</span>
            </div>
            ${receipt.change > 0 ? `
            <div class="total-row">
              <span><span class="emoji">💵</span> Change:</span>
              <span>${this.formatCurrency(receipt.change)}</span>
            </div>
            ` : ''}
          </div>
          ${isInvoice ? `
          <div class="balance-due-row">
            <div class="total-row">
              <span><span class="emoji">✅</span> Amount Paid:</span>
              <span>${this.formatCurrency(receipt.amountPaid)}</span>
            </div>
            <div class="total-row final-total">
              <span><span class="emoji">⚠️</span> Balance Due:</span>
              <span>${this.formatCurrency(receipt.balanceDue)}</span>
            </div>
            ${receipt.dueDate ? `
            <div class="total-row">
              <span><span class="emoji">📆</span> Due Date:</span>
              <span>${receipt.dueDate}</span>
            </div>
            ` : ''}
          </div>
          ` : ''}
          ${receipt.loyaltyPointsEarned > 0 ? `
          <div class="loyalty-badge">
            <span class="emoji">⭐</span> You earned ${receipt.loyaltyPointsEarned} loyalty points!
          </div>
          ` : ''}
        </div>
        <div class="footer">
          <h3><span class="emoji">🙏</span> Webale nyo! (Thank you!)</h3>
          <p>We appreciate your business and look forward to serving you again!</p>
          ${companyInfo.website ? `<p><strong>Visit us: ${companyInfo.website}</strong></p>` : ''}
          <div class="website-qr"><strong>Visit our public website</strong><br><img src="${websiteQr}" alt="Store website QR"><p>${receipt.websiteUrl || window.location.origin}</p></div>
          <p><span class="emoji">😊</span> Come back soon!</p>
        </div>
      </div>
    </body>
    </html>
    `;
    return html;
  }
  // PDF Receipt
  async generatePDFReceipt(saleData) {
    const receipt = this.generateReceiptData(saleData);
    const companyInfo = await this.getCompanyInfo();
    const isInvoice = receipt.paymentStatus !== 'paid';
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 200] // Thermal printer size
    });
    // Set font
    doc.setFont('helvetica');
    let yPos = 10;
    const pageWidth = 80;
    const margin = 5;
    // Classic indigo stationery with a warm gold rule. The page remains
    // thermal-width, while colour PDFs retain a polished keepsake feel.
    doc.setFillColor(49, 46, 129);
    doc.rect(0, 0, pageWidth, 56, 'F');
    doc.setFillColor(196, 160, 82);
    doc.rect(0, 56, pageWidth, 1.5, 'F');
    // Logo, if the store has uploaded one (stored as a base64 data URL)
    const logoFormatMatch = companyInfo.logoUrl?.match(/^data:image\/(png|jpe?g|webp);base64,/i);
    if (logoFormatMatch) {
      try {
        const logoSize = 18;
        const format = logoFormatMatch[1].toUpperCase() === 'JPG' ? 'JPEG' : logoFormatMatch[1].toUpperCase();
        doc.addImage(companyInfo.logoUrl, format, (pageWidth - logoSize) / 2, yPos, logoSize, logoSize);
        yPos += logoSize + 3;
      } catch (logoError) {
        console.warn('Could not add store logo to PDF receipt:', logoError);
      }
    }
    // Header
    doc.setFontSize(12);
    doc.setTextColor(255, 253, 248);
    doc.text(companyInfo.name, pageWidth/2, yPos, { align: 'center' });
    yPos += 5;
    doc.setFontSize(8);
    doc.setTextColor(237, 233, 216);
    doc.text(companyInfo.motto, pageWidth/2, yPos, { align: 'center' });
    yPos += 4;
    if (companyInfo.address) {
      doc.text(companyInfo.address, pageWidth/2, yPos, { align: 'center' });
      yPos += 4;
    }
    if (companyInfo.phone) {
      doc.text(companyInfo.phone, pageWidth/2, yPos, { align: 'center' });
      yPos += 4;
    }
    yPos = Math.max(yPos + 4, 62);
    // Draw a soft gold divider below the store masthead.
    doc.setDrawColor(196, 160, 82);
    doc.setLineWidth(0.55);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 6;
    // Document type — RECEIPT when fully paid, INVOICE with a status tag
    // when there's a balance due.
    doc.setFontSize(11);
    doc.setTextColor(49, 46, 129);
    doc.text(isInvoice ? 'INVOICE' : 'RECEIPT', pageWidth/2, yPos, { align: 'center' });
    yPos += 5;
    if (isInvoice) {
      doc.setFontSize(8);
      doc.setTextColor(180, 83, 9);
      doc.text(
        receipt.paymentStatus === 'partial' ? '(PARTIALLY PAID)' : '(UNPAID)',
        pageWidth/2, yPos, { align: 'center' }
      );
      yPos += 5;
    }
    // Receipt info
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(`${isInvoice ? 'Invoice' : 'Receipt'}: ${receipt.receiptNumber}`, margin, yPos);
    yPos += 4;
    doc.text(`Date: ${receipt.date}`, margin, yPos);
    yPos += 4;
    if (receipt.customer) {
      doc.text(`Customer: ${receipt.customer.firstName} ${receipt.customer.lastName}`, margin, yPos);
      yPos += 4;
    }
    doc.text(`Cashier: ${receipt.cashier}`, margin, yPos);
    yPos += 6;
    // Fine gold divider separates the transaction details from the item list.
    doc.setDrawColor(196, 160, 82);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 6;
    // Items header
    doc.setFillColor(250, 248, 241);
    doc.roundedRect(margin, yPos - 3, pageWidth - margin * 2, 7, 1.5, 1.5, 'F');
    doc.setTextColor(49, 46, 129);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('ITEMS', margin, yPos);
    yPos += 4;
    doc.setFont('helvetica', 'normal');
    // Items
    receipt.items.forEach((item, index) => {
      if (index % 2 === 1) {
        doc.setFillColor(250, 248, 241);
        doc.rect(margin, yPos - 2.5, pageWidth - margin * 2, 9, 'F');
      }
      doc.setTextColor(49, 46, 129);
      const itemName = doc.splitTextToSize(`${index + 1}. ${item.name}`, pageWidth - margin * 2);
      doc.text(itemName, margin, yPos);
      yPos += Math.max(3, itemName.length * 3)
      yPos += 3;
      
      const itemTotal = this.formatCurrency(item.quantity * item.price);
      doc.setTextColor(71, 85, 105);
      doc.text(`   ${item.quantity} x ${this.formatCurrency(item.price)} = ${itemTotal}`, margin + 3, yPos);
      yPos += 5;
    });
    // Draw line
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;
    // Totals
    doc.setFontSize(9);
    doc.text(`Subtotal: ${this.formatCurrency(receipt.subtotal)}`, margin, yPos);
    yPos += 4;
    if (receipt.tax > 0) {
      doc.text(`VAT (18%): ${this.formatCurrency(receipt.tax)}`, margin, yPos);
      yPos += 4;
    }
    if (receipt.discount > 0) {
      doc.text(`Loyalty Discount: -${this.formatCurrency(receipt.discount)}`, margin, yPos);
      yPos += 4;
    }
    // Final total
    doc.setFillColor(49, 46, 129);
    doc.roundedRect(margin, yPos - 5, pageWidth - margin * 2, 12, 1.5, 1.5, 'F');
    doc.setFontSize(11);
    doc.setTextColor(255, 253, 248);
    doc.text(`TOTAL: ${this.formatCurrency(receipt.total)}`, margin, yPos);
    yPos += 11;
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(`Payment: ${receipt.paymentMethod.toUpperCase()}`, margin, yPos);
    yPos += 4;
    if (receipt.change > 0) {
      doc.text(`Change: ${this.formatCurrency(receipt.change)}`, margin, yPos);
      yPos += 4;
    }
    if (isInvoice) {
      yPos += 2;
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 5;
      doc.text(`Amount Paid: ${this.formatCurrency(receipt.amountPaid)}`, margin, yPos);
      yPos += 4;
      doc.setFontSize(10);
      doc.setTextColor(180, 83, 9);
      doc.text(`Balance Due: ${this.formatCurrency(receipt.balanceDue)}`, margin, yPos);
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      yPos += 4;
      if (receipt.dueDate) {
        doc.text(`Due: ${receipt.dueDate}`, margin, yPos);
        yPos += 4;
      }
    }
    if (receipt.loyaltyPointsEarned > 0) {
      yPos += 2;
      doc.text(`Points Earned: ${receipt.loyaltyPointsEarned}`, margin, yPos);
      yPos += 6;
    }
    // Always link the QR to the store's CMMS public board (or app website
    // when this store has no linked board).
    try {
      const qrValue = receipt.websiteUrl || window.location.origin;
      const qrDataUrl = await QRCode.toDataURL(qrValue, { margin: 1, width: 280 });
      const qrSize = 28;
      yPos += 2;
      doc.setFillColor(250, 248, 241);
      doc.roundedRect(18, yPos - 2, 44, 37, 2, 2, 'F');
      doc.addImage(qrDataUrl, 'PNG', (pageWidth - qrSize) / 2, yPos, qrSize, qrSize);
      yPos += qrSize + 2;
      doc.setFontSize(7);
      doc.setTextColor(49, 46, 129);
      doc.text('SCAN TO VISIT OUR WEBSITE', pageWidth / 2, yPos, { align: 'center' });
      doc.setFontSize(9);
      yPos += 4;
    } catch (qrError) {
      console.warn('Could not add QR code to PDF receipt:', qrError);
    }
    // Footer
    yPos += 4;
    doc.setDrawColor(196, 160, 82);
    doc.setLineWidth(0.45);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 6;
    doc.setFontSize(8);
    doc.setTextColor(49, 46, 129);
    doc.setFont('helvetica', 'bold');
    doc.text('Webale nyo! Thank you for your purchase.', pageWidth/2, yPos, { align: 'center' });
    yPos += 4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('We look forward to seeing you again.', pageWidth/2, yPos, { align: 'center' });
    yPos += 6;
    if (companyInfo.website) doc.text(companyInfo.website, pageWidth/2, yPos, { align: 'center' });
    // Let longer item lists and their always-present website QR extend the
    // thermal PDF roll instead of clipping the footer off at 200 mm.
    doc.internal.pageSize.setHeight(yPos + 12);
    return doc;
  }
  // Send SMS (mock implementation - would integrate with SMS service)
  async sendSMSReceipt(phoneNumber, saleData) {
    const message = await this.generateSMSReceipt(saleData);
    
    // Mock SMS sending - in production, integrate with services like:
    // - Twilio, Africa's Talking, or local Ugandan SMS providers
    console.log('📱 Sending SMS to:', phoneNumber);
    console.log('Message:', message);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      message: 'SMS receipt sent successfully!',
      recipient: phoneNumber,
      messageId: `SMS_${Date.now()}`
    };
  }
  // Send Email (mock implementation - would integrate with email service)
  async sendEmailReceipt(email, saleData) {
    const htmlContent = await this.generateEmailReceipt(saleData);
    const receipt = this.generateReceiptData(saleData);
    const companyInfo = await this.getCompanyInfo();
    const subject = `Receipt ${receipt.receiptNumber} - ${companyInfo.name}`;
    // Mock email sending - in production, integrate with services like:
    // - SendGrid, Mailgun, or AWS SES
    console.log('📧 Sending Email to:', email);
    console.log('Subject:', subject);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    return {
      success: true,
      message: 'Email receipt sent successfully!',
      recipient: email,
      subject,
      messageId: `EMAIL_${Date.now()}`
    };
  }
  // Download PDF
  downloadPDFReceipt(saleData, filename) {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = await this.generatePDFReceipt(saleData);
        const receipt = this.generateReceiptData(saleData);
        // An unpaid/partial sale is an invoice, not a receipt — the
        // downloaded filename should say so too, not just the PDF's own
        // "INVOICE" heading (see generatePDFReceipt's isInvoice).
        const docWord = receipt.paymentStatus && receipt.paymentStatus !== 'paid' ? 'Invoice' : 'Receipt';
        const finalFilename = filename || `${docWord}_${receipt.receiptNumber}.pdf`;
        doc.save(finalFilename);
        
        resolve({
          success: true,
          message: 'PDF receipt downloaded successfully!',
          filename: finalFilename
        });
      } catch (error) {
        reject({
          success: false,
          message: 'Failed to generate PDF receipt',
          error: error.message
        });
      }
    });
  }
  // Print receipt (browser print)
  async printReceipt(saleData) {
    const htmlContent = await this.generateEmailReceipt(saleData);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
    
    return {
      success: true,
      message: 'Print dialog opened successfully!'
    };
  }
}
export default new ReceiptService();
