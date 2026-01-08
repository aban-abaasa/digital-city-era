// Comprehensive Inventory API Service for FAREDEAL using Supabase
import { toast } from 'react-toastify';
import { apiService } from './apiService';
import { getCurrentUser } from './supabaseClient';

class InventoryApiService {
  constructor() {
    this.tableName = 'products';
    this.inventoryTable = 'inventory';
    this.categoriesTable = 'categories';
    this.suppliersTable = 'suppliers';
  }

  // Get inventory overview with statistics
  async getInventoryOverview() {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      // Get total active products count
      const { data: productsData, count: totalProducts } = await apiService.getAll(this.tableName, {
        select: 'id',
        filter: { is_active: true },
        count: 'exact'
      });

      // Get products with their inventory data
      const { data: inventoryData } = await apiService.getAll(this.tableName, {
        select: `
          id,
          name,
          cost_price,
          inventory (
            current_stock,
            min_stock_level,
            max_stock_level
          )
        `,
        filter: { is_active: true }
      });

      // Calculate statistics
      const lowStockProducts = inventoryData.filter(p => 
        p.inventory?.[0] && 
        p.inventory[0].current_stock > 0 && 
        p.inventory[0].current_stock <= p.inventory[0].min_stock_level
      ).length;

      const outOfStockProducts = inventoryData.filter(p => 
        p.inventory?.[0] && p.inventory[0].current_stock === 0
      ).length;

      const totalInventoryValue = inventoryData.reduce((sum, p) => {
        const stock = p.inventory?.[0]?.current_stock || 0;
        return sum + (stock * (p.cost_price || 0));
      }, 0);

      // Get category statistics
      const { data: categoryStats } = await apiService.getAll(this.categoriesTable, {
        select: `
          id,
          name,
          description,
          products (
            id,
            cost_price,
            inventory (
              current_stock
            )
          )
        `
      });

      const categoryStatsFormatted = categoryStats.map(cat => ({
        _id: cat.id,
        name: cat.name,
        icon: this.getCategoryIcon(cat.name),
        count: cat.products?.length || 0,
        totalStock: cat.products?.reduce((sum, p) => 
          sum + (p.inventory?.[0]?.current_stock || 0), 0) || 0,
        totalValue: cat.products?.reduce((sum, p) => {
          const stock = p.inventory?.[0]?.current_stock || 0;
          return sum + (stock * (p.cost_price || 0));
        }, 0) || 0
      }));

      const averageStockLevel = totalProducts > 0 ? 
        inventoryData.reduce((sum, p) => 
          sum + (p.inventory?.[0]?.current_stock || 0), 0) / totalProducts : 0;

      return {
        success: true,
        stats: {
          totalProducts,
          lowStockProducts,
          outOfStockProducts,
          totalInventoryValue: Math.round(totalInventoryValue),
          categoryStats: categoryStatsFormatted,
          averageStockLevel: Math.round(averageStockLevel * 100) / 100
        }
      };
    } catch (error) {
      console.error('Get inventory overview error:', error);
      toast.error('Failed to fetch inventory overview');
      throw error;
    }
  }

  // Get category icon based on name
  getCategoryIcon(categoryName) {
    const iconMap = {
      'Electronics': '📱',
      'Computers': '💻',
      'Beverages': '🥤',
      'Bakery': '🍞',
      'Dairy': '🥛',
      'Food': '🍽️',
      'Clothing': '👕',
      'Books': '📚',
      'Tools': '🔧',
      'Sports': '⚽'
    };
    return iconMap[categoryName] || '📦';
  }

  // Get all products with filtering and pagination
  async getProducts(params = {}) {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      let query = {
        select: `
          id,
          sku,
          name,
          description,
          cost_price,
          selling_price,
          barcode,
          weight,
          dimensions,
          is_active,
          created_at,
          updated_at,
          categories (
            id,
            name
          ),
          suppliers (
            id,
            name,
            contact_phone
          ),
          inventory (
            current_stock,
            min_stock_level,
            max_stock_level,
            last_restocked,
            location
          ),
          product_images (
            image_url
          )
        `,
        filter: {}
      };

      // Apply filters
      if (params.category) {
        query.filter.category_id = params.category;
      }

      if (params.search) {
        // For search, we'll use ilike operator
        query.search = {
          column: 'name,sku,barcode',
          value: params.search
        };
      }

      if (params.stockStatus) {
        // This will need to be handled with a more complex query
        // For now, we'll fetch all and filter in memory
      }

      // Add pagination
      if (params.page && params.limit) {
        query.pagination = {
          page: params.page,
          limit: params.limit
        };
      }

      const { data: products, count } = await apiService.getAll(this.tableName, {
        ...query,
        count: 'exact'
      });

      // Apply stock status filtering if needed
      let filteredProducts = products || [];
      if (params.stockStatus) {
        switch (params.stockStatus) {
          case 'low':
            filteredProducts = filteredProducts.filter(p => {
              const inventory = p.inventory?.[0];
              return inventory && inventory.current_stock > 0 && 
                     inventory.current_stock <= inventory.min_stock_level;
            });
            break;
          case 'out':
            filteredProducts = filteredProducts.filter(p => {
              const inventory = p.inventory?.[0];
              return inventory && inventory.current_stock === 0;
            });
            break;
          case 'good':
            filteredProducts = filteredProducts.filter(p => {
              const inventory = p.inventory?.[0];
              return inventory && inventory.current_stock > inventory.min_stock_level;
            });
            break;
        }
      }

      // Sort products if requested
      if (params.sortBy) {
        filteredProducts.sort((a, b) => {
          switch (params.sortBy) {
            case 'name':
              return a.name.localeCompare(b.name);
            case 'stock':
              const aStock = a.inventory?.[0]?.current_stock || 0;
              const bStock = b.inventory?.[0]?.current_stock || 0;
              return params.sortOrder === 'desc' ? bStock - aStock : aStock - bStock;
            case 'price':
              return params.sortOrder === 'desc' ? 
                (b.selling_price || 0) - (a.selling_price || 0) : 
                (a.selling_price || 0) - (b.selling_price || 0);
            case 'lastRestocked':
              const aDate = new Date(a.inventory?.[0]?.last_restocked || 0);
              const bDate = new Date(b.inventory?.[0]?.last_restocked || 0);
              return params.sortOrder === 'desc' ? bDate - aDate : aDate - bDate;
            default:
              return 0;
          }
        });
      }

      // Format products for frontend
      const formattedProducts = filteredProducts.map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description,
        price: p.selling_price,
        cost: p.cost_price,
        stock: p.inventory?.[0]?.current_stock || 0,
        minStock: p.inventory?.[0]?.min_stock_level || 0,
        maxStock: p.inventory?.[0]?.max_stock_level || 0,
        category: p.categories?.name || 'Uncategorized',
        brand: p.suppliers?.name || 'Unknown',
        supplier: {
          id: p.suppliers?.id || null,
          name: p.suppliers?.name || 'Unknown',
          contact: p.suppliers?.contact_phone || ''
        },
        barcode: p.barcode,
        weight: p.weight,
        dimensions: p.dimensions,
        location: p.inventory?.[0]?.location || '',
        lastRestocked: p.inventory?.[0]?.last_restocked || p.created_at,
        isActive: p.is_active,
        images: p.product_images?.map(img => img.image_url) || [],
        salesVelocity: 0, // Would need to calculate from orders
        profitMargin: p.selling_price && p.cost_price ? 
          ((p.selling_price - p.cost_price) / p.selling_price * 100) : 0
      }));

      return {
        success: true,
        data: formattedProducts,
        pagination: {
          page: params.page || 1,
          limit: params.limit || 20,
          total: filteredProducts.length,
          pages: Math.ceil(filteredProducts.length / (params.limit || 20))
        }
      };
    } catch (error) {
      console.error('Get products error:', error);
      toast.error('Failed to fetch products');
      throw error;
    }
  }

  // Get low stock products
  async getLowStockProducts() {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      const { data: products } = await apiService.getAll(this.tableName, {
        select: `
          id,
          name,
          sku,
          selling_price,
          cost_price,
          inventory (
            current_stock,
            min_stock_level
          )
        `,
        filter: { is_active: true }
      });

      const lowStockProducts = products?.filter(p => {
        const inventory = p.inventory?.[0];
        return inventory && inventory.current_stock > 0 && 
               inventory.current_stock <= inventory.min_stock_level;
      }) || [];

      return {
        success: true,
        products: lowStockProducts.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          price: p.selling_price,
          cost: p.cost_price,
          stock: p.inventory[0].current_stock,
          minStock: p.inventory[0].min_stock_level
        }))
      };
    } catch (error) {
      console.error('Get low stock products error:', error);
      throw error;
    }
  }

  // Get out of stock products
  async getOutOfStockProducts() {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      const { data: products } = await apiService.getAll(this.tableName, {
        select: `
          id,
          name,
          sku,
          selling_price,
          cost_price,
          inventory (
            current_stock,
            min_stock_level
          )
        `,
        filter: { is_active: true }
      });

      const outOfStockProducts = products?.filter(p => {
        const inventory = p.inventory?.[0];
        return inventory && inventory.current_stock === 0;
      }) || [];

      return {
        success: true,
        products: outOfStockProducts.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          price: p.selling_price,
          cost: p.cost_price,
          stock: 0,
          minStock: p.inventory[0].min_stock_level
        }))
      };
    } catch (error) {
      console.error('Get out of stock products error:', error);
      throw error;
    }
  }

  // Add or update product
  async saveProduct(productData) {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      if (productData.id) {
        // Update existing product
        const updatedProduct = await apiService.update(this.tableName, productData.id, {
          name: productData.name,
          description: productData.description,
          sku: productData.sku,
          barcode: productData.barcode,
          cost_price: productData.cost,
          selling_price: productData.price,
          category_id: productData.category_id,
          supplier_id: productData.supplier_id,
          weight: productData.weight,
          dimensions: productData.dimensions,
          is_active: productData.isActive !== false
        });

        // Update inventory if provided
        if (productData.stock !== undefined || productData.minStock !== undefined || 
            productData.maxStock !== undefined || productData.location !== undefined) {
          await apiService.update(this.inventoryTable, productData.id, {
            current_stock: productData.stock,
            min_stock_level: productData.minStock,
            max_stock_level: productData.maxStock,
            location: productData.location,
            last_restocked: new Date().toISOString()
          }, 'product_id');
        }

        toast.success('Product updated successfully!');
        return { success: true, data: updatedProduct };
      } else {
        // Add new product
        const newProductData = {
          name: productData.name,
          description: productData.description,
          sku: productData.sku || `SKU-${Date.now()}`,
          barcode: productData.barcode,
          cost_price: productData.cost || 0,
          selling_price: productData.price || 0,
          category_id: productData.category_id,
          supplier_id: productData.supplier_id,
          weight: productData.weight,
          dimensions: productData.dimensions,
          is_active: true,
          created_by: user.id
        };

        const newProduct = await apiService.create(this.tableName, newProductData);

        // Create inventory record
        await apiService.create(this.inventoryTable, {
          product_id: newProduct.id,
          current_stock: productData.stock || 0,
          min_stock_level: productData.minStock || 0,
          max_stock_level: productData.maxStock || 0,
          location: productData.location || '',
          last_restocked: new Date().toISOString()
        });

        toast.success('Product added successfully!');
        return { success: true, data: newProduct };
      }
    } catch (error) {
      console.error('Save product error:', error);
      toast.error(`Failed to save product: ${error.message}`);
      throw error;
    }
  }

  // Adjust stock
  async adjustStock(productId, adjustment, reason = '') {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      // Get current inventory record
      const { data: inventory } = await apiService.getAll(this.inventoryTable, {
        select: 'current_stock',
        filter: { product_id: productId }
      });

      if (!inventory || inventory.length === 0) {
        throw new Error('Product inventory record not found');
      }

      const currentStock = inventory[0].current_stock;
      const newStock = Math.max(0, currentStock + adjustment);

      // Update inventory
      await apiService.update(this.inventoryTable, productId, {
        current_stock: newStock,
        last_restocked: new Date().toISOString()
      }, 'product_id');

      // Get product name for notification
      const product = await apiService.getById(this.tableName, productId, {
        select: 'name'
      });

      const adjustmentType = adjustment > 0 ? 'increased' : 'decreased';
      toast.success(`Stock ${adjustmentType} for ${product.name}. New stock: ${newStock}`);
      
      return {
        success: true,
        data: {
          product,
          oldStock: currentStock,
          newStock,
          adjustment,
          reason
        }
      };
    } catch (error) {
      console.error('Adjust stock error:', error);
      toast.error(`Failed to adjust stock: ${error.message}`);
      throw error;
    }
  }

  // Bulk stock adjustment
  async bulkStockAdjustment(adjustments) {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      const results = [];
      
      for (const adj of adjustments) {
        try {
          const result = await this.adjustStock(adj.productId, adj.adjustment, adj.reason);
          results.push({
            productId: adj.productId,
            productName: result.data.product.name,
            oldStock: result.data.oldStock,
            newStock: result.data.newStock,
            adjustment: adj.adjustment,
            success: true
          });
        } catch (error) {
          results.push({
            productId: adj.productId,
            success: false,
            error: error.message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      toast.success(`Bulk adjustment completed: ${successCount}/${adjustments.length} products updated`);
      
      return {
        success: true,
        data: results
      };
    } catch (error) {
      console.error('Bulk stock adjustment error:', error);
      toast.error('Failed to perform bulk stock adjustment');
      throw error;
    }
  }

  // Generate reorder suggestions
  async getReorderSuggestions() {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      const { data: products } = await apiService.getAll(this.tableName, {
        select: `
          id,
          name,
          sku,
          cost_price,
          selling_price,
          inventory (
            current_stock,
            min_stock_level,
            max_stock_level
          )
        `,
        filter: { is_active: true }
      });

      const suggestions = products?.filter(p => {
        const inventory = p.inventory?.[0];
        return inventory && (inventory.current_stock <= inventory.min_stock_level || 
                           inventory.current_stock === 0);
      }).map(p => {
        const inventory = p.inventory[0];
        const suggestedOrder = Math.max(
          inventory.max_stock_level - inventory.current_stock, 
          inventory.min_stock_level * 2
        );
        
        return {
          product: {
            id: p.id,
            name: p.name,
            sku: p.sku,
            cost: p.cost_price,
            price: p.selling_price
          },
          currentStock: inventory.current_stock,
          minStock: inventory.min_stock_level,
          maxStock: inventory.max_stock_level,
          suggestedOrder,
          priority: inventory.current_stock === 0 ? 'high' : 
                   inventory.current_stock <= inventory.min_stock_level / 2 ? 'medium' : 'low',
          estimatedCost: suggestedOrder * (p.cost_price || 0),
          salesVelocity: 0, // Would need to calculate from historical data
          daysOfStock: 0 // Would need sales velocity data
        };
      }).sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }) || [];

      return {
        success: true,
        data: suggestions
      };
    } catch (error) {
      console.error('Get reorder suggestions error:', error);
      toast.error('Failed to generate reorder suggestions');
      throw error;
    }
  }

  // Get categories
  async getCategories() {
    try {
      const { data: categories } = await apiService.getAll(this.categoriesTable, {
        select: `
          id,
          name,
          description,
          is_active,
          products (id)
        `
      });

      const formattedCategories = categories?.map(cat => ({
        id: cat.id,
        name: cat.name,
        count: cat.products?.length || 0,
        icon: this.getCategoryIcon(cat.name)
      })) || [];

      return {
        success: true,
        categories: formattedCategories
      };
    } catch (error) {
      console.error('Get categories error:', error);
      throw error;
    }
  }

  // Get suppliers
  async getSuppliers() {
    try {
      const { data: suppliers } = await apiService.getAll(this.suppliersTable, {
        select: `
          id,
          name,
          contact_phone,
          email,
          is_active
        `,
        filter: { is_active: true }
      });

      const formattedSuppliers = suppliers?.map(sup => ({
        id: sup.id,
        name: sup.name,
        contact: sup.contact_phone,
        email: sup.email,
        rating: 4.5 // Would need to calculate from performance data
      })) || [];

      return {
        success: true,
        suppliers: formattedSuppliers
      };
    } catch (error) {
      console.error('Get suppliers error:', error);
      throw error;
    }
  }

  // Simulate barcode scan (find product by barcode)
  async scanBarcode(barcode) {
    try {
      const { data: products } = await apiService.getAll(this.tableName, {
        select: `
          id,
          name,
          sku,
          barcode,
          selling_price,
          cost_price,
          inventory (
            current_stock
          )
        `,
        filter: { 
          barcode: barcode,
          is_active: true 
        }
      });

      if (products && products.length > 0) {
        const product = products[0];
        const formattedProduct = {
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          price: product.selling_price,
          cost: product.cost_price,
          stock: product.inventory?.[0]?.current_stock || 0
        };

        toast.success(`Product found: ${product.name}`);
        return {
          success: true,
          data: formattedProduct
        };
      } else {
        toast.warning('Product not found for this barcode');
        return {
          success: false,
          message: 'Product not found'
        };
      }
    } catch (error) {
      console.error('Barcode scan error:', error);
      toast.error('Failed to scan barcode');
      throw error;
    }
  }

  // Export inventory data
  async exportInventory(format = 'csv') {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      const { data: products } = await apiService.getAll(this.tableName, {
        select: `
          sku,
          name,
          cost_price,
          selling_price,
          categories (name),
          suppliers (name),
          inventory (
            current_stock,
            min_stock_level,
            max_stock_level,
            location,
            last_restocked
          )
        `,
        filter: { is_active: true }
      });

      const exportData = products?.map(p => {
        const inventory = p.inventory?.[0] || {};
        const profitMargin = p.selling_price && p.cost_price ? 
          ((p.selling_price - p.cost_price) / p.selling_price * 100) : 0;

        return {
          SKU: p.sku,
          Name: p.name,
          Category: p.categories?.name || 'Uncategorized',
          Brand: p.suppliers?.name || 'Unknown',
          Stock: inventory.current_stock || 0,
          'Min Stock': inventory.min_stock_level || 0,
          'Max Stock': inventory.max_stock_level || 0,
          Price: p.selling_price || 0,
          Cost: p.cost_price || 0,
          'Profit Margin': Math.round(profitMargin * 100) / 100,
          Supplier: p.suppliers?.name || 'Unknown',
          Location: inventory.location || '',
          'Last Restocked': inventory.last_restocked || ''
        };
      }) || [];

      toast.success(`Inventory exported successfully (${format.toUpperCase()})`);
      
      return {
        success: true,
        data: exportData,
        format,
        filename: `inventory_export_${new Date().toISOString().split('T')[0]}.${format}`
      };
    } catch (error) {
      console.error('Export inventory error:', error);
      toast.error('Failed to export inventory');
      throw error;
    }
  }
}

// Export singleton instance
export default new InventoryApiService();

// Export individual methods for direct import
export const {
  getInventoryOverview,
  getProducts,
  getLowStockProducts,
  getOutOfStockProducts,
  saveProduct,
  adjustStock,
  bulkStockAdjustment,
  getReorderSuggestions,
  getCategories,
  getSuppliers,
  scanBarcode,
  exportInventory
} = new InventoryApiService();