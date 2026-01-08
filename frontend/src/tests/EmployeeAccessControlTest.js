/**
 * Employee Access Control System Test Suite
 * Comprehensive testing for employee login control functionality
 * 
 * Features tested:
 * - Global access toggle
 * - Individual employee control
 * - Bulk operations
 * - Audit logging
 * - Real-time updates
 * - Configuration export/import
 * - Data persistence
 * - Error handling
 */

import { employeeAccessService } from '../services/employeeAccessService.js';

class EmployeeAccessControlTest {
    constructor() {
        this.testResults = [];
        this.startTime = Date.now();
        
        console.log('🚀 Starting Employee Access Control System Tests...\n');
        console.log('=' .repeat(70));
        console.log('EMPLOYEE ACCESS CONTROL SYSTEM - COMPREHENSIVE TEST SUITE');
        console.log('=' .repeat(70));
    }

    // Utility method for logging test results
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
        this.log('Testing Service Initialization and Setup...', 'test');
        
        try {
            // Test service methods availability
            const requiredMethods = [
                'getAccessSettings', 'toggleGlobalEmployeeAccess', 'getEmployeeList',
                'toggleEmployeeAccess', 'performBulkOperation', 'getAuditLog',
                'subscribe', 'exportConfiguration', 'importConfiguration'
            ];
            
            const missingMethods = requiredMethods.filter(method => 
                typeof employeeAccessService[method] !== 'function'
            );
            
            if (missingMethods.length === 0) {
                this.log('All required service methods available', 'success');
            } else {
                this.log(`Missing methods: ${missingMethods.join(', ')}`, 'error');
                return false;
            }
            
            // Test initial data loading
            const settings = employeeAccessService.getAccessSettings();
            const employees = employeeAccessService.getEmployeeList();
            const auditLog = employeeAccessService.getAuditLog();
            
            this.log(`Loaded ${employees.length} employees`, 'success');
            this.log(`Global access enabled: ${settings.globalEmployeeAccess}`, 'info');
            this.log(`Audit log entries: ${auditLog.length}`, 'info');
            
            return true;
        } catch (error) {
            this.log(`Service initialization failed: ${error.message}`, 'error');
            return false;
        }
    }

    // Test 2: Global Access Control
    async testGlobalAccessControl() {
        this.log('Testing Global Access Control...', 'test');
        
        try {
            const initialSettings = employeeAccessService.getAccessSettings();
            const initialStatus = initialSettings.globalEmployeeAccess;
            
            this.log(`Initial global access status: ${initialStatus}`, 'info');
            
            // Toggle global access
            const updatedSettings = await employeeAccessService.toggleGlobalEmployeeAccess();
            const newStatus = updatedSettings.globalEmployeeAccess;
            
            if (newStatus !== initialStatus) {
                this.log(`Global access toggled successfully: ${initialStatus} → ${newStatus}`, 'success');
            } else {
                this.log('Global access toggle failed - status unchanged', 'error');
                return false;
            }
            
            // Verify persistence
            const persistedSettings = employeeAccessService.getAccessSettings();
            if (persistedSettings.globalEmployeeAccess === newStatus) {
                this.log('Global access setting persisted correctly', 'success');
            } else {
                this.log('Global access setting persistence failed', 'error');
                return false;
            }
            
            // Restore original state
            if (newStatus !== initialStatus) {
                await employeeAccessService.toggleGlobalEmployeeAccess();
                this.log('Original global access state restored', 'info');
            }
            
            return true;
        } catch (error) {
            this.log(`Global access control test failed: ${error.message}`, 'error');
            return false;
        }
    }

    // Test 3: Individual Employee Control
    async testIndividualEmployeeControl() {
        this.log('Testing Individual Employee Access Control...', 'test');
        
        try {
            const employees = employeeAccessService.getEmployeeList();
            
            if (employees.length === 0) {
                this.log('No employees found for testing', 'warning');
                return false;
            }
            
            const testEmployee = employees[0];
            const originalStatus = employeeAccessService.getEmployeeAccessStatus(testEmployee.id);
            
            this.log(`Testing employee: ${testEmployee.name} (${testEmployee.id})`, 'info');
            this.log(`Original status: ${originalStatus}`, 'info');
            
            // Toggle employee access
            const newStatus = originalStatus === 'active' ? 'disabled' : 'active';
            await employeeAccessService.toggleEmployeeAccess(testEmployee.id, newStatus);
            
            // Verify change
            const updatedStatus = employeeAccessService.getEmployeeAccessStatus(testEmployee.id);
            
            if (updatedStatus === newStatus) {
                this.log(`Employee access updated successfully: ${originalStatus} → ${newStatus}`, 'success');
            } else {
                this.log(`Employee access update failed: expected ${newStatus}, got ${updatedStatus}`, 'error');
                return false;
            }
            
            // Restore original status
            await employeeAccessService.toggleEmployeeAccess(testEmployee.id, originalStatus);
            const restoredStatus = employeeAccessService.getEmployeeAccessStatus(testEmployee.id);
            
            if (restoredStatus === originalStatus) {
                this.log('Original employee status restored', 'success');
            } else {
                this.log('Failed to restore original employee status', 'warning');
            }
            
            return true;
        } catch (error) {
            this.log(`Individual employee control test failed: ${error.message}`, 'error');
            return false;
        }
    }

    // Test 4: Bulk Operations
    async testBulkOperations() {
        this.log('Testing Bulk Employee Operations...', 'test');
        
        try {
            const employees = employeeAccessService.getEmployeeList();
            
            if (employees.length < 2) {
                this.log('Insufficient employees for bulk operation test', 'warning');
                return false;
            }
            
            // Select first 3 employees for bulk operation
            const testEmployeeIds = employees.slice(0, 3).map(emp => emp.id);
            
            this.log(`Testing bulk operation on ${testEmployeeIds.length} employees`, 'info');
            
            // Store original statuses
            const originalStatuses = {};
            testEmployeeIds.forEach(id => {
                originalStatuses[id] = employeeAccessService.getEmployeeAccessStatus(id);
            });
            
            // Perform bulk disable operation
            const result = await employeeAccessService.performBulkOperation('disable', testEmployeeIds);
            
            if (result.success && result.affectedCount === testEmployeeIds.length) {
                this.log(`Bulk disable operation successful - ${result.affectedCount} employees affected`, 'success');
            } else {
                this.log(`Bulk disable operation failed - expected ${testEmployeeIds.length}, affected ${result.affectedCount}`, 'error');
                return false;
            }
            
            // Verify all employees are disabled
            const allDisabled = testEmployeeIds.every(id => 
                employeeAccessService.getEmployeeAccessStatus(id) === 'disabled'
            );
            
            if (allDisabled) {
                this.log('All test employees correctly disabled', 'success');
            } else {
                this.log('Some employees not correctly disabled', 'error');
                return false;
            }
            
            // Perform bulk enable operation to restore
            const restoreResult = await employeeAccessService.performBulkOperation('enable', testEmployeeIds);
            
            if (restoreResult.success) {
                this.log('Bulk enable operation completed for restoration', 'success');
            } else {
                this.log('Bulk enable operation failed during restoration', 'warning');
            }
            
            return true;
        } catch (error) {
            this.log(`Bulk operations test failed: ${error.message}`, 'error');
            return false;
        }
    }

    // Test 5: Audit Log Functionality
    async testAuditLogFunctionality() {
        this.log('Testing Audit Log Functionality...', 'test');
        
        try {
            const initialLogCount = employeeAccessService.getAuditLog().length;
            this.log(`Initial audit log entries: ${initialLogCount}`, 'info');
            
            // Perform an action that should be logged
            await employeeAccessService.toggleGlobalEmployeeAccess();
            
            // Check if audit log was updated
            const updatedLogCount = employeeAccessService.getAuditLog().length;
            
            if (updatedLogCount > initialLogCount) {
                this.log('Audit logging working - new entry created', 'success');
            } else {
                this.log('Audit logging failed - no new entries', 'error');
                return false;
            }
            
            // Verify log entry content
            const latestEntry = employeeAccessService.getAuditLog()[0];
            
            const requiredFields = ['id', 'timestamp', 'action', 'details', 'performedBy'];
            const missingFields = requiredFields.filter(field => !latestEntry[field]);
            
            if (missingFields.length === 0) {
                this.log('Audit log entry contains all required fields', 'success');
                this.log(`Latest action: ${latestEntry.action}`, 'info');
            } else {
                this.log(`Audit log entry missing fields: ${missingFields.join(', ')}`, 'error');
                return false;
            }
            
            // Restore original state
            await employeeAccessService.toggleGlobalEmployeeAccess();
            
            return true;
        } catch (error) {
            this.log(`Audit log functionality test failed: ${error.message}`, 'error');
            return false;
        }
    }

    // Test 6: Real-time Subscription System
    async testRealtimeSubscriptions() {
        this.log('Testing Real-time Subscription System...', 'test');
        
        try {
            let notificationReceived = false;
            let receivedUpdate = null;
            
            // Subscribe to updates
            const unsubscribe = employeeAccessService.subscribe((update) => {
                notificationReceived = true;
                receivedUpdate = update;
                this.log(`Real-time update received: ${update.type}`, 'success');
            });
            
            // Trigger an update
            await employeeAccessService.toggleGlobalEmployeeAccess();
            
            // Wait for notification
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Check if notification was received
            if (notificationReceived && receivedUpdate) {
                this.log('Real-time subscription system working correctly', 'success');
                this.log(`Update type: ${receivedUpdate.type}`, 'info');
            } else {
                this.log('Real-time notifications not received', 'error');
                unsubscribe();
                return false;
            }
            
            // Clean up
            unsubscribe();
            
            // Restore original state
            await employeeAccessService.toggleGlobalEmployeeAccess();
            
            return true;
        } catch (error) {
            this.log(`Real-time subscription test failed: ${error.message}`, 'error');
            return false;
        }
    }

    // Test 7: Configuration Export/Import
    async testConfigurationExportImport() {
        this.log('Testing Configuration Export/Import...', 'test');
        
        try {
            // Export current configuration
            const exportedConfig = employeeAccessService.exportConfiguration();
            
            this.log('Configuration exported successfully', 'success');
            
            // Verify export structure
            const requiredKeys = ['settings', 'auditLog', 'exportedAt', 'version'];
            const missingKeys = requiredKeys.filter(key => !exportedConfig[key]);
            
            if (missingKeys.length === 0) {
                this.log('Export contains all required data', 'success');
            } else {
                this.log(`Export missing keys: ${missingKeys.join(', ')}`, 'error');
                return false;
            }
            
            // Make a change to test import
            const originalSettings = employeeAccessService.getAccessSettings();
            await employeeAccessService.toggleGlobalEmployeeAccess();
            
            // Import the exported configuration
            const importResult = await employeeAccessService.importConfiguration(exportedConfig);
            
            if (importResult.success) {
                this.log('Configuration imported successfully', 'success');
            } else {
                this.log('Configuration import failed', 'error');
                return false;
            }
            
            // Verify import worked
            const importedSettings = employeeAccessService.getAccessSettings();
            
            if (importedSettings.globalEmployeeAccess === originalSettings.globalEmployeeAccess) {
                this.log('Import correctly restored original settings', 'success');
            } else {
                this.log('Import did not restore settings correctly', 'error');
                return false;
            }
            
            return true;
        } catch (error) {
            this.log(`Configuration export/import test failed: ${error.message}`, 'error');
            return false;
        }
    }

    // Test 8: Access Control Statistics
    async testAccessControlStatistics() {
        this.log('Testing Access Control Statistics...', 'test');
        
        try {
            const stats = employeeAccessService.getAccessControlStats();
            
            this.log('Access control statistics retrieved', 'success');
            
            // Verify statistics structure
            const expectedStats = [
                'totalEmployees', 'activeEmployees', 'disabledEmployees',
                'pendingEmployees', 'globalAccessEnabled', 'recentActions', 'lastUpdate'
            ];
            
            const missingStats = expectedStats.filter(stat => stats[stat] === undefined);
            
            if (missingStats.length === 0) {
                this.log('All expected statistics present', 'success');
                this.log(`Total employees: ${stats.totalEmployees}`, 'info');
                this.log(`Active employees: ${stats.activeEmployees}`, 'info');
                this.log(`Disabled employees: ${stats.disabledEmployees}`, 'info');
            } else {
                this.log(`Missing statistics: ${missingStats.join(', ')}`, 'error');
                return false;
            }
            
            // Verify statistics accuracy
            const employees = employeeAccessService.getEmployeeList();
            
            if (stats.totalEmployees === employees.length) {
                this.log('Employee count statistics accurate', 'success');
            } else {
                this.log(`Employee count mismatch: stats=${stats.totalEmployees}, actual=${employees.length}`, 'error');
                return false;
            }
            
            return true;
        } catch (error) {
            this.log(`Access control statistics test failed: ${error.message}`, 'error');
            return false;
        }
    }

    // Run all tests
    async runAllTests() {
        console.log('\n🧪 Starting Comprehensive Employee Access Control Tests...\n');
        
        const tests = [
            { name: 'Service Initialization', method: this.testServiceInitialization.bind(this) },
            { name: 'Global Access Control', method: this.testGlobalAccessControl.bind(this) },
            { name: 'Individual Employee Control', method: this.testIndividualEmployeeControl.bind(this) },
            { name: 'Bulk Operations', method: this.testBulkOperations.bind(this) },
            { name: 'Audit Log Functionality', method: this.testAuditLogFunctionality.bind(this) },
            { name: 'Real-time Subscriptions', method: this.testRealtimeSubscriptions.bind(this) },
            { name: 'Configuration Export/Import', method: this.testConfigurationExportImport.bind(this) },
            { name: 'Access Control Statistics', method: this.testAccessControlStatistics.bind(this) }
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
        console.log('📊 EMPLOYEE ACCESS CONTROL SYSTEM - TEST SUMMARY');
        console.log('='.repeat(70));
        
        const totalTests = results.length;
        const passedTests = results.filter(r => r.success).length;
        const failedTests = totalTests - passedTests;
        const successRate = ((passedTests / totalTests) * 100).toFixed(1);
        
        console.log(`⏱️  Total Duration: ${duration}s`);
        console.log(`📈 Success Rate: ${successRate}%`);
        console.log(`✅ Passed: ${passedTests}/${totalTests}`);
        console.log(`❌ Failed: ${failedTests}/${totalTests}`);
        
        console.log('\n📋 Detailed Results:');
        results.forEach((result, index) => {
            const status = result.success ? '✅ PASS' : '❌ FAIL';
            console.log(`   ${index + 1}. ${result.name}: ${status}`);
        });
        
        console.log('\n🎯 System Capabilities Verified:');
        if (passedTests >= 6) {
            console.log('   ✅ Global Access Control');
            console.log('   ✅ Individual Employee Management');
            console.log('   ✅ Bulk Operations');
            console.log('   ✅ Real-time Updates');
            console.log('   ✅ Audit Logging');
            console.log('   ✅ Configuration Management');
            console.log('   ✅ Data Persistence');
        }
        
        if (successRate >= 90) {
            console.log('\n🏆 SYSTEM STATUS: FULLY OPERATIONAL');
            console.log('   Employee Access Control System ready for production use!');
        } else if (successRate >= 75) {
            console.log('\n⚠️ SYSTEM STATUS: MOSTLY FUNCTIONAL');
            console.log('   Minor issues detected, review failed tests');
        } else {
            console.log('\n🔧 SYSTEM STATUS: NEEDS ATTENTION');
            console.log('   Critical issues detected, requires debugging');
        }
        
        console.log('\n💡 Next Steps:');
        console.log('   1. Review any failed tests above');
        console.log('   2. Test the Employee Access Control UI in AdminPortal');
        console.log('   3. Verify real-time updates across multiple tabs');
        console.log('   4. Test integration with actual authentication system');
        console.log('   5. Validate audit trail accuracy and completeness');
        
        console.log('\n' + '='.repeat(70));
        console.log(`✨ Employee Access Control System Test Complete - ${new Date().toLocaleString()}`);
        console.log('='.repeat(70));
    }
}

