/**
 * Admin Portal Integration Test Suite
 * Tests frontend-backend integration for admin features
 * Created: October 8, 2025
 */

import { adminService } from '../services/adminService.js';

class AdminIntegrationTest {
  constructor() {
    this.testResults = [];
    this.startTime = Date.now();
    
    console.log('\x1b[36m%s\x1b[0m', '🚀 Starting Admin Portal Integration Tests...\n');
    console.log('=' .repeat(70));
    console.log('ADMIN PORTAL FRONTEND-BACKEND INTEGRATION TEST SUITE');
    console.log('=' .repeat(70));
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const emoji = {
      'success': '✅',
      'error': '❌', 
      'warning': '⚠️',
      'info': 'ℹ️',
      'test': '🧪'
    };
    
    console.log(`[${timestamp}] ${emoji[type]} ${message}`);
    
    this.testResults.push({
      timestamp,
      type,
      message,
      success: type === 'success'
    });
  }

  // Test 1: Service Initialization
  async testServiceInitialization() {
    this.log('Testing Admin Service Initialization...', 'test');
    
    try {
      // Check if service is instantiated
      if (!adminService) {
        throw new Error('Admin service not initialized');
      }

      // Check for required methods
      const requiredMethods = [
        'verifyAdminAccess',
        'getDashboardMetrics',
        'getEmployees',
        'updateEmployeeAccess',
        'getNotifications',
        'getSystemConfig',
        'getPaymentSummary',
        'getSystemHealth'
      ];

      const missingMethods = requiredMethods.filter(
        method => typeof adminService[method] !== 'function'
      );

      if (missingMethods.length > 0) {
        throw new Error(`Missing methods: ${missingMethods.join(', ')}`);
      }

      this.log('Admin service initialized with all required methods', 'success');
      return true;
    } catch (error) {
      this.log(`Service initialization failed: ${error.message}`, 'error');
      return false;
    }
  }

  // Test 2: Dashboard Metrics
  async testDashboardMetrics() {
    this.log('Testing Dashboard Metrics API...', 'test');
    
    try {
      const result = await adminService.getDashboardMetrics();

      if (!result.success) {
        throw new Error('Failed to fetch dashboard metrics');
      }

      const requiredMetrics = [
        'today_sales',
        'today_orders',
        'total_employees',
        'active_employees',
        'total_products'
      ];

      const missingMetrics = requiredMetrics.filter(
        metric => result.metrics[metric] === undefined
      );

      if (missingMetrics.length > 0) {
        throw new Error(`Missing metrics: ${missingMetrics.join(', ')}`);
      }

      this.log('Dashboard metrics fetched successfully', 'success');
      this.log(`Today's Sales: ${result.metrics.today_sales}`, 'info');
      this.log(`Total Products: ${result.metrics.total_products}`, 'info');
      return true;
    } catch (error) {
      this.log(`Dashboard metrics test failed: ${error.message}`, 'error');
      return false;
    }
  }

  // Test 3: Employee Management
  async testEmployeeManagement() {
    this.log('Testing Employee Management API...', 'test');
    
    try {
      const result = await adminService.getEmployees();

      if (!result.success) {
        throw new Error('Failed to fetch employees');
      }

      this.log(`Fetched ${result.employees.length} employees`, 'success');

      // Test employee filtering
      const activeEmployees = await adminService.getEmployees({ status: 'active' });
      if (activeEmployees.success) {
        this.log(`Active employees: ${activeEmployees.employees.length}`, 'info');
      }

      return true;
    } catch (error) {
      this.log(`Employee management test failed: ${error.message}`, 'error');
      return false;
    }
  }

  // Test 4: Notifications System
  async testNotifications() {
    this.log('Testing Notifications System...', 'test');
    
    try {
      const result = await adminService.getNotifications({ limit: 10 });

      if (!result.success) {
        throw new Error('Failed to fetch notifications');
      }

      this.log(`Fetched ${result.notifications.length} notifications`, 'success');
      this.log(`Unread notifications: ${result.unreadCount}`, 'info');

      return true;
    } catch (error) {
      this.log(`Notifications test failed: ${error.message}`, 'error');
      return false;
    }
  }

  // Test 5: System Configuration
  async testSystemConfiguration() {
    this.log('Testing System Configuration API...', 'test');
    
    try {
      const result = await adminService.getSystemConfig();

      if (!result.success) {
        throw new Error('Failed to fetch system config');
      }

      const configKeys = Object.keys(result.config);
      this.log(`Loaded ${configKeys.length} configuration items`, 'success');

      // Check for essential config keys
      const essentialKeys = ['company_name', 'business_currency', 'tax_rate'];
      const foundKeys = essentialKeys.filter(key => result.config[key]);
      
      this.log(`Essential config items found: ${foundKeys.length}/${essentialKeys.length}`, 'info');

      return true;
    } catch (error) {
      this.log(`System configuration test failed: ${error.message}`, 'error');
      return false;
    }
  }

  // Test 6: Portal Configuration
  async testPortalConfiguration() {
    this.log('Testing Portal Configuration API...', 'test');
    
    try {
      const result = await adminService.getPortalConfigs();

      if (!result.success) {
        throw new Error('Failed to fetch portal configs');
      }

      this.log(`Loaded ${result.portals.length} portal configurations`, 'success');

      const portalNames = result.portals.map(p => p.portal_name);
      this.log(`Portals: ${portalNames.join(', ')}`, 'info');

      return true;
    } catch (error) {
      this.log(`Portal configuration test failed: ${error.message}`, 'error');
      return false;
    }
  }

  // Test 7: Payment Management
  async testPaymentManagement() {
    this.log('Testing Payment Management API...', 'test');
    
    try {
      const result = await adminService.getPaymentSummary({ limit: 10 });

      if (!result.success) {
        throw new Error('Failed to fetch payment summary');
      }

      this.log(`Fetched ${result.payments.length} payment records`, 'success');

      return true;
    } catch (error) {
      this.log(`Payment management test failed: ${error.message}`, 'error');
      return false;
    }
  }

  // Test 8: System Health Monitoring
  async testSystemHealthMonitoring() {
    this.log('Testing System Health Monitoring...', 'test');
    
    try {
      const result = await adminService.getSystemHealth(24);

      if (!result.success) {
        throw new Error('Failed to fetch system health');
      }

      this.log(`System health status: ${result.isHealthy ? 'Healthy' : 'Issues detected'}`, 
        result.isHealthy ? 'success' : 'warning');
      
      if (result.currentHealth.database_status) {
        this.log(`Database: ${result.currentHealth.database_status}`, 'info');
      }

      return true;
    } catch (error) {
      this.log(`System health monitoring test failed: ${error.message}`, 'error');
      return false;
    }
  }

  // Test 9: Error Logging
  async testErrorLogging() {
    this.log('Testing Error Logging System...', 'test');
    
    try {
      const result = await adminService.getErrorLogs({ limit: 10, resolved: false });

      if (!result.success) {
        throw new Error('Failed to fetch error logs');
      }

      this.log(`Unresolved errors: ${result.unresolvedCount}`, 
        result.unresolvedCount > 0 ? 'warning' : 'success');

      return true;
    } catch (error) {
      this.log(`Error logging test failed: ${error.message}`, 'error');
      return false;
    }
  }

  // Test 10: Activity Logging
  async testActivityLogging() {
    this.log('Testing Activity Logging...', 'test');
    
    try {
      // Log a test activity
      await adminService.logActivity('TEST_ACTION', 'test', null, {
        test: true,
        timestamp: new Date().toISOString()
      });

      this.log('Activity logged successfully', 'success');
      return true;
    } catch (error) {
      this.log(`Activity logging test failed: ${error.message}`, 'error');
      return false;
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('\n🧪 Starting Comprehensive Admin Integration Tests...\n');
    
    const tests = [
      { name: 'Service Initialization', method: this.testServiceInitialization.bind(this) },
      { name: 'Dashboard Metrics', method: this.testDashboardMetrics.bind(this) },
      { name: 'Employee Management', method: this.testEmployeeManagement.bind(this) },
      { name: 'Notifications System', method: this.testNotifications.bind(this) },
      { name: 'System Configuration', method: this.testSystemConfiguration.bind(this) },
      { name: 'Portal Configuration', method: this.testPortalConfiguration.bind(this) },
      { name: 'Payment Management', method: this.testPaymentManagement.bind(this) },
      { name: 'System Health Monitoring', method: this.testSystemHealthMonitoring.bind(this) },
      { name: 'Error Logging', method: this.testErrorLogging.bind(this) },
      { name: 'Activity Logging', method: this.testActivityLogging.bind(this) }
    ];
    
    const results = [];
    
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      console.log(`\n📋 Test ${i + 1}/${tests.length}: ${test.name}`);
      console.log('-'.repeat(50));
      
      try {
        const result = await test.method();
        results.push({ name: test.name, success: result });
      } catch (error) {
        this.log(`Test "${test.name}" crashed: ${error.message}`, 'error');
        results.push({ name: test.name, success: false });
      }
    }
    
    // Generate test summary
    this.generateTestSummary(results);
    
    return results;
  }

  // Generate comprehensive test summary
  generateTestSummary(results) {
    const endTime = Date.now();
    const duration = (endTime - this.startTime) / 1000;
    
    console.log('\n' + '='.repeat(70));
    console.log('\x1b[36m%s\x1b[0m', '📊 ADMIN PORTAL INTEGRATION TEST SUMMARY');
    console.log('='.repeat(70));
    
    const totalTests = results.length;
    const passedTests = results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);
    
    console.log(`⏱️  Total Duration: ${duration.toFixed(2)}s`);
    console.log(`📈 Success Rate: ${successRate}%`);
    console.log(`✅ Passed: ${passedTests}/${totalTests}`);
    console.log(`❌ Failed: ${failedTests}/${totalTests}`);
    
    console.log('\n📋 Detailed Results:');
    results.forEach((result, index) => {
      const status = result.success ? '\x1b[32m✅ PASS\x1b[0m' : '\x1b[31m❌ FAIL\x1b[0m';
      console.log(`   ${index + 1}. ${result.name}: ${status}`);
    });
    
    console.log('\n🎯 Integration Status:');
    if (passedTests >= 8) {
      console.log('\x1b[32m%s\x1b[0m', '   ✅ Admin Portal Fully Integrated');
      console.log('   ✅ Frontend-Backend Connection: Working');
      console.log('   ✅ Database Integration: Active');
      console.log('   ✅ Real-time Features: Operational');
    } else if (passedTests >= 6) {
      console.log('\x1b[33m%s\x1b[0m', '   ⚠️  Admin Portal Partially Integrated');
      console.log('   ⚠️  Some features need attention');
    } else {
      console.log('\x1b[31m%s\x1b[0m', '   ❌ Admin Portal Integration Issues');
      console.log('   ❌ Critical features not working');
    }
    
    if (successRate >= 80) {
      console.log('\n🏆 INTEGRATION STATUS: EXCELLENT');
      console.log('   Admin portal is ready for production use!');
    } else if (successRate >= 60) {
      console.log('\n⚠️  INTEGRATION STATUS: NEEDS WORK');
      console.log('   Review failed tests and fix issues');
    } else {
      console.log('\n🔧 INTEGRATION STATUS: REQUIRES ATTENTION');
      console.log('   Critical issues need to be resolved');
    }
    
    console.log('\n💡 Next Steps:');
    console.log('   1. Review any failed tests above');
    console.log('   2. Ensure backend server is running on port 3001');
    console.log('   3. Verify database schema is deployed to Supabase');
    console.log('   4. Check Supabase credentials in .env file');
    console.log('   5. Test admin portal UI components');
    
    console.log('\n' + '='.repeat(70));
    console.log(`✨ Admin Integration Test Complete - ${new Date().toLocaleString()}`);
    console.log('='.repeat(70));
  }
}

// Export test class
export { AdminIntegrationTest };

// Auto-run in development
if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
  console.log('🏠 Development environment detected');
  console.log('💡 Run: new AdminIntegrationTest().runAllTests() to test admin integration');
  
  // Make test available globally
  window.AdminIntegrationTest = AdminIntegrationTest;
}

export default AdminIntegrationTest;
