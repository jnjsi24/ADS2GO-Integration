const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

// Import centralized logger
const logger = require('./utils/logger');

// WebSocket service for real-time device status
const deviceStatusService = require('./services/deviceStatusService');

// ✅ For handling GraphQL file uploads
const { graphqlUploadExpress } = require('graphql-upload');

// 🔹 Import GraphQL typeDefs and resolvers
const { mergeTypeDefs } = require('@graphql-tools/merge');
const { mergeResolvers } = require('@graphql-tools/merge');

// 👇 Schemas
const userTypeDefs = require('./schema/userSchema');
const adminTypeDefs = require('./schema/adminSchema');
const superAdminTypeDefs = require('./schema/superAdminSchema');
const adTypeDefs = require('./schema/adSchema');
const driverTypeDefs = require('./schema/driverSchema');
const paymentTypeDefs = require('./schema/paymentSchema');
const materialTypeDefs = require('./schema/materialSchema');
const pricingConfigTypeDefs = require('./schema/pricingConfigSchema');
const globalPricingMultipliersTypeDefs = require('./schema/globalPricingMultipliersSchema');
const materialTrackingTypeDefs = require('./schema/materialTrackingSchema');
const tabletTypeDefs = require('./schema/tabletSchema');
const adsDeploymentTypeDefs = require('./schema/adsDeploymentSchema');
const screenTrackingTypeDefs = require('./schema/screenTrackingSchema');
const notificationTypeDefs = require('./schema/notificationSchema');
const userReportTypeDefs = require('./schema/userReportSchema');
const driverReportTypeDefs = require('./schema/driverReportSchema');
const contactMessageTypeDefs = require('./schema/contactMessageSchema');
const driverSalaryTypeDefs = require('./schema/driverSalarySchema');
const faqTypeDefs = require('./schema/faqSchema');
const companyAdTypeDefs = require('./schema/companyAdSchema');

// 👇 Resolvers
const userResolvers = require('./resolvers/userResolver');
const adminResolvers = require('./resolvers/adminResolver');
const superAdminResolvers = require('./resolvers/superAdminResolver');
const adResolvers = require('./resolvers/adResolver');
const driverResolvers = require('./resolvers/driverResolver');
const paymentResolvers = require('./resolvers/paymentResolver');
const materialResolver = require('./resolvers/materialResolver');
const pricingConfigResolvers = require('./resolvers/pricingConfigResolver');
const globalPricingMultipliersResolvers = require('./resolvers/globalPricingMultipliersResolver');
const materialTrackingResolvers = require('./resolvers/materialTrackingResolver');
const tabletResolvers = require('./resolvers/tabletResolver');
const adsDeploymentResolvers = require('./resolvers/adsDeploymentResolver');
const screenTrackingResolvers = require('./resolvers/screenTrackingResolver');
const notificationResolvers = require('./resolvers/notificationResolver');
const userReportResolvers = require('./resolvers/userReportResolver');
const driverReportResolvers = require('./resolvers/driverReportResolver');
const contactMessageResolvers = require('./resolvers/contactMessageResolver');
const driverSalaryResolvers = require('./resolvers/driverSalaryResolver');
const faqResolvers = require('./resolvers/faqResolver');
const companyAdResolvers = require('./resolvers/companyAdResolver');

// 👇 Middleware
const { authMiddleware } = require('./middleware/auth');
const { driverMiddleware } = require('./middleware/driverAuth');

// Import jobs
// const { startDeviceStatusJob } = require('./jobs/deviceStatusJob'); // deprecated with ScreenTracking
const { startPaymentDeadlineJob } = require('./jobs/paymentDeadlineJob');
const cronJobs = require('./jobs/cronJobs');

// Import routes
const tabletRoutes = require('./routes/tablet');
const screenTrackingRoutes = require('./routes/screenTracking'); // Now uses DeviceTracking
const deviceTrackingRoutes = require('./routes/deviceTracking');
const materialRoutes = require('./routes/material');
const adsRoutes = require('./routes/ads');
const uploadRoute = require('./routes/upload');
const materialPhotoUploadRoutes = require('./routes/materialPhotoUpload');
const analyticsRoutes = require('./routes/analytics');
const newsletterRoutes = require('./routes/newsletter');
const contactRoutes = require('./routes/contact');
const cleanupRoutes = require('./routes/cleanup');
const deviceHoursNotificationRoutes = require('./routes/deviceHoursNotification');
const deviceOfflineNotificationRoutes = require('./routes/deviceOfflineNotification');
const diagnosticDeviceHoursRoutes = require('./routes/diagnosticDeviceHours');
const googleOAuthRoutes = require('./routes/googleOAuth');

// Import services
// const syncService = require('./services/syncService'); // No longer needed - using MongoDB only
const EmailService = require('./utils/emailService');

// ✅ MongoDB connection - Don't block server startup
// Connect to MongoDB but don't exit if connection fails immediately
// This allows the server to start and health checks to pass
// Railway health checks require the server to be accessible quickly
if (!process.env.MONGODB_URI) {
  console.error('\n❌ MONGODB_URI is not defined in the .env file');
  console.error('⚠️  Server will start but database operations will fail');
  // Don't exit - let the server start so health checks can pass
  // The health check will show MongoDB as disconnected
} else {
  // Connect to MongoDB without blocking server startup
  mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 30000, // Increased from 10000 to 30000
    socketTimeoutMS: 75000, // Increased from 45000 to 75000
    maxPoolSize: 10, // Maximum number of connections in the pool
    minPoolSize: 2, // Minimum number of connections to maintain
    maxIdleTimeMS: 30000, // Close idle connections after 30 seconds
    retryWrites: true,
    retryReads: true,
  })
    .then(() => logger.info('\n💾 MongoDB: Connected to Atlas'))
    .catch(err => {
      console.error('\n❌ MongoDB connection error:', err);
      console.error('⚠️  Server will continue to run, but database operations will fail');
      console.error('⚠️  MongoDB will retry connection automatically');
      // Don't exit - let the server start so Railway health checks can pass
      // Mongoose will retry the connection automatically
    });
}

// ✅ Initialize Email Service
logger.info('\n📧 Initializing Email Service...');
EmailService.initializeTransporter();
EmailService.verifyConfiguration()
  .then(isConfigured => {
    if (isConfigured) {
      const provider = EmailService.provider || 'Unknown';
      logger.info(`✅ Email Service: Ready and configured (${provider.toUpperCase()})`);
      if (provider === 'resend') {
        logger.info('   Using Resend API for email delivery');
      } else if (provider === 'smtp') {
        logger.info('   Using SMTP for email delivery');
      }
    } else {
      logger.warn('⚠️  Email Service: Configuration issues detected');
      if (process.env.RESEND_API_KEY) {
        logger.warn('   RESEND_API_KEY is set but Resend initialization failed');
        logger.warn('   Please check your RESEND_API_KEY is valid');
      } else {
        logger.warn('   Check your .env file for email configuration');
        logger.warn('   For Resend: Set RESEND_API_KEY');
        logger.warn('   For SMTP: Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD (or EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD)');
      }
    }
  })
  .catch(err => {
    console.error('❌ Email Service initialization error:', err.message);
  });

  // ✅ Apollo Server setup
const server = new ApolloServer({
  typeDefs: (() => {
    const schemas = [
      userTypeDefs,
      adminTypeDefs,
      superAdminTypeDefs,
      adTypeDefs,
      driverTypeDefs,
      paymentTypeDefs,
      materialTypeDefs,
      pricingConfigTypeDefs,
      globalPricingMultipliersTypeDefs,
      materialTrackingTypeDefs,
      tabletTypeDefs,
      adsDeploymentTypeDefs,
      screenTrackingTypeDefs,
      notificationTypeDefs,
      userReportTypeDefs,
      driverReportTypeDefs,
      contactMessageTypeDefs,
      driverSalaryTypeDefs,
      faqTypeDefs,
      companyAdTypeDefs,
    ];
    
    return mergeTypeDefs(schemas);
  })(),
  resolvers: (() => {
    const resolvers = [
    {
      JSON: {
        serialize: (value) => value,
        parseValue: (value) => value,
        parseLiteral: (ast) => ast.value,
      },
    },
    userResolvers,
    adminResolvers,
    superAdminResolvers,
    adResolvers,
    driverResolvers,
    paymentResolvers,
    materialResolver,
    pricingConfigResolvers,
    globalPricingMultipliersResolvers,
    materialTrackingResolvers,
    tabletResolvers,
    adsDeploymentResolvers,
    screenTrackingResolvers,
    notificationResolvers,
    userReportResolvers,
    driverReportResolvers,
    contactMessageResolvers,
    driverSalaryResolvers,
    faqResolvers,
    companyAdResolvers,
  ];
    
    return mergeResolvers(resolvers);
  })(),
  // Add request timeout and other performance settings
  requestTimeout: 60000, // 60 seconds timeout for GraphQL requests
  keepAliveTimeout: 65000, // 65 seconds keep-alive timeout
  // Increase allowed payload size for file uploads
  csrfPrevention: true,
  // Format errors properly
  formatError: (err) => {
    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production') {
      if (err.message.includes('timeout') || err.message.includes('ETIMEDOUT')) {
        return {
          message: 'Request timeout - the server took too long to respond. Please try again.',
          extensions: {
            code: err.extensions?.code || 'REQUEST_TIMEOUT'
          }
        };
      }
      
      // Allow authentication-related errors to pass through in production
      // These are user-facing errors that should be shown to users
      const authErrorMessages = [
        'Invalid password',
        'Incorrect password',
        'No user found with this email',
        'This email does not exist',
        'This email already exists',
        'User with this email already exists',
        'No admin found with this email',
        'No superadmin found with this email',
        'Account is temporarily locked',
        'This account has been deleted',
        'Not authenticated',
        'Invalid credentials'
      ];
      
      if (authErrorMessages.some(msg => err.message.includes(msg))) {
        return err;
      }
      
      // Hide internal error details in production
      if (err.extensions?.code === 'INTERNAL_SERVER_ERROR') {
        return {
          message: 'An internal server error occurred',
          extensions: {
            code: 'INTERNAL_SERVER_ERROR'
          }
        };
      }
    }
    return err;
  },
});

const app = express();

// ✅ Register health check endpoint BEFORE startServer() to ensure it's always available
// This ensures Railway can check health even if Apollo Server fails to start
app.get('/health', (req, res) => {
  const mongoStatus = mongoose.connection.readyState;
  const mongoStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  // Return 200 even if MongoDB is still connecting (state 2) or server is starting
  // Only return error if MongoDB is explicitly disconnected (state 0) after initial connection attempt
  const isHealthy = mongoStatus === 1 || mongoStatus === 2;
  
  // Get memory usage
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const rssMB = Math.round(memUsage.rss / 1024 / 1024);
  const heapLimitMB = Math.round((memUsage.heapTotal + memUsage.external) / 1024 / 1024);
  const heapUsagePercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
  
  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    message: isHealthy ? 'Server is healthy' : 'Server is starting up',
    timestamp: new Date().toISOString(),
    status: isHealthy ? 'OK' : 'STARTING',
    uptime: process.uptime(),
    memory: {
      heapUsed: `${heapUsedMB} MB`,
      heapTotal: `${heapTotalMB} MB`,
      rss: `${rssMB} MB`,
      heapUsagePercent: `${heapUsagePercent}%`,
      limit: `${heapLimitMB} MB (approx)`
    },
    mongodb: {
      status: mongoStates[mongoStatus] || 'unknown',
      readyState: mongoStatus
    }
  });
});

async function startServer() {
  // Start Apollo Server (non-blocking - if it fails, server can still respond to health checks)
  try {
    await server.start();
  } catch (apolloError) {
    console.error('⚠️ Apollo Server failed to start:', apolloError.message);
    console.error('⚠️ Server will continue without GraphQL endpoint');
    // Don't throw - allow server to start for health checks
  }

  // ✅ Enable compression for all responses (especially important for large analytics data)
  // Optimized for slow connections: higher compression level, smaller threshold
  app.use(compression({
    level: 9, // Maximum compression for slow connections (was 6)
    threshold: 512, // Compress responses larger than 512 bytes (was 1KB default)
    filter: (req, res) => {
      // Compress all responses except if explicitly disabled
      if (req.headers['x-no-compression']) {
        return false;
      }
      // Always compress JSON responses (analytics data)
      if (req.path.includes('/analytics') || req.path.includes('/api/')) {
        return true;
      }
      return compression.filter(req, res);
    }
  }));

  // ✅ Global CORS
  app.use(cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // In development, allow all origins for easier debugging
      if (process.env.NODE_ENV === 'development') {
        // Only log CORS in verbose mode to reduce spam
        logger.verbose(`🔓 Development mode: Allowing origin ${origin}`);
        return callback(null, true);
      }

      // Allowlist from env (comma-separated)
      const envAllowed = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);

      const defaultAllowed = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost',
        'http://127.0.0.1',
        'https://ads2go-6ead4.web.app',
        'https://ads2go-6ead4.firebaseapp.com',
        // Additional development origins
        'http://localhost:3001',
        'http://localhost:5000',
        'http://localhost:8080',
        'http://localhost:8000',
        'http://10.0.2.2:3000', // Android emulator
        'http://10.0.2.2:5000', // Android emulator
        // Dynamic origins from environment
        ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
        ...(process.env.EXPO_URL ? [process.env.EXPO_URL] : []),
        ...(process.env.LOCAL_NETWORK_IP ? [`http://${process.env.LOCAL_NETWORK_IP}:5000`] : []),
      ];

      const allowedOrigins = new Set([...defaultAllowed, ...envAllowed]);

      const isRailwayApp = /^https?:\/\/([a-z0-9-]+)\.up\.railway\.app$/i.test(origin) ||
                           /^https?:\/\/([a-z0-9-]+)\.railway\.app$/i.test(origin);

      // Allow local network IPs for development (fallback if not in .env)
      const isLocalNetwork = /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}):\d+$/i.test(origin);

      if (allowedOrigins.has(origin) || isRailwayApp || isLocalNetwork) {
        callback(null, true);
      } else {
        logger.warn(`🚫 CORS blocked origin: ${origin}`);
        logger.debug(`📋 Allowed origins:`, Array.from(allowedOrigins));
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200 // Some legacy browsers choke on 204
  }));

  // Handle preflight requests manually
  app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(200);
  });

  // Regular express body parsing with size limits
  app.use(express.json({ limit: '50mb' })); // Increased for large GraphQL operations
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  
  // Serve uploaded media statically
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
  
  // Serve public files statically
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Regular file upload route (must come before GraphQL middleware)
  app.use('/upload', uploadRoute);
  
// Routes
app.use('/tablet', tabletRoutes);
app.use('/screenTracking', screenTrackingRoutes); // Now uses DeviceTracking
app.use('/deviceTracking', deviceTrackingRoutes);
app.use('/material', materialRoutes);
app.use('/ads', adsRoutes);
app.use('/material-photos', materialPhotoUploadRoutes);
app.use('/analytics', analyticsRoutes);
// ✅ PHASE 2: New optimized analytics endpoints (50-100x faster)
app.use('/analytics/v2', require('./routes/analyticsV2'));
// ✅ OPTIMIZED: Device-specific analytics V2 (100x faster)
app.use('/analytics/v2', require('./routes/analyticsDeviceV2'));
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/contact', contactRoutes);
app.use('/cleanup', cleanupRoutes);
app.use('/offlineQueue', require('./routes/offlineQueue'));
app.use('/cron-test', require('./routes/cronTest'));
app.use('/updateTracking', require('./routes/updateTracking'));
app.use('/api/deviceDataHistoryV2', require('./routes/deviceDataHistoryV2'));
app.use('/api/enhancedRoute', require('./routes/enhancedRouteAPI'));
app.use('/api/adAnalytics', require('./routes/adAnalytics'));
app.use('/api/device-hours', deviceHoursNotificationRoutes);
app.use('/api/device-offline', deviceOfflineNotificationRoutes);
app.use('/api/diagnostic', diagnosticDeviceHoursRoutes);
app.use('/api/cleanup-notifications', require('./routes/cleanupNotifications'));
app.use('/api/admin', require('./routes/createIndexes'));
app.use('/api/verifyMetrics', require('./routes/verifyMetrics'));
app.use('/api/analyzeGPS', require('./routes/analyzeGPS'));
app.use('/api/fixDeviceHours', require('./routes/fixDeviceHours')); // Fix for offline devices showing hours
app.use('/api/google-oauth', googleOAuthRoutes);
  
  // GraphQL file uploads middleware (must come after regular upload route)
  // Allow up to 8 concurrent file uploads to support driver registration (profile, vehicle, license front/back, OR, CR)
  app.use(graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 8 }));

  // GraphQL endpoint with combined context
  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }) => {
        // Get both driver and user context
        const { driver } = await driverMiddleware({ req });
        const { user } = await authMiddleware({ req });
        
        // Provide role-specific context
        let context = { driver, user };
        
        if (driver) {
          context.driver = driver;
        }
        
        if (user) {
          if (user.role === 'ADMIN') {
            context.admin = user;
          } else if (user.role === 'SUPERADMIN') {
            context.superAdmin = user;
            // SuperAdmin should also have admin access
            context.admin = user;
          }
        }
        
        return context;
      },
    })
  );

  // ✅ Global error handler
  app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'An unexpected error occurred',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  });

  const PORT = process.env.PORT || 5000;
  
  // Create HTTP server with timeout configurations
  const httpServer = http.createServer(app);
  
  // Configure HTTP server timeouts to prevent hanging connections
  httpServer.timeout = 120000; // 2 minutes - timeout for inactive connections
  httpServer.keepAliveTimeout = 65000; // 65 seconds - timeout for keep-alive connections
  httpServer.headersTimeout = 66000; // 66 seconds - timeout for headers (should be > keepAliveTimeout)
  
  // Set max headers count to prevent header overflow
  httpServer.maxHeadersCount = 2000;
  
  // Handle timeout errors
  httpServer.on('timeout', (socket) => {
    // ✅ FIX: Suppress timeout warnings - these are expected for long-polling connections
    // Only log in verbose mode
    if (process.env.VERBOSE_LOGS === 'true') {
      console.warn('⚠️ HTTP request timeout - closing connection');
    }
    socket.destroy();
  });
  
  // Handle client errors (connection resets, etc.)
  httpServer.on('clientError', (err, socket) => {
    if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
      // These are common and not critical - just close the connection
      socket.destroy();
    } else {
      // ✅ FIX: Only log non-common errors in verbose mode
      if (process.env.VERBOSE_LOGS === 'true') {
        console.error('❌ HTTP client error:', err.message);
      }
      socket.destroy();
    }
  });
  
  // Initialize WebSocket server
  deviceStatusService.initializeWebSocketServer(httpServer);

  // Start the server IMMEDIATELY - don't wait for other services
  // This allows Railway health checks to pass quickly
  return new Promise((resolve, reject) => {
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Server ready at http://0.0.0.0:${PORT}`);
      console.log(`\n🚀 GraphQL server ready at http://0.0.0.0:${PORT}/graphql`);
      console.log(`\n✅ Health check available at http://0.0.0.0:${PORT}/health`);
      
      // Log initial memory usage
      const initialMem = process.memoryUsage();
      console.log(`\n💾 Memory: Heap ${Math.round(initialMem.heapUsed / 1024 / 1024)}MB / ${Math.round(initialMem.heapTotal / 1024 / 1024)}MB | RSS ${Math.round(initialMem.rss / 1024 / 1024)}MB`);
      
      // Periodic memory monitoring (every 5 minutes)
      setInterval(() => {
        const mem = process.memoryUsage();
        const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
        const rssMB = Math.round(mem.rss / 1024 / 1024);
        const heapUsagePercent = Math.round((mem.heapUsed / mem.heapTotal) * 100);
        
        // Only log if heap usage is above 50% or if verbose mode is enabled
        if (heapUsagePercent > 50 || process.env.VERBOSE_LOGS === 'true') {
          logger.info(`💾 Memory: Heap ${heapUsedMB}MB / ${heapTotalMB}MB (${heapUsagePercent}%) | RSS ${rssMB}MB`);
        }
      }, 5 * 60 * 1000); // Every 5 minutes
      
      // Start background services (non-blocking)
      try {
        // Start the device status monitoring job
        // startDeviceStatusJob(); // deprecated
        startPaymentDeadlineJob();
        
        // Start cron jobs for daily data archiving
        cronJobs.start();
        console.log('📅 Cron jobs started for daily data archiving');
      } catch (error) {
        console.error('⚠️ Error starting background services:', error);
        // Don't fail server startup if background services fail
      }
      
      // Start scheduled ad service
      try {
        const scheduledAdService = require('./services/scheduledAdService');
        scheduledAdService.start();
      } catch (error) {
        console.error('⚠️ Error starting scheduled ad service:', error);
        // Don't fail server startup if this fails
      }
      
      resolve();
    });
    
    httpServer.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} is already in use. Please kill the process using this port.`);
        reject(error);
      } else {
        console.error('\n❌ Server startup error:', error);
        reject(error);
      }
    });
  });
  
  // Handle server shutdown gracefully
  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully');
    httpServer.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });  
    // Start sync service in production (no longer needed - using MongoDB only)
  // if (process.env.NODE_ENV === 'production') {
  //   syncService.start();
  // }
  
  // Handle server errors
  httpServer.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is already in use. Please kill the process using this port.`);
      process.exit(1);
    } else {
      console.error('\n❌ Server startup error:', error);
    }
  });
}

// Start server with proper error handling
startServer().catch((error) => {
  console.error('❌ Fatal error starting server:', error);
  // Don't exit immediately - give Railway time to see the error in logs
  // But also ensure the process doesn't hang indefinitely
  setTimeout(() => {
    console.error('❌ Server startup failed, exiting...');
    process.exit(1);
  }, 5000);
});