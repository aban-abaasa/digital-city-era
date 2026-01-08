/**
 * Backend API Integration Service
 * Connects frontend to the Express backend server
 */

class BackendApiService {
    constructor() {
        if (import.meta.env.PROD) {
            this.baseURL = import.meta.env.VITE_API_URL || 'https://api.faredeal.vercel.app/api';
        } else {
            this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
        }
        this.token = localStorage.getItem('auth_token');
        
        // Initialize connection
        this.initializeConnection();
    }

    /**
     * Initialize backend connection and test connectivity
     */
    async initializeConnection() {
        try {
            console.log('🔌 Connecting to backend API...');
            const response = await this.request('/health');
            
            if (response.status === 'ok') {
                console.log('✅ Backend API connected successfully');
                console.log(`📡 Database: ${response.database}`);
                console.log(`🌍 Environment: ${response.environment}`);
                return true;
            }
        } catch (error) {
            console.warn('⚠️ Backend API not available, using fallback data');
            console.log('🔧 Make sure backend server is running on http://localhost:3001');
            return false;
        }
    }

    /**
     * Generic API request method
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { Authorization: `Bearer ${this.token}` }),
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`API request failed: ${endpoint}`, error);
            throw error;
        }
    }

    // =============================================================================
    // AUTHENTICATION METHODS
    // =============================================================================

    /**
     * User login
     */
    async login(email, password) {
        try {
            const response = await this.request('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            if (response.success && response.token) {
                this.token = response.token;
                localStorage.setItem('auth_token', response.token);
                localStorage.setItem('user_profile', JSON.stringify(response.user));
                
                console.log('✅ Login successful');
                return {
                    success: true,
                    user: response.user,
                    token: response.token
                };
            } else {
                throw new Error(response.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get user profile
     */
    async getUserProfile() {
        try {
            const response = await this.request('/auth/profile');
            
            if (response.success) {
                localStorage.setItem('user_profile', JSON.stringify(response.user));
                return response.user;
            } else {
                throw new Error(response.error || 'Failed to fetch profile');
            }
        } catch (error) {
            console.error('Profile fetch error:', error);
            
            // Return cached profile as fallback
            const cachedProfile = localStorage.getItem('user_profile');
            if (cachedProfile) {
                return JSON.parse(cachedProfile);
            }
            
            throw error;
        }
    }

    /**
     * Logout user
     */
    logout() {
        this.token = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_profile');
        console.log('✅ Logout successful');
    }

    // =============================================================================
    // INVENTORY MANAGEMENT METHODS
    // =============================================================================

    /**
     * Get all products
     */
    async getProducts() {
        try {
            const response = await this.request('/products');
            
            if (response.success) {
                console.log(`📦 Fetched ${response.products.length} products from backend`);
                
                // Store in localStorage for offline access
                localStorage.setItem('backend_products', JSON.stringify(response.products));
                
                return {
                    success: true,
                    products: response.products
                };
            } else {
                throw new Error(response.error || 'Failed to fetch products');
            }
        } catch (error) {
            console.warn('Products fetch failed, using cached data:', error);
            
            // Return cached data as fallback
            const cachedProducts = localStorage.getItem('backend_products');
            if (cachedProducts) {
                return {
                    success: true,
                    products: JSON.parse(cachedProducts),
                    cached: true
                };
            }
            
            return {
                success: false,
                error: error.message,
                products: []
            };
        }
    }

    /**
     * Create new product
     */
    async createProduct(productData) {
        try {
            const response = await this.request('/products', {
                method: 'POST',
                body: JSON.stringify(productData)
            });

            if (response.success) {
                console.log('✅ Product created successfully:', response.product.name);
                
                // Refresh cached products
                await this.getProducts();
                
                return {
                    success: true,
                    product: response.product
                };
            } else {
                throw new Error(response.error || 'Failed to create product');
            }
        } catch (error) {
            console.error('Product creation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update product stock
     */
    async updateProductStock(productId, adjustment, reason = 'Manual adjustment') {
        try {
            const response = await this.request(`/products/${productId}/stock`, {
                method: 'PUT',
                body: JSON.stringify({ adjustment, reason })
            });

            if (response.success) {
                console.log(`✅ Stock updated: ${adjustment > 0 ? '+' : ''}${adjustment} units`);
                
                // Refresh cached products
                await this.getProducts();
                
                return {
                    success: true,
                    newStock: response.newStock,
                    adjustment: response.adjustment
                };
            } else {
                throw new Error(response.error || 'Failed to update stock');
            }
        } catch (error) {
            console.error('Stock update error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // =============================================================================
    // EMPLOYEE MANAGEMENT METHODS
    // =============================================================================

    /**
     * Get all employees
     */
    async getEmployees() {
        try {
            const response = await this.request('/employees');
            
            if (response.success) {
                console.log(`👥 Fetched ${response.employees.length} employees from backend`);
                
                // Store in localStorage for offline access
                localStorage.setItem('backend_employees', JSON.stringify(response.employees));
                
                return {
                    success: true,
                    employees: response.employees
                };
            } else {
                throw new Error(response.error || 'Failed to fetch employees');
            }
        } catch (error) {
            console.warn('Employees fetch failed, using cached data:', error);
            
            // Return cached data as fallback
            const cachedEmployees = localStorage.getItem('backend_employees');
            if (cachedEmployees) {
                return {
                    success: true,
                    employees: JSON.parse(cachedEmployees),
                    cached: true
                };
            }
            
            return {
                success: false,
                error: error.message,
                employees: []
            };
        }
    }

    // =============================================================================
    // ANALYTICS & DASHBOARD METHODS
    // =============================================================================

    /**
     * Get dashboard analytics
     */
    async getDashboardAnalytics() {
        try {
            const response = await this.request('/analytics/dashboard');
            
            if (response.success) {
                console.log('📊 Fetched dashboard analytics from backend');
                
                // Store in localStorage for offline access
                localStorage.setItem('backend_analytics', JSON.stringify(response.analytics));
                
                return {
                    success: true,
                    analytics: response.analytics
                };
            } else {
                throw new Error(response.error || 'Failed to fetch analytics');
            }
        } catch (error) {
            console.warn('Analytics fetch failed, using cached data:', error);
            
            // Return cached data as fallback
            const cachedAnalytics = localStorage.getItem('backend_analytics');
            if (cachedAnalytics) {
                return {
                    success: true,
                    analytics: JSON.parse(cachedAnalytics),
                    cached: true
                };
            }
            
            return {
                success: false,
                error: error.message,
                analytics: {
                    totalProducts: 0,
                    totalEmployees: 0,
                    activeUsers: 0,
                    totalInventoryValue: 0,
                    lowStockCount: 0
                }
            };
        }
    }

    // =============================================================================
    // PORTAL CONFIGURATION METHODS
    // =============================================================================

    /**
     * Get portal configuration
     */
    async getPortalConfig() {
        try {
            const response = await this.request('/portal/config');
            
            if (response.success) {
                console.log('⚙️ Fetched portal configuration from backend');
                
                // Store in localStorage for offline access
                localStorage.setItem('backend_portal_config', JSON.stringify(response.config));
                
                return {
                    success: true,
                    config: response.config
                };
            } else {
                throw new Error(response.error || 'Failed to fetch portal config');
            }
        } catch (error) {
            console.warn('Portal config fetch failed, using cached data:', error);
            
            // Return cached data as fallback
            const cachedConfig = localStorage.getItem('backend_portal_config');
            if (cachedConfig) {
                return {
                    success: true,
                    config: JSON.parse(cachedConfig),
                    cached: true
                };
            }
            
            return {
                success: false,
                error: error.message,
                config: {
                    companyName: 'FAREDEAL',
                    adminPortal: 'Admin Portal',
                    managerPortal: 'Manager Portal',
                    cashierPortal: 'Cashier Portal'
                }
            };
        }
    }

    /**
     * Update portal configuration
     */
    async updatePortalConfig(config) {
        try {
            const response = await this.request('/portal/config', {
                method: 'PUT',
                body: JSON.stringify({ config })
            });

            if (response.success) {
                console.log('✅ Portal configuration updated successfully');
                
                // Refresh cached config
                await this.getPortalConfig();
                
                return {
                    success: true,
                    message: response.message
                };
            } else {
                throw new Error(response.error || 'Failed to update portal config');
            }
        } catch (error) {
            console.error('Portal config update error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // =============================================================================
    // UTILITY METHODS
    // =============================================================================

    /**
     * Check if backend is connected
     */
    async isBackendConnected() {
        try {
            await this.request('/health');
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get API info
     */
    async getApiInfo() {
        try {
            const response = await this.request('/info');
            return response;
        } catch (error) {
            console.error('Failed to fetch API info:', error);
            return null;
        }
    }

    /**
     * Sync all data with backend
     */
    async syncAllData() {
        console.log('🔄 Syncing all data with backend...');
        
        try {
            const [products, employees, analytics, config] = await Promise.allSettled([
                this.getProducts(),
                this.getEmployees(),
                this.getDashboardAnalytics(),
                this.getPortalConfig()
            ]);

            const results = {
                products: products.status === 'fulfilled' ? products.value : null,
                employees: employees.status === 'fulfilled' ? employees.value : null,
                analytics: analytics.status === 'fulfilled' ? analytics.value : null,
                config: config.status === 'fulfilled' ? config.value : null
            };

            console.log('✅ Data sync completed');
            return results;
            
        } catch (error) {
            console.error('Data sync failed:', error);
            throw error;
        }
    }
}

// Create and export singleton instance
const backendApiService = new BackendApiService();

export { backendApiService, BackendApiService };
export default backendApiService;