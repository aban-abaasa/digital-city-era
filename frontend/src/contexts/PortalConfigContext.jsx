import React, { createContext, useContext, useState, useEffect } from 'react';
import { notificationService } from '../services/notificationService';

const PortalConfigContext = createContext();

export const usePortalConfig = () => {
  const context = useContext(PortalConfigContext);
  if (!context) {
    throw new Error('usePortalConfig must be used within a PortalConfigProvider');
  }
  return context;
};

export const PortalConfigProvider = ({ children }) => {
  const [portalConfig, setPortalConfig] = useState({
    adminPortal: 'Admin Portal',
    employeePortal: 'Employee Portal',
    managerPortal: 'Manager Portal',
    customerPortal: 'Customer Portal',
    supplierPortal: 'Supplier Portal',
    deliveryPortal: 'Delivery Portal',
    systemName: 'FAREDEAL',
    companyName: 'FareDeal Uganda',
    appTitle: 'FareDeal Management System',
    tagline: 'Your Trusted Marketplace',
    version: '2.0.0',
    lastUpdated: new Date().toISOString()
  });

  const [isLoading, setIsLoading] = useState(false);
  const [subscribers, setSubscribers] = useState(new Set());

  // Load configuration on mount
  useEffect(() => {
    loadPortalConfiguration();
  }, []);

  // Load configuration from localStorage and simulate API call
  const loadPortalConfiguration = async () => {
    try {
      setIsLoading(true);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Load from localStorage first (client-side persistence)
      const localConfig = localStorage.getItem('portalConfiguration');
      if (localConfig) {
        const parsedConfig = JSON.parse(localConfig);
        setPortalConfig(prev => ({
          ...prev,
          ...parsedConfig,
          lastUpdated: parsedConfig.lastUpdated || new Date().toISOString()
        }));
      }

      // Simulate fetching from server API
      const serverConfig = await fetchPortalConfigFromServer();
      if (serverConfig) {
        setPortalConfig(prev => ({
          ...prev,
          ...serverConfig,
          lastUpdated: serverConfig.lastUpdated || new Date().toISOString()
        }));
        
        // Sync with localStorage
        localStorage.setItem('portalConfiguration', JSON.stringify(serverConfig));
      }

    } catch (error) {
      console.error('Failed to load portal configuration:', error);
      notificationService.show('Failed to load portal configuration', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Simulate server API call
  const fetchPortalConfigFromServer = async () => {
    // In a real application, this would be an actual API call
    // For now, we'll simulate it with localStorage data
    try {
      const mockApiResponse = {
        success: true,
        data: JSON.parse(localStorage.getItem('portalConfiguration') || '{}')
      };
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      return mockApiResponse.data;
    } catch (error) {
      return null;
    }
  };

  // Update configuration with real API integration
  const updatePortalConfiguration = async (newConfig) => {
    try {
      setIsLoading(true);
      
      // Validate configuration
      const validatedConfig = validatePortalConfig(newConfig);
      
      // Simulate API call to update server
      const success = await updatePortalConfigOnServer(validatedConfig);
      
      if (success) {
        const updatedConfig = {
          ...validatedConfig,
          lastUpdated: new Date().toISOString(),
          version: incrementVersion(portalConfig.version)
        };
        
        // Update local state
        setPortalConfig(updatedConfig);
        
        // Persist to localStorage
        localStorage.setItem('portalConfiguration', JSON.stringify(updatedConfig));
        
        // Broadcast to all subscribers (other components/portals)
        broadcastConfigUpdate(updatedConfig);
        
        notificationService.show('Portal configuration updated successfully!', 'success');
        
        // Simulate real-time update to all connected portals
        setTimeout(() => {
          notificationService.show(`Changes broadcasted to all ${Object.keys(updatedConfig).length} portals`, 'success');
        }, 1000);
        
        return { success: true, data: updatedConfig };
      } else {
        throw new Error('Server update failed');
      }
      
    } catch (error) {
      console.error('Failed to update portal configuration:', error);
      notificationService.show('Failed to update portal configuration', 'error');
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Simulate server update
  const updatePortalConfigOnServer = async (config) => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Simulate potential server errors (5% chance)
    if (Math.random() < 0.05) {
      throw new Error('Server temporarily unavailable');
    }
    
    // Simulate successful update
    return true;
  };

  // Validate portal configuration
  const validatePortalConfig = (config) => {
    const required = ['systemName', 'companyName', 'appTitle'];
    const validated = { ...config };
    
    required.forEach(field => {
      if (!validated[field] || validated[field].trim() === '') {
        validated[field] = portalConfig[field]; // Keep existing value
      }
    });
    
    // Sanitize strings
    Object.keys(validated).forEach(key => {
      if (typeof validated[key] === 'string') {
        validated[key] = validated[key].trim().slice(0, 100); // Max 100 characters
      }
    });
    
    return validated;
  };

  // Increment version number
  const incrementVersion = (currentVersion) => {
    const parts = currentVersion.split('.');
    const patch = parseInt(parts[2] || 0) + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  };

  // Subscribe to configuration changes
  const subscribe = (callback) => {
    setSubscribers(prev => new Set([...prev, callback]));
    
    return () => {
      setSubscribers(prev => {
        const newSet = new Set(prev);
        newSet.delete(callback);
        return newSet;
      });
    };
  };

  // Broadcast configuration updates to subscribers
  const broadcastConfigUpdate = (config) => {
    subscribers.forEach(callback => {
      try {
        callback(config);
      } catch (error) {
        console.error('Error in portal config subscriber:', error);
      }
    });
  };

  // Reset to default configuration
  const resetToDefault = async () => {
    const defaultConfig = {
      adminPortal: 'Admin Portal',
      employeePortal: 'Employee Portal',
      managerPortal: 'Manager Portal',
      customerPortal: 'Customer Portal',
      supplierPortal: 'Supplier Portal',
      deliveryPortal: 'Delivery Portal',
      systemName: 'FAREDEAL',
      companyName: 'FareDeal Uganda',
      appTitle: 'FareDeal Management System',
      tagline: 'Your Trusted Marketplace',
      version: '2.0.0',
      lastUpdated: new Date().toISOString()
    };

    return await updatePortalConfiguration(defaultConfig);
  };

  // Get portal-specific configuration
  const getPortalConfig = (portalType) => {
    const portalKey = `${portalType}Portal`;
    return {
      name: portalConfig[portalKey] || portalType,
      systemName: portalConfig.systemName,
      companyName: portalConfig.companyName,
      appTitle: portalConfig.appTitle,
      tagline: portalConfig.tagline,
      version: portalConfig.version,
      lastUpdated: portalConfig.lastUpdated
    };
  };

  // Check if configuration has unsaved changes
  const hasUnsavedChanges = (newConfig) => {
    return JSON.stringify(portalConfig) !== JSON.stringify(newConfig);
  };

  const contextValue = {
    portalConfig,
    isLoading,
    updatePortalConfiguration,
    resetToDefault,
    subscribe,
    getPortalConfig,
    hasUnsavedChanges,
    loadPortalConfiguration
  };

  return (
    <PortalConfigContext.Provider value={contextValue}>
      {children}
    </PortalConfigContext.Provider>
  );
};

export default PortalConfigContext;