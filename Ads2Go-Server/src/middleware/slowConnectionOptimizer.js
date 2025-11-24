/**
 * Middleware to optimize responses for slow internet connections
 * - Adds pagination support
 * - Limits response sizes
 * - Adds cache headers
 * - Provides field selection
 */

/**
 * Parse pagination parameters from query string
 */
function parsePagination(req) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit) || 50)); // Max 1000, default 50
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
}

/**
 * Parse field selection from query string (comma-separated)
 * Example: ?fields=id,name,email
 */
function parseFields(req) {
  const fields = req.query.fields;
  if (!fields) return null;
  
  return fields.split(',').map(f => f.trim()).filter(Boolean);
}

/**
 * Project only selected fields from an object
 */
function projectFields(obj, fields) {
  if (!fields || fields.length === 0) return obj;
  
  const result = {};
  fields.forEach(field => {
    if (field.includes('.')) {
      // Handle nested fields (e.g., "user.name")
      const parts = field.split('.');
      let value = obj;
      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = value[part];
        } else {
          value = undefined;
          break;
        }
      }
      if (value !== undefined) {
        result[field] = value;
      }
    } else {
      if (obj.hasOwnProperty(field)) {
        result[field] = obj[field];
      }
    }
  });
  
  return result;
}

/**
 * Project fields from an array of objects
 */
function projectFieldsArray(arr, fields) {
  if (!arr || !Array.isArray(arr)) return arr;
  if (!fields || fields.length === 0) return arr;
  
  return arr.map(obj => projectFields(obj, fields));
}

/**
 * Calculate approximate response size in bytes
 */
function estimateSize(obj) {
  return JSON.stringify(obj).length;
}

/**
 * Format size for display
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Add cache headers to response
 */
function addCacheHeaders(res, maxAge = 300) {
  res.set('Cache-Control', `public, max-age=${maxAge}`);
  res.set('Vary', 'Accept-Encoding'); // Vary on compression
}

/**
 * Add ETag header for conditional requests
 */
function addETag(res, data) {
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
  res.set('ETag', `"${hash}"`);
  return hash;
}

/**
 * Check if client has cached version (304 Not Modified)
 */
function checkETag(req, res, etag) {
  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch && ifNoneMatch === `"${etag}"`) {
    res.status(304).end();
    return true;
  }
  return false;
}

/**
 * Limit array size and add pagination metadata
 */
function paginateArray(arr, page, limit) {
  const total = arr.length;
  const skip = (page - 1) * limit;
  const paginated = arr.slice(skip, skip + limit);
  const totalPages = Math.ceil(total / limit);
  
  return {
    data: paginated,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
      hasPrevious: page > 1
    }
  };
}

/**
 * Create a lightweight summary from full analytics data
 */
function createSummary(analytics) {
  if (!analytics || typeof analytics !== 'object') return analytics;
  
  // Extract only key metrics
  const summary = {
    totals: {
      adsPlayed: analytics.totals?.adsPlayed || 0,
      displayTime: analytics.totals?.displayTime || 0,
      qrScans: analytics.totals?.qrScans || 0,
      impressions: analytics.totals?.impressions || 0
    },
    period: analytics.period,
    dateRange: analytics.dateRange,
    // Include only first few items for preview
    ads: analytics.ads?.slice(0, 5) || [],
    dailyStats: analytics.dailyStats?.slice(0, 7) || [], // Last 7 days
    deviceStats: analytics.deviceStats?.slice(0, 10) || [] // Top 10 devices
  };
  
  if (analytics.ads && analytics.ads.length > 5) {
    summary.adsTruncated = true;
    summary.totalAds = analytics.ads.length;
  }
  
  if (analytics.dailyStats && analytics.dailyStats.length > 7) {
    summary.dailyStatsTruncated = true;
    summary.totalDays = analytics.dailyStats.length;
  }
  
  if (analytics.deviceStats && analytics.deviceStats.length > 10) {
    summary.deviceStatsTruncated = true;
    summary.totalDevices = analytics.deviceStats.length;
  }
  
  return summary;
}

/**
 * Main middleware function
 */
function slowConnectionOptimizer(options = {}) {
  const {
    enablePagination = true,
    enableFieldSelection = true,
    enableCaching = true,
    enableETags = true,
    maxResponseSize = 5 * 1024 * 1024, // 5MB default
    defaultLimit = 50,
    cacheMaxAge = 300 // 5 minutes
  } = options;
  
  return (req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);
    
    // Override json method to add optimizations
    res.json = function(data) {
      let optimizedData = data;
      const startSize = estimateSize(data);
      
      // Apply field selection if requested
      if (enableFieldSelection) {
        const fields = parseFields(req);
        if (fields && fields.length > 0) {
          if (Array.isArray(data)) {
            optimizedData = projectFieldsArray(data, fields);
          } else if (data && typeof data === 'object') {
            if (data.data && Array.isArray(data.data)) {
              // Handle paginated responses
              optimizedData = {
                ...data,
                data: projectFieldsArray(data.data, fields)
              };
            } else {
              optimizedData = projectFields(data, fields);
            }
          }
        }
      }
      
      // Apply pagination if requested
      if (enablePagination && req.query.page) {
        const { page, limit } = parsePagination(req);
        
        if (Array.isArray(optimizedData)) {
          const paginated = paginateArray(optimizedData, page, limit);
          optimizedData = paginated;
        } else if (optimizedData && typeof optimizedData === 'object' && optimizedData.data && Array.isArray(optimizedData.data)) {
          // Already paginated, update pagination info
          const { page: newPage, limit: newLimit } = parsePagination(req);
          const paginated = paginateArray(optimizedData.data, newPage, newLimit);
          optimizedData = {
            ...optimizedData,
            data: paginated.data,
            pagination: paginated.pagination
          };
        }
      }
      
      // Add cache headers
      if (enableCaching) {
        addCacheHeaders(res, cacheMaxAge);
      }
      
      // Add ETag for conditional requests
      if (enableETags) {
        const etag = addETag(res, optimizedData);
        if (checkETag(req, res, etag)) {
          return; // 304 Not Modified already sent
        }
      }
      
      // Check response size and warn if too large
      const finalSize = estimateSize(optimizedData);
      if (finalSize > maxResponseSize) {
        console.warn(`⚠️ [Slow Connection] Large response: ${formatSize(finalSize)} (limit: ${formatSize(maxResponseSize)})`);
        res.set('X-Response-Size', finalSize.toString());
        res.set('X-Response-Size-Warning', 'large');
      }
      
      // Add response metadata
      res.set('X-Response-Size', finalSize.toString());
      res.set('X-Original-Size', startSize.toString());
      if (finalSize < startSize) {
        res.set('X-Size-Reduction', `${((1 - finalSize / startSize) * 100).toFixed(1)}%`);
      }
      
      // Call original json method
      return originalJson(optimizedData);
    };
    
    // Add helper methods to request object
    req.parsePagination = () => parsePagination(req);
    req.parseFields = () => parseFields(req);
    req.createSummary = (data) => createSummary(data);
    
    next();
  };
}

module.exports = {
  slowConnectionOptimizer,
  parsePagination,
  parseFields,
  projectFields,
  projectFieldsArray,
  paginateArray,
  createSummary,
  addCacheHeaders,
  addETag,
  checkETag,
  estimateSize,
  formatSize
};

