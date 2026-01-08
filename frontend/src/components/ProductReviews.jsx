import React, { useState, useEffect } from 'react';
import { 
  FiStar, FiThumbsUp, FiThumbsDown, FiMessageCircle, FiImage, FiSend,
  FiFilter, FiSearch, FiChevronDown, FiChevronUp, FiUser, FiClock,
  FiCheckCircle, FiAlertCircle, FiHeart, FiShare2, FiFlag, FiX
} from 'react-icons/fi';
import { toast } from 'react-toastify';

const ProductReviews = ({ product, isOpen, onClose }) => {
  const [reviews, setReviews] = useState([
    {
      id: 1,
      user: {
        name: 'Sarah Johnson',
        avatar: '👩',
        verified: true,
        level: 'Gold Member'
      },
      rating: 5,
      title: 'Absolutely amazing!',
      content: 'This product exceeded all my expectations. The quality is outstanding and the customer service was excellent. Highly recommend!',
      date: '2024-01-15',
      helpful: 24,
      images: ['📱', '📱'],
      verified: true,
      tags: ['Quality', 'Fast Delivery']
    },
    {
      id: 2,
      user: {
        name: 'Mike Chen',
        avatar: '👨',
        verified: false,
        level: 'Silver Member'
      },
      rating: 4,
      title: 'Great product with minor issues',
      content: 'Overall a great product. The build quality is solid and it works as expected. Only minor complaint is the battery life could be better.',
      date: '2024-01-12',
      helpful: 18,
      images: [],
      verified: true,
      tags: ['Good Value']
    },
    {
      id: 3,
      user: {
        name: 'Emily Rodriguez',
        avatar: '👩‍💼',
        verified: true,
        level: 'Platinum Member'
      },
      rating: 5,
      title: 'Perfect for my needs',
      content: 'I\'ve been using this for a month now and it\'s been perfect. The design is sleek and the performance is exactly what I needed.',
      date: '2024-01-10',
      helpful: 31,
      images: ['📱'],
      verified: true,
      tags: ['Design', 'Performance']
    }
  ]);

  const [newReview, setNewReview] = useState({
    rating: 5,
    title: '',
    content: '',
    images: []
  });

  const [filterRating, setFilterRating] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredReviews = reviews.filter(review => {
    const matchesRating = filterRating === 'all' || review.rating.toString() === filterRating;
    const matchesSearch = review.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         review.content.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRating && matchesSearch;
  });

  const sortedReviews = [...filteredReviews].sort((a, b) => {
    switch (sortBy) {
      case 'helpful':
        return b.helpful - a.helpful;
      case 'rating-high':
        return b.rating - a.rating;
      case 'rating-low':
        return a.rating - b.rating;
      case 'recent':
      default:
        return new Date(b.date) - new Date(a.date);
    }
  });

  const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  const ratingDistribution = [5, 4, 3, 2, 1].map(rating => ({
    rating,
    count: reviews.filter(r => r.rating === rating).length,
    percentage: (reviews.filter(r => r.rating === rating).length / reviews.length) * 100
  }));

  const handleSubmitReview = () => {
    if (!newReview.title || !newReview.content) {
      toast.error('Please fill in all required fields');
      return;
    }

    const review = {
      id: Date.now(),
      user: {
        name: 'You',
        avatar: '👤',
        verified: true,
        level: 'Member'
      },
      ...newReview,
      date: new Date().toISOString().split('T')[0],
      helpful: 0,
      verified: true,
      tags: []
    };

    setReviews(prev => [review, ...prev]);
    setNewReview({ rating: 5, title: '', content: '', images: [] });
    setShowWriteReview(false);
    toast.success('Review submitted successfully!');
  };

  const handleHelpful = (reviewId) => {
    setReviews(prev => prev.map(review =>
      review.id === reviewId ? { ...review, helpful: review.helpful + 1 } : review
    ));
    toast.success('Thank you for your feedback!');
  };

  const handleReport = (reviewId) => {
    toast.info('Review reported. We\'ll look into this.');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <FiStar className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-3xl font-bold">Product Reviews</h2>
                <p className="text-blue-100">{product?.name || 'Product Reviews'}</p>
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

        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Rating Summary */}
          <div className="w-1/3 border-r border-gray-200 p-6">
            <div className="mb-6">
              <div className="flex items-center space-x-3 mb-2">
                <div className="text-4xl font-bold text-gray-900">{averageRating.toFixed(1)}</div>
                <div>
                  <div className="flex items-center space-x-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <FiStar
                        key={star}
                        className={`h-5 w-5 ${
                          star <= averageRating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-sm text-gray-600">{reviews.length} reviews</div>
                </div>
              </div>
            </div>

            {/* Rating Distribution */}
            <div className="mb-6">
              <h3 className="font-bold text-gray-900 mb-3">Rating Distribution</h3>
              <div className="space-y-2">
                {ratingDistribution.map(({ rating, count, percentage }) => (
                  <div key={rating} className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1 w-12">
                      <span className="text-sm font-medium">{rating}</span>
                      <FiStar className="h-3 w-3 text-yellow-400 fill-current" />
                    </div>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-yellow-400 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600 w-8">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Write Review Button */}
            <button
              onClick={() => setShowWriteReview(true)}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-xl font-medium hover:from-blue-600 hover:to-purple-700 transition-all duration-200"
            >
              Write a Review
            </button>
          </div>

          {/* Right Content - Reviews List */}
          <div className="flex-1 flex flex-col">
            {/* Filters */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                <div className="flex-1 max-w-md relative">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="text"
                    placeholder="Search reviews..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700">Filter:</label>
                    <select
                      value={filterRating}
                      onChange={(e) => setFilterRating(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All Ratings</option>
                      <option value="5">5 Stars</option>
                      <option value="4">4 Stars</option>
                      <option value="3">3 Stars</option>
                      <option value="2">2 Stars</option>
                      <option value="1">1 Star</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700">Sort by:</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="recent">Most Recent</option>
                      <option value="helpful">Most Helpful</option>
                      <option value="rating-high">Highest Rating</option>
                      <option value="rating-low">Lowest Rating</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Reviews List */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {sortedReviews.map(review => (
                  <div key={review.id} className="bg-white border border-gray-200 rounded-2xl p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xl">
                          {review.user.avatar}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-bold text-gray-900">{review.user.name}</h4>
                            {review.user.verified && (
                              <FiCheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{review.user.level}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-1 mb-1">
                          {[1, 2, 3, 4, 5].map(star => (
                            <FiStar
                              key={star}
                              className={`h-4 w-4 ${
                                star <= review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-sm text-gray-500">{review.date}</p>
                      </div>
                    </div>

                    <h5 className="font-bold text-gray-900 mb-2">{review.title}</h5>
                    <p className="text-gray-700 mb-4 leading-relaxed">{review.content}</p>

                    {review.images.length > 0 && (
                      <div className="flex space-x-2 mb-4">
                        {review.images.map((image, index) => (
                          <div
                            key={index}
                            className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-2xl"
                          >
                            {image}
                          </div>
                        ))}
                      </div>
                    )}

                    {review.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {review.tags.map(tag => (
                          <span
                            key={tag}
                            className="bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-xs font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => handleHelpful(review.id)}
                          className="flex items-center space-x-1 text-gray-600 hover:text-green-600 transition-colors"
                        >
                          <FiThumbsUp className="h-4 w-4" />
                          <span className="text-sm">Helpful ({review.helpful})</span>
                        </button>
                        <button className="flex items-center space-x-1 text-gray-600 hover:text-blue-600 transition-colors">
                          <FiMessageCircle className="h-4 w-4" />
                          <span className="text-sm">Reply</span>
                        </button>
                      </div>
                      <button
                        onClick={() => handleReport(review.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <FiFlag className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Write Review Modal */}
        {showWriteReview && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-60 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-gray-900">Write a Review</h3>
                  <button
                    onClick={() => setShowWriteReview(false)}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <FiX className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-96">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
                    <div className="flex items-center space-x-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          onClick={() => setNewReview(prev => ({ ...prev, rating: star }))}
                          className="focus:outline-none"
                        >
                          <FiStar
                            className={`h-8 w-8 ${
                              star <= newReview.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Review Title</label>
                    <input
                      type="text"
                      value={newReview.title}
                      onChange={(e) => setNewReview(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Summarize your experience"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Your Review</label>
                    <textarea
                      value={newReview.content}
                      onChange={(e) => setNewReview(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Tell us about your experience with this product..."
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200">
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowWriteReview(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitReview}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200"
                  >
                    Submit Review
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductReviews;


