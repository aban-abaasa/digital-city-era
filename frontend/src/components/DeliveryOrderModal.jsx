import React, { useState } from 'react';
import { toast } from 'react-toastify';
import {
  FiX, FiTruck, FiMapPin, FiClock, FiCalendar, FiUser, FiPhone,
  FiMail, FiHome, FiPackage, FiCheckCircle, FiCreditCard, FiShield,
  FiPlus, FiMinus, FiXCircle, FiStar, FiNavigation
} from 'react-icons/fi';

const DeliveryOrderModal = ({
  isOpen,
  onClose,
  cart,
  cartTotal,
  deliveryFee,
  finalTotal,
  deliveryInfo,
  setDeliveryInfo,
  onSubmit
}) => {
  const [currentStep, setCurrentStep] = useState('delivery-info'); // delivery-info, review, payment, confirmation
  const [paymentMethod, setPaymentMethod] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleInputChange = (field, value) => {
    setDeliveryInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNext = () => {
    if (currentStep === 'delivery-info') {
      // Validate delivery info
      if (!deliveryInfo.address || !deliveryInfo.city || !deliveryInfo.phone || !deliveryInfo.email) {
        toast.error('Please fill in all required fields');
        return;
      }
      setCurrentStep('review');
    } else if (currentStep === 'review') {
      setCurrentStep('payment');
    }
  };

  const handleBack = () => {
    if (currentStep === 'review') {
      setCurrentStep('delivery-info');
    } else if (currentStep === 'payment') {
      setCurrentStep('review');
    }
  };

  const handleSubmit = async () => {
    if (!paymentMethod) {
      toast.error('Please select a payment method');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const orderData = {
        orderId: `DEL-${Date.now()}`,
        items: cart,
        subtotal: cartTotal,
        deliveryFee,
        total: finalTotal,
        deliveryInfo,
        paymentMethod,
        orderDate: new Date().toISOString(),
        status: 'pending',
        estimatedDelivery: getEstimatedDelivery()
      };

      await onSubmit(orderData);
      setCurrentStep('confirmation');
    } catch (error) {
      toast.error('Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getEstimatedDelivery = () => {
    const today = new Date();
    const deliveryDate = new Date(today);
    deliveryDate.setDate(today.getDate() + 3); // 3 business days
    
    return deliveryDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStepIcon = (step) => {
    switch (step) {
      case 'delivery-info': return FiMapPin;
      case 'review': return FiPackage;
      case 'payment': return FiCreditCard;
      case 'confirmation': return FiCheckCircle;
      default: return FiMapPin;
    }
  };

  const getStepTitle = (step) => {
    switch (step) {
      case 'delivery-info': return 'Delivery Information';
      case 'review': return 'Review Order';
      case 'payment': return 'Payment Method';
      case 'confirmation': return 'Order Confirmed';
      default: return 'Delivery Information';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FiTruck className="h-8 w-8 mr-3" />
              <div>
                <h2 className="text-xl font-bold">Place Delivery Order</h2>
                <p className="text-blue-100 text-sm">Step {['delivery-info', 'review', 'payment', 'confirmation'].indexOf(currentStep) + 1} of 4</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-blue-200 transition-colors"
            >
              <FiX className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            {['delivery-info', 'review', 'payment', 'confirmation'].map((step, index) => {
              const StepIcon = getStepIcon(step);
              const isActive = step === currentStep;
              const isCompleted = ['delivery-info', 'review', 'payment', 'confirmation'].indexOf(currentStep) > index;
              
              return (
                <div key={step} className="flex flex-col items-center">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isActive 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white animate-pulse' 
                      : isCompleted 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-200 text-gray-400'
                  }`}>
                    {isCompleted ? (
                      <FiCheckCircle className="h-6 w-6" />
                    ) : (
                      <StepIcon className="h-6 w-6" />
                    )}
                  </div>
                  <p className={`text-xs mt-2 font-medium ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                    {getStepTitle(step)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          
          {/* Step 1: Delivery Information */}
          {currentStep === 'delivery-info' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Where should we deliver your order?</h3>
                <p className="text-gray-600">Please provide your delivery address and contact information</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FiHome className="inline h-4 w-4 mr-2" />
                    Street Address *
                  </label>
                  <input
                    type="text"
                    value={deliveryInfo.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="123 Main Street"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FiMapPin className="inline h-4 w-4 mr-2" />
                    City *
                  </label>
                  <input
                    type="text"
                    value={deliveryInfo.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    placeholder="New York"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FiMapPin className="inline h-4 w-4 mr-2" />
                    Postal Code
                  </label>
                  <input
                    type="text"
                    value={deliveryInfo.postalCode}
                    onChange={(e) => handleInputChange('postalCode', e.target.value)}
                    placeholder="10001"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FiPhone className="inline h-4 w-4 mr-2" />
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={deliveryInfo.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FiMail className="inline h-4 w-4 mr-2" />
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={deliveryInfo.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="customer@email.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FiCalendar className="inline h-4 w-4 mr-2" />
                    Preferred Delivery Date
                  </label>
                  <input
                    type="date"
                    value={deliveryInfo.deliveryDate}
                    onChange={(e) => handleInputChange('deliveryDate', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FiClock className="inline h-4 w-4 mr-2" />
                    Preferred Delivery Time
                  </label>
                  <select
                    value={deliveryInfo.deliveryTime}
                    onChange={(e) => handleInputChange('deliveryTime', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Any time</option>
                    <option value="morning">Morning (9 AM - 12 PM)</option>
                    <option value="afternoon">Afternoon (12 PM - 5 PM)</option>
                    <option value="evening">Evening (5 PM - 8 PM)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FiPackage className="inline h-4 w-4 mr-2" />
                  Special Instructions
                </label>
                <textarea
                  value={deliveryInfo.specialInstructions}
                  onChange={(e) => handleInputChange('specialInstructions', e.target.value)}
                  placeholder="Any special delivery instructions, building access codes, or notes for the delivery driver..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleNext}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 px-8 rounded-lg font-bold hover:from-blue-600 hover:to-purple-600 transition-all duration-200 flex items-center"
                >
                  Next: Review Order
                  <FiPackage className="h-5 w-5 ml-2" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Review Order */}
          {currentStep === 'review' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Review Your Order</h3>
                <p className="text-gray-600">Please review your items and delivery details before proceeding</p>
              </div>

              {/* Order Items */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-bold text-gray-900 mb-3">Order Items</h4>
                <div className="space-y-3">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">{item.image}</span>
                        <div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                        </div>
                      </div>
                      <p className="font-bold text-gray-900">{formatCurrency(item.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-bold text-gray-900 mb-3">Delivery Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Address:</p>
                    <p className="font-medium text-gray-900">{deliveryInfo.address}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">City:</p>
                    <p className="font-medium text-gray-900">{deliveryInfo.city}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Phone:</p>
                    <p className="font-medium text-gray-900">{deliveryInfo.phone}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Email:</p>
                    <p className="font-medium text-gray-900">{deliveryInfo.email}</p>
                  </div>
                  {deliveryInfo.deliveryDate && (
                    <div>
                      <p className="text-gray-600">Delivery Date:</p>
                      <p className="font-medium text-gray-900">{deliveryInfo.deliveryDate}</p>
                    </div>
                  )}
                  {deliveryInfo.deliveryTime && (
                    <div>
                      <p className="text-gray-600">Delivery Time:</p>
                      <p className="font-medium text-gray-900">{deliveryInfo.deliveryTime}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-bold text-gray-900 mb-3">Order Summary</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(cartTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery Fee:</span>
                    <span className={deliveryFee === 0 ? 'text-green-600 font-bold' : ''}>
                      {deliveryFee === 0 ? 'FREE' : formatCurrency(deliveryFee)}
                    </span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span className="text-green-600">{formatCurrency(finalTotal)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={handleBack}
                  className="bg-gray-300 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-400 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 px-8 rounded-lg font-bold hover:from-blue-600 hover:to-purple-600 transition-all duration-200 flex items-center"
                >
                  Next: Payment
                  <FiCreditCard className="h-5 w-5 ml-2" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Payment Method */}
          {currentStep === 'payment' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Choose Payment Method</h3>
                <p className="text-gray-600">Select how you'd like to pay for your delivery order</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`p-4 border-2 rounded-lg transition-all duration-200 ${
                    paymentMethod === 'card'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center">
                    <FiCreditCard className={`h-6 w-6 mr-3 ${
                      paymentMethod === 'card' ? 'text-blue-600' : 'text-gray-400'
                    }`} />
                    <div className="text-left">
                      <p className="font-medium text-gray-900">Credit/Debit Card</p>
                      <p className="text-sm text-gray-500">Pay securely with your card</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-4 border-2 rounded-lg transition-all duration-200 ${
                    paymentMethod === 'cash'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center">
                    <FiShield className={`h-6 w-6 mr-3 ${
                      paymentMethod === 'cash' ? 'text-blue-600' : 'text-gray-400'
                    }`} />
                    <div className="text-left">
                      <p className="font-medium text-gray-900">Cash on Delivery</p>
                      <p className="text-sm text-gray-500">Pay when you receive your order</p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <FiShield className="h-5 w-5 text-yellow-600 mr-3 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800">Secure Payment</p>
                    <p className="text-sm text-yellow-700">
                      Your payment information is encrypted and secure. We never store your card details.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={handleBack}
                  className="bg-gray-300 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-400 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!paymentMethod || isSubmitting}
                  className={`py-3 px-8 rounded-lg font-bold transition-all duration-200 flex items-center ${
                    !paymentMethod || isSubmitting
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-500 to-blue-500 text-white hover:from-green-600 hover:to-blue-600'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <FiTruck className="h-5 w-5 mr-2" />
                      Place Order
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {currentStep === 'confirmation' && (
            <div className="text-center space-y-6">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <FiCheckCircle className="h-12 w-12 text-green-600" />
              </div>
              
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">🎉 Order Confirmed!</h3>
                <p className="text-gray-600 mb-4">Your delivery order has been placed successfully</p>
              </div>

              <div className="bg-green-50 rounded-lg p-4 max-w-md mx-auto">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Order ID:</span>
                    <span className="font-mono font-bold">DEL-{Date.now()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estimated Delivery:</span>
                    <span className="font-medium">{getEstimatedDelivery()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-bold text-green-600">{formatCurrency(finalTotal)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 max-w-md mx-auto">
                <div className="flex items-start">
                  <FiTruck className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
                  <div className="text-left">
                    <p className="font-medium text-blue-800">What happens next?</p>
                    <ul className="text-sm text-blue-700 mt-2 space-y-1">
                      <li>• We'll confirm your order via email</li>
                      <li>• Our team will prepare your items</li>
                      <li>• You'll receive delivery updates</li>
                      <li>• Driver will contact you before delivery</li>
                    </ul>
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 px-8 rounded-lg font-bold hover:from-blue-600 hover:to-purple-600 transition-all duration-200"
              >
                Continue Shopping
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeliveryOrderModal;
