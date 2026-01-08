import jsPDF from 'jspdf';
import 'jspdf-autotable';
import DataAggregator from './dataAggregator';

// Enhanced Report Service with comprehensive data integration
class AdvancedReportService {
  constructor() {
    this.dataAggregator = DataAggregator;
  }

  // Generate comprehensive report data
  async generateComprehensiveReport(reportType, period, customRange = null, options = {}) {
    try {
      let reportData;
      
      switch (reportType) {
        case 'sales':
          reportData = await this.dataAggregator.getSalesData(period, customRange);
          break;
        case 'inventory':
          reportData = await this.dataAggregator.getInventoryData(period, customRange);
          break;
        case 'employees':
          reportData = await this.dataAggregator.getEmployeeData(period, customRange);
          break;
        case 'financial':
          reportData = await this.dataAggregator.getFinancialData(period, customRange);
          break;
        case 'customers':
          reportData = await this.dataAggregator.getCustomerData(period, customRange);
          break;
        case 'suppliers':
          reportData = await this.dataAggregator.getSupplierData(period, customRange);
          break;
        case 'dashboard':
          reportData = await this.dataAggregator.getDashboardData(period, customRange);
          break;
        default:
          reportData = await this.dataAggregator.getSalesData(period, customRange);
      }

      return {
        reportType,
        title: this.getReportTitle(reportType, period),
        dateRange: reportData.dateRange,
        period: period,
        generatedAt: new Date().toISOString(),
        data: reportData,
        summary: reportData.summary,
        insights: this.generateInsights(reportType, reportData.summary, reportData),
        options: options
      };
    } catch (error) {
      console.error('Error generating comprehensive report:', error);
      throw new Error('Failed to generate report. Please try again.');
    }
  }

  // Get report title based on type and period
  getReportTitle(reportType, period) {
    const typeNames = {
      sales: 'Sales Performance',
      inventory: 'Inventory Management',
      employees: 'Employee Analytics',
      financial: 'Financial Overview',
      customers: 'Customer Insights',
      suppliers: 'Supplier Performance',
      dashboard: 'Executive Dashboard'
    };

    const periodNames = {
      today: 'Daily',
      yesterday: 'Yesterday',
      last7days: 'Weekly',
      last30days: 'Monthly',
      thismonth: 'This Month',
      lastmonth: 'Last Month',
      thisyear: 'Yearly',
      lastyear: 'Last Year'
    };

    return `${periodNames[period] || 'Custom'} ${typeNames[reportType] || 'Business'} Report`;
  }

  // Generate insights based on data
  generateInsights(reportType, summary, data) {
    const insights = {
      sales: this.generateSalesInsights(summary, data),
      inventory: this.generateInventoryInsights(summary, data),
      employees: this.generateEmployeeInsights(summary, data),
      financial: this.generateFinancialInsights(summary, data),
      customers: this.generateCustomerInsights(summary, data),
      suppliers: this.generateSupplierInsights(summary, data),
      dashboard: this.generateDashboardInsights(summary, data)
    };

    return insights[reportType] || insights.sales;
  }

  generateSalesInsights(summary, data) {
    const insights = [];
    
    if (summary.totalSales > 1000000) {
      insights.push('🎉 Excellent sales performance! Revenue exceeded 1M UGX.');
    } else if (summary.totalSales > 500000) {
      insights.push('📈 Good sales performance with room for growth.');
    } else {
      insights.push('📊 Sales performance needs attention. Consider promotional strategies.');
    }

    if (summary.avgOrderValue > 50000) {
      insights.push('💰 High average order value indicates strong customer spending.');
    }

    if (summary.uniqueCustomers > 100) {
      insights.push('👥 Strong customer base with good market reach.');
    }

    if (data.products && data.products.length > 0) {
      const topProduct = data.products.reduce((max, product) => 
        product.sales > max.sales ? product : max, data.products[0]);
      insights.push(`🏆 Top performer: ${topProduct.name} with ${this.formatCurrency(topProduct.sales)} in sales.`);
    }

    return insights;
  }

