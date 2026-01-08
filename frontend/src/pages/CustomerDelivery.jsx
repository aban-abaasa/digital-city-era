import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'react-toastify';
import '../styles/animations.css';
import { 
  FiTruck, FiMapPin, FiClock, FiStar, FiHeart, FiShoppingCart, FiSearch,
  FiFilter, FiGrid, FiList, FiPlus, FiMinus, FiCalendar, FiUser, FiPhone,
  FiMail, FiHome, FiPackage, FiCheckCircle, FiXCircle, FiNavigation,
  FiCreditCard, FiShield, FiZap, FiAward, FiTrendingUp, FiEye, FiMenu,
  FiX, FiRefreshCw
} from 'react-icons/fi';
import DeliveryOrderModal from '../components/DeliveryOrderModal';
import ProductCard from '../components/ProductCard';
import productService from '../services/productService';
import orderService from '../services/orderService';
import cartService from '../services/cartService';

const CustomerDelivery = () => {
  // State management
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [viewMode, setViewMode] = useState('grid');
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState([0, 2000]);
  const [selectedRating, setSelectedRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [wishlist, setWishlist] = useState(new Set());
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);
  const [deliveryInfo, setDeliveryInfo] = useState({
    address: '',
    city: '',
    postalCode: '',
    phone: '',
    email: '',
    deliveryDate: '',
    deliveryTime: '',
    specialInstructions: ''
  });

  // Load products and categories from API
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Load products and categories in parallel
        const [productsResponse, categoriesResponse] = await Promise.all([
          productService.getProducts({ limit: 50 }),
          productService.getCategories()
        ]);
        
        setProducts(productsResponse.products || []);
        setFilteredProducts(productsResponse.products || []);
        setCategories(categoriesResponse.categories || []);
        
        // If no products from API, use mock data
        if (!productsResponse.products || productsResponse.products.length === 0) {
          console.log('No products from API, using mock data');
          toast.info('🛍️ Showing demo products - Add your own products in the admin panel!', {
            position: "top-center",
            autoClose: 5000,
          });
          const mockProducts = [
            // Groceries & Fresh Produce
            {
              _id: '1',
              name: 'Fresh Organic Bananas',
              description: 'Premium organic bananas, perfect for healthy snacking',
              category: 'produce',
              brand: 'Fresh Farm',
              price: 2.99,
              originalPrice: 3.49,
              stock: 150,
              rating: 4.5,
              reviews: 128,
              image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400',
              tags: ['organic', 'fresh', 'healthy', 'bananas'],
              deliveryAvailable: true,
              deliveryTime: 'Same day',
              freeDelivery: true
            },
            {
              _id: '2',
              name: 'Whole Milk 1 Gallon',
              description: 'Fresh whole milk, perfect for families',
              category: 'dairy',
              brand: 'Dairy Fresh',
              price: 4.99,
              originalPrice: 5.49,
              stock: 80,
              rating: 4.3,
              reviews: 95,
              image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400',
              tags: ['dairy', 'fresh', 'nutritious', 'milk'],
              deliveryAvailable: true,
              deliveryTime: 'Same day',
              freeDelivery: true
            },
            {
              _id: '3',
              name: 'Coca Cola Classic 12-Pack',
              description: 'Classic Coca Cola, 12 pack cans',
              category: 'beverages',
              brand: 'Coca Cola',
              price: 8.99,
              originalPrice: 9.99,
              stock: 200,
              rating: 4.7,
              reviews: 256,
              image: 'https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=400',
              tags: ['soda', 'classic', 'refreshing', 'cola'],
              deliveryAvailable: true,
              deliveryTime: 'Same day',
              freeDelivery: false
            },
            {
              _id: '4',
              name: 'Fresh Bread Loaf',
              description: 'Artisan bread, baked fresh daily',
              category: 'bakery',
              brand: 'Bakery Fresh',
              price: 3.49,
              originalPrice: 3.99,
              stock: 45,
              rating: 4.6,
              reviews: 87,
              image: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=400',
              tags: ['bread', 'fresh', 'artisan', 'bakery'],
              deliveryAvailable: true,
              deliveryTime: 'Same day',
              freeDelivery: true
            },
            {
              _id: '5',
              name: 'Organic Chicken Breast',
              description: 'Fresh organic chicken breast, perfect for healthy meals',
              category: 'meat',
              brand: 'Organic Farms',
              price: 12.99,
              originalPrice: 14.99,
              stock: 25,
              rating: 4.8,
              reviews: 142,
              image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400',
              tags: ['chicken', 'organic', 'protein', 'fresh'],
              deliveryAvailable: true,
              deliveryTime: 'Same day',
              freeDelivery: false
            },
            // Electronics
            {
              _id: '6',
              name: 'iPhone 15 Pro',
              description: 'Latest iPhone with advanced camera system',
              category: 'electronics',
              brand: 'Apple',
              price: 999.99,
              originalPrice: 1099.99,
              stock: 15,
              rating: 4.9,
              reviews: 342,
              image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400',
              tags: ['iphone', 'smartphone', 'apple', 'premium'],
              deliveryAvailable: true,
              deliveryTime: '1-2 days',
              freeDelivery: true
            },
            {
              _id: '7',
              name: 'Samsung Galaxy S24',
              description: 'Powerful Android smartphone with amazing camera',
              category: 'electronics',
              brand: 'Samsung',
              price: 799.99,
              originalPrice: 899.99,
              stock: 22,
              rating: 4.7,
              reviews: 198,
              image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400',
              tags: ['samsung', 'android', 'smartphone', 'galaxy'],
              deliveryAvailable: true,
              deliveryTime: '1-2 days',
              freeDelivery: true
            },
            {
              _id: '8',
              name: 'MacBook Air M3',
              description: 'Ultra-thin laptop with M3 chip for ultimate performance',
              category: 'electronics',
              brand: 'Apple',
              price: 1299.99,
              originalPrice: 1399.99,
              stock: 8,
              rating: 4.8,
              reviews: 156,
              image: 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=400',
              tags: ['macbook', 'laptop', 'apple', 'm3'],
              deliveryAvailable: true,
              deliveryTime: '2-3 days',
              freeDelivery: true
            },
            {
              _id: '9',
              name: 'Sony WH-1000XM5 Headphones',
              description: 'Premium noise-cancelling wireless headphones',
              category: 'electronics',
              brand: 'Sony',
              price: 399.99,
              originalPrice: 449.99,
              stock: 18,
              rating: 4.6,
              reviews: 234,
              image: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400',
              tags: ['headphones', 'wireless', 'noise-cancelling', 'sony'],
              deliveryAvailable: true,
              deliveryTime: '1-2 days',
              freeDelivery: true
            },
            // Household Items
            {
              _id: '10',
              name: 'Tide Laundry Detergent',
              description: 'Powerful laundry detergent for all fabric types',
              category: 'household',
              brand: 'Tide',
              price: 12.99,
              originalPrice: 14.99,
              stock: 65,
              rating: 4.4,
              reviews: 189,
              image: 'https://images.unsplash.com/photo-1581578731548-c6a0c3f2fcc0?w=400',
              tags: ['detergent', 'laundry', 'cleaning', 'tide'],
              deliveryAvailable: true,
              deliveryTime: 'Same day',
              freeDelivery: false
            },
            {
              _id: '11',
              name: 'Bounty Paper Towels',
              description: 'Super absorbent paper towels, 12 rolls',
              category: 'household',
              brand: 'Bounty',
              price: 18.99,
              originalPrice: 21.99,
              stock: 42,
              rating: 4.5,
              reviews: 167,
              image: 'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=400',
              tags: ['paper towels', 'absorbent', 'cleaning', 'bounty'],
              deliveryAvailable: true,
              deliveryTime: 'Same day',
              freeDelivery: false
            },
            {
              _id: '12',
              name: 'Dawn Dish Soap',
              description: 'Powerful dish soap that cuts through grease',
              category: 'household',
              brand: 'Dawn',
              price: 4.99,
              originalPrice: 5.99,
              stock: 78,
              rating: 4.6,
              reviews: 203,
              image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
              tags: ['dish soap', 'cleaning', 'grease-cutting', 'dawn'],
              deliveryAvailable: true,
              deliveryTime: 'Same day',
              freeDelivery: true
            },
            // Health & Beauty
            {
              _id: '13',
              name: 'Vitamin D3 Supplements',
              description: 'High-quality Vitamin D3 for immune support',
              category: 'health',
              brand: 'Nature Made',
              price: 19.99,
              originalPrice: 24.99,
              stock: 35,
              rating: 4.7,
              reviews: 145,
              image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400',
              tags: ['vitamins', 'health', 'supplements', 'immune'],
              deliveryAvailable: true,
              deliveryTime: 'Same day',
              freeDelivery: true
            },
            {
              _id: '14',
              name: 'Cetaphil Gentle Cleanser',
              description: 'Gentle facial cleanser for all skin types',
              category: 'health',
              brand: 'Cetaphil',
              price: 11.99,
              originalPrice: 13.99,
              stock: 28,
              rating: 4.5,
              reviews: 98,
              image: 'https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=400',
              tags: ['skincare', 'cleanser', 'gentle', 'cetaphil'],
              deliveryAvailable: true,
              deliveryTime: 'Same day',
              freeDelivery: true
            },
            // Snacks
            {
              _id: '15',
              name: 'Lay\'s Classic Potato Chips',
              description: 'Crispy classic potato chips, family size',
              category: 'snacks',
              brand: 'Lay\'s',
              price: 4.49,
              originalPrice: 4.99,
              stock: 120,
              rating: 4.3,
              reviews: 276,
              image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400',
              tags: ['chips', 'snacks', 'potato', 'lays'],
              deliveryAvailable: true,
              deliveryTime: 'Same day',
              freeDelivery: true
            },
            {
              _id: '16',
              name: 'Oreo Cookies Family Pack',
              description: 'Classic chocolate sandwich cookies',
              category: 'snacks',
              brand: 'Oreo',
              price: 5.99,
              originalPrice: 6.99,
              stock: 85,
              rating: 4.6,
              reviews: 312,
              image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400',
              tags: ['cookies', 'chocolate', 'oreo', 'snacks'],
              deliveryAvailable: true,
              deliveryTime: 'Same day',
              freeDelivery: true
            }
          ];
          
          setProducts(mockProducts);
          setFilteredProducts(mockProducts);
        }
        
        // Load cart from localStorage
        const savedCart = cartService.getCart();
        setCart(savedCart);
        
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load products. Please try again later.');
        toast.error('Failed to load products. Please try again later.');
        
        // Fallback to comprehensive mock data if API fails
        toast.info('🛍️ Showing demo products - Add your own products in the admin panel!', {
          position: "top-center",
          autoClose: 5000,
        });
        const mockProducts = [
          // Groceries & Fresh Produce
          {
            _id: '1',
            name: 'Fresh Organic Bananas',
            description: 'Premium organic bananas, perfect for healthy snacking',
            category: 'produce',
            brand: 'Fresh Farm',
            price: 2.99,
            originalPrice: 3.49,
            stock: 150,
            rating: 4.5,
            reviews: 128,
            image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400',
            tags: ['organic', 'fresh', 'healthy', 'bananas'],
            deliveryAvailable: true,
            deliveryTime: 'Same day',
            freeDelivery: true
          },
          {
            _id: '2',
            name: 'Whole Milk 1 Gallon',
            description: 'Fresh whole milk, perfect for families',
            category: 'dairy',
            brand: 'Dairy Fresh',
            price: 4.99,
            originalPrice: 5.49,
            stock: 80,
            rating: 4.3,
            reviews: 95,
            image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400',
            tags: ['dairy', 'fresh', 'nutritious', 'milk'],
            deliveryAvailable: true,
            deliveryTime: 'Same day',
            freeDelivery: true
          },
          {
            _id: '3',
            name: 'Coca Cola Classic 12-Pack',
            description: 'Classic Coca Cola, 12 pack cans',
            category: 'beverages',
            brand: 'Coca Cola',
            price: 8.99,
            originalPrice: 9.99,
            stock: 200,
            rating: 4.7,
            reviews: 256,
            image: 'https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=400',
            tags: ['soda', 'classic', 'refreshing', 'cola'],
            deliveryAvailable: true,
            deliveryTime: 'Same day',
            freeDelivery: false
          },
          {
            _id: '4',
            name: 'Fresh Bread Loaf',
            description: 'Artisan bread, baked fresh daily',
            category: 'bakery',
            brand: 'Bakery Fresh',
            price: 3.49,
            originalPrice: 3.99,
            stock: 45,
            rating: 4.6,
            reviews: 87,
            image: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=400',
            tags: ['bread', 'fresh', 'artisan', 'bakery'],
            deliveryAvailable: true,
            deliveryTime: 'Same day',
            freeDelivery: true
          },
          {
            _id: '5',
            name: 'Organic Chicken Breast',
            description: 'Fresh organic chicken breast, perfect for healthy meals',
            category: 'meat',
            brand: 'Organic Farms',
            price: 12.99,
            originalPrice: 14.99,
            stock: 25,
            rating: 4.8,
            reviews: 142,
            image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400',
            tags: ['chicken', 'organic', 'protein', 'fresh'],
            deliveryAvailable: true,
            deliveryTime: 'Same day',
            freeDelivery: false
          },
          // Electronics
          {
            _id: '6',
            name: 'iPhone 15 Pro',
            description: 'Latest iPhone with advanced camera system',
            category: 'electronics',
            brand: 'Apple',
            price: 999.99,
            originalPrice: 1099.99,
            stock: 15,
            rating: 4.9,
            reviews: 342,
            image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400',
            tags: ['iphone', 'smartphone', 'apple', 'premium'],
            deliveryAvailable: true,
            deliveryTime: '1-2 days',
            freeDelivery: true
          },
          {
            _id: '7',
            name: 'Samsung Galaxy S24',
            description: 'Powerful Android smartphone with amazing camera',
            category: 'electronics',
            brand: 'Samsung',
            price: 799.99,
            originalPrice: 899.99,
            stock: 22,
            rating: 4.7,
            reviews: 198,
            image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400',
            tags: ['samsung', 'android', 'smartphone', 'galaxy'],
            deliveryAvailable: true,
            deliveryTime: '1-2 days',
            freeDelivery: true
          },
          {
            _id: '8',
            name: 'MacBook Air M3',
            description: 'Ultra-thin laptop with M3 chip for ultimate performance',
            category: 'electronics',
            brand: 'Apple',
            price: 1299.99,
            originalPrice: 1399.99,
            stock: 8,
            rating: 4.8,
            reviews: 156,
            image: 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=400',
            tags: ['macbook', 'laptop', 'apple', 'm3'],
            deliveryAvailable: true,
            deliveryTime: '2-3 days',
            freeDelivery: true
          },
          {
            _id: '9',
            name: 'Sony WH-1000XM5 Headphones',
            description: 'Premium noise-cancelling wireless headphones',
            category: 'electronics',
            brand: 'Sony',
            price: 399.99,
            originalPrice: 449.99,
            stock: 18,
            rating: 4.6,
            reviews: 234,
            image: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400',
            tags: ['headphones', 'wireless', 'noise-cancelling', 'sony'],
            deliveryAvailable: true,
            deliveryTime: '1-2 days',
            freeDelivery: true
          },
          // Household Items
          {
            _id: '10',
            name: 'Tide Laundry Detergent',
            description: 'Powerful laundry detergent for all fabric types',
            category: 'household',
            brand: 'Tide',
            price: 12.99,
            originalPrice: 14.99,
            stock: 65,
            rating: 4.4,
            reviews: 189,
            image: 'https://images.unsplash.com/photo-1581578731548-c6a0c3f2fcc0?w=400',
            tags: ['detergent', 'laundry', 'cleaning', 'tide'],
            deliveryAvailable: true,
            deliveryTime: 'Same day',
            freeDelivery: false
          },
          {
            _id: '11',
            name: 'Bounty Paper Towels',
            description: 'Super absorbent paper towels, 12 rolls',
            category: 'household',
            brand: 'Bounty',
            price: 18.99,
            originalPrice: 21.99,
            stock: 42,
            rating: 4.5,
            reviews: 167,
            image: 'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=400',
            tags: ['paper towels', 'absorbent', 'cleaning', 'bounty'],
            deliveryAvailable: true,
            deliveryTime: 'Same day',
            freeDelivery: false
          },
          {
            _id: '12',
            name: 'Dawn Dish Soap',
            description: 'Powerful dish soap that cuts through grease',
            category: 'household',
            brand: 'Dawn',
            price: 4.99,
            originalPrice: 5.99,
            stock: 78,
            rating: 4.6,
            reviews: 203,
            image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
            tags: ['dish soap', 'cleaning', 'grease-cutting', 'dawn'],
            deliveryAvailable: true,
            deliveryTime: 'Same day',
            freeDelivery: true
          },
          // Health & Beauty
          {
            _id: '13',
            name: 'Vitamin D3 Supplements',
            description: 'High-quality Vitamin D3 for immune support',
            category: 'health',
            brand: 'Nature Made',
            price: 19.99,
            originalPrice: 24.99,
            stock: 35,
            rating: 4.7,
            reviews: 145,
            image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400',
            tags: ['vitamins', 'health', 'supplements', 'immune'],
            deliveryAvailable: true,
            deliveryTime: 'Same day',
            freeDelivery: true
          },
          {
            _id: '14',
            name: 'Cetaphil Gentle Cleanser',
            description: 'Gentle facial cleanser for all skin types',
            category: 'health',
            brand: 'Cetaphil',
            price: 11.99,
            originalPrice: 13.99,
            stock: 28,
            rating: 4.5,
            reviews: 98,
            image: 'https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=400',
            tags: ['skincare', 'cleanser', 'gentle', 'cetaphil'],
            deliveryAvailable: true,
            deliveryTime: 'Same day',
            freeDelivery: true
          },
          // Snacks
          {
            _id: '15',
            name: 'Lay\'s Classic Potato Chips',
            description: 'Crispy classic potato chips, family size',
            category: 'snacks',
            brand: 'Lay\'s',
            price: 4.49,
            originalPrice: 4.99,
            stock: 120,
            rating: 4.3,
            reviews: 276,
            image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400',
            tags: ['chips', 'snacks', 'potato', 'lays'],
            deliveryAvailable: true,
            deliveryTime: 'Same day',
            freeDelivery: true
          },
          {
            _id: '16',
            name: 'Oreo Cookies Family Pack',
            description: 'Classic chocolate sandwich cookies',
            category: 'snacks',
            brand: 'Oreo',
            price: 5.99,
            originalPrice: 6.99,
            stock: 85,
            rating: 4.6,
            reviews: 312,
            image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400',
            tags: ['cookies', 'chocolate', 'oreo', 'snacks'],
            deliveryAvailable: true,
            deliveryTime: 'Same day',
            freeDelivery: true
          }
        ];
        
        setProducts(mockProducts);
        setFilteredProducts(mockProducts);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Memoized filtered products for better performance
  const filteredProductsMemo = useMemo(() => {
    let filtered = products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];
      const matchesRating = selectedRating === 0 || product.rating >= selectedRating;
      
      return matchesSearch && matchesCategory && matchesPrice && matchesRating;
    });

    // Sort products
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'rating':
          return b.rating - a.rating;
        case 'popularity':
          return b.reviews - a.reviews;
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [products, searchTerm, selectedCategory, sortBy, priceRange, selectedRating]);

  // Update filtered products when memo changes
  useEffect(() => {
    setFilteredProducts(filteredProductsMemo);
  }, [filteredProductsMemo]);

  // Cart management with useCallback for performance
  const addToCart = useCallback((product) => {
    const updatedCart = cartService.addItem(product, 1);
    setCart(updatedCart);
    
    toast.success(`✅ ${product.name} added to cart!`, {
      position: "bottom-right",
      autoClose: 2000,
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    const updatedCart = cartService.removeItem(productId);
    setCart(updatedCart);
    toast.info('Item removed from cart');
  }, []);

  const updateCartQuantity = useCallback((productId, newQuantity) => {
    const updatedCart = cartService.updateQuantity(productId, newQuantity);
    setCart(updatedCart);
  }, []);

  // Wishlist management
  const toggleWishlist = useCallback((productId) => {
    setWishlist(prev => {
      const newWishlist = new Set(prev);
      if (newWishlist.has(productId)) {
        newWishlist.delete(productId);
        toast.info('Removed from wishlist');
      } else {
        newWishlist.add(productId);
        toast.success('Added to wishlist ❤️');
      }
      return newWishlist;
    });
  }, []);



  const getCartTotals = useCallback(() => {
    return cartService.getCartTotals(cart);
  }, [cart]);

  // Use categories from API or fallback to comprehensive categories
  const displayCategories = categories.length > 0 ? categories : [
    { id: 'all', name: 'All Categories', icon: '🛍️' },
    { id: 'produce', name: 'Fresh Produce', icon: '🥬' },
    { id: 'dairy', name: 'Dairy', icon: '🥛' },
    { id: 'meat', name: 'Meat & Poultry', icon: '🥩' },
    { id: 'bakery', name: 'Bakery', icon: '🍞' },
    { id: 'beverages', name: 'Beverages', icon: '🥤' },
    { id: 'snacks', name: 'Snacks', icon: '🍿' },
    { id: 'household', name: 'Household', icon: '🏠' },
    { id: 'health', name: 'Health & Beauty', icon: '💊' },
    { id: 'electronics', name: 'Electronics', icon: '📱' }
  ];

  // Handle order submission
  const handleOrderSubmit = async (orderData) => {
    try {
      setLoading(true);
      
      const orderPayload = {
        items: cart,
        customerInfo: {
          name: orderData.name,
          email: orderData.email,
          phone: orderData.phone
        },
        deliveryAddress: {
          street: orderData.address,
          city: orderData.city,
          state: orderData.state || 'CA',
          postalCode: orderData.postalCode,
          country: 'USA'
        },
        paymentMethod: 'online_payment',
        specialInstructions: orderData.specialInstructions,
        deliveryDate: orderData.deliveryDate,
        deliveryTime: orderData.deliveryTime
      };
      
      const response = await orderService.createOrder(orderPayload);
      
      if (response.success) {
        toast.success('🎉 Delivery order placed successfully! Order #' + response.order.orderNumber);
        
        // Clear cart and close modal
        cartService.clearCart();
        setCart([]);
        setShowOrderModal(false);
        
        // Reset delivery info
        setDeliveryInfo({
          address: '',
          city: '',
          postalCode: '',
          phone: '',
          email: '',
          deliveryDate: '',
          deliveryTime: '',
          specialInstructions: ''
        });
        
        // Optionally redirect to order tracking
        // window.location.href = `/track/${response.order.orderNumber}`;
      } else {
        throw new Error(response.message || 'Failed to create order');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error(error.message || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center animate-fadeInUp">
          <div className="relative mb-8">
            <div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 w-20 h-20 border-4 border-purple-500 border-r-transparent rounded-full animate-spin mx-auto" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
            <div className="absolute inset-2 w-16 h-16 border-4 border-pink-500 border-b-transparent rounded-full animate-spin mx-auto" style={{animationDuration: '2s'}}></div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3 animate-pulse">🛍️ Loading Amazing Products...</h2>
          <p className="text-gray-600 text-lg animate-bounce">Fetching the latest deals for you</p>
          <div className="mt-6 flex justify-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
            <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
            <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes slideInFromLeft {
            from {
              opacity: 0;
              transform: translateX(-30px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          @keyframes slideInFromRight {
            from {
              opacity: 0;
              transform: translateX(30px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.05);
            }
          }
          @keyframes bounce {
            0%, 20%, 53%, 80%, 100% {
              transform: translate3d(0,0,0);
            }
            40%, 43% {
              transform: translate3d(0, -8px, 0);
            }
            70% {
              transform: translate3d(0, -4px, 0);
            }
            90% {
              transform: translate3d(0, -2px, 0);
            }
          }
          @keyframes wiggle {
            0%, 7% { transform: rotateZ(0); }
            15% { transform: rotateZ(-15deg); }
            20% { transform: rotateZ(10deg); }
            25% { transform: rotateZ(-10deg); }
            30% { transform: rotateZ(6deg); }
            35% { transform: rotateZ(-4deg); }
            40%, 100% { transform: rotateZ(0); }
          }
          .animate-fadeInUp {
            animation: fadeInUp 0.6s ease-out;
          }
          .animate-slideInFromLeft {
            animation: slideInFromLeft 0.5s ease-out;
          }
          .animate-slideInFromRight {
            animation: slideInFromRight 0.5s ease-out;
          }
          .animate-pulse-custom {
            animation: pulse 2s infinite;
          }
          .animate-bounce-custom {
            animation: bounce 1s infinite;
          }
          .animate-wiggle {
            animation: wiggle 1s ease-in-out;
          }
          .animate-wiggle:hover {
            animation: wiggle 0.5s ease-in-out;
          }
        `
      }} />
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm shadow-lg border-b border-gray-200 sticky top-0 z-50 animate-slideInFromLeft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                <span className="text-2xl animate-bounce">🚚</span>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  FAREDEAL Delivery
                </h1>
                <p className="text-xs sm:text-sm text-gray-500">Shop online • Fast delivery • Secure payment</p>
              </div>
            </div>
            
            {/* Desktop Cart & Wishlist */}
            <div className="hidden sm:flex items-center space-x-4">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="p-3 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <FiFilter className="h-5 w-5" />
              </button>
              
              <div className="relative">
                <button className="p-3 rounded-xl bg-pink-100 hover:bg-pink-200 transition-colors">
                  <FiHeart className="h-5 w-5 text-pink-600" />
                  {wishlist.size > 0 && (
                    <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                      {wishlist.size}
                    </span>
                  )}
                </button>
              </div>
              
              <div className="relative">
                <button
                  onClick={() => cart.length > 0 && setShowOrderModal(true)}
                  className={`relative p-3 rounded-xl transition-all duration-200 ${
                    cart.length > 0 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg hover:shadow-xl transform hover:scale-105' 
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                  disabled={cart.length === 0}
                >
                  <FiShoppingCart className="h-5 w-5" />
                  {cart.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold animate-pulse">
                      {cart.reduce((total, item) => total + item.quantity, 0)}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <div className="sm:hidden">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <FiMenu className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Search and Filters */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8 animate-slideInFromRight">
          {/* Main Search Bar */}
          <div className="relative mb-6">
            <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-6 w-6 animate-pulse" />
            <input
              type="text"
              placeholder="Search for products, brands, or features..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg bg-gray-50 hover:bg-white transition-all duration-300 transform hover:scale-105 focus:scale-105"
            />
          </div>

          {/* Quick Filters Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
            >
              {displayCategories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
            >
              <option value="name">Sort by Name</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
              <option value="popularity">Most Popular</option>
            </select>

            <select
              value={selectedRating}
              onChange={(e) => setSelectedRating(Number(e.target.value))}
              className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
            >
              <option value={0}>All Ratings</option>
              <option value={4}>4+ Stars</option>
              <option value={4.5}>4.5+ Stars</option>
            </select>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex-1 p-3 rounded-xl transition-all ${
                  viewMode === 'grid' 
                    ? 'bg-blue-500 text-white shadow-lg' 
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                <FiGrid className="h-5 w-5 mx-auto" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex-1 p-3 rounded-xl transition-all ${
                  viewMode === 'list' 
                    ? 'bg-blue-500 text-white shadow-lg' 
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                <FiList className="h-5 w-5 mx-auto" />
              </button>
            </div>
          </div>

          {/* Advanced Filters (Collapsible) */}
          {showFilters && (
            <div className="border-t pt-6 animate-slideUp">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Advanced Filters</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Price Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Price Range</label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="2000"
                      value={priceRange[1]}
                      onChange={(e) => setPriceRange([0, Number(e.target.value)])}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>$0</span>
                      <span className="font-medium">${priceRange[1]}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quick Actions</label>
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedCategory('all');
                        setSortBy('name');
                        setPriceRange([0, 2000]);
                        setSelectedRating(0);
                      }}
                      className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                    >
                      <FiRefreshCw className="h-4 w-4 inline mr-2" />
                      Clear Filters
                    </button>
                  </div>
                </div>

                {/* Results Info */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Results</label>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-blue-600">{filteredProducts.length}</div>
                    <div className="text-sm text-gray-600">products found</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results Summary */}
          <div className="flex items-center justify-between mt-6 pt-6 border-t">
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span className="font-medium">{filteredProducts.length} products</span>
              {searchTerm && (
                <span>for "{searchTerm}"</span>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 rounded-lg text-blue-700 transition-colors"
            >
              <FiFilter className="h-4 w-4" />
              <span className="hidden sm:inline">
                {showFilters ? 'Hide Filters' : 'More Filters'}
              </span>
            </button>
          </div>
        </div>

        {/* Products Grid */}
        <div className={`grid gap-6 mb-8 ${
          viewMode === 'grid' 
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
            : 'grid-cols-1'
        }`}>
          {filteredProducts.map((product, index) => (
            <div 
              key={product._id || product.id} 
              className={`bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-700 transform hover:-translate-y-3 hover:scale-105 group animate-fadeInUp ${
                viewMode === 'list' ? 'flex flex-row' : 'flex flex-col'
              }`}
              style={{
                animationDelay: `${index * 100}ms`,
                animationFillMode: 'both'
              }}
            >
              {/* Product Image */}
              <div className={`relative bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center overflow-hidden ${
                viewMode === 'list' ? 'w-48 h-32' : 'h-48 w-full'
              }`}>
                <div className="absolute inset-0 bg-gradient-to-br from-blue-100/50 to-purple-100/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <span className="text-6xl group-hover:scale-125 group-hover:rotate-6 transition-all duration-500 relative z-10">{product.image}</span>
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                {/* Badges */}
                <div className="absolute top-3 left-3 flex flex-col gap-2">
                  {product.originalPrice > product.price && (
                    <div className="bg-gradient-to-r from-red-500 to-red-600 text-white text-xs px-3 py-1 rounded-full font-bold animate-bounce shadow-lg transform hover:scale-110 transition-all duration-300">
                      {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF
                    </div>
                  )}
                  {product.freeDelivery && (
                    <div className="bg-gradient-to-r from-green-500 to-green-600 text-white text-xs px-3 py-1 rounded-full font-bold shadow-lg transform hover:scale-110 transition-all duration-300">
                      🚚 Free Delivery
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-x-2 group-hover:translate-x-0">
                  <button
                    onClick={() => toggleWishlist(product._id || product.id)}
                    className={`p-2 rounded-full shadow-lg transition-all duration-500 transform hover:scale-125 ${
                      wishlist.has(product._id || product.id)
                        ? 'bg-gradient-to-r from-pink-500 to-red-500 text-white animate-pulse' 
                        : 'bg-white/90 text-gray-600 hover:bg-gradient-to-r hover:from-pink-500 hover:to-red-500 hover:text-white'
                    }`}
                  >
                    <FiHeart className={`h-4 w-4 ${wishlist.has(product._id || product.id) ? 'fill-current' : ''}`} />
                  </button>
                  
                  <button
                    onClick={() => addToCart(product)}
                    className="bg-white/90 text-blue-600 p-2 rounded-full shadow-lg hover:bg-gradient-to-r hover:from-blue-500 hover:to-blue-600 hover:text-white transition-all duration-500 transform hover:scale-125"
                  >
                    <FiPlus className="h-4 w-4" />
                  </button>
                </div>

                {/* Stock Indicator */}
                <div className="absolute bottom-3 left-3">
                  <div className={`text-xs px-2 py-1 rounded-full font-medium ${
                    product.stockQuantity > 10 
                      ? 'bg-green-100 text-green-700' 
                      : product.stockQuantity > 0 
                        ? 'bg-yellow-100 text-yellow-700' 
                        : 'bg-red-100 text-red-700'
                  }`}>
                    {product.stockQuantity > 10 ? 'In Stock' : 
                     product.stockQuantity > 0 ? `${product.stockQuantity} left` : 'Out of Stock'}
                  </div>
                </div>
              </div>

              {/* Product Info */}
              <div className={`p-6 flex-1 ${viewMode === 'list' ? 'flex flex-col justify-between' : ''}`}>
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-gray-900 text-base leading-tight group-hover:text-blue-600 transition-all duration-300 transform group-hover:scale-105">
                      {product.name}
                    </h3>
                    <div className="flex items-center text-yellow-400 ml-2 transform group-hover:scale-110 transition-all duration-300">
                      <FiStar className="h-4 w-4 fill-current animate-pulse" />
                      <span className="text-sm text-gray-600 ml-1 font-medium">{product.rating}</span>
                      <span className="text-xs text-gray-500 ml-1">({product.reviews})</span>
                    </div>
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-2 leading-relaxed">{product.description}</p>

                  {/* Price */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-xl font-bold text-gray-900 group-hover:text-green-600 transition-colors duration-300 transform group-hover:scale-110">${product.price}</span>
                      {product.originalPrice > product.price && (
                        <span className="text-sm text-gray-500 line-through group-hover:text-red-500 transition-colors duration-300">${product.originalPrice}</span>
                      )}
                      {product.originalPrice > product.price && (
                        <span className="text-xs bg-gradient-to-r from-red-100 to-red-200 text-red-700 px-2 py-1 rounded-full font-bold transform group-hover:scale-105 transition-all duration-300">
                          Save ${(product.originalPrice - product.price).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delivery Info */}
                  <div className="flex items-center text-sm text-gray-600 mb-4">
                    <FiTruck className="h-4 w-4 mr-2" />
                    <span>{product.deliveryTime}</span>
                    {product.freeDelivery && (
                      <span className="ml-2 text-green-600 font-medium">• Free Delivery</span>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {product.tags.slice(0, viewMode === 'list' ? 5 : 3).map((tag, index) => (
                      <span key={index} className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className={`grid gap-3 ${viewMode === 'list' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <button
                    onClick={() => addToCart(product)}
                    disabled={product.stockQuantity === 0}
                    className={`py-3 px-4 rounded-xl font-bold transition-all duration-300 flex items-center justify-center space-x-2 ${
                      product.stockQuantity === 0
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 transform hover:scale-105 shadow-lg hover:shadow-xl'
                    }`}
                  >
                    <FiShoppingCart className="h-4 w-4" />
                    <span>{product.stockQuantity === 0 ? 'Out of Stock' : 'Add to Cart'}</span>
                  </button>
                  
                  {viewMode === 'list' && (
                    <button className="py-3 px-4 border-2 border-blue-500 text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-colors flex items-center justify-center space-x-2">
                      <FiEye className="h-4 w-4" />
                      <span>Quick View</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredProducts.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600 mb-6">Try adjusting your search terms or filters</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
                setSortBy('name');
                setPriceRange([0, 2000]);
                setSelectedRating(0);
              }}
              className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        )}

        {/* Desktop Cart Summary (Floating) */}
        {cart.length > 0 && (
          <div className="hidden sm:block fixed bottom-6 right-6 bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 max-w-sm border border-gray-200 animate-slideUp">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 text-lg">🛒 Cart Summary</h3>
              <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
                {cart.reduce((total, item) => total + item.quantity, 0)} items
              </span>
            </div>
            
            <div className="space-y-3 mb-4 max-h-40 overflow-y-auto">
              {cart.map(item => (
                <div key={item._id || item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-sm truncate">{item.name}</div>
                    <div className="flex items-center space-x-2 mt-1">
                      <button
                        onClick={() => updateCartQuantity(item._id || item.id, item.quantity - 1)}
                        className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 transition-colors"
                      >
                        <FiMinus className="h-3 w-3" />
                      </button>
                      <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQuantity(item._id || item.id, item.quantity + 1)}
                        className="w-6 h-6 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white transition-colors"
                      >
                        <FiPlus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <div className="font-bold text-gray-900">${(item.price * item.quantity).toFixed(2)}</div>
                    <button
                                              onClick={() => removeFromCart(item._id || item.id)}
                      className="text-red-500 hover:text-red-700 text-xs transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 mb-4">
              {(() => {
                const totals = getCartTotals();
                return (
                  <>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-medium">${totals.subtotal}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Tax:</span>
                      <span className="font-medium">${totals.tax}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Delivery:</span>
                      <span className={`font-medium ${totals.deliveryFee === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                        {totals.deliveryFee === 0 ? 'FREE' : `$${totals.deliveryFee}`}
                      </span>
                    </div>
                    {totals.deliveryFee === 0 && (
                      <div className="text-xs text-green-600 mb-2">🎉 You saved $9.99 on delivery!</div>
                    )}
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Total:</span>
                      <span className="text-green-600">${totals.total}</span>
                    </div>
                  </>
                );
              })()}
            </div>

            <button
              onClick={() => setShowOrderModal(true)}
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 text-white py-4 px-4 rounded-xl font-bold hover:from-green-600 hover:to-blue-600 transform hover:scale-105 transition-all duration-300 flex items-center justify-center shadow-lg hover:shadow-xl"
            >
              <FiTruck className="h-5 w-5 mr-2" />
              Place Delivery Order
            </button>
          </div>
        )}

        {/* Mobile Cart Summary (Bottom Bar) */}
        {cart.length > 0 && (
          <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-40">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm text-gray-600">{getCartTotals().itemCount} items</div>
                <div className="font-bold text-lg">${getCartTotals().total}</div>
              </div>
              <button
                onClick={() => setShowOrderModal(true)}
                className="bg-gradient-to-r from-green-500 to-blue-500 text-white py-3 px-6 rounded-xl font-bold hover:from-green-600 hover:to-blue-600 transition-all duration-200 flex items-center"
              >
                <FiTruck className="h-5 w-5 mr-2" />
                Checkout
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delivery Order Modal */}
      <DeliveryOrderModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        cart={cart}
        cartTotals={getCartTotals()}
        deliveryInfo={deliveryInfo}
        setDeliveryInfo={setDeliveryInfo}
        onSubmit={handleOrderSubmit}
        loading={loading}
      />
    </div>
  );
};

export default CustomerDelivery;
