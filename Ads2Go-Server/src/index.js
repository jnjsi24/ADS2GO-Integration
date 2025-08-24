const express = require('express');
const mongoose = require('mongoose');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// ✅ For handling GraphQL file uploads
const { graphqlUploadExpress } = require('graphql-upload');

// 🔹 Import GraphQL typeDefs and resolvers
const { mergeTypeDefs } = require('@graphql-tools/merge');
const { mergeResolvers } = require('@graphql-tools/merge');

// 👇 Schemas
const userTypeDefs = require('./schema/userSchema');
const adTypeDefs = require('./schema/adSchema');
const driverTypeDefs = require('./schema/driverSchema');
const paymentTypeDefs = require('./schema/paymentSchema');
const materialTypeDefs = require('./schema/materialSchema');
const adsPlanTypeDefs = require('./schema/adsPlanSchema');
const materialTrackingTypeDefs = require('./schema/materialTrackingSchema');

// 👇 Resolvers
const userResolvers = require('./resolvers/userResolver');
const adResolvers = require('./resolvers/adResolver');
const driverResolvers = require('./resolvers/driverResolver');
const paymentResolvers = require('./resolvers/paymentResolver');
const materialResolver = require('./resolvers/materialResolver');
const adsPlanResolvers = require('./resolvers/adsPlanResolver');
const materialTrackingResolvers = require('./resolvers/materialTrackingResolver');

// 👇 Middleware
const { authMiddleware } = require('./middleware/auth');
const { driverMiddleware } = require('./middleware/driverAuth');

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
    adTypeDefs,
    driverTypeDefs,
    paymentTypeDefs,
    materialTypeDefs,
    adsPlanTypeDefs,
    materialTrackingTypeDefs,
  ]),
  resolvers: mergeResolvers([
    userResolvers,
    adResolvers,
    driverResolvers,
    paymentResolvers,
    materialResolver,
    adsPlanResolvers,
    materialTrackingResolvers,
  ]),
});

const app = express();

async function startServer() {
  await server.start();

  // ✅ Global CORS
  app.use(cors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost',
      'http://127.0.0.1',
      'http://192.168.1.5:3000',
    ],
    credentials: true,
  }));

  // ✅ GraphQL file uploads middleware (must come before express.json())
  app.use(graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 4 }));

  app.use(express.json());

  // ✅ Serve uploaded media statically
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  // ✅ Upload route
  const uploadRoute = require('./routes/upload');
  app.use('/upload', uploadRoute);

  // ✅ GraphQL endpoint with combined context
  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }) => {
        const { driver } = await driverMiddleware({ req });
        const { user } = await authMiddleware({ req });
        return { driver, user };
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
  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server ready at http://localhost:${PORT}/graphql`);
  });

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
