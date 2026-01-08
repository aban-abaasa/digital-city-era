// Simple cart service for managing shopping cart with localStorage persistence

const CART_STORAGE_KEY = 'supermarket_cart';

export const cartService = {
  // Get cart from localStorage or database
  getCart: async () => {
    try {
      const user = await getCurrentUser();
      
      if (user) {
        // Get cart from database for authenticated users
        return await cartService.getServerCart(user.id);
      } else {
        // Get cart from localStorage for guest users
        return cartService.getLocalCart();
      }
    } catch (error) {
      console.error('Error loading cart:', error);
      return cartService.getLocalCart(); // Fallback to local cart
    }
  },

  // Get cart from localStorage
  getLocalCart: () => {
    try {
      const cartData = localStorage.getItem(CART_STORAGE_KEY);
      const expiryTime = localStorage.getItem(CART_EXPIRY_KEY);
      
      if (!cartData || !expiryTime) {
        return [];
      }
      
      // Check if cart has expired
      if (new Date().getTime() > parseInt(expiryTime)) {
        cartService.clearLocalCart();
        return [];
      }
      
      return JSON.parse(cartData);
    } catch (error) {
      console.error('Error loading local cart:', error);
      return [];
    }
  },

  // Get cart from database for authenticated users
  getServerCart: async (userId) => {
    try {
      // For now, we'll simulate server cart with localStorage
      // In a full implementation, you might store cart items in a 'cart_items' table
      const localCart = cartService.getLocalCart();
      
      // Validate cart items against current product data
      const validatedCart = await cartService.validateCartItems(localCart);
      
      return validatedCart;
    } catch (error) {
      console.error('Error loading server cart:', error);
      return [];
    }
  },

  // Validate cart items against current product data
  validateCartItems: async (cartItems) => {
    if (!cartItems || cartItems.length === 0) {
      return [];
    }

    try {
      const validatedItems = [];
      
      for (const item of cartItems) {
        // Get current product data
        const product = await apiService.getById('products', item.id, {
          select: `
            id,
            name,
            selling_price,
            is_active,
            inventory (
              current_stock,
              available_stock
            )
          `
        });

        if (product && product.is_active) {
          // Check stock availability
          const availableStock = product.inventory?.[0]?.available_stock || 0;
          const requestedQuantity = item.quantity;
          
          if (availableStock >= requestedQuantity) {
            validatedItems.push({
              ...item,
              name: product.name,
              price: product.selling_price,
              availableStock: availableStock,
              isValid: true
            });
          } else if (availableStock > 0) {
            // Partial stock available
            validatedItems.push({
              ...item,
              quantity: availableStock,
              name: product.name,
              price: product.selling_price,
              availableStock: availableStock,
              isValid: true,
              hasStockIssue: true,
              originalQuantity: requestedQuantity
            });
          }
          // If no stock available, don't add to validated items
        }
        // If product is inactive or not found, don't add to validated items
      }

      return validatedItems;
    } catch (error) {
      console.error('Error validating cart items:', error);
      return cartItems; // Return original cart if validation fails
    }
  },

  // Save cart to localStorage
  saveLocalCart: (cart) => {
    try {
      const expiryTime = new Date().getTime() + (CART_EXPIRY_HOURS * 60 * 60 * 1000);
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      localStorage.setItem(CART_EXPIRY_KEY, expiryTime.toString());
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  },

  // Save cart to database for authenticated users
  saveServerCart: async (userId, cart) => {
    try {
      // For now, we'll still use localStorage
      // In a full implementation, you would save to a 'cart_items' table
      cartService.saveLocalCart(cart);
      return cart;
    } catch (error) {
      console.error('Error saving server cart:', error);
      throw error;
    }
  },

  // Add item to cart
  addItem: async (product, quantity = 1) => {
    try {
      const cart = await cartService.getCart();
      const existingItemIndex = cart.findIndex(item => item.id === product.id);
      
      if (existingItemIndex >= 0) {
        // Update existing item quantity
        cart[existingItemIndex].quantity += quantity;
      } else {
        // Add new item
        cart.push({
          id: product.id,
          name: product.name,
          price: product.selling_price,
          image: product.product_images?.[0]?.image_url || null,
          sku: product.sku,
          quantity,
          addedAt: new Date().toISOString(),
        });
      }
      
      const user = await getCurrentUser();
      if (user) {
        await cartService.saveServerCart(user.id, cart);
      } else {
        cartService.saveLocalCart(cart);
      }
      
      return cart;
    } catch (error) {
      console.error('Error adding item to cart:', error);
      throw error;
    }
  },

  // Remove item from cart
  removeItem: async (productId) => {
    try {
      const cart = await cartService.getCart();
      const updatedCart = cart.filter(item => item.id !== productId);
      
      const user = await getCurrentUser();
      if (user) {
        await cartService.saveServerCart(user.id, updatedCart);
      } else {
        cartService.saveLocalCart(updatedCart);
      }
      
      return updatedCart;
    } catch (error) {
      console.error('Error removing item from cart:', error);
      throw error;
    }
  },

  // Update item quantity
  updateQuantity: async (productId, quantity) => {
    try {
      if (quantity <= 0) {
        return await cartService.removeItem(productId);
      }
      
      const cart = await cartService.getCart();
      const itemIndex = cart.findIndex(item => item.id === productId);
      
      if (itemIndex >= 0) {
        cart[itemIndex].quantity = quantity;
        
        const user = await getCurrentUser();
        if (user) {
          await cartService.saveServerCart(user.id, cart);
        } else {
          cartService.saveLocalCart(cart);
        }
      }
      
      return cart;
    } catch (error) {
      console.error('Error updating item quantity:', error);
      throw error;
    }
  },

  // Clear entire cart
  clearCart: async () => {
    try {
      const user = await getCurrentUser();
      if (user) {
        await cartService.saveServerCart(user.id, []);
      }
      cartService.clearLocalCart();
      return [];
    } catch (error) {
      console.error('Error clearing cart:', error);
      cartService.clearLocalCart();
      return [];
    }
  },

  // Clear local cart
  clearLocalCart: () => {
    localStorage.removeItem(CART_STORAGE_KEY);
    localStorage.removeItem(CART_EXPIRY_KEY);
    return [];
  },

  // Get cart totals with Uganda-specific calculations
  getCartTotals: (cart) => {
    const subtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    const taxRate = 0.18; // 18% VAT in Uganda
    const tax = subtotal * taxRate;
    const deliveryFee = subtotal >= 100000 ? 0 : 5000; // Free delivery over 100K UGX
    const total = subtotal + tax + deliveryFee;
    
    return {
      subtotal: Math.round(subtotal),
      tax: Math.round(tax),
      deliveryFee: Math.round(deliveryFee),
      total: Math.round(total),
      itemCount: cart.reduce((total, item) => total + item.quantity, 0),
      currency: 'UGX'
    };
  },

  // Get cart item count
  getItemCount: async () => {
    try {
      const cart = await cartService.getCart();
      return cart.reduce((total, item) => total + item.quantity, 0);
    } catch (error) {
      console.error('Error getting item count:', error);
      return 0;
    }
  },

  // Check if product is in cart
  isInCart: async (productId) => {
    try {
      const cart = await cartService.getCart();
      return cart.some(item => item.id === productId);
    } catch (error) {
      console.error('Error checking if item is in cart:', error);
      return false;
    }
  },

  // Get cart item by product ID
  getCartItem: async (productId) => {
    try {
      const cart = await cartService.getCart();
      return cart.find(item => item.id === productId);
    } catch (error) {
      console.error('Error getting cart item:', error);
      return null;
    }
  },

  // Merge carts (useful when user logs in)
  mergeCarts: async (serverCart, localCart) => {
    try {
      const mergedCart = [...serverCart];
      
      localCart.forEach(localItem => {
        const existingIndex = mergedCart.findIndex(item => item.id === localItem.id);
        if (existingIndex >= 0) {
          // Take the higher quantity
          mergedCart[existingIndex].quantity = Math.max(
            mergedCart[existingIndex].quantity,
            localItem.quantity
          );
        } else {
          mergedCart.push(localItem);
        }
      });
      
      const user = await getCurrentUser();
      if (user) {
        await cartService.saveServerCart(user.id, mergedCart);
      } else {
        cartService.saveLocalCart(mergedCart);
      }
      
      return mergedCart;
    } catch (error) {
      console.error('Error merging carts:', error);
      return localCart;
    }
  },

  // Validate cart items (check stock, prices, etc.)
  validateCart: async (cart) => {
    try {
      const validatedCart = await cartService.validateCartItems(cart);
      const errors = [];
      
      cart.forEach(originalItem => {
        const validatedItem = validatedCart.find(item => item.id === originalItem.id);
        
        if (!validatedItem) {
          errors.push({
            type: 'unavailable',
            productId: originalItem.id,
            productName: originalItem.name,
            message: 'Product is no longer available'
          });
        } else if (validatedItem.hasStockIssue) {
          errors.push({
            type: 'stock_issue',
            productId: originalItem.id,
            productName: originalItem.name,
            requestedQuantity: validatedItem.originalQuantity,
            availableQuantity: validatedItem.quantity,
            message: `Only ${validatedItem.quantity} items available, reduced from ${validatedItem.originalQuantity}`
          });
        }
      });
      
      return {
        valid: errors.length === 0,
        cart: validatedCart,
        errors: errors,
      };
    } catch (error) {
      console.error('Error validating cart:', error);
      return {
        valid: false,
        cart: cart,
        errors: [{
          type: 'validation_error',
          message: 'Unable to validate cart items'
        }]
      };
    }
  },

  // Apply discount code
  applyDiscount: (cart, discountCode) => {
    // Mock discount codes
    const discountCodes = {
      'SAVE10': { type: 'percentage', value: 10, minAmount: 50000 },
      'NEWUSER': { type: 'fixed', value: 10000, minAmount: 20000 },
      'FREESHIP': { type: 'free_shipping', value: 0, minAmount: 0 }
    };
    
    const discount = discountCodes[discountCode.toUpperCase()];
    if (!discount) {
      return {
        success: false,
        message: 'Invalid discount code'
      };
    }
    
    const totals = cartService.getCartTotals(cart);
    
    if (totals.subtotal < discount.minAmount) {
      return {
        success: false,
        message: `Minimum order amount of UGX ${discount.minAmount.toLocaleString()} required`
      };
    }
    
    let discountAmount = 0;
    let freeShipping = false;
    
    switch (discount.type) {
      case 'percentage':
        discountAmount = Math.round(totals.subtotal * (discount.value / 100));
        break;
      case 'fixed':
        discountAmount = discount.value;
        break;
      case 'free_shipping':
        freeShipping = true;
        discountAmount = totals.deliveryFee;
        break;
    }
    
    return {
      success: true,
      discount: {
        code: discountCode,
        type: discount.type,
        amount: discountAmount,
        freeShipping: freeShipping
      }
    };
  },

  // Estimate delivery
  estimateDelivery: async (address) => {
    try {
      // Mock delivery estimation based on address
      const baseDeliveryDays = 1;
      const estimatedDate = new Date();
      estimatedDate.setDate(estimatedDate.getDate() + baseDeliveryDays);
      
      return {
        estimated_date: estimatedDate.toISOString().split('T')[0],
        estimated_days: baseDeliveryDays,
        shipping_cost: 5000, // UGX
        shipping_methods: [
          {
            name: 'Standard Delivery',
            cost: 5000,
            days: 1,
            description: 'Delivery within Kampala'
          },
          {
            name: 'Express Delivery',
            cost: 10000,
            days: 0,
            description: 'Same day delivery'
          }
        ]
      };
    } catch (error) {
      console.error('Error estimating delivery:', error);
      throw error;
    }
  }
};

export default cartService;