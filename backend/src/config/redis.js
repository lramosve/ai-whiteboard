// Redis removed - using in-memory storage for development
// For production, consider adding back Redis or using a managed cache service

import { logger } from '../utils/logger.js';

class InMemoryCache {
  constructor() {
    this.cache = new Map();
    this.locks = new Map();
  }

  async connect() {
    logger.info('Using in-memory cache (no Redis)');
    return true;
  }

  async get(key) {
    return this.cache.get(key) || null;
  }

  async set(key, value, expirySeconds = null) {
    this.cache.set(key, value);
    
    if (expirySeconds) {
      setTimeout(() => {
        this.cache.delete(key);
      }, expirySeconds * 1000);
    }
    
    return 'OK';
  }

  async del(key) {
    return this.cache.delete(key) ? 1 : 0;
  }

  async exists(key) {
    return this.cache.has(key) ? 1 : 0;
  }

  async keys(pattern) {
    // Simple pattern matching (only supports * wildcard at end)
    const regex = new RegExp('^' + pattern.replace('*', '.*'));
    return Array.from(this.cache.keys()).filter(key => regex.test(key));
  }

  async setex(key, seconds, value) {
    return this.set(key, value, seconds);
  }

  async hget(hash, field) {
    const hashData = this.cache.get(hash);
    return hashData ? hashData[field] : null;
  }

  async hset(hash, field, value) {
    const hashData = this.cache.get(hash) || {};
    hashData[field] = value;
    this.cache.set(hash, hashData);
    return 1;
  }

  async hdel(hash, field) {
    const hashData = this.cache.get(hash);
    if (hashData && field in hashData) {
      delete hashData[field];
      return 1;
    }
    return 0;
  }

  async hgetall(hash) {
    return this.cache.get(hash) || {};
  }

  // Lock acquisition (simple in-memory implementation)
  async acquireLock(resource, ttlMs = 30000) {
    const lockKey = `lock:${resource}`;
    const lockValue = `${Date.now()}_${Math.random()}`;
    
    // Check if lock exists and is still valid
    const existingLock = this.locks.get(lockKey);
    if (existingLock && existingLock.expiry > Date.now()) {
      return null; // Lock is held by someone else
    }

    // Acquire lock
    this.locks.set(lockKey, {
      value: lockValue,
      expiry: Date.now() + ttlMs
    });

    // Auto-release after TTL
    setTimeout(() => {
      const lock = this.locks.get(lockKey);
      if (lock && lock.value === lockValue) {
        this.locks.delete(lockKey);
      }
    }, ttlMs);

    return lockValue;
  }

  async releaseLock(resource, lockValue) {
    const lockKey = `lock:${resource}`;
    const lock = this.locks.get(lockKey);
    
    if (lock && lock.value === lockValue) {
      this.locks.delete(lockKey);
      return true;
    }
    
    return false;
  }

  async quit() {
    this.cache.clear();
    this.locks.clear();
    logger.info('In-memory cache cleared');
  }
}

export const redisClient = new InMemoryCache();
