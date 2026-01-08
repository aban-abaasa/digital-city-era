/**
 * Fast Connection Cache System
 * Optimizes login speed with parallel operations, caching, and request deduplication
 */

class FastConnectionCache {
  constructor() {
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.requestTimestamps = new Map();
  }

  /**
   * Execute with request deduplication (prevent duplicate API calls)
   * If request is already in flight, return the existing promise
   */
  async executeWithDedup(key, asyncFn) {
    // If request already pending, return existing promise
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }

    // Execute request and cache the promise
    const promise = asyncFn()
      .then(result => {
        this.cache.set(key, result);
        this.pendingRequests.delete(key);
        return result;
      })
      .catch(error => {
        this.pendingRequests.delete(key);
        throw error;
      });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  /**
   * Parallel execution - run multiple async operations in parallel
   */
  async executeParallel(operations) {
    return Promise.all(operations.map(op => op()));
  }

  /**
   * Get cached value or execute with timeout
   */
  async getOrExecute(key, asyncFn, options = {}) {
    const { ttl = 5 * 60 * 1000, timeout = 30000 } = options;

    // Check cache
    const cached = this.cache.get(key);
    if (cached) {
      const age = Date.now() - (this.requestTimestamps.get(key) || 0);
      if (age < ttl) {
        return cached;
      }
      this.cache.delete(key);
    }

    // Execute with timeout
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Request timeout: ${timeout}ms`));
      }, timeout);

      asyncFn()
        .then(result => {
          clearTimeout(timeoutId);
          this.cache.set(key, result);
          this.requestTimestamps.set(key, Date.now());
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Batch operations - combine multiple requests into one
   */
  async batch(operations) {
    const results = [];
    
    // Simple chunking without generator
    const chunkSize = 5;
    for (let i = 0; i < operations.length; i += chunkSize) {
      const chunk = operations.slice(i, i + chunkSize);
      const groupResults = await Promise.all(
        chunk.map(op => op().catch(err => ({ error: err })))
      );
      results.push(...groupResults);
    }

    return results;
  }

  /**
   * Prefetch data to warm cache
   */
  async prefetch(key, asyncFn, options = {}) {
    try {
      const result = await this.getOrExecute(key, asyncFn, {
        timeout: 10000,
        ...options
      });
      return result;
    } catch (error) {
      console.log(`Prefetch failed for ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Clear cache
   */
  clear(key = null) {
    if (key) {
      this.cache.delete(key);
      this.requestTimestamps.delete(key);
    } else {
      this.cache.clear();
      this.requestTimestamps.clear();
    }
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      cacheKeys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export const fastCache = new FastConnectionCache();

/**
 * Optimized API caller with retry logic and exponential backoff
 */
export const optimizedApiCall = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    initialDelay = 500,
    maxDelay = 5000,
    timeout = 30000
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await executeWithTimeout(fn, timeout);
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        // Exponential backoff with jitter
        const jitter = Math.random() * 1000;
        const waitTime = Math.min(delay + jitter, maxDelay);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        delay *= 2;
      }
    }
  }

  throw lastError;
};

/**
 * Execute function with timeout wrapper
 */
export const executeWithTimeout = (fn, timeout = 30000) => {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    )
  ]);
};

/**
 * Connection quality detector
 */
export const detectConnectionQuality = async () => {
  const startTime = Date.now();
  try {
    // Use a small request to measure latency
    const response = await fetch('data:text/plain,ping', { method: 'HEAD' });
    const latency = Date.now() - startTime;

    return {
      online: navigator.onLine,
      latency,
      quality: latency < 100 ? 'fast' : latency < 500 ? 'normal' : 'slow',
      effectiveType: navigator.connection?.effectiveType || 'unknown'
    };
  } catch {
    return {
      online: navigator.onLine,
      latency: Infinity,
      quality: 'unknown',
      effectiveType: navigator.connection?.effectiveType || 'unknown'
    };
  }
};

export default fastCache;
