// Portal Configuration Service - Real API Integration
class PortalConfigService {
  constructor() {
    // ⚡ Smart API URL detection for production/development
    if (import.meta.env.PROD) {
      // Production: Use your actual backend URL
      this.baseURL = import.meta.env.VITE_API_URL || 'https://api.faredeal.vercel.app/api';
    } else {
      // Development: Use localhost
      this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    }
    
    this.isDevelopment = import.meta.env.DEV || import.meta.env.NODE_ENV === 'development';
    this.endpoints = {
      getConfig: '/portal-config',
      updateConfig: '/portal-config',
      resetConfig: '/portal-config/reset',
      broadcastUpdate: '/portal-config/broadcast'
    };
  }

  // Get current portal configuration
  async getPortalConfiguration() {
    try {
      // In development, use localStorage as mock API
      if (this.isDevelopment) {
        return this.getMockConfiguration();
      }

      const response = await fetch(`${this.baseURL}${this.endpoints.getConfig}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data: data.configuration,
        timestamp: data.timestamp,
        version: data.version
      };

    } catch (error) {
      console.error('Failed to fetch portal configuration:', error);
      return {
        success: false,
        error: error.message,
        fallback: this.getDefaultConfiguration()
      };
    }
  }

  // Update portal configuration
  async updatePortalConfiguration(config) {
    try {
      // Validate configuration before sending
      const validatedConfig = this.validateConfiguration(config);

      // In development, use localStorage as mock API
      if (this.isDevelopment) {
        return this.updateMockConfiguration(validatedConfig);
      }

      const response = await fetch(`${this.baseURL}${this.endpoints.updateConfig}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          configuration: validatedConfig,
          timestamp: new Date().toISOString(),
          updatedBy: this.getCurrentUserId()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Broadcast update to all connected clients
      await this.broadcastConfigurationUpdate(validatedConfig);

      return {
        success: true,
        data: data.configuration,
        message: 'Configuration updated successfully',
        affectedPortals: data.affectedPortals || []
      };

    } catch (error) {
      console.error('Failed to update portal configuration:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Reset configuration to default
  async resetPortalConfiguration() {
    try {
      const defaultConfig = this.getDefaultConfiguration();

      // In development, use localStorage as mock API
      if (this.isDevelopment) {
        localStorage.setItem('portalConfiguration', JSON.stringify(defaultConfig));
        return {
          success: true,
          data: defaultConfig,
          message: 'Configuration reset to default'
        };
      }

      const response = await fetch(`${this.baseURL}${this.endpoints.resetConfig}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          resetBy: this.getCurrentUserId(),
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data: data.configuration,
        message: 'Configuration reset successfully'
      };

    } catch (error) {
      console.error('Failed to reset portal configuration:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Broadcast configuration update to all connected portals
  async broadcastConfigurationUpdate(config) {
    try {
      // In development, simulate broadcast with localStorage event
      if (this.isDevelopment) {
        window.dispatchEvent(new CustomEvent('portalConfigUpdated', {
          detail: { config, timestamp: new Date().toISOString() }
        }));
        return { success: true };
      }

      const response = await fetch(`${this.baseURL}${this.endpoints.broadcastUpdate}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          configuration: config,
          timestamp: new Date().toISOString(),
          broadcastBy: this.getCurrentUserId()
        })
      });

      return { success: response.ok };

    } catch (error) {
      console.error('Failed to broadcast configuration update:', error);
      return { success: false, error: error.message };
    }
  }

  // Mock configuration for development
  getMockConfiguration() {
    const stored = localStorage.getItem('portalConfiguration');
    const defaultConfig = this.getDefaultConfiguration();
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          success: true,
          data: { ...defaultConfig, ...parsed },
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.error('Failed to parse stored configuration:', error);
      }
    }
    
    return {
      success: true,
      data: defaultConfig,
      timestamp: new Date().toISOString()
    };
  }

  // Update mock configuration for development
  async updateMockConfiguration(config) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate random failures (5% chance)
    if (Math.random() < 0.05) {
      throw new Error('Simulated server error');
    }

    const updatedConfig = {
      ...config,
      lastUpdated: new Date().toISOString(),
      version: this.incrementVersion(config.version || '2.0.0')
    };

    localStorage.setItem('portalConfiguration', JSON.stringify(updatedConfig));

    // Simulate broadcasting to other tabs/windows
    window.dispatchEvent(new CustomEvent('portalConfigUpdated', {
      detail: { config: updatedConfig, timestamp: new Date().toISOString() }
    }));

    return {
      success: true,
      data: updatedConfig,
      message: 'Configuration updated successfully',
      affectedPortals: ['admin', 'employee', 'manager', 'customer', 'supplier', 'delivery']
    };
  }

  // Validate configuration data
  validateConfiguration(config) {
    const required = [
      'systemName', 'companyName', 'appTitle',
      'adminPortal', 'employeePortal', 'managerPortal'
    ];

    const validated = { ...config };

    // Check required fields
    required.forEach(field => {
      if (!validated[field] || typeof validated[field] !== 'string' || validated[field].trim() === '') {
        throw new Error(`${field} is required and cannot be empty`);
      }
    });

    // Sanitize and validate string lengths
    Object.keys(validated).forEach(key => {
      if (typeof validated[key] === 'string') {
        validated[key] = validated[key].trim();
        
        if (validated[key].length > 100) {
          throw new Error(`${key} cannot exceed 100 characters`);
        }
        
        if (validated[key].length < 1) {
          throw new Error(`${key} cannot be empty`);
        }
      }
    });

    return validated;
  }

  // Get default configuration
  getDefaultConfiguration() {
    return {
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
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
  }

  // Increment version number
  incrementVersion(currentVersion) {
    try {
      const parts = currentVersion.split('.');
      const patch = parseInt(parts[2] || 0) + 1;
      return `${parts[0]}.${parts[1]}.${patch}`;
    } catch (error) {
      return '2.0.1';
    }
  }

  // Get authentication token (implement based on your auth system)
  getAuthToken() {
    return localStorage.getItem('authToken') || 'mock-admin-token';
  }

  // Get current user ID (implement based on your auth system)
  getCurrentUserId() {
    return localStorage.getItem('userId') || 'admin-user';
  }

  // Setup real-time listeners for configuration changes
  setupRealTimeListener(callback) {
    const handleConfigUpdate = (event) => {
      if (event.detail && event.detail.config) {
        callback(event.detail.config);
      }
    };

    window.addEventListener('portalConfigUpdated', handleConfigUpdate);

    // Return cleanup function
    return () => {
      window.removeEventListener('portalConfigUpdated', handleConfigUpdate);
    };
  }

  // Get configuration history (for admin audit trail)
  async getConfigurationHistory() {
    try {
      // In development, simulate history
      if (this.isDevelopment) {
        return {
          success: true,
          data: [
            {
              id: 1,
              timestamp: new Date(Date.now() - 86400000).toISOString(),
              updatedBy: 'admin-user',
              changes: ['systemName', 'companyName'],
              version: '2.0.0'
            },
            {
              id: 2,
              timestamp: new Date().toISOString(),
              updatedBy: 'admin-user',
              changes: ['employeePortal', 'managerPortal'],
              version: '2.0.1'
            }
          ]
        };
      }

      const response = await fetch(`${this.baseURL}${this.endpoints.getConfig}/history`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return { success: true, data: data.history };

    } catch (error) {
      console.error('Failed to fetch configuration history:', error);
      return { success: false, error: error.message };
    }
  }
}

export const portalConfigService = new PortalConfigService();
export default PortalConfigService;