import React, { useState, useEffect } from 'react';
import { FiWifi, FiWifiOff, FiCheckCircle, FiAlertCircle, FiRefreshCw, FiGlobe } from 'react-icons/fi';
import { supabase } from '../services/supabase';

/**
 * Mobile Connection Tester Component
 * Helps diagnose network and Supabase connectivity issues on mobile
 */
const MobileConnectionTester = ({ showDebug = false }) => {
  const [results, setResults] = useState({
    online: null,
    supabaseHealth: null,
    latency: null,
    testMessage: ''
  });
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    // Listen for online/offline events
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  const updateOnlineStatus = () => {
    setResults(prev => ({
      ...prev,
      online: navigator.onLine
    }));
  };

  const runTests = async () => {
    setTesting(true);
    const startTime = Date.now();

    try {
      // Test 1: Check if online
      const isOnline = navigator.onLine;
      setResults(prev => ({
        ...prev,
        online: isOnline,
        testMessage: isOnline ? '✅ Device is online' : '❌ Device is offline'
      }));

      if (!isOnline) {
        setTesting(false);
        return;
      }

      // Test 2: Test Supabase connection with timeout
      setResults(prev => ({
        ...prev,
        testMessage: '🔄 Testing Supabase connection...'
      }));

      const supabaseTestStart = Date.now();
      
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Supabase timeout')), 10000)
        );
        
        const testPromise = supabase.auth.getUser();
        
        await Promise.race([testPromise, timeoutPromise]);
        
        const supabaseLatency = Date.now() - supabaseTestStart;
        
        setResults(prev => ({
          ...prev,
          supabaseHealth: true,
          latency: supabaseLatency,
          testMessage: `✅ Supabase responsive (${supabaseLatency}ms)`
        }));
      } catch (error) {
        const supabaseLatency = Date.now() - supabaseTestStart;
        
        setResults(prev => ({
          ...prev,
          supabaseHealth: false,
          latency: supabaseLatency,
          testMessage: `⚠️ Supabase slow or unresponsive (${supabaseLatency}ms)`
        }));
      }

      const totalTime = Date.now() - startTime;
      
      if (showDebug) {
        console.log('📊 Connection Test Results:');
        console.log('  Online:', isOnline);
        console.log('  Supabase Health:', results.supabaseHealth);
        console.log('  Total Time:', totalTime + 'ms');
      }

    } catch (error) {
      setResults(prev => ({
        ...prev,
        testMessage: '❌ Test failed: ' + error.message
      }));
    } finally {
      setTesting(false);
    }
  };

  if (!showDebug) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm z-50 border-2 border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <FiGlobe className="w-5 h-5" />
          Connection Test
        </h3>
        <button
          onClick={runTests}
          disabled={testing}
          className="p-1 hover:bg-gray-100 rounded transition"
        >
          <FiRefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-3">
        {/* Online Status */}
        <div className="flex items-center gap-2">
          {results.online ? (
            <FiWifi className="w-5 h-5 text-green-600" />
          ) : (
            <FiWifiOff className="w-5 h-5 text-red-600" />
          )}
          <div>
            <div className="text-sm font-medium text-gray-700">
              {results.online ? '🟢 Online' : '🔴 Offline'}
            </div>
          </div>
        </div>

        {/* Supabase Health */}
        {results.supabaseHealth !== null && (
          <div className="flex items-center gap-2">
            {results.supabaseHealth ? (
              <FiCheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <FiAlertCircle className="w-5 h-5 text-yellow-600" />
            )}
            <div>
              <div className="text-sm font-medium text-gray-700">
                Supabase: {results.supabaseHealth ? '✅ Good' : '⚠️ Slow'}
              </div>
              {results.latency && (
                <div className="text-xs text-gray-500">
                  Latency: {results.latency}ms
                </div>
              )}
            </div>
          </div>
        )}

        {/* Test Message */}
        {results.testMessage && (
          <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-200">
            {results.testMessage}
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={runTests}
          disabled={testing}
          className="w-full mt-4 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:bg-gray-400 transition"
        >
          {testing ? '🔄 Testing...' : 'Run Connection Test'}
        </button>
      </div>
    </div>
  );
};

export default MobileConnectionTester;
