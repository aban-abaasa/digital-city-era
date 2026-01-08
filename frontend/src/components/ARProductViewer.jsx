import React, { useState, useRef, useEffect } from 'react';
import { 
  FiCamera, FiX, FiRotateCw, FiZoomIn, FiZoomOut, 
  FiMaximize, FiMinimize, FiDownload, FiShare2,
  FiHeart, FiShoppingBag, FiInfo, FiSettings
} from 'react-icons/fi';
import { toast } from 'react-toastify';

const ARProductViewer = ({ product, isOpen, onClose }) => {
  const [viewMode, setViewMode] = useState('ar'); // 'ar', '3d', '360'
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [arSupported, setArSupported] = useState(false);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    // Check for AR support
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-ar').then(setArSupported);
    }
    
    // Simulate loading
    setTimeout(() => setIsLoading(false), 2000);
  }, []);

  const handleARMode = () => {
    if (!arSupported) {
      toast.info("AR not supported on this device. Using 3D view instead.");
      setViewMode('3d');
      return;
    }
    
    toast.success("AR mode activated! Point your camera at a flat surface.");
    setViewMode('ar');
  };

  const handle3DMode = () => {
    setViewMode('3d');
    toast.info("3D view activated");
  };

  const handle360Mode = () => {
    setViewMode('360');
    toast.info("360° view activated");
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.2, 0.5));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleAddToCart = () => {
    toast.success(`${product.name} added to cart!`);
  };

  const handleAddToWishlist = () => {
    toast.success(`${product.name} added to wishlist!`);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Check out ${product.name} on FareDeal`,
        text: `Amazing product with AR view!`,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard!");
    }
  };

  const renderARView = () => (
    <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-6xl mb-4">📱</div>
          <div className="text-xl font-bold mb-2">AR View Active</div>
          <div className="text-sm text-blue-200">Point your camera at a flat surface</div>
          <div className="mt-4 text-xs text-gray-300">
            {product.name} will appear in your space
          </div>
        </div>
      </div>
      
      {/* AR Overlay Controls */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
        <div className="bg-black/50 backdrop-blur-sm rounded-full px-4 py-2 text-white text-sm">
          AR Mode
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleZoomIn}
            className="bg-black/50 backdrop-blur-sm text-white p-2 rounded-full hover:bg-black/70 transition-colors"
          >
            <FiZoomIn className="h-5 w-5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="bg-black/50 backdrop-blur-sm text-white p-2 rounded-full hover:bg-black/70 transition-colors"
          >
            <FiZoomOut className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      {/* AR Product Model */}
      <div 
        className="absolute bottom-20 left-1/2 transform -translate-x-1/2"
        style={{ 
          transform: `translateX(-50%) scale(${zoom}) rotate(${rotation}deg)`,
          transition: 'all 0.3s ease'
        }}
      >
        <div className="text-8xl filter drop-shadow-2xl">
          {product.image}
        </div>
      </div>
    </div>
  );

  const render3DView = () => (
    <div className="relative w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        <div 
          className="text-9xl filter drop-shadow-2xl transition-transform duration-500"
          style={{ 
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
          }}
        >
          {product.image}
        </div>
      </div>
      
      {/* 3D Controls */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
        <div className="bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 text-gray-800 text-sm font-medium">
          3D View
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleRotate}
            className="bg-white/80 backdrop-blur-sm text-gray-800 p-2 rounded-full hover:bg-white transition-colors"
          >
            <FiRotateCw className="h-5 w-5" />
          </button>
          <button
            onClick={handleZoomIn}
            className="bg-white/80 backdrop-blur-sm text-gray-800 p-2 rounded-full hover:bg-white transition-colors"
          >
            <FiZoomIn className="h-5 w-5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="bg-white/80 backdrop-blur-sm text-gray-800 p-2 rounded-full hover:bg-white transition-colors"
          >
            <FiZoomOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );

  const render360View = () => (
    <div className="relative w-full h-full bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          <div 
            className="text-8xl filter drop-shadow-2xl transition-transform duration-1000"
            style={{ 
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
          >
            {product.image}
          </div>
          <div className="absolute -inset-4 border-4 border-dashed border-indigo-300 rounded-full animate-spin" style={{ animationDuration: '10s' }}></div>
        </div>
      </div>
      
      {/* 360 Controls */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
        <div className="bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 text-gray-800 text-sm font-medium">
          360° View
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setRotation(prev => prev + 45)}
            className="bg-white/80 backdrop-blur-sm text-gray-800 p-2 rounded-full hover:bg-white transition-colors"
          >
            <FiRotateCw className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${isFullscreen ? 'p-0' : ''}`}>
      <div className={`bg-white rounded-3xl shadow-2xl ${isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-4xl h-[80vh]'} flex flex-col overflow-hidden`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="text-2xl">{product.image}</div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{product.name}</h2>
              <p className="text-gray-600">Interactive Product View</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleFullscreen}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
            >
              {isFullscreen ? <FiMinimize className="h-5 w-5" /> : <FiMaximize className="h-5 w-5" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* View Mode Selector */}
        <div className="flex items-center justify-center p-4 border-b border-gray-200">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-2xl">
            {[
              { id: 'ar', label: 'AR View', icon: FiCamera, color: 'from-blue-500 to-cyan-500' },
              { id: '3d', label: '3D View', icon: FiRotateCw, color: 'from-purple-500 to-pink-500' },
              { id: '360', label: '360° View', icon: FiRotateCw, color: 'from-green-500 to-emerald-500' }
            ].map(mode => (
              <button
                key={mode.id}
                onClick={() => {
                  if (mode.id === 'ar') handleARMode();
                  else if (mode.id === '3d') handle3DMode();
                  else handle360Mode();
                }}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                  viewMode === mode.id
                    ? 'bg-white text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                style={viewMode === mode.id ? {
                  background: `linear-gradient(135deg, ${mode.color.split(' ')[1]}, ${mode.color.split(' ')[3]})`
                } : {}}
              >
                <mode.icon className="h-4 w-4" />
                <span>{mode.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Viewer */}
        <div className="flex-1 p-6">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <div className="text-gray-600">Loading {viewMode.toUpperCase()} view...</div>
              </div>
            </div>
          ) : (
            <div className="w-full h-full">
              {viewMode === 'ar' && renderARView()}
              {viewMode === '3d' && render3DView()}
              {viewMode === '360' && render360View()}
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="p-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-2xl font-bold text-gray-900">${product.price}</div>
              {product.originalPrice && (
                <div className="text-lg text-gray-500 line-through">${product.originalPrice}</div>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handleShare}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
              >
                <FiShare2 className="h-4 w-4" />
                <span>Share</span>
              </button>
              
              <button
                onClick={handleAddToWishlist}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
              >
                <FiHeart className="h-4 w-4" />
                <span>Wishlist</span>
              </button>
              
              <button
                onClick={handleAddToCart}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 font-medium"
              >
                <FiShoppingBag className="h-5 w-5" />
                <span>Add to Cart</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ARProductViewer;


