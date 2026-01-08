import { apiService } from './apiService';

export const productService = {
  // Get all products with filtering
  getProducts: async (filters = {}) => {
    try {
      const queryFilters = {
        is_active: true, // Only show active products for customers
      };

      // Apply search filter
      if (filters.search) {
        queryFilters.name_like = filters.search;
      }

      // Apply category filter
      if (filters.category) {
        queryFilters.category_id = filters.category;
      }

      // Apply price range filters
      if (filters.minPrice) {
        queryFilters.selling_price_gte = filters.minPrice;
      }
      if (filters.maxPrice) {
        queryFilters.selling_price_lte = filters.maxPrice;
      }

      const options = {
        filters: queryFilters,
        select: `
          id,
          name,
          description,
          sku,
          selling_price,
          cost_price,
          category_id,
          brand,
          weight,
          dimensions,
          is_active,
          created_at,
          categories (
            id,
            name,
            description
          ),
          product_images (
            id,
            image_url,
            alt_text,
            is_primary,
            sort_order
          ),
          inventory (
            current_stock,
            reserved_stock,
            available_stock
          )
        `,
        page: filters.page || 1,
        limit: filters.limit || 20,
        orderBy: { column: 'created_at', ascending: false }
      };

      const result = await apiService.get('products', options);
      
      return {
        products: result.data || [],
        pagination: {
          current_page: result.page,
          per_page: result.limit,
          total: result.count,
          total_pages: Math.ceil((result.count || 0) / (result.limit || 20))
        }
      };
    } catch (error) {
      throw error;
    }
  },

  // Get product by ID
  getProduct: async (id) => {
    try {
      const product = await apiService.getById('products', id, {
        select: `
          *,
          categories (
            id,
            name,
            description,
            parent_id
          ),
          product_images (
            id,
            image_url,
            alt_text,
            is_primary,
            sort_order
          ),
          product_variants (
            id,
            variant_name,
            variant_value,
            price_adjustment,
            stock_quantity,
            is_active
          ),
          inventory (
            current_stock,
            reserved_stock,
            available_stock,
            reorder_level,
            max_stock_level
          )
        `
      });

      if (!product) {
        throw { message: 'Product not found', code: 404 };
      }

      return product;
    } catch (error) {
      throw error;
    }
  },

  // Get product categories
  getCategories: async () => {
    try {
      const categories = await apiService.get('categories', {
        filters: { is_active: true },
        select: 'id, name, description, parent_id, sort_order',
        orderBy: { column: 'sort_order', ascending: true }
      });

      return categories.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Search products
  searchProducts: async (query) => {
    try {
      const products = await apiService.get('products', {
        filters: {
          name_like: query,
          is_active: true
        },
        select: `
          id,
          name,
          description,
          sku,
          selling_price,
          category_id,
          brand,
          categories (
            id,
            name
          ),
          product_images (
            id,
            image_url,
            alt_text,
            is_primary
          ),
          inventory (
            current_stock,
            available_stock
          )
        `,
        limit: 50,
        orderBy: { column: 'name', ascending: true }
      });

      return products.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Get featured products
  getFeaturedProducts: async (limit = 8) => {
    try {
      const products = await apiService.get('products', {
        filters: {
          is_active: true,
          is_featured: true
        },
        select: `
          id,
          name,
          description,
          sku,
          selling_price,
          cost_price,
          category_id,
          brand,
          is_featured,
          categories (
            id,
            name
          ),
          product_images (
            id,
            image_url,
            alt_text,
            is_primary
          ),
          inventory (
            current_stock,
            available_stock
          )
        `,
        limit: limit,
        orderBy: { column: 'created_at', ascending: false }
      });

      return products.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Get products by category
  getProductsByCategory: async (categoryId, limit = 20) => {
    try {
      const products = await apiService.get('products', {
        filters: {
          category_id: categoryId,
          is_active: true
        },
        select: `
          id,
          name,
          description,
          sku,
          selling_price,
          category_id,
          brand,
          categories (
            id,
            name
          ),
          product_images (
            id,
            image_url,
            alt_text,
            is_primary
          ),
          inventory (
            current_stock,
            available_stock
          )
        `,
        limit: limit,
        orderBy: { column: 'name', ascending: true }
      });

      return products.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Get product variants
  getProductVariants: async (productId) => {
    try {
      const variants = await apiService.get('product_variants', {
        filters: {
          product_id: productId,
          is_active: true
        },
        orderBy: { column: 'variant_name', ascending: true }
      });

      return variants.data || [];
    } catch (error) {
      throw error;
    }
  },

  // Get product stock information
  getProductStock: async (productId) => {
    try {
      const inventory = await apiService.get('inventory', {
        filters: { product_id: productId },
        limit: 1
      });

      if (!inventory.data || inventory.data.length === 0) {
        return {
          current_stock: 0,
          available_stock: 0,
          reserved_stock: 0,
          is_available: false
        };
      }

      const stock = inventory.data[0];
      return {
        ...stock,
        is_available: stock.available_stock > 0
      };
    } catch (error) {
      throw error;
    }
  },

  // Check product availability
  checkAvailability: async (productId, quantity = 1) => {
    try {
      const stock = await this.getProductStock(productId);
      
      return {
        is_available: stock.available_stock >= quantity,
        available_quantity: stock.available_stock,
        requested_quantity: quantity
      };
    } catch (error) {
      throw error;
    }
  }
};

export default productService;




