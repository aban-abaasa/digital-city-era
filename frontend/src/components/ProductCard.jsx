import React from 'react';
import { FiStar, FiShoppingCart, FiPlus } from 'react-icons/fi';

const ProductCard = ({ product, onAddToCart }) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
      {/* Product Image */}
      <div className="relative h-48 bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <span className="text-6xl">{product.image}</span>
        {product.originalPrice > product.price && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
            SALE
          </div>
        )}
        <button
          onClick={() => onAddToCart(product)}
          className="absolute top-2 right-2 bg-white text-blue-600 p-2 rounded-full shadow-lg hover:bg-blue-50 transition-colors"
        >
          <FiPlus className="h-5 w-5" />
        </button>
      </div>

      {/* Product Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-bold text-gray-900 text-sm leading-tight">{product.name}</h3>
          <div className="flex items-center text-yellow-400">
            <FiStar className="h-4 w-4 fill-current" />
            <span className="text-xs text-gray-600 ml-1">{product.rating}</span>
          </div>
        </div>

        <p className="text-gray-600 text-xs mb-3 line-clamp-2">{product.description}</p>

        {/* Price */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-lg font-bold text-gray-900">{formatCurrency(product.price)}</span>
            {product.originalPrice > product.price && (
              <span className="text-sm text-gray-500 line-through">{formatCurrency(product.originalPrice)}</span>
            )}
          </div>
          <span className="text-xs text-green-600 font-medium">
            {product.freeDelivery ? 'Free Delivery' : product.deliveryTime}
          </span>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {product.tags.slice(0, 3).map((tag, index) => (
            <span key={index} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              {tag}
            </span>
          ))}
        </div>

        {/* Add to Cart Button */}
        <button
          onClick={() => onAddToCart(product)}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-2 px-4 rounded-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-all duration-200 flex items-center justify-center"
        >
          <FiShoppingCart className="h-4 w-4 mr-2" />
          Add to Cart
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
