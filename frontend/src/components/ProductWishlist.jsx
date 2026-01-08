import React, { useState, useEffect } from 'react';
import { 
  FiHeart, FiX, FiShare2, FiEye, FiShoppingCart, FiStar, FiMessageCircle,
  FiFilter, FiSearch, FiGrid, FiList, FiChevronDown, FiChevronUp,
  FiTag, FiClock, FiTrendingUp, FiGift, FiZap
} from 'react-icons/fi';
import { toast } from 'react-toastify';

const ProductWishlist = ({ isOpen, onClose }) => {
  const [wishlistItems, setWishlistItems] = useState([
    {
      id: 1,
      name: 'iPhone 15 Pro Max',
      price: 1199.99,
      originalPrice: 1299.99,
      image: '📱',
      category: 'Electronics',
      rating: 4.8,
      reviews: 1247,
      addedDate: '2024-01-15',
      inStock: true,
      discount: 8,
      tags: ['New', 'Popular', 'Limited']
    },
    {
      id: 2,
      name: 'AirPods Pro 3rd Gen',
      price: 249.99,
      originalPrice: 279.99,
      image: '🎧',
      category: 'Audio',
      rating: 4.9,
      reviews: 892,
      addedDate: '2024-01-12',
      inStock: true,
      discount: 11,
      tags: ['Best Seller', 'Wireless']
    },
    {
      id: 3,
      name: 'MacBook Air M2',
      price: 1299.99,
      originalPrice: 1399.99,
      image: '💻',
      category: 'Computers',
      rating: 4.7,
      reviews: 654,
      addedDate: '2024-01-10',
      inStock: false,
      discount: 7,
      tags: ['Professional', 'Portable']
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [filterCategory, setFilterCategory] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [showFilters, setShowFilters] = useState(false);

  const categories = ['all', 'Electronics', 'Audio', 'Computers', 'Wearables', 'Tablets'];

  const filteredItems = wishlistItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case 'price-low':
        return a.price - b.price;
      case 'price-high':
        return b.price - a.price;
      case 'rating':
        return b.rating - a.rating;
      case 'name':
        return a.name.localeCompare(b.name);
      case 'date':
      default:
        return new Date(b.addedDate) - new Date(a.addedDate);
    }
  });

  const handleRemoveFromWishlist = (itemId) => {
    setWishlistItems(items => items.filter(item => item.id !== itemId));
    toast.success('Item removed from wishlist');
  };

  const handleAddToCart = (item) => {
    toast.success(`${item.name} added to cart!`);
  };

  const handleShare = (item) => {
    if (navigator.share) {
      navigator.share({
        title: `Check out ${item.name} on FareDeal`,
        text: `Amazing deal: ${item.name} for $${item.price}`,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(`${item.name} - $${item.price} on FareDeal`);
      toast.success('Product link copied to clipboard!');
    }
  };

  const handleQuickView = (item) => {
    toast.info(`Quick view for ${item.name} coming soon!`);
  };

  const getTotalSavings = () => {
    return wishlistItems.reduce((total, item) => {
      return total + (item.originalPrice - item.price);
    }, 0);
  };

  const getAverageRating = () => {
    const totalRating = wishlistItems.reduce((sum, item) => sum + item.rating, 0);
    return (totalRating / wishlistItems.length).toFixed(1);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-600 to-red-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <FiHeart className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-3xl font-bold">My Wishlist</h2>
                <p className="text-pink-100">{wishlistItems.length} items saved</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <FiX className="h-8 w-8" />
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="bg-gradient-to-r from-pink-50 to-red-50 p-4 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{wishlistItems.length}</div>
              <div className="text-sm text-gray-600">Total Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">${getTotalSavings().toFixed(2)}</div>
              <div className="text-sm text-gray-600">Total Savings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{getAverageRating()}</div>
              <div className="text-sm text-gray-600">Avg Rating</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {wishlistItems.filter(item => item.inStock).length}
              </div>
              <div className="text-sm text-gray-600">In Stock</div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex-1 max-w-md relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search wishlist..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Sort by:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                >
                  <option value="date">Date Added</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="rating">Rating</option>
                  <option value="name">Name</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Category:</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category === 'all' ? 'All Categories' : category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'grid' ? 'bg-pink-100 text-pink-600' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <FiGrid className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'list' ? 'bg-pink-100 text-pink-600' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <FiList className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Wishlist Items */}
        <div className="flex-1 overflow-y-auto p-6">
          {sortedItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">💔</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Your wishlist is empty</h3>
              <p className="text-gray-600 mb-6">Start adding items you love to your wishlist!</p>
              <button
                onClick={onClose}
                className="bg-pink-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-pink-700 transition-colors"
              >
                Start Shopping
              </button>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
              {sortedItems.map(item => (
                <div
                  key={item.id}
                  className={`bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-200 ${
                    viewMode === 'list' ? 'flex' : ''
                  }`}
                >
                  <div className={`${viewMode === 'list' ? 'w-48' : 'w-full'} h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center relative`}>
                    <div className="text-6xl">{item.image}</div>
                    {item.discount > 0 && (
                      <div className="absolute top-3 left-3 bg-red-500 text-white px-2 py-1 rounded-full text-sm font-bold">
                        -{item.discount}%
                      </div>
                    )}
                    {!item.inStock && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                          Out of Stock
                        </span>
                      </div>
                    )}
                  </div>

                  <div className={`p-6 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg mb-1">{item.name}</h3>
                        <p className="text-sm text-gray-600 mb-2">{item.category}</p>
                        <div className="flex items-center space-x-1 mb-2">
                          <FiStar className="h-4 w-4 text-yellow-400 fill-current" />
                          <span className="text-sm font-medium">{item.rating}</span>
                          <span className="text-sm text-gray-500">({item.reviews} reviews)</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFromWishlist(item.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        <FiX className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="flex items-center space-x-2 mb-4">
                      <span className="text-xl font-bold text-gray-900">${item.price}</span>
                      {item.originalPrice > item.price && (
                        <span className="text-sm text-gray-500 line-through">${item.originalPrice}</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {item.tags.map(tag => (
                        <span
                          key={tag}
                          className="bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-xs font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        Added {new Date(item.addedDate).toLocaleDateString()}
                      </span>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleQuickView(item)}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <FiEye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleShare(item)}
                          className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        >
                          <FiShare2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleAddToCart(item)}
                          disabled={!item.inStock}
                          className="p-2 text-gray-600 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <FiShoppingCart className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {sortedItems.length > 0 && (
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {sortedItems.length} of {wishlistItems.length} items
              </div>
              <div className="flex space-x-3">
                <button className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">
                  <FiShare2 className="h-4 w-4" />
                  <span>Share Wishlist</span>
                </button>
                <button className="flex items-center space-x-2 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors">
                  <FiShoppingCart className="h-4 w-4" />
                  <span>Add All to Cart</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductWishlist;


