import jsPDF from 'jspdf';
import 'jspdf-autotable';

class ReceiptService {
  constructor() {
    this.companyInfo = {
      name: 'FareDeal Uganda',
      address: 'Kampala, Uganda',
      phone: '+256 700 123 456',
      email: 'info@faredeal.ug',
      website: 'www.faredeal.ug',
      motto: 'Your Trusted Local Store 🇺🇬'
    };
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
    const receiptData = {
      receiptNumber: saleData.saleNumber || `RCP-${Date.now()}`,
      date: this.formatDateTime(saleData.createdAt || new Date()),
      items: saleData.items || [],
      subtotal: saleData.subtotal || 0,
      tax: saleData.tax || 0,
      discount: saleData.discount || 0,
      total: saleData.total || 0,
      paymentMethod: saleData.paymentMethod || 'cash',
      change: saleData.change || 0,
      loyaltyPointsEarned: saleData.loyaltyPointsEarned || 0,
      customer: saleData.customer,
      cashier: saleData.cashier || 'System User'
    };

    return receiptData;
  }

  // SMS/Message Receipt
  generateSMSReceipt(saleData) {
    const receipt = this.generateReceiptData(saleData);
    
    let message = `🇺🇬 ${this.companyInfo.name}\n`;
    message += `📱 ${this.companyInfo.phone}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🧾 Receipt: ${receipt.receiptNumber}\n`;
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
    
    if (receipt.loyaltyPointsEarned > 0) {
      message += `⭐ Points Earned: ${receipt.loyaltyPointsEarned}\n`;
    }
    
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🙏 Webale nyo! (Thank you!)\n`;
    message += `Come back soon! 😊`;

    return message;
  }

  // Email Receipt HTML
  generateEmailReceipt(saleData) {
    const receipt = this.generateReceiptData(saleData);
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Receipt - ${receipt.receiptNumber}</title>
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
        .uganda-flag { font-size: 24px; }
        .emoji { font-size: 18px; }
      </style>
    </head>
    <body>
      <div class="receipt-container">
        <div class="header">
          <h1><span class="uganda-flag">🇺🇬</span> ${this.companyInfo.name}</h1>
          <p>${this.companyInfo.motto}</p>
          <p><span class="emoji">📍</span> ${this.companyInfo.address}</p>
          <p><span class="emoji">📱</span> ${this.companyInfo.phone} | <span class="emoji">📧</span> ${this.companyInfo.email}</p>
        </div>
        
        <div class="content">
          <div class="receipt-info">
            <h2><span class="emoji">🧾</span> Receipt Details</h2>
            <p><strong>Receipt #:</strong> ${receipt.receiptNumber}</p>
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

          ${receipt.loyaltyPointsEarned > 0 ? `
          <div class="loyalty-badge">
            <span class="emoji">⭐</span> You earned ${receipt.loyaltyPointsEarned} loyalty points!
          </div>
          ` : ''}
        </div>

        <div class="footer">
          <h3><span class="emoji">🙏</span> Webale nyo! (Thank you!)</h3>
          <p>We appreciate your business and look forward to serving you again!</p>
          <p><strong>Visit us: ${this.companyInfo.website}</strong></p>
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

    // Header
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('🇺🇬 FareDeal Uganda', pageWidth/2, yPos, { align: 'center' });
    yPos += 5;

    doc.setFontSize(8);
    doc.text(this.companyInfo.motto, pageWidth/2, yPos, { align: 'center' });
    yPos += 4;

    doc.text(this.companyInfo.address, pageWidth/2, yPos, { align: 'center' });
    yPos += 4;

    doc.text(this.companyInfo.phone, pageWidth/2, yPos, { align: 'center' });
    yPos += 8;

    // Draw line
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 6;

    // Receipt info
    doc.setFontSize(9);
    doc.text(`Receipt: ${receipt.receiptNumber}`, margin, yPos);
    yPos += 4;

    doc.text(`Date: ${receipt.date}`, margin, yPos);
    yPos += 4;

    if (receipt.customer) {
      doc.text(`Customer: ${receipt.customer.firstName} ${receipt.customer.lastName}`, margin, yPos);
      yPos += 4;
    }

    doc.text(`Cashier: ${receipt.cashier}`, margin, yPos);
    yPos += 6;

    // Draw line
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 6;

    // Items header
    doc.setFontSize(8);
    doc.text('ITEMS', margin, yPos);
    yPos += 4;

    // Items
    receipt.items.forEach((item, index) => {
      doc.text(`${index + 1}. ${item.name}`, margin, yPos);
      yPos += 3;
      
      const itemTotal = this.formatCurrency(item.quantity * item.price);
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
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`TOTAL: ${this.formatCurrency(receipt.total)}`, margin, yPos);
    yPos += 6;

    doc.setFontSize(9);
    doc.text(`Payment: ${receipt.paymentMethod.toUpperCase()}`, margin, yPos);
    yPos += 4;

    if (receipt.change > 0) {
      doc.text(`Change: ${this.formatCurrency(receipt.change)}`, margin, yPos);
      yPos += 4;
    }

    if (receipt.loyaltyPointsEarned > 0) {
      yPos += 2;
      doc.text(`⭐ Points Earned: ${receipt.loyaltyPointsEarned}`, margin, yPos);
      yPos += 6;
    }

    // Footer
    yPos += 4;
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 6;

    doc.setFontSize(8);
    doc.text('🙏 Webale nyo! (Thank you!)', pageWidth/2, yPos, { align: 'center' });
    yPos += 4;

    doc.text('Come back soon! 😊', pageWidth/2, yPos, { align: 'center' });
    yPos += 6;

    doc.text(this.companyInfo.website, pageWidth/2, yPos, { align: 'center' });

    return doc;
  }

  // Send SMS (mock implementation - would integrate with SMS service)
  async sendSMSReceipt(phoneNumber, saleData) {
    const message = this.generateSMSReceipt(saleData);
    
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
    const htmlContent = this.generateEmailReceipt(saleData);
    const receipt = this.generateReceiptData(saleData);
    
    // Mock email sending - in production, integrate with services like:
    // - SendGrid, Mailgun, or AWS SES
    console.log('📧 Sending Email to:', email);
    console.log('Subject:', `Receipt ${receipt.receiptNumber} - FareDeal Uganda`);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      success: true,
      message: 'Email receipt sent successfully!',
      recipient: email,
      subject: `Receipt ${receipt.receiptNumber} - FareDeal Uganda`,
      messageId: `EMAIL_${Date.now()}`
    };
  }

  // Download PDF
  downloadPDFReceipt(saleData, filename) {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = await this.generatePDFReceipt(saleData);
        const receipt = this.generateReceiptData(saleData);
        
        const finalFilename = filename || `Receipt_${receipt.receiptNumber}.pdf`;
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
  printReceipt(saleData) {
    const htmlContent = this.generateEmailReceipt(saleData);
    
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
