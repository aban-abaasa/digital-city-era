import React, { useState, useEffect, useRef } from 'react';
import { 
  FiMessageCircle, FiX, FiSend, FiMic, FiMicOff, 
  FiShoppingBag, FiSearch, FiHeart, FiStar, FiHelpCircle,
  FiTrendingUp, FiGift, FiTruck, FiCreditCard, FiUser,
  FiChevronRight
} from 'react-icons/fi';
import { toast } from 'react-toastify';

const VirtualAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'assistant',
      content: "Hi! I'm your personal FareDeal shopping assistant. How can I help you today?",
      timestamp: new Date(),
      suggestions: [
        "Find the best deals",
        "Track my order",
        "Product recommendations",
        "Account help"
      ]
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const response = generateAIResponse(inputMessage);
      const assistantMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: response.content,
        timestamp: new Date(),
        suggestions: response.suggestions,
        actions: response.actions
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const generateAIResponse = (userInput) => {
    const input = userInput.toLowerCase();
    
    if (input.includes('deal') || input.includes('sale') || input.includes('discount')) {
      return {
        content: "🎯 I found some amazing deals for you! We have up to 50% off on electronics, free shipping on orders over $100, and exclusive member discounts. Would you like me to show you the best offers?",
        suggestions: ["Show me deals", "Electronics sale", "Free shipping info"],
        actions: [
          { label: "Browse Deals", action: () => window.location.href = '/customer-delivery' },
          { label: "View Electronics", action: () => toast.info("Filtering electronics...") }
        ]
      };
    }
    
    if (input.includes('order') || input.includes('track') || input.includes('delivery')) {
      return {
        content: "📦 I can help you track your orders! Your recent order #ORD-789123 is out for delivery and should arrive today. Would you like me to show you the tracking details?",
        suggestions: ["Track order", "Delivery status", "Order history"],
        actions: [
          { label: "Track Order", action: () => toast.info("Opening order tracking...") },
          { label: "Order History", action: () => toast.info("Loading order history...") }
        ]
      };
    }
    
    if (input.includes('recommend') || input.includes('suggest') || input.includes('best')) {
      return {
        content: "✨ Based on your purchase history, I recommend the iPhone 15 Pro Max, AirPods Pro 3rd Gen, and the new MacBook Air M2. These are trending and match your preferences!",
        suggestions: ["Show recommendations", "iPhone deals", "MacBook offers"],
        actions: [
          { label: "View Recommendations", action: () => toast.info("Loading personalized recommendations...") },
          { label: "iPhone 15 Pro", action: () => toast.info("Showing iPhone 15 Pro details...") }
        ]
      };
    }
    
    if (input.includes('help') || input.includes('support') || input.includes('problem')) {
      return {
        content: "🆘 I'm here to help! I can assist with orders, returns, account issues, product questions, and more. What specific help do you need?",
        suggestions: ["Return policy", "Account help", "Product questions"],
        actions: [
          { label: "Contact Support", action: () => toast.info("Connecting to support...") },
          { label: "FAQ", action: () => toast.info("Opening FAQ...") }
        ]
      };
    }
    
    if (input.includes('payment') || input.includes('checkout') || input.includes('buy')) {
      return {
        content: "💳 I can help you with payments! We accept all major credit cards, PayPal, Apple Pay, and Google Pay. You can also use your loyalty points for discounts!",
        suggestions: ["Payment methods", "Loyalty points", "Checkout help"],
        actions: [
          { label: "Go to Checkout", action: () => window.location.href = '/customer-payment' },
          { label: "View Cart", action: () => toast.info("Opening shopping cart...") }
        ]
      };
    }
    
    // Default response
    return {
      content: "I understand you're looking for help. I can assist with finding products, tracking orders, recommendations, deals, and account support. What would you like to know more about?",
      suggestions: ["Product search", "Order help", "Account support", "Deals & offers"],
      actions: [
        { label: "Browse Products", action: () => window.location.href = '/customer-delivery' },
        { label: "My Account", action: () => toast.info("Opening account settings...") }
      ]
    };
  };

  const handleSuggestionClick = (suggestion) => {
    setInputMessage(suggestion);
    inputRef.current?.focus();
  };

  const handleActionClick = (action) => {
    action.action();
  };

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      toast.info("Voice input stopped");
    } else {
      setIsListening(true);
      toast.info("Listening... Speak now");
      // Simulate voice input
      setTimeout(() => {
        setIsListening(false);
        setInputMessage("Find me the best deals on smartphones");
        toast.success("Voice input received");
      }, 3000);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Floating Assistant Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-all duration-300 z-50 group"
        >
          <FiMessageCircle className="h-6 w-6 group-hover:scale-110 transition-transform" />
          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center animate-pulse">
            AI
          </div>
        </button>
      )}

      {/* Assistant Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-3xl shadow-2xl border border-gray-200 z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <FiMessageCircle className="h-6 w-6" />
              </div>
              <div>
                <div className="font-bold">FareDeal Assistant</div>
                <div className="text-xs text-blue-100">AI-Powered Shopping Helper</div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white transition-colors"
            >
              <FiX className="h-6 w-6" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
                  <div className={`rounded-2xl p-3 ${
                    message.type === 'user' 
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white' 
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    <div className="text-sm">{message.content}</div>
                    <div className={`text-xs mt-1 ${
                      message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  
                  {/* Suggestions */}
                  {message.suggestions && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="text-xs bg-white border border-gray-300 text-gray-700 px-3 py-1 rounded-full hover:bg-gray-50 transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* Actions */}
                  {message.actions && (
                    <div className="mt-3 space-y-2">
                      {message.actions.map((action, index) => (
                        <button
                          key={index}
                          onClick={() => handleActionClick(action)}
                          className="w-full text-left bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:from-blue-600 hover:to-purple-700 transition-all duration-200 flex items-center justify-between"
                        >
                          <span>{action.label}</span>
                          <FiChevronRight className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl p-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleListening}
                className={`p-2 rounded-full transition-colors ${
                  isListening 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {isListening ? <FiMicOff className="h-5 w-5" /> : <FiMic className="h-5 w-5" />}
              </button>
              
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything about shopping..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim()}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-blue-500 to-purple-600 text-white p-2 rounded-full hover:scale-110 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiSend className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className="mt-2 text-xs text-gray-500 text-center">
              💡 Try: "Find me deals on smartphones" or "Track my order"
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VirtualAssistant;
