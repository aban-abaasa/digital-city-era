import { supabase } from './supabase';

/**
 * Inventory Service
 * Handles all database operations for inventory management
 */

// ============================================================================
// PRODUCTS
// ============================================================================

export const getProducts = async () => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name),
        supplier:suppliers(id, company_name),
        inventory(
          current_stock,
          available_stock,
          minimum_stock,
          reorder_point,
          status,
          location
        )
      `)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
};

export const getProductById = async (id) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name),
        supplier:suppliers(id, company_name, contact_person, phone, email),
        inventory(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching product:', error);
    throw error;
  }
};

export const searchProducts = async (query) => {
  try {
    const { data, error} = await supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name),
        inventory(current_stock, status)
      `)
      .or(`name.ilike.%${query}%,sku.ilike.%${query}%,barcode.ilike.%${query}%`)
      .eq('is_active', true)
      .limit(50);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error searching products:', error);
    throw error;
  }
};

export const getLowStockProducts = async () => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        inventory!inner(current_stock, minimum_stock, status)
      `)
      .eq('is_active', true)
      .eq('inventory.status', 'low_stock')
      .order('name');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    throw error;
  }
};

// ============================================================================
// INVENTORY
// ============================================================================

export const getInventory = async () => {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select(`
        *,
        product:products(
          id,
          sku,
          name,
          selling_price,
          category:categories(name)
        )
      `)
      .order('product(name)');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching inventory:', error);
    throw error;
  }
};

export const updateInventoryStock = async (productId, quantity, movementType = 'manual_adjust', notes = '') => {
  try {
    // Get current inventory
    const { data: inventory, error: invError } = await supabase
      .from('inventory')
      .select('*')
      .eq('product_id', productId)
      .single();

    if (invError) throw invError;

    const previousStock = inventory.current_stock;
    const newStock = previousStock + quantity;

    if (newStock < 0) {
      throw new Error('Insufficient stock');
    }

    // Update inventory
    const { error: updateError } = await supabase
      .from('inventory')
      .update({ 
        current_stock: newStock,
        last_restocked_at: new Date().toISOString()
      })
      .eq('product_id', productId);

    if (updateError) throw updateError;

    // Log movement
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error: movementError } = await supabase
      .from('inventory_movements')
      .insert({
        product_id: productId,
        movement_type: movementType,
        quantity: quantity,
        previous_stock: previousStock,
        new_stock: newStock,
        created_by: user?.id,
        notes: notes
      });

    if (movementError) throw movementError;

    return { success: true, newStock };
  } catch (error) {
    console.error('Error updating inventory:', error);
    throw error;
  }
};

// ============================================================================
// CATEGORIES
// ============================================================================

export const getCategories = async () => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
};

// ============================================================================
// SUPPLIERS
// ============================================================================

export const getSuppliers = async () => {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('is_active', true)
      .order('company_name');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    throw error;
  }
};

export const getSupplierById = async (id) => {
  try {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching supplier:', error);
    throw error;
  }
};

// ============================================================================
// INVENTORY MOVEMENTS
// ============================================================================

export const getInventoryMovements = async (productId = null, limit = 100) => {
  try {
    let query = supabase
      .from('inventory_movements')
      .select(`
        *,
        product:products(id, name, sku),
        creator:created_by(full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching inventory movements:', error);
    throw error;
  }
};

// ============================================================================
// PURCHASE ORDERS
// ============================================================================

export const getPurchaseOrders = async (status = null) => {
  try {
    let query = supabase
      .from('purchase_orders')
      .select(`
        *,
        supplier:suppliers(id, company_name, contact_person, phone),
        items:purchase_order_items(
          *,
          product:products(id, name, sku)
        )
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    throw error;
  }
};

export const createPurchaseOrder = async (orderData) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('purchase_orders')
      .insert({
        ...orderData,
        created_by: user?.id
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating purchase order:', error);
    throw error;
  }
};

// ============================================================================
// DASHBOARD STATS
// ============================================================================

export const getDashboardStats = async () => {
  try {
    // Get total products
    const { count: totalProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Get low stock count
    const { count: lowStockCount } = await supabase
      .from('inventory')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'low_stock');

    // Get out of stock count
    const { count: outOfStockCount } = await supabase
      .from('inventory')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'out_of_stock');

    // Get total inventory value
    const { data: inventoryValue } = await supabase
      .from('inventory')
      .select(`
        current_stock,
        product:products(cost_price, selling_price)
      `);

    const totalValue = inventoryValue?.reduce((sum, item) => {
      return sum + (item.current_stock * (item.product?.cost_price || 0));
    }, 0) || 0;

    const totalRetailValue = inventoryValue?.reduce((sum, item) => {
      return sum + (item.current_stock * (item.product?.selling_price || 0));
    }, 0) || 0;

    return {
      totalProducts: totalProducts || 0,
      lowStockCount: lowStockCount || 0,
      outOfStockCount: outOfStockCount || 0,
      totalValue: totalValue,
      totalRetailValue: totalRetailValue
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    throw error;
  }
};

export default {
  getProducts,
  getProductById,
  searchProducts,
  getLowStockProducts,
  getInventory,
  updateInventoryStock,
  getCategories,
  getSuppliers,
  getSupplierById,
  getInventoryMovements,
  getPurchaseOrders,
  createPurchaseOrder,
  getDashboardStats
};