  generateInventoryInsights(summary, data) {
    const insights = [];
    
    if (summary.stockLevel > 80) {
      insights.push('✅ Healthy inventory levels across most products.');
    } else if (summary.stockLevel > 60) {
      insights.push('⚠️ Some inventory levels need attention.');
    } else {
      insights.push('🚨 Critical inventory levels detected. Immediate restocking required.');
    }

    if (summary.lowStockItems > 0) {
      insights.push(`📦 ${summary.lowStockItems} items are below reorder point.`);
    }

    if (summary.turnoverRate > 3) {
      insights.push('🔄 High inventory turnover indicates strong sales velocity.');
    } else if (summary.turnoverRate < 1.5) {
      insights.push('🐌 Low turnover rate suggests slow-moving inventory.');
    }

    if (data.inventory && data.inventory.length > 0) {
      const lowStockItems = data.inventory.filter(item => item.quantity < item.reorderPoint);
      if (lowStockItems.length > 0) {
        insights.push(`⚠️ Priority restock needed: ${lowStockItems.map(item => item.name).join(', ')}`);
      }
    }

    return insights;
  }

  generateEmployeeInsights(summary, data) {
    const insights = [];
    
    if (summary.avgAttendance > 95) {
      insights.push('👏 Excellent employee attendance rate!');
    } else if (summary.avgAttendance > 85) {
      insights.push('✅ Good attendance with minor room for improvement.');
    } else {
      insights.push('📋 Attendance needs attention. Consider engagement initiatives.');
    }

    if (summary.avgPerformance > 4.5) {
      insights.push('⭐ Outstanding employee performance across the board.');
    } else if (summary.avgPerformance > 4.0) {
      insights.push('👍 Good performance levels maintained.');
    } else {
      insights.push('📈 Performance improvement opportunities identified.');
    }

    if (data.performance && data.performance.length > 0) {
      const topPerformer = data.performance.reduce((max, perf) => 
        perf.rating > max.rating ? perf : max, data.performance[0]);
      insights.push(`🏆 Top performer: ${topPerformer.name} with ${topPerformer.rating}/5.0 rating.`);
    }

    return insights;
  }

  generateFinancialInsights(summary, data) {
    const insights = [];
    
    if (summary.profitMargin > 20) {
      insights.push('💰 Excellent profit margins! Strong financial health.');
    } else if (summary.profitMargin > 10) {
      insights.push('📊 Good profit margins with potential for optimization.');
    } else {
      insights.push('⚠️ Profit margins need improvement. Review cost structure.');
    }

    if (summary.netProfit > 0) {
      insights.push('✅ Profitable operations maintained.');
    } else {
      insights.push('🚨 Operating at a loss. Immediate cost review required.');
    }

    if (summary.expenseRatio < 60) {
      insights.push('💡 Efficient expense management.');
    } else {
      insights.push('📉 High expense ratio. Consider cost optimization.');
    }

    return insights;
  }

  generateCustomerInsights(summary, data) {
    const insights = [];
    
    if (summary.satisfactionRate > 90) {
      insights.push('😊 Exceptional customer satisfaction!');
    } else if (summary.satisfactionRate > 75) {
      insights.push('👍 Good customer satisfaction levels.');
    } else {
      insights.push('📞 Customer satisfaction needs improvement.');
    }

    if (summary.retentionRate > 80) {
      insights.push('🔄 Strong customer retention rate.');
    } else {
      insights.push('👥 Customer retention opportunities identified.');
    }

    if (summary.avgRating > 4.5) {
      insights.push('⭐ Outstanding customer ratings!');
    }

    return insights;
  }

  generateSupplierInsights(summary, data) {
    const insights = [];
    
    if (summary.onTimeRate > 95) {
      insights.push('🚚 Excellent supplier delivery performance!');
    } else if (summary.onTimeRate > 85) {
      insights.push('✅ Good delivery performance with minor delays.');
    } else {
      insights.push('⏰ Supplier delivery performance needs improvement.');
    }

    if (summary.avgQuality > 4.5) {
      insights.push('🏆 High-quality supplier relationships.');
    } else if (summary.avgQuality > 4.0) {
      insights.push('👍 Good supplier quality standards.');
    } else {
      insights.push('📋 Supplier quality improvement needed.');
    }

    if (summary.avgDeliveryTime < 3) {
      insights.push('⚡ Fast delivery times from suppliers.');
    }

    return insights;
  }

  generateDashboardInsights(summary, data) {
    const insights = [];
    
    insights.push(`💰 Total Revenue: ${this.formatCurrency(summary.totalRevenue)}`);
    insights.push(`📈 Net Profit: ${this.formatCurrency(summary.totalProfit)}`);
    insights.push(`👥 Active Customers: ${summary.totalCustomers}`);
    insights.push(`👨‍💼 Total Employees: ${summary.totalEmployees}`);
    
    if (summary.lowStockItems > 0) {
      insights.push(`⚠️ ${summary.lowStockItems} items need restocking.`);
    }
    
    if (summary.profitMargin > 15) {
      insights.push('🎯 Strong profit margins achieved.');
    }

    return insights;
  }

  // Format currency
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  // Generate SMS content
  generateSMSContent(reportData) {
    const { reportType, title, dateRange, summary, insights } = reportData;
    
    let smsContent = `🇺🇬 FAREDEAL ${reportType.toUpperCase()} REPORT\n`;
    smsContent += `📅 ${dateRange}\n\n`;
    smsContent += `📊 KEY METRICS:\n`;
    
    // Add top 3 summary metrics
    const summaryEntries = Object.entries(summary).slice(0, 3);
    summaryEntries.forEach(([key, value]) => {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      if (typeof value === 'number' && (key.includes('amount') || key.includes('total') || key.includes('revenue') || key.includes('profit'))) {
        smsContent += `${label}: ${this.formatCurrency(value)}\n`;
      } else {
        smsContent += `${label}: ${value}\n`;
      }
    });
    
    smsContent += `\n💡 TOP INSIGHT:\n${insights[0] || 'Business performance tracking well.'}\n\n`;
    smsContent += `Full report available via email/PDF.\nWebale nyo! 🌟`;
    
    return smsContent;
  }

  // Generate HTML content
  generateHTMLContent(reportData) {
    const { reportType, title, dateRange, summary, insights, data, generatedAt } = reportData;
    
    const formattedDate = new Date(generatedAt).toLocaleString('en-UG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Kampala'
    });

    return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 900px; margin: 20px auto; background: linear-gradient(to bottom right, #f0f9ff, #fff); border-radius: 16px; overflow: hidden; box-shadow: 0 15px 35px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899); padding: 40px; color: white; text-align: center; position: relative;">
          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><defs><pattern id=\"grain\" width=\"100\" height=\"100\" patternUnits=\"userSpaceOnUse\"><circle cx=\"25\" cy=\"25\" r=\"1\" fill=\"white\" opacity=\"0.1\"/><circle cx=\"75\" cy=\"75\" r=\"1\" fill=\"white\" opacity=\"0.1\"/><circle cx=\"50\" cy=\"10\" r=\"0.5\" fill=\"white\" opacity=\"0.1\"/></pattern></defs><rect width=\"100\" height=\"100\" fill=\"url(%23grain)\"/></svg>'); opacity: 0.3;"></div>
          <h1 style="margin: 0; font-size: 2.8em; font-weight: bold; display: flex; align-items: center; justify-content: center; position: relative; z-index: 1;">
            <span style="margin-right: 15px; font-size: 1.2em;">🇺🇬</span> FAREDEAL ${reportType.toUpperCase()} REPORT
          </h1>
          <p style="margin: 10px 0 0; font-size: 1.3em; opacity: 0.95; position: relative; z-index: 1;">${title}</p>
          <div style="margin-top: 20px; padding: 15px; background: rgba(255,255,255,0.2); border-radius: 12px; backdrop-filter: blur(10px); position: relative; z-index: 1;">
            <p style="margin: 0; font-size: 1.1em; font-weight: 600;">📅 ${dateRange}</p>
            <p style="margin: 5px 0 0; font-size: 0.95em; opacity: 0.9;">Generated: ${formattedDate}</p>
          </div>
        </div>

        <div style="padding: 40px;">
          ${this.generateSummarySection(summary)}
          ${this.generateInsightsSection(insights)}
          ${this.generateDataSection(data, reportType)}
          ${this.generateRecommendationsSection(reportType, summary)}
        </div>

        <div style="background: linear-gradient(135deg, #f0f9ff, #e0f2fe); padding: 30px; text-align: center; border-top: 3px solid #6366f1;">
          <h4 style="color: #4338ca; margin-bottom: 15px; font-size: 1.3em;">🌟 FAREDEAL Analytics</h4>
          <p style="margin: 0; font-size: 1em; color: #374151; line-height: 1.6;">
            Building Data-Driven Decisions for Ugandan Businesses<br>
            <span style="font-weight: bold; color: #4338ca;">Webale nyo!</span> For support: reports@faredeal.ug | +256 700 123 456
          </p>
        </div>
      </div>
    `;
  }

  generateSummarySection(summary) {
    if (!summary) return '';
    
    return `
      <div style="background: linear-gradient(135deg, #ecfdf5, #d1fae5); border-left: 6px solid #10b981; padding: 30px; border-radius: 12px; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <h3 style="color: #047857; font-size: 1.8em; margin-bottom: 20px; display: flex; align-items: center;">
          <span style="margin-right: 10px;">📊</span> Executive Summary
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
          ${Object.entries(summary).map(([key, value]) => {
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            const formattedValue = (typeof value === 'number' && (key.includes('amount') || key.includes('total') || key.includes('revenue') || key.includes('profit'))) 
              ? this.formatCurrency(value) 
              : value;
            return `
              <div style="background: white; padding: 20px; border-radius: 10px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: transform 0.2s;">
                <p style="margin: 0 0 8px; font-size: 0.9em; color: #6b7280; font-weight: 600;">${label}</p>
                <p style="margin: 0; font-size: 1.4em; font-weight: bold; color: #047857;">${formattedValue}</p>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  generateInsightsSection(insights) {
    if (!insights || insights.length === 0) return '';
    
    return `
      <div style="background: linear-gradient(135deg, #fefce8, #fef3c7); border-left: 6px solid #eab308; padding: 30px; border-radius: 12px; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <h3 style="color: #a16207; font-size: 1.8em; margin-bottom: 20px; display: flex; align-items: center;">
          <span style="margin-right: 10px;">💡</span> Key Insights
        </h3>
        <div style="display: grid; gap: 15px;">
          ${insights.map(insight => `
            <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <p style="margin: 0; color: #374151; font-size: 1.1em; line-height: 1.5;">${insight}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  generateDataSection(data, reportType) {
    if (!data || !data[reportType]) return '';
    
    const reportData = data[reportType];
    if (!reportData || !Array.isArray(reportData) || reportData.length === 0) return '';
    
    const columns = Object.keys(reportData[0] || {});
    
    return `
      <div style="background: linear-gradient(135deg, #f0f9ff, #e0f2fe); border-left: 6px solid #6366f1; padding: 30px; border-radius: 12px; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <h3 style="color: #4338ca; font-size: 1.8em; margin-bottom: 20px; display: flex; align-items: center;">
          <span style="margin-right: 10px;">📈</span> Detailed Data
        </h3>
        <div style="overflow-x: auto; background: white; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white;">
                ${columns.map(column => `
                  <th style="padding: 15px; text-align: left; font-weight: bold; text-transform: capitalize; font-size: 0.95em;">
                    ${column.replace(/([A-Z])/g, ' $1')}
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${reportData.slice(0, 10).map((row, index) => `
                <tr style="background-color: ${index % 2 === 0 ? '#f8fafc' : '#ffffff'}; border-bottom: 1px solid #e2e8f0;">
                  ${Object.entries(row).map(([key, value]) => {
                    const formattedValue = (typeof value === 'number' && (key.includes('amount') || key.includes('total') || key.includes('price') || key.includes('revenue'))) 
                      ? this.formatCurrency(value) 
                      : value;
                    return `<td style="padding: 12px; color: #374151; font-size: 0.9em;">${formattedValue}</td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${reportData.length > 10 ? `
            <div style="padding: 20px; text-align: center; background: #f8fafc; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #6b7280; font-style: italic; font-size: 0.9em;">
                Showing first 10 of ${reportData.length} records. Full data available in PDF download.
              </p>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  generateRecommendationsSection(reportType, summary) {
    const recommendations = this.getRecommendations(reportType, summary);
    
    return `
      <div style="background: linear-gradient(135deg, #fdf2f8, #fce7f3); border-left: 6px solid #ec4899; padding: 30px; border-radius: 12px; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <h3 style="color: #be185d; font-size: 1.8em; margin-bottom: 20px; display: flex; align-items: center;">
          <span style="margin-right: 10px;">🎯</span> Strategic Recommendations
        </h3>
        <div style="display: grid; gap: 15px;">
          ${recommendations.map(rec => `
            <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <p style="margin: 0; color: #374151; font-size: 1.1em; line-height: 1.5;">${rec}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  getRecommendations(reportType, summary) {
    const recommendations = {
      sales: [
        'Focus marketing efforts on top-performing product categories',
        'Implement customer loyalty programs to increase retention',
        'Analyze slow-moving inventory for promotional opportunities',
        'Consider seasonal pricing strategies for peak performance'
      ],
      inventory: [
        'Reorder low stock items to prevent stockouts',
        'Review slow-moving items for clearance sales',
        'Optimize storage space allocation based on turnover rates',
        'Implement automated reorder point notifications'
      ],
      employees: [
        'Recognize top performers with incentive programs',
        'Provide additional training for underperforming areas',
        'Implement flexible scheduling to improve attendance',
        'Create career development pathways for retention'
      ],
      financial: [
        'Review and optimize operational expenses',
        'Implement cost tracking for better profit margins',
        'Consider revenue diversification strategies',
        'Monitor cash flow patterns for better planning'
      ],
      customers: [
        'Implement customer feedback collection systems',
        'Create targeted marketing campaigns for retention',
        'Develop customer service excellence programs',
        'Analyze customer behavior for personalization'
      ],
      suppliers: [
        'Strengthen relationships with top-performing suppliers',
        'Address delivery delays with underperforming suppliers',
        'Consider diversifying supplier base for critical items',
        'Implement supplier performance scorecards'
      ]
    };

    return recommendations[reportType] || recommendations.sales;
  }

  // Send report via SMS
  async sendReportViaSMS(phoneNumber, reportData) {
    const smsContent = this.generateSMSContent(reportData);
    console.log(`Sending Report SMS to ${phoneNumber}:\n${smsContent}`);
    
    try {
      // Simulate SMS sending
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: true, message: 'Report summary sent via SMS successfully!' };
    } catch (error) {
      console.error('Failed to send report SMS:', error);
      return { success: false, message: 'Failed to send report via SMS.' };
    }
  }

  // Send report via Email
  async sendReportViaEmail(email, reportData) {
    const htmlContent = this.generateHTMLContent(reportData);
    console.log(`Sending Report Email to ${email}`);
    
    try {
      // Simulate email sending
      await new Promise(resolve => setTimeout(resolve, 1500));
      return { success: true, message: 'Report sent via email successfully!' };
    } catch (error) {
      console.error('Failed to send report email:', error);
      return { success: false, message: 'Failed to send report via email.' };
    }
  }

  // Generate PDF report
  generateReportPDF(reportData) {
    const { reportType, title, dateRange, summary, insights, data, generatedAt } = reportData;

    const doc = new jsPDF({
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = margin;

    // Header with gradient effect
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text(`🇺🇬 FAREDEAL ${reportType.toUpperCase()} REPORT`, pageWidth / 2, 25, { align: 'center' });
    doc.setFontSize(12);
    doc.text(title, pageWidth / 2, 35, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date(generatedAt).toLocaleDateString('en-UG')}`, pageWidth / 2, 42, { align: 'center' });

    y = 65;
    doc.setTextColor(0, 0, 0);

    // Summary Section
    if (summary) {
      doc.setFillColor(236, 253, 245);
      doc.rect(margin, y, pageWidth - 2 * margin, 20, 'F');
      
      doc.setFontSize(16);
      doc.setTextColor(4, 120, 87);
      doc.text('📊 Executive Summary', margin + 5, y + 12);
      
      y += 25;
      
      const summaryEntries = Object.entries(summary);
      const cols = 2;
      const rows = Math.ceil(summaryEntries.length / cols);
      
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols && (i * cols + j) < summaryEntries.length; j++) {
          const [key, value] = summaryEntries[i * cols + j];
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          const formattedValue = (typeof value === 'number' && (key.includes('amount') || key.includes('total') || key.includes('revenue') || key.includes('profit'))) 
            ? this.formatCurrency(value) 
            : value.toString();
          
          const x = margin + j * ((pageWidth - 2 * margin) / cols);
          
          doc.setFontSize(10);
          doc.setTextColor(107, 114, 128);
          doc.text(label + ':', x, y);
          doc.setFontSize(12);
          doc.setTextColor(4, 120, 87);
          doc.text(formattedValue, x, y + 7);
        }
        y += 15;
      }
      y += 10;
    }

    // Insights Section
    if (insights && insights.length > 0) {
      doc.setFillColor(254, 252, 232);
      doc.rect(margin, y, pageWidth - 2 * margin, 15, 'F');
      
      doc.setFontSize(14);
      doc.setTextColor(234, 179, 8);
      doc.text('💡 Key Insights', margin + 5, y + 10);
      
      y += 20;
      
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);
      insights.slice(0, 5).forEach((insight, index) => {
        const splitInsight = doc.splitTextToSize(`• ${insight}`, pageWidth - 2 * margin - 10);
        doc.text(splitInsight, margin + 5, y);
        y += splitInsight.length * 4 + 2;
      });
      y += 10;
    }

    // Data Table
    if (data && data[reportType] && data[reportType].length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(55, 65, 81);
      doc.text('📈 Detailed Data', margin, y);
      y += 10;

      const tableData = data[reportType];
      const tableColumns = Object.keys(tableData[0]).map(key => 
        key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
      );
      
      const tableRows = tableData.map(row => 
        Object.entries(row).map(([key, value]) => {
          if (typeof value === 'number' && (key.includes('amount') || key.includes('total') || key.includes('price') || key.includes('revenue'))) {
            return this.formatCurrency(value);
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
          cellPadding: 3,
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
          doc.setFontSize(8);
          doc.setTextColor(128);
          doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
        }
      });

      y = doc.autoTable.previous.finalY + 15;
    }

    // Footer
    const footerY = pageHeight - 25;
    doc.setFillColor(240, 249, 255);
    doc.rect(0, footerY - 10, pageWidth, 35, 'F');
    
    doc.setFontSize(10);
    doc.setTextColor(67, 56, 202);
    doc.text('FAREDEAL Analytics - Building Data-Driven Decisions', pageWidth / 2, footerY, { align: 'center' });
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('Contact: reports@faredeal.ug | +256 700 123 456', pageWidth / 2, footerY + 8, { align: 'center' });
    doc.text('Webale nyo! 🌟', pageWidth / 2, footerY + 16, { align: 'center' });

    return doc;
  }

  // Schedule recurring reports
  async scheduleReport(reportConfig) {
    try {
      // Store report schedule in localStorage (in real app, use backend)
      const schedules = JSON.parse(localStorage.getItem('reportSchedules') || '[]');
      const newSchedule = {
        id: Date.now(),
        ...reportConfig,
        createdAt: new Date().toISOString(),
        status: 'active'
      };
      
      schedules.push(newSchedule);
      localStorage.setItem('reportSchedules', JSON.stringify(schedules));
      
      return { success: true, message: 'Report scheduled successfully!' };
    } catch (error) {
      console.error('Failed to schedule report:', error);
      return { success: false, message: 'Failed to schedule report.' };
    }
  }

  // Get scheduled reports
  getScheduledReports() {
    try {
      return JSON.parse(localStorage.getItem('reportSchedules') || '[]');
    } catch (error) {
      console.error('Failed to get scheduled reports:', error);
      return [];
    }
  }

  // Cancel scheduled report
  async cancelScheduledReport(scheduleId) {
    try {
      const schedules = JSON.parse(localStorage.getItem('reportSchedules') || '[]');
      const updatedSchedules = schedules.filter(schedule => schedule.id !== scheduleId);
      localStorage.setItem('reportSchedules', JSON.stringify(updatedSchedules));
      
      return { success: true, message: 'Report schedule cancelled successfully!' };
    } catch (error) {
      console.error('Failed to cancel scheduled report:', error);
      return { success: false, message: 'Failed to cancel report schedule.' };
    }
  }
}

export default new AdvancedReportService();
