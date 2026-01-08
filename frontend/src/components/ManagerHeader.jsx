import React from 'react';
import { FiBell, FiSettings, FiLogOut, FiGrid, FiChevronDown } from 'react-icons/fi';
import { toast } from 'react-toastify';

const ManagerHeader = ({ 
  currentTime, 
  notificationCount, 
  setNotificationCount,
  showMobileMenu,
  setShowMobileMenu,
  isMobile 
}) => {

  const getUgandanGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return '🌅 Wasuze otya nno'; // Good morning in Luganda
    if (hour < 17) return '🌞 Osiibye otya'; // Good afternoon in Luganda  
    return '🌙 Oraire otya'; // Good evening in Luganda
  };

  return (
    <div className="bg-gradient-to-r from-yellow-400 via-green-500 to-red-500 shadow-2xl relative overflow-hidden">
      {/* Uganda Flag Pattern Background */}
      <div className="absolute inset-0 opacity-10">
        <div className="h-1/3 bg-black"></div>
        <div className="h-1/3 bg-yellow-400"></div>
        <div className="h-1/3 bg-red-600"></div>
      </div>
      
      {/* Animated Crested Crane (Uganda's national bird) */}
      <div className="absolute top-2 right-20 text-6xl opacity-20 animate-bounce">
        🦩
      </div>
      
      <div className="relative max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4 sm:py-6">
          {/* Left Section - Brand & Location */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* FAREDEAL Logo with Uganda Flag */}
            <div className="relative h-12 w-12 sm:h-16 sm:w-16">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 via-black to-red-600 rounded-full animate-pulse shadow-xl"></div>
              <div className="relative h-full w-full bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-yellow-400">
                <span className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-yellow-500 to-red-500 bg-clip-text text-transparent">
                  🏪
                </span>
              </div>
              {/* Live indicator */}
              <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs px-2 py-1 rounded-full animate-bounce font-bold">
                LIVE
              </div>
            </div>
            
            {/* Brand & Location Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-3xl font-bold text-white drop-shadow-lg">
                  {isMobile ? 'FAREDEAL' : 'FAREDEAL Manager Portal'}
                </h1>
                <span className="text-2xl animate-wave">🇺🇬</span>
              </div>
              <div className="flex items-center space-x-2 text-sm sm:text-base">
                <span className="text-yellow-100 font-medium">
                  {getUgandanGreeting()} • Kampala, Uganda
                </span>
                {!isMobile && (
                  <>
                    <span className="text-yellow-200">•</span>
                    <span className="text-yellow-100">
                      {currentTime.toLocaleTimeString('en-UG', { 
                        timeZone: 'Africa/Kampala',
                        hour12: true 
                      })} EAT
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Section - Stats & Actions */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Today's Quick Stats - Hidden on mobile */}
            <div className="hidden lg:flex items-center space-x-4 mr-6">
              <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/20">
                <div className="text-xl font-bold text-white">UGX 2.4M</div>
                <div className="text-xs text-yellow-100">Today's Sales</div>
              </div>
              <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/20">
                <div className="text-xl font-bold text-white">28</div>
                <div className="text-xs text-yellow-100">Team Online</div>
              </div>
              <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/20">
                <div className="text-xl font-bold text-white">156</div>
                <div className="text-xs text-yellow-100">Orders Today</div>
              </div>
            </div>

            {/* Notification Bell with Uganda Style */}
            <button 
              onClick={() => {
                setNotificationCount(0);
                toast.success('🔔 Amakulu (Notifications) cleared!');
              }}
              className="relative p-3 text-white hover:bg-white/20 rounded-xl transition-all duration-300 group backdrop-blur-sm border border-white/20"
            >
              <FiBell className="h-6 w-6 group-hover:animate-bounce" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center animate-pulse font-bold border-2 border-white">
                  {notificationCount}
                </span>
              )}
            </button>

            {/* Settings with Gear Animation */}
            <button 
              onClick={() => toast.info('⚙️ Ensengeka (Settings) opened')}
              className="p-3 text-white hover:bg-white/20 rounded-xl transition-all duration-300 group backdrop-blur-sm border border-white/20"
            >
              <FiSettings className="h-6 w-6 group-hover:rotate-180 transition-transform duration-500" />
            </button>

            {/* Profile Menu with Cultural Touch */}
            <div className="relative">
              <button 
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="flex items-center space-x-3 p-2 text-white hover:bg-white/20 rounded-xl transition-all duration-300 backdrop-blur-sm border border-white/20"
              >
                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                  <span className="text-lg sm:text-xl font-bold text-white">👨‍💼</span>
                </div>
                {!isMobile && (
                  <div className="text-left">
                    <div className="text-sm font-bold text-white">Manager</div>
                    <div className="text-xs text-yellow-100 flex items-center">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></div>
                      Online • Kampala
                    </div>
                  </div>
                )}
                <FiChevronDown className={`h-4 w-4 text-yellow-200 transition-transform duration-300 ${
                  showMobileMenu ? 'rotate-180' : ''
                }`} />
              </button>

              {/* Enhanced Profile Dropdown */}
              {showMobileMenu && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                  {/* Header with Uganda colors */}
                  <div className="bg-gradient-to-r from-yellow-400 via-black to-red-600 p-4 text-white">
                    <div className="flex items-center space-x-3">
                      <div className="h-14 w-14 bg-white rounded-full flex items-center justify-center">
                        <span className="text-2xl">👨‍💼</span>
                      </div>
                      <div>
                        <div className="font-bold text-lg">Nakiyonga Catherine</div>
                        <div className="text-yellow-100 text-sm">Store Manager</div>
                        <div className="text-yellow-200 text-xs flex items-center">
                          <div className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></div>
                          Online since 9:00 AM EAT
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Menu Items */}
                  <div className="p-2">
                    <button 
                      onClick={() => {
                        setShowMobileMenu(false);
                        toast.info('⚙️ Account settings opened');
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-yellow-50 rounded-xl transition-colors"
                    >
                      <FiSettings className="h-5 w-5 text-yellow-600" />
                      <span className="font-medium">Account Settings</span>
                    </button>
                    
                    <button 
                      onClick={() => {
                        setShowMobileMenu(false);
                        toast.info('🔔 Notifications panel opened');
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-green-50 rounded-xl transition-colors"
                    >
                      <FiBell className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Notifications</span>
                      {notificationCount > 0 && (
                        <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                          {notificationCount}
                        </span>
                      )}
                    </button>
                    
                    <button 
                      onClick={() => {
                        setShowMobileMenu(false);
                        toast.info('❓ Help center opened');
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-blue-50 rounded-xl transition-colors"
                    >
                      <span className="text-lg">🇺🇬</span>
                      <span className="font-medium">Uganda Support</span>
                    </button>
                    
                    <hr className="my-2" />
                    
                    <button 
                      onClick={() => {
                        setShowMobileMenu(false);
                        toast.success('👋 Webale (Thank you)! Logged out');
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <FiLogOut className="h-5 w-5" />
                      <span className="font-medium">Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            {isMobile && (
              <button 
                onClick={() => setShowMobileMenu(!showMobileMenu)} 
                className="p-3 text-white hover:bg-white/20 rounded-xl transition-all duration-300 backdrop-blur-sm border border-white/20"
              >
                <FiGrid className="h-6 w-6" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Decorative Wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg className="w-full h-4 text-white" fill="currentColor" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z" opacity=".25"></path>
          <path d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z" opacity=".5"></path>
          <path d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z" className="text-gray-50"></path>
        </svg>
      </div>

      {/* CSS for wave animation */}
      <style jsx>{`
        @keyframes wave {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(20deg); }
          75% { transform: rotate(-20deg); }
        }
        .animate-wave {
          animation: wave 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default ManagerHeader;
