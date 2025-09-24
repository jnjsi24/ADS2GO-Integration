const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

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
const adsPlanTypeDefs = require('./schema/adsPlanSchema');
const materialTrackingTypeDefs = require('./schema/materialTrackingSchema');
const tabletTypeDefs = require('./schema/tabletSchema');
const adsDeploymentTypeDefs = require('./schema/adsDeploymentSchema');
const screenTrackingTypeDefs = require('./schema/screenTrackingSchema');
const notificationTypeDefs = require('./schema/notificationSchema');

// 👇 Resolvers
const userResolvers = require('./resolvers/userResolver');
const adminResolvers = require('./resolvers/adminResolver');
const superAdminResolvers = require('./resolvers/superAdminResolver');
const adResolvers = require('./resolvers/adResolver');
const driverResolvers = require('./resolvers/driverResolver');
const paymentResolvers = require('./resolvers/paymentResolver');
const materialResolver = require('./resolvers/materialResolver');
const adsPlanResolvers = require('./resolvers/adsPlanResolver');
const materialTrackingResolvers = require('./resolvers/materialTrackingResolver');
const tabletResolvers = require('./resolvers/tabletResolver');
const adsDeploymentResolvers = require('./resolvers/adsDeploymentResolver');
const screenTrackingResolvers = require('./resolvers/screenTrackingResolver');
const notificationResolvers = require('./resolvers/notificationResolver');

// 👇 Middleware
const { authMiddleware } = require('./middleware/auth');
const { driverMiddleware } = require('./middleware/driverAuth');

// Import jobs
const { startDeviceStatusJob } = require('./jobs/deviceStatusJob');

// Import routes
const tabletRoutes = require('./routes/tablet');
const screenTrackingRoutes = require('./routes/screenTracking');
const materialRoutes = require('./routes/material');
const adsRoutes = require('./routes/ads');
const uploadRoute = require('./routes/upload');
const materialPhotoUploadRoutes = require('./routes/materialPhotoUpload');
const analyticsRoutes = require('./routes/analytics');

// Import services
// const syncService = require('./services/syncService'); // No longer needed - using MongoDB only

// ✅ MongoDB connection
if (!process.env.MONGODB_URI) {
  console.error('\n❌ MONGODB_URI is not defined in the .env file');
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
})
  .then(() => console.log('\n💾 MongoDB: Connected to Atlas'))
  .catch(err => {
    console.error('\n❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ✅ Apollo Server setup
const server = new ApolloServer({
  typeDefs: mergeTypeDefs([
    userTypeDefs,
    adminTypeDefs,
    superAdminTypeDefs,
    adTypeDefs,
    driverTypeDefs,
    paymentTypeDefs,
    materialTypeDefs,
    adsPlanTypeDefs,
    materialTrackingTypeDefs,
    tabletTypeDefs,
    adsDeploymentTypeDefs,
    screenTrackingTypeDefs,
    notificationTypeDefs,
  ]),
  resolvers: mergeResolvers([
    userResolvers,
    adminResolvers,
    superAdminResolvers,
    adResolvers,
    driverResolvers,
    paymentResolvers,
    materialResolver,
    adsPlanResolvers,
    materialTrackingResolvers,
    tabletResolvers,
    adsDeploymentResolvers,
    screenTrackingResolvers,
    notificationResolvers,
  ]),
});

const app = express();

async function startServer() {
  await server.start();

  // ✅ Global CORS
  app.use(cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

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
        'http://192.168.1.5:3000',
        'http://192.168.100.22:3000',
        'http://192.168.100.22:5000',
        'https://ads2go-6ead4.web.app',
        'https://ads2go-6ead4.firebaseapp.com',
      ];

      const allowedOrigins = new Set([...defaultAllowed, ...envAllowed]);

      const isRailwayApp = /^https?:\/\/([a-z0-9-]+)\.up\.railway\.app$/i.test(origin) ||
                           /^https?:\/\/([a-z0-9-]+)\.railway\.app$/i.test(origin);

      if (allowedOrigins.has(origin) || isRailwayApp) {
        console.log('✅ CORS: Allowing origin:', origin);
        callback(null, true);
      } else {
        console.log('❌ CORS: Blocking origin:', origin);
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
    console.log('🔄 Handling preflight request for:', req.headers.origin);
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(200);
  });

  // Regular express body parsing
  app.use(express.json());
  
  // Serve uploaded media statically
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
  
  // Serve public files statically
  app.use(express.static(path.join(__dirname, '..', 'public')));
  
  // Regular file upload route (must come before GraphQL middleware)
  app.use('/upload', uploadRoute);
  
  // Routes
  app.use('/tablet', tabletRoutes);
  app.use('/screenTracking', screenTrackingRoutes);
  app.use('/material', materialRoutes);
  app.use('/ads', adsRoutes);
  app.use('/material-photos', materialPhotoUploadRoutes);
  app.use('/analytics', analyticsRoutes);
  
  // GraphQL file uploads middleware (must come after regular upload route)
  app.use(graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 4 }));

  // GraphQL endpoint with combined context
  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }) => {
        // Debug GraphQL context
        console.log('🔍 GraphQL Context Debug:');
        console.log('  - Authorization header:', req.headers.authorization);
        console.log('  - User-Agent:', req.headers['user-agent']);
        
        // Get both driver and user context
        const { driver } = await driverMiddleware({ req });
        const { user } = await authMiddleware({ req });
        
        // Provide role-specific context
        let context = { driver, user };
        
        if (driver) {
          console.log('🚗 Driver context:', { id: driver.id, driverId: driver.driverId, email: driver.email, role: driver.role });
          context.driver = driver;
        }
        
        if (user) {
          console.log('🔐 User context:', { id: user.id, email: user.email, role: user.role });
          if (user.role === 'ADMIN') {
            context.admin = user;
            console.log('✅ Set admin context for ADMIN user');
          } else if (user.role === 'SUPERADMIN') {
            context.superAdmin = user;
            // SuperAdmin should also have admin access
            context.admin = user;
            console.log('✅ Set admin context for SUPERADMIN user');
          }
        }
        
        // Debug final context
        console.log('🔧 Final GraphQL context:', {
          hasDriver: !!context.driver,
          hasUser: !!context.user,
          hasAdmin: !!context.admin,
          hasSuperAdmin: !!context.superAdmin
        });
        
        if (!driver && !user) {
          console.log('❌ No authentication context found');
        }
        
        console.log('🔧 Final context:', Object.keys(context));
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
  
  // Create HTTP server
  const httpServer = http.createServer(app);
  
  // Initialize WebSocket server
  deviceStatusService.initializeWebSocketServer(httpServer);

  // Start the server
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server ready at http://0.0.0.0:${PORT}`);
    console.log(`\n🚀 GraphQL server ready at http://0.0.0.0:${PORT}/graphql`);
    
    // Start the device status monitoring job
    startDeviceStatusJob();
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

startServer().catch(console.error);