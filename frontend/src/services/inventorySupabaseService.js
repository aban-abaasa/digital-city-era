/**
 * FAREDEAL Inventory Service - Supabase Integration
 * 
 * Centralized inventory management service that connects all portals:
 * - Manager Portal: Full inventory control and analytics
 * - Employee/Cashier Portal: View products, check stock, update after sales
 * - Supplier Portal: View products they supply, update delivery status
 * - Customer Portal: View available products and stock status
 * 
 * This service ensures all portals work with the same real-time inventory data
 */

import { supabase, db, utils } from './supabase';
import { toast } from 'react-toastify';

class InventorySupabaseService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5000; // 5 seconds cache
    this.subscribers = new Set();
  }

  // ============================================================================
  // PRODUCTS MANAGEMENT
  // ============================================================================

  /**
   * Get all products with inventory information
   * @param {Object} options - Filter and pagination options
   * @returns {Promise<Array>} Array of products with inventory data
   */
  async getAllProducts(options = {}) {
    try {
      const {
        search = '',
        category = '',
        supplier = '',
        status = '',
        sortBy = 'name',
        sortOrder = 'asc',
        limit = 100,
        offset = 0,
        includeInactive = false
      } = options;

      let query = supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name),
          supplier:suppliers(id, company_name, contact_person),
          inventory(
            id,
            product_id,
            current_stock,
            reserved_stock,
            minimum_stock,
            reorder_point,
            reorder_quantity,
            last_stocktake_date,
            last_restock_date
          )
        `);

      // Apply filters
      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      if (search) {
        query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
      }

      if (category) {
        query = query.eq('category_id', category);
      }

      // Skip supplier filter as products table doesn't have supplier_id column
      // if (supplier) {
      //   query = query.eq('supplier_id', supplier);
      // }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) throw error;

      console.log('🔍 Raw data from Supabase:', data);
      console.log('📦 First product raw data:', data?.[0]);
      
      // Check inventory data
      if (data?.[0]) {
        console.log('📦 First product inventory array:', data[0].inventory);
        console.log('📦 Books inventory details:', {
          name: data[0].name,
          hasInventory: !!data[0].inventory,
          inventoryLength: data[0].inventory?.length || 0,
          inventoryData: data[0].inventory
        });
      }

      // Transform data to match expected format
      const products = data.map(product => {
        const stock = product.inventory?.[0]?.current_stock || 0;
        return {
          ...product,
          stock: stock,
          available_stock: stock - (product.inventory?.[0]?.reserved_stock || 0),
          reserved_stock: product.inventory?.[0]?.reserved_stock || 0,
          minStock: product.inventory?.[0]?.minimum_stock || 0,
          reorderPoint: product.inventory?.[0]?.reorder_point || 0,
          reorderQuantity: product.inventory?.[0]?.reorder_quantity || 100,
          lastStocktakeDate: product.inventory?.[0]?.last_stocktake_date,
          lastRestockDate: product.inventory?.[0]?.last_restock_date,
          categoryName: product.category?.name || 'Uncategorized',
          supplierName: product.supplier?.company_name || 'No Supplier'
        };
      });

      console.log(`✅ Loaded ${products.length} products from Supabase`);
      console.log('📊 Processed products:', products.map(p => ({ name: p.name, sku: p.sku, stock: p.stock })));
      return products;

    } catch (error) {
      console.error('❌ Error fetching products:', error);
      toast.error('Failed to load products: ' + utils.handleError(error));
      return [];
    }
  }

  /**
   * Get a single product by ID
   * @param {string} productId - Product UUID
   * @returns {Promise<Object>} Product with full details
   */
  async getProductById(productId) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name, description),
          supplier:suppliers(id, company_name, contact_person, phone, email),
          inventory(*)
        `)
        .eq('id', productId)
        .single();

      if (error) throw error;

      return {
        ...data,
        stock: data.inventory?.[0]?.current_stock || 0,
        available_stock: data.inventory?.[0]?.available_stock || 0,
        stockStatus: data.inventory?.[0]?.status || 'unknown'
      };

    } catch (error) {
      console.error('❌ Error fetching product:', error);
      toast.error('Failed to load product details');
      return null;
    }
  }

  /**
   * Get product by SKU or Barcode (for POS scanning)
   * @param {string} code - SKU or Barcode
   * @returns {Promise<Object>} Product details
   */
  async getProductByCode(code) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          inventory(current_stock, available_stock, status)
        `)
        .or(`sku.eq.${code},barcode.eq.${code}`)
        .eq('is_active', true)
        .single();

      if (error) throw error;

      return {
        ...data,
        stock: data.inventory?.[0]?.current_stock || 0,
        available_stock: data.inventory?.[0]?.available_stock || 0,
        stockStatus: data.inventory?.[0]?.status || 'unknown'
      };

    } catch (error) {
      console.error('❌ Product not found:', code);
      return null;
    }
  }

  /**
   * Create a new product
   * @param {Object} productData - Product information
   * @returns {Promise<Object>} Created product
   */
  async createProduct(productData) {
    try {
      const {
        sku,
        barcode,
        name,
        description,
        category_id,
        supplier_id,
        brand,
        cost_price = 0,
        selling_price = 0,
        tax_rate = 18, // Uganda VAT
        initial_stock = 0,
        minimum_stock = 10,
        maximum_stock = 1000,
        reorder_point = 20,
        location = 'Main Storage',
        warehouse = 'Main Warehouse'
      } = productData;

      // Ensure selling_price is a valid number
      let finalSellingPrice = parseFloat(selling_price);
      let finalCostPrice = parseFloat(cost_price);
      
      // Handle NaN values
      if (isNaN(finalSellingPrice)) finalSellingPrice = 0;
      if (isNaN(finalCostPrice)) finalCostPrice = 0;
      
      // If no selling price, use cost price
      if (finalSellingPrice === 0 && finalCostPrice > 0) {
        finalSellingPrice = finalCostPrice * 1.3; // 30% markup as default
      }
      
      // Ensure we have at least a price
      if (finalSellingPrice === 0 && finalCostPrice === 0) {
        console.warn('⚠️ No price provided, using default price of 1000');
        finalSellingPrice = 1000;
      }
      
      console.log(`💰 Product pricing: cost=${finalCostPrice}, selling=${finalSellingPrice}`);

      // Calculate markup percentage
      const markup_percentage = finalCostPrice > 0 
        ? ((finalSellingPrice - finalCostPrice) / finalCostPrice * 100).toFixed(2)
        : 0;

      // Generate guaranteed unique identifiers
      const generateUniqueId = () => {
        const timestamp = Date.now();
        const random1 = Math.random().toString(36).substring(2, 9);
        const random2 = Math.random().toString(36).substring(2, 6);
        return `${timestamp}-${random1}-${random2}`.toUpperCase();
      };
      
      let uniqueBarcode;
      if (barcode && String(barcode).trim()) {
        uniqueBarcode = String(barcode).trim();
      } else {
        uniqueBarcode = `BC-${generateUniqueId()}`;
      }
      
      let uniqueSku;
      if (sku && String(sku).trim()) {
        uniqueSku = String(sku).trim();
      } else {
        uniqueSku = `SKU-${generateUniqueId()}`;
      }
      
      // Insert product with required fields - ENSURE PRICE IS NEVER NULL
      const productInsert = {
        name: name || 'Unnamed Product',
        sku: uniqueSku,
        barcode: uniqueBarcode,
        price: finalSellingPrice > 0 ? finalSellingPrice : 1000,  // CRITICAL: Never null or zero
        selling_price: finalSellingPrice > 0 ? finalSellingPrice : 1000,
        cost_price: finalCostPrice > 0 ? finalCostPrice : undefined
      };
      
      console.log('📦 Inserting product:', productInsert);
      
      // Add optional fields
      if (description && String(description).trim()) productInsert.description = String(description).trim();
      if (category_id) productInsert.category_id = category_id;
      if (brand && String(brand).trim()) productInsert.brand = String(brand).trim();
      if (tax_rate) productInsert.tax_rate = parseFloat(tax_rate) || 18;
      if (markup_percentage) productInsert.markup_percentage = parseFloat(markup_percentage);
      
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert(productInsert)
        .select()
        .single();

      if (productError) throw productError;

      // Create inventory record with only basic fields (skip if RLS blocks it)
      let inventory = null;
      try {
        const { data: inv, error: inventoryError } = await supabase
          .from('inventory')
          .insert({
            product_id: product.id,
            current_stock: initial_stock || 0
          })
          .select()
          .single();

        if (!inventoryError) {
          inventory = inv;
        }
      } catch (invError) {
        // Inventory creation failed, continue anyway
      }

      toast.success(`✅ Product "${name}" created successfully!`);
      return { ...product, inventory };

    } catch (error) {
      console.error('❌ Error creating product:', error);
      toast.error('Failed to create product: ' + utils.handleError(error));
      throw error;
    }
  }

  /**
   * Update product information
   * @param {string} productId - Product UUID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated product
   */
  async updateProduct(productId, updates) {
    try {
      // Recalculate markup if prices changed
      if (updates.cost_price || updates.selling_price) {
        const product = await this.getProductById(productId);
        const costPrice = updates.cost_price || product.cost_price;
        const sellingPrice = updates.selling_price || product.selling_price;
        updates.markup_percentage = costPrice > 0 
          ? ((sellingPrice - costPrice) / costPrice * 100).toFixed(2)
          : 0;
      }

      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', productId)
        .select()
        .single();

      if (error) throw error;

      toast.success('✅ Product updated successfully!');
      return data;

    } catch (error) {
      console.error('❌ Error updating product:', error);
      toast.error('Failed to update product');
      throw error;
    }
  }

  /**
   * Delete (deactivate) a product
   * @param {string} productId - Product UUID
   * @returns {Promise<boolean>} Success status
   */
  async deleteProduct(productId) {
    try {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', productId);

      if (error) throw error;

      toast.success('✅ Product deactivated successfully!');
      return true;

    } catch (error) {
      console.error('❌ Error deleting product:', error);
      toast.error('Failed to delete product');
      return false;
    }
  }

  // ============================================================================
  // INVENTORY MANAGEMENT
  // ============================================================================

  /**
   * Update stock quantity
   * @param {string} productId - Product UUID
   * @param {number} quantity - New quantity
   * @param {string} reason - Reason for update
   * @returns {Promise<Object>} Updated inventory
   */
  async updateStock(productId, quantity, reason = 'Manual adjustment') {
    try {
      // Get current inventory
      const { data: currentInventory, error: fetchError } = await supabase
        .from('inventory')
        .select('*')
        .eq('product_id', productId)
        .single();

      if (fetchError) throw fetchError;

      const previousStock = currentInventory.current_stock;
      const quantityChange = quantity - previousStock;

      // Update inventory
      const { data: updatedInventory, error: updateError } = await supabase
        .from('inventory')
        .update({
          current_stock: quantity,
          last_restocked_at: quantity > previousStock ? new Date().toISOString() : currentInventory.last_restocked_at
        })
        .eq('product_id', productId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Log the movement
      await this.logInventoryMovement({
        product_id: productId,
        movement_type: 'adjustment',
        quantity: quantityChange,
        previous_stock: previousStock,
        new_stock: quantity,
        reference_type: 'manual_adjustment',
        notes: reason
      });

      toast.success(`✅ Stock updated to ${quantity} units`);
      return updatedInventory;

    } catch (error) {
      console.error('❌ Error updating stock:', error);
      toast.error('Failed to update stock');
      throw error;
    }
  }

  /**
   * Adjust stock after sale (for POS/Cashier portal)
   * @param {Array} items - Array of sold items [{product_id, quantity}]
   * @param {string} saleId - Sale reference ID
   * @returns {Promise<boolean>} Success status
   */
  async adjustStockAfterSale(items, saleId) {
    try {
      for (const item of items) {
        const { product_id, quantity } = item;

        // Get current inventory
        const { data: inventory, error: fetchError } = await supabase
          .from('inventory')
          .select('current_stock')
          .eq('product_id', product_id)
          .single();

        if (fetchError) throw fetchError;

        const newStock = inventory.current_stock - quantity;

        if (newStock < 0) {
          toast.error(`⚠️ Insufficient stock for product ${product_id}`);
          continue;
        }

        // Update inventory
        const { error: updateError } = await supabase
          .from('inventory')
          .update({ current_stock: newStock })
          .eq('product_id', product_id);

        if (updateError) throw updateError;

        // Log the movement
        await this.logInventoryMovement({
          product_id,
          movement_type: 'sale',
          quantity: -quantity,
          previous_stock: inventory.current_stock,
          new_stock: newStock,
          reference_type: 'sale',
          reference_id: saleId,
          reference_number: `SALE-${saleId}`,
          notes: `Stock reduced after sale`
        });
      }

      console.log(`✅ Stock adjusted for ${items.length} items`);
      return true;

    } catch (error) {
      console.error('❌ Error adjusting stock after sale:', error);
      toast.error('Failed to adjust stock after sale');
      return false;
    }
  }

  /**
   * Reserve stock (for pending orders)
   * @param {string} productId - Product UUID
   * @param {number} quantity - Quantity to reserve
   * @returns {Promise<boolean>} Success status
   */
  async reserveStock(productId, quantity) {
    try {
      const { data: inventory, error: fetchError } = await supabase
        .from('inventory')
        .select('current_stock, reserved_stock')
        .eq('product_id', productId)
        .single();

      if (fetchError) throw fetchError;

      const availableStock = inventory.current_stock - inventory.reserved_stock;

      if (availableStock < quantity) {
        toast.error('⚠️ Insufficient available stock to reserve');
        return false;
      }

      const { error: updateError } = await supabase
        .from('inventory')
        .update({
          reserved_stock: inventory.reserved_stock + quantity
        })
        .eq('product_id', productId);

      if (updateError) throw updateError;

      return true;

    } catch (error) {
      console.error('❌ Error reserving stock:', error);
      return false;
    }
  }

  /**
   * Release reserved stock
   * @param {string} productId - Product UUID
   * @param {number} quantity - Quantity to release
   * @returns {Promise<boolean>} Success status
   */
  async releaseReservedStock(productId, quantity) {
    try {
      const { data: inventory, error: fetchError } = await supabase
        .from('inventory')
        .select('reserved_stock')
        .eq('product_id', productId)
        .single();

      if (fetchError) throw fetchError;

      const newReserved = Math.max(0, inventory.reserved_stock - quantity);

      const { error: updateError } = await supabase
        .from('inventory')
        .update({ reserved_stock: newReserved })
        .eq('product_id', productId);

      if (updateError) throw updateError;

      return true;

    } catch (error) {
      console.error('❌ Error releasing reserved stock:', error);
      return false;
    }
  }

  /**
   * Get low stock products
   * @returns {Promise<Array>} Array of low stock products
   */
  async getLowStockProducts() {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          *,
          product:products(id, name, sku, selling_price, category:categories(name))
        `)
        .lte('current_stock', supabase.raw('minimum_stock'))
        .order('current_stock', { ascending: true });

      if (error) throw error;

      return data.map(item => ({
        ...item.product,
        stock: item.current_stock,
        minStock: item.minimum_stock,
        status: item.status
      }));

    } catch (error) {
      console.error('❌ Error fetching low stock products:', error);
      return [];
    }
  }

  /**
   * Get out of stock products
   * @returns {Promise<Array>} Array of out of stock products
   */
  async getOutOfStockProducts() {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          *,
          product:products(id, name, sku, selling_price, category:categories(name))
        `)
        .eq('current_stock', 0)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return data.map(item => ({
        ...item.product,
        stock: 0,
        status: 'out_of_stock'
      }));

    } catch (error) {
      console.error('❌ Error fetching out of stock products:', error);
      return [];
    }
  }

  /**
   * Get inventory statistics
   * @returns {Promise<Object>} Inventory stats
   */
  async getInventoryStats() {
    try {
      // Get total products count
      const { count: totalProducts, error: countError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (countError) throw countError;

      // Get low stock count
      const { data: lowStockData, error: lowStockError } = await supabase
        .from('inventory')
        .select('id')
        .lte('current_stock', supabase.raw('minimum_stock'));

      if (lowStockError) throw lowStockError;

      // Get out of stock count
      const { count: outOfStock, error: outStockError } = await supabase
        .from('inventory')
        .select('*', { count: 'exact', head: true })
        .eq('current_stock', 0);

      if (outStockError) throw outStockError;

      // Get total inventory value
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, cost_price, inventory(current_stock)')
        .eq('is_active', true);

      if (productsError) throw productsError;

      const totalValue = productsData.reduce((sum, product) => {
        const stock = product.inventory?.[0]?.current_stock || 0;
        return sum + (product.cost_price * stock);
      }, 0);

      return {
        totalProducts: totalProducts || 0,
        lowStockItems: lowStockData?.length || 0,
        outOfStockItems: outOfStock || 0,
        totalValue: Math.round(totalValue),
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Error fetching inventory stats:', error);
      return {
        totalProducts: 0,
        lowStockItems: 0,
        outOfStockItems: 0,
        totalValue: 0,
        lastUpdated: new Date().toISOString()
      };
    }
  }

  // ============================================================================
  // INVENTORY MOVEMENTS & LOGGING
  // ============================================================================

  /**
   * Log inventory movement
   * @param {Object} movementData - Movement details
   * @returns {Promise<Object>} Created movement record
   */
  async logInventoryMovement(movementData) {
    try {
      const { data, error } = await supabase
        .from('inventory_movements')
        .insert({
          ...movementData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        // If table doesn't exist, log warning but don't crash
        if (error.code === '404' || error.message?.includes('not found')) {
          console.warn('⚠️ inventory_movements table not found - movement logging skipped');
          return { success: false, warning: 'Table not found' };
        }
        throw error;
      }

      console.log('✅ Inventory movement logged:', data);
      return data;

    } catch (error) {
      console.warn('⚠️ Warning logging inventory movement (non-critical):', error.message);
      // Return success anyway - this is non-critical for transactions
      return { success: true, warning: 'Movement not logged' };
    }
  }

  /**
   * Get inventory movement history
   * @param {string} productId - Product UUID (optional)
   * @param {number} limit - Number of records to fetch
   * @returns {Promise<Array>} Movement history
   */
  async getMovementHistory(productId = null, limit = 50) {
    try {
      let query = supabase
        .from('inventory_movements')
        .select(`
          *,
          product:products(id, name, sku)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (productId) {
        query = query.eq('product_id', productId);
      }

      const { data, error } = await query;

      if (error) {
        // If table doesn't exist, return empty array
        if (error.code === '404' || error.message?.includes('not found')) {
          console.warn('⚠️ inventory_movements table not found');
          return [];
        }
        throw error;
      }

      return data;

    } catch (error) {
      console.warn('⚠️ Warning fetching movement history:', error.message);
      return [];
    }
  }

  // ============================================================================
  // CATEGORIES MANAGEMENT
  // ============================================================================

  /**
   * Get all categories
   * @returns {Promise<Array>} Array of categories
   */
  async getCategories() {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      return data;

    } catch (error) {
      console.error('❌ Error fetching categories:', error);
      return [];
    }
  }

  /**
   * Create a new category
   * @param {Object} categoryData - Category information
   * @returns {Promise<Object>} Created category
   */
  async createCategory(categoryData) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert(categoryData)
        .select()
        .single();

      if (error) throw error;

      toast.success('✅ Category created successfully!');
      return data;

    } catch (error) {
      console.error('❌ Error creating category:', error);
      toast.error('Failed to create category');
      throw error;
    }
  }

  // ============================================================================
  // SUPPLIERS MANAGEMENT
  // ============================================================================

  /**
   * Get all suppliers
   * @returns {Promise<Array>} Array of suppliers
   */
  async getSuppliers() {
    try {
      // Fetch suppliers from users table where role='supplier'
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'supplier')
        .order('company_name', { ascending: true });

      if (error) {
        console.error('❌ Supabase error fetching suppliers:', error);
        throw error;
      }

      console.log('✅ Fetched suppliers:', data);

      // Filter and format suppliers - show all suppliers regardless of active status for testing
      const suppliers = (data || []).map(sup => ({
        id: sup.id,
        company_name: sup.company_name || sup.full_name || sup.username || 'Unknown Supplier',
        full_name: sup.full_name,
        phone: sup.phone,
        email: sup.email,
        business_license: sup.business_license,
        category: sup.category,
        is_active: sup.is_active,
        rating: sup.rating || null
      }));

      return suppliers;

    } catch (error) {
      console.error('❌ Error fetching suppliers:', error);
      return [];
    }
  }

  /**
   * Create a new supplier
   * @param {Object} supplierData - Supplier information
   * @returns {Promise<Object>} Created supplier
   */
  async createSupplier(supplierData) {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert(supplierData)
        .select()
        .single();

      if (error) throw error;

      toast.success('✅ Supplier created successfully!');
      return data;

    } catch (error) {
      console.error('❌ Error creating supplier:', error);
      toast.error('Failed to create supplier');
      throw error;
    }
  }

  // ============================================================================
  // REAL-TIME SUBSCRIPTIONS
  // ============================================================================

  /**
   * Subscribe to inventory changes
   * @param {Function} callback - Function to call on changes
   * @returns {Object} Subscription channel
   */
  subscribeToInventoryChanges(callback) {
    const channel = supabase
      .channel('inventory_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory'
        },
        (payload) => {
          console.log('📡 Inventory change detected:', payload);
          callback(payload);
        }
      )
      .subscribe();

    this.subscribers.add(channel);
    return channel;
  }

  /**
   * Subscribe to product changes
   * @param {Function} callback - Function to call on changes
   * @returns {Object} Subscription channel
   */
  subscribeToProductChanges(callback) {
    const channel = supabase
      .channel('product_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products'
        },
        (payload) => {
          console.log('📡 Product change detected:', payload);
          callback(payload);
        }
      )
      .subscribe();

    this.subscribers.add(channel);
    return channel;
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll() {
    this.subscribers.forEach(channel => {
      supabase.removeChannel(channel);
    });
    this.subscribers.clear();
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Search products (for POS and other portals)
   * @param {string} searchTerm - Search term
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} Matching products
   */
  async searchProducts(searchTerm, limit = 20) {
    if (!searchTerm || searchTerm.length < 2) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          inventory(current_stock, available_stock, status)
        `)
        .or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%,barcode.ilike.%${searchTerm}%`)
        .eq('is_active', true)
        .limit(limit);

      if (error) throw error;

      return data.map(product => ({
        ...product,
        stock: product.inventory?.[0]?.current_stock || 0,
        available_stock: product.inventory?.[0]?.available_stock || 0,
        stockStatus: product.inventory?.[0]?.status || 'unknown'
      }));

    } catch (error) {
      console.error('❌ Error searching products:', error);
      return [];
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cached data
   * @param {string} key - Cache key
   * @returns {any} Cached data or null
   */
  getCached(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  /**
   * Set cached data
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   */
  setCached(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
}

// Create and export a singleton instance
const inventoryService = new InventorySupabaseService();

export default inventoryService;

// Named exports for specific functions
export {
  inventoryService,
  InventorySupabaseService
};
