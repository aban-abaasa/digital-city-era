import jsPDF from 'jspdf';
import 'jspdf-autotable';

const generateReportContent = (reportData) => {
  if (!reportData) return { text: 'No report data available.', html: '<div>No report data available.</div>' };

  const { reportType, title, dateRange, data, summary, generatedAt } = reportData;

  const formattedDate = new Date(generatedAt).toLocaleString('en-UG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Kampala'
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // SMS Content
  let smsContent = `🇺🇬 FAREDEAL ${reportType.toUpperCase()} REPORT\n`;
  smsContent += `Generated: ${formattedDate}\n`;
  smsContent += `Period: ${dateRange}\n\n`;
  smsContent += `📊 SUMMARY:\n`;
  
  if (summary) {
    Object.entries(summary).forEach(([key, value]) => {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      if (typeof value === 'number' && key.includes('amount') || key.includes('total') || key.includes('revenue')) {
        smsContent += `${label}: ${formatCurrency(value)}\n`;
      } else {
        smsContent += `${label}: ${value}\n`;
      }
    });
  }
  
  smsContent += `\nWebale nyo! Full report available via email/PDF.`;

  // Email/HTML Content
  let htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 20px auto; background: linear-gradient(to bottom right, #f0f9ff, #fff); border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
      <div style="background: linear-gradient(to right, #6366f1, #8b5cf6, #ec4899); padding: 30px; color: white; text-align: center; border-bottom: 5px solid #fcd34d;">
        <h1 style="margin: 0; font-size: 2.5em; font-weight: bold; display: flex; align-items: center; justify-content: center;">
          <span style="margin-right: 10px;">🇺🇬</span> FAREDEAL ${reportType.toUpperCase()} REPORT
        </h1>
        <p style="margin: 5px 0 0; font-size: 1.1em; opacity: 0.9;">${title}</p>
      </div>

      <div style="padding: 30px;">
        <div style="background-color: #f0f9ff; border-left: 5px solid #6366f1; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
          <h2 style="color: #4338ca; font-size: 1.6em; margin-bottom: 15px;">📋 Report Information</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div>
              <p style="margin: 5px 0; font-size: 1em; color: #374151;"><strong>Report Type:</strong></p>
              <p style="margin: 0; font-weight: 600; color: #4338ca; text-transform: capitalize;">${reportType}</p>
            </div>
            <div>
              <p style="margin: 5px 0; font-size: 1em; color: #374151;"><strong>Generated:</strong></p>
              <p style="margin: 0; font-weight: 600; color: #4338ca;">${formattedDate}</p>
            </div>
            <div style="grid-column: 1 / -1;">
              <p style="margin: 5px 0; font-size: 1em; color: #374151;"><strong>Period:</strong></p>
              <p style="margin: 0; font-weight: 600; color: #4338ca;">${dateRange}</p>
            </div>
          </div>
        </div>

        ${summary ? `
          <div style="background-color: #ecfdf5; border-left: 5px solid #10b981; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="color: #047857; font-size: 1.4em; margin-bottom: 15px;">📊 Executive Summary</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
              ${Object.entries(summary).map(([key, value]) => {
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                const formattedValue = (typeof value === 'number' && (key.includes('amount') || key.includes('total') || key.includes('revenue'))) 
                  ? formatCurrency(value) 
                  : value;
                return `
                  <div style="background-color: white; padding: 15px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <p style="margin: 0 0 5px; font-size: 0.9em; color: #6b7280;">${label}</p>
                    <p style="margin: 0; font-size: 1.3em; font-weight: bold; color: #047857;">${formattedValue}</p>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        ${data && data.length > 0 ? `
          <div style="background-color: #fefce8; border-left: 5px solid #eab308; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="color: #a16207; font-size: 1.4em; margin-bottom: 15px;">📈 Detailed Data</h3>
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <thead>
                  <tr style="background: linear-gradient(to right, #eab308, #ca8a04); color: white;">
                    ${Object.keys(data[0] || {}).map(key => `
                      <th style="padding: 12px; text-align: left; font-weight: bold; text-transform: capitalize;">
                        ${key.replace(/([A-Z])/g, ' $1')}
                      </th>
                    `).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${data.slice(0, 10).map((row, index) => `
                    <tr style="background-color: ${index % 2 === 0 ? '#fefce8' : '#ffffff'}; border-bottom: 1px solid #e5e7eb;">
                      ${Object.entries(row).map(([key, value]) => {
                        const formattedValue = (typeof value === 'number' && (key.includes('amount') || key.includes('total') || key.includes('price'))) 
                          ? formatCurrency(value) 
                          : value;
                        return `<td style="padding: 10px; color: #374151;">${formattedValue}</td>`;
                      }).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              ${data.length > 10 ? `
                <p style="text-align: center; margin: 15px 0 0; color: #6b7280; font-style: italic;">
                  Showing first 10 of ${data.length} records. Full data available in PDF download.
                </p>
              ` : ''}
            </div>
          </div>
        ` : ''}

        <div style="background-color: #f0f9ff; border: 2px solid #6366f1; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 25px;">
          <h4 style="color: #4338ca; margin-bottom: 15px; font-size: 1.2em;">💡 Insights & Recommendations</h4>
          <div style="text-align: left; color: #374151; line-height: 1.6;">
            ${generateInsights(reportType, summary, data)}
          </div>
        </div>

        <p style="text-align: center; font-size: 0.95em; color: #6b7280; margin-top: 30px; line-height: 1.6;">
          This report was generated automatically by FAREDEAL Analytics.<br>
          <span style="font-weight: bold;">Webale nyo!</span> For questions, contact: reports@faredeal.ug<br>
          <strong>Generated on:</strong> ${formattedDate}
        </p>
      </div>
    </div>
  `;

  return { sms: smsContent, html: htmlContent };
};

const generateInsights = (reportType, summary, data) => {
  let insights = '';
  
  switch (reportType) {
    case 'sales':
      insights = `
        <p><strong>📈 Sales Performance:</strong></p>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>Your sales trend shows ${summary?.totalSales > 1000000 ? 'strong' : 'moderate'} performance this period</li>
          <li>Top performing products drive ${Math.round((summary?.topProductRevenue / summary?.totalRevenue) * 100) || 35}% of revenue</li>
          <li>Customer retention rate is ${summary?.returnCustomers || 78}% - ${summary?.returnCustomers > 70 ? 'excellent!' : 'room for improvement'}</li>
        </ul>
        <p><strong>💡 Recommendations:</strong></p>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>Focus marketing efforts on top-performing product categories</li>
          <li>Consider loyalty programs to increase customer retention</li>
          <li>Analyze slow-moving inventory for promotional opportunities</li>
        </ul>
      `;
      break;
    case 'inventory':
      insights = `
        <p><strong>📦 Inventory Analysis:</strong></p>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>Current stock levels are ${summary?.stockLevel > 80 ? 'healthy' : 'requiring attention'}</li>
          <li>${summary?.lowStockItems || 12} items are below reorder point</li>
          <li>Inventory turnover rate: ${summary?.turnoverRate || 2.3}x annually</li>
        </ul>
        <p><strong>💡 Recommendations:</strong></p>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>Reorder low stock items to prevent stockouts</li>
          <li>Review slow-moving items for clearance sales</li>
          <li>Optimize storage space allocation based on turnover rates</li>
        </ul>
      `;
      break;
    case 'suppliers':
      insights = `
        <p><strong>🤝 Supplier Performance:</strong></p>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>Average delivery time: ${summary?.avgDeliveryTime || 3.2} days</li>
          <li>On-time delivery rate: ${summary?.onTimeRate || 94}%</li>
          <li>Quality rating average: ${summary?.avgQuality || 4.2}/5.0</li>
        </ul>
        <p><strong>💡 Recommendations:</strong></p>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>Strengthen relationships with top-performing suppliers</li>
          <li>Address delivery delays with underperforming suppliers</li>
          <li>Consider diversifying supplier base for critical items</li>
        </ul>
      `;
      break;
    default:
      insights = `
        <p><strong>📊 General Insights:</strong></p>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li>Business performance is tracking well for the period</li>
          <li>Key metrics show positive trends</li>
          <li>Continue monitoring performance indicators</li>
        </ul>
      `;
  }
  
  return insights;
};

const sendReportViaSMS = async (phoneNumber, reportData) => {
  const { sms } = generateReportContent(reportData);
  console.log(`Sending Report SMS to ${phoneNumber}:\n${sms}`);
  
  try {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true, message: 'Report summary sent via SMS successfully!' };
  } catch (error) {
    console.error('Failed to send report SMS:', error);
    return { success: false, message: 'Failed to send report via SMS.' };
  }
};

const sendReportViaEmail = async (email, reportData) => {
  const { html } = generateReportContent(reportData);
  console.log(`Sending Report Email to ${email}`);
  
  try {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return { success: true, message: 'Report sent via email successfully!' };
  } catch (error) {
    console.error('Failed to send report email:', error);
    return { success: false, message: 'Failed to send report via email.' };
  }
};

const generateReportPDF = (reportData) => {
  const { reportType, title, dateRange, data, summary, generatedAt } = reportData;

  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let y = margin;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Header
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text(`🇺🇬 FAREDEAL ${reportType.toUpperCase()} REPORT`, pageWidth / 2, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.text(title, pageWidth / 2, 30, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date(generatedAt).toLocaleDateString('en-UG')}`, pageWidth / 2, 37, { align: 'center' });

  y = 65;
  doc.setTextColor(0, 0, 0);

  // Report Information
  doc.setFillColor(240, 249, 255);
  doc.rect(margin, y, pageWidth - 2 * margin, 25, 'F');
  
  doc.setFontSize(14);
  doc.setTextColor(67, 56, 202);
  doc.text('📋 Report Information', margin + 5, y + 8);
  
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`, margin + 5, y + 16);
  doc.text(`Period: ${dateRange}`, margin + 5, y + 22);

  y += 35;

  // Summary Section
  if (summary) {
    doc.setFillColor(236, 253, 245);
    doc.rect(margin, y, pageWidth - 2 * margin, 15, 'F');
    
    doc.setFontSize(14);
    doc.setTextColor(4, 120, 87);
    doc.text('📊 Executive Summary', margin + 5, y + 10);
    
    y += 20;
    
    const summaryEntries = Object.entries(summary);
    const cols = 3;
    const rows = Math.ceil(summaryEntries.length / cols);
    
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols && (i * cols + j) < summaryEntries.length; j++) {
        const [key, value] = summaryEntries[i * cols + j];
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        const formattedValue = (typeof value === 'number' && (key.includes('amount') || key.includes('total') || key.includes('revenue'))) 
          ? formatCurrency(value) 
          : value.toString();
        
        const x = margin + j * ((pageWidth - 2 * margin) / cols);
        
        doc.setFontSize(9);
        doc.setTextColor(107, 114, 128);
        doc.text(label + ':', x, y);
        doc.setFontSize(11);
        doc.setTextColor(4, 120, 87);
        doc.text(formattedValue, x, y + 6);
      }
      y += 15;
    }
    y += 10;
  }

  // Data Table
  if (data && data.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(55, 65, 81);
    doc.text('📈 Detailed Data', margin, y);
    y += 10;

    const tableColumns = Object.keys(data[0]).map(key => 
      key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
    );
    
    const tableRows = data.map(row => 
      Object.entries(row).map(([key, value]) => {
        if (typeof value === 'number' && (key.includes('amount') || key.includes('total') || key.includes('price'))) {
          return formatCurrency(value);
        }
        return value.toString();
      })
    );

    doc.autoTable({
      startY: y,
      head: [tableColumns],
      body: tableRows,
      theme: 'grid',
      styles: { 
        fontSize: 8, 
        cellPadding: 2,
        textColor: [55, 65, 81]
      },
      headStyles: { 
        fillColor: [99, 102, 241], 
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: margin, right: margin },
      didDrawPage: function (data) {
        // Add page numbers
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
      }
    });

    y = doc.autoTable.previous.finalY + 15;
  }

  // Insights Section (if space allows)
  if (y < pageHeight - 60) {
    doc.setFillColor(240, 249, 255);
    doc.rect(margin, y, pageWidth - 2 * margin, 15, 'F');
    
    doc.setFontSize(12);
    doc.setTextColor(67, 56, 202);
    doc.text('💡 Key Insights', margin + 5, y + 10);
    
    y += 20;
    
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);
    const insights = getTextInsights(reportType, summary);
    const splitInsights = doc.splitTextToSize(insights, pageWidth - 2 * margin);
    doc.text(splitInsights, margin, y);
  }

  // Footer
  const footerY = pageHeight - 20;
  doc.setFillColor(240, 249, 255);
  doc.rect(0, footerY - 10, pageWidth, 30, 'F');
  
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text('FAREDEAL Analytics - Building Data-Driven Decisions', pageWidth / 2, footerY, { align: 'center' });
  doc.text('Contact: reports@faredeal.ug | +256 700 123 456', pageWidth / 2, footerY + 7, { align: 'center' });

  return doc;
};

const getTextInsights = (reportType, summary) => {
  switch (reportType) {
    case 'sales':
      return `Sales performance shows ${summary?.totalSales > 1000000 ? 'strong' : 'moderate'} results. Focus on top-performing categories and customer retention programs.`;
    case 'inventory':
      return `Inventory levels are ${summary?.stockLevel > 80 ? 'healthy' : 'requiring attention'}. Monitor reorder points and optimize turnover rates.`;
    case 'suppliers':
      return `Supplier performance averages ${summary?.avgQuality || 4.2}/5.0 quality rating with ${summary?.onTimeRate || 94}% on-time delivery.`;
    default:
      return `Business metrics show positive trends. Continue monitoring key performance indicators for sustained growth.`;
  }
};

// Sample report data generators
const generateSampleSalesReport = () => ({
  reportType: 'sales',
  title: 'Monthly Sales Performance Report',
  dateRange: 'November 1-30, 2024',
  generatedAt: new Date().toISOString(),
  summary: {
    totalSales: 45230000,
    totalOrders: 1247,
    avgOrderValue: 36280,
    totalRevenue: 45230000,
    topProductRevenue: 15830000,
    returnCustomers: 78
  },
  data: [
    { product: 'Ugandan Coffee', quantity: 245, revenue: 12250000, margin: 35 },
    { product: 'Fresh Matooke', quantity: 189, revenue: 7560000, margin: 28 },
    { product: 'Dairy Products', quantity: 156, revenue: 8940000, margin: 42 },
    { product: 'Rice & Grains', quantity: 134, revenue: 6700000, margin: 31 },
    { product: 'Cooking Oil', quantity: 98, revenue: 4900000, margin: 25 }
  ]
});

const generateSampleInventoryReport = () => ({
  reportType: 'inventory',
  title: 'Inventory Status Report',
  dateRange: 'As of November 30, 2024',
  generatedAt: new Date().toISOString(),
  summary: {
    totalItems: 1847,
    stockLevel: 85,
    lowStockItems: 23,
    turnoverRate: 2.8,
    totalValue: 125000000
  },
  data: [
    { item: 'Ugandan Coffee', currentStock: 450, reorderPoint: 100, status: 'Good', value: 22500000 },
    { item: 'Sugar', currentStock: 89, reorderPoint: 150, status: 'Low', value: 4450000 },
    { item: 'Cooking Oil', currentStock: 234, reorderPoint: 80, status: 'Good', value: 11700000 },
    { item: 'Rice', currentStock: 67, reorderPoint: 120, status: 'Low', value: 3350000 },
    { item: 'Matooke', currentStock: 345, reorderPoint: 200, status: 'Good', value: 13800000 }
  ]
});

const generateSampleSupplierReport = () => ({
  reportType: 'suppliers',
  title: 'Supplier Performance Report',
  dateRange: 'October - November 2024',
  generatedAt: new Date().toISOString(),
  summary: {
    totalSuppliers: 34,
    avgDeliveryTime: 3.2,
    onTimeRate: 94,
    avgQuality: 4.2,
    totalOrders: 456
  },
  data: [
    { supplier: 'Uganda Coffee Co.', orders: 45, onTime: 96, quality: 4.8, totalValue: 15600000 },
    { supplier: 'Fresh Farms Ltd', orders: 38, onTime: 92, quality: 4.3, totalValue: 12400000 },
    { supplier: 'Kampala Distributors', orders: 52, onTime: 89, quality: 4.1, totalValue: 18200000 },
    { supplier: 'East Africa Supplies', orders: 29, onTime: 98, quality: 4.6, totalValue: 9800000 },
    { supplier: 'Local Producers Co-op', orders: 41, onTime: 94, quality: 4.4, totalValue: 14100000 }
  ]
});

export { 
  sendReportViaSMS, 
  sendReportViaEmail, 
  generateReportPDF, 
  generateReportContent,
  generateSampleSalesReport,
  generateSampleInventoryReport,
  generateSampleSupplierReport
};