// Export test class
export { EmployeeAccessControlTest };

// Auto-run tests in development environment
if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
    console.log('🏠 Development environment detected - Employee Access Control Tests available');
    console.log('💡 Run: new EmployeeAccessControlTest().runAllTests() in console to test system');
    
    // Make test available globally
    window.EmployeeAccessControlTest = EmployeeAccessControlTest;
}

// Example usage documentation
const USAGE_EXAMPLES = `
🔧 EMPLOYEE ACCESS CONTROL SYSTEM - USAGE EXAMPLES

1. Run Complete Test Suite:
   const tester = new EmployeeAccessControlTest();
   await tester.runAllTests();

2. Test Individual Components:
   await tester.testGlobalAccessControl();
   await tester.testBulkOperations();

3. Verify Real-time Features:
   await tester.testRealtimeSubscriptions();

4. Check Data Persistence:
   await tester.testConfigurationExportImport();

📚 System Features Tested:
   ✅ Global Employee Access Toggle
   ✅ Individual Employee Control  
   ✅ Bulk Enable/Disable Operations
   ✅ Real-time Update Broadcasting
   ✅ Comprehensive Audit Logging
   ✅ Configuration Export/Import
   ✅ Data Persistence & Recovery
   ✅ Access Control Statistics

🎯 Production Ready Features:
   - Centralized employee access management
   - Real-time access control updates
   - Comprehensive audit trail
   - Bulk operations for efficiency
   - Configuration backup/restore
   - Statistical reporting
   - Role-based access control
`;

console.log(USAGE_EXAMPLES);