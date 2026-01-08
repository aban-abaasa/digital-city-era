import React, { createContext, useContext, useState, useEffect } from 'react';
import { employeeAccessService } from '../services/employeeAccessService';

const EmployeeAccessContext = createContext();

export const useEmployeeAccess = () => {
  const context = useContext(EmployeeAccessContext);
  if (!context) {
    throw new Error('useEmployeeAccess must be used within an EmployeeAccessProvider');
  }
  return context;
};

export const EmployeeAccessProvider = ({ children }) => {
  const [accessSettings, setAccessSettings] = useState({});
  const [employeeList, setEmployeeList] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [accessStats, setAccessStats] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // Initialize the service and load data
  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        
        // Load initial data
        const settings = employeeAccessService.getAccessSettings();
        const employees = employeeAccessService.getEmployeeList();
        const audit = employeeAccessService.getAuditLog();
        const stats = employeeAccessService.getAccessControlStats();
        
        setAccessSettings(settings);
        setEmployeeList(employees);
        setAuditLog(audit);
        setAccessStats(stats);
        
        // Subscribe to real-time updates
        const unsubscribe = employeeAccessService.subscribe((update) => {
          handleRealTimeUpdate(update);
        });
        
        return () => unsubscribe();
      } catch (error) {
        console.error('Error initializing employee access context:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initialize();
  }, []);

  // Handle real-time updates
  const handleRealTimeUpdate = (update) => {
    switch (update.type) {
      case 'GLOBAL_ACCESS_CHANGED':
        setAccessSettings(update.settings);
        setAccessStats(employeeAccessService.getAccessControlStats());
        break;
        
      case 'INDIVIDUAL_ACCESS_CHANGED':
        setEmployeeList(prev => prev.map(emp => 
          emp.id === update.employeeId 
            ? { ...emp, status: update.status }
            : emp
        ));
        setAccessStats(employeeAccessService.getAccessControlStats());
        break;
        
      case 'BULK_OPERATION_COMPLETED':
        setEmployeeList(employeeAccessService.getEmployeeList());
        setAccessStats(employeeAccessService.getAccessControlStats());
        break;
        
      case 'CONFIGURATION_IMPORTED':
        setAccessSettings(update.settings);
        setEmployeeList(employeeAccessService.getEmployeeList());
        setAccessStats(employeeAccessService.getAccessControlStats());
        break;
        
      default:
        // Update audit log for all changes
        setAuditLog(employeeAccessService.getAuditLog());
        break;
    }
  };

  // Toggle global employee access
  const toggleGlobalAccess = async () => {
    try {
      setIsLoading(true);
      const result = await employeeAccessService.toggleGlobalEmployeeAccess();
      return result;
    } catch (error) {
      console.error('Error toggling global access:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle individual employee access
  const toggleEmployeeAccess = async (employeeId, newStatus) => {
    try {
      setIsLoading(true);
      const result = await employeeAccessService.toggleEmployeeAccess(employeeId, newStatus);
      return result;
    } catch (error) {
      console.error('Error toggling employee access:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Perform bulk operations
  const performBulkOperation = async (operation, employeeIds) => {
    try {
      setIsLoading(true);
      const result = await employeeAccessService.performBulkOperation(operation, employeeIds);
      return result;
    } catch (error) {
      console.error('Error performing bulk operation:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Check if employee has access
  const hasEmployeeAccess = (employeeId) => {
    return employeeAccessService.getEmployeeAccessStatus(employeeId) === 'active';
  };

  // Export configuration
  const exportConfiguration = () => {
    return employeeAccessService.exportConfiguration();
  };

  // Import configuration
  const importConfiguration = async (configData) => {
    try {
      setIsLoading(true);
      const result = await employeeAccessService.importConfiguration(configData);
      return result;
    } catch (error) {
      console.error('Error importing configuration:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const contextValue = {
    // State
    accessSettings,
    employeeList,
    auditLog,
    accessStats,
    isLoading,
    
    // Actions
    toggleGlobalAccess,
    toggleEmployeeAccess,
    performBulkOperation,
    hasEmployeeAccess,
    exportConfiguration,
    importConfiguration,
    
    // Service reference for direct access if needed
    employeeAccessService
  };

  return (
    <EmployeeAccessContext.Provider value={contextValue}>
      {children}
    </EmployeeAccessContext.Provider>
  );
};