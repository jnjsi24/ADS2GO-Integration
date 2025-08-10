const express = require('express');
const mongoose = require('mongoose');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const cors = require('cors');
require('dotenv').config();

const { mergeTypeDefs } = require('@graphql-tools/merge');
const { mergeResolvers } = require('@graphql-tools/merge');

// Load User schema and resolvers
const userTypeDefs = require('./schema/userSchema');
const userResolvers = require('./resolvers/userResolver');

// Load Driver schema and resolvers
const driverTypeDefs = require('./schema/driverSchema');
const driverResolvers = require('./resolvers/driverResolver');

// Load AdsPlan schema and resolvers
const adsPlanTypeDefs = require('./schema/adsPlanSchema');
const adsPlanResolvers = require('./resolvers/adsPlanResolver');

// Load Material schema and resolvers — **add these!**
const materialTypeDefs = require('./schema/materialSchema');
const materialResolvers = require('./resolvers/materialResolver');

const { authMiddleware } = require('./middleware/auth');

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not defined in the .env file');
  process.exit(1);
}

// Merge all schemas and resolvers including material
const typeDefs = mergeTypeDefs([
  userTypeDefs,
  driverTypeDefs,
  adsPlanTypeDefs,
  materialTypeDefs,        // Added material schema
]);

const resolvers = mergeResolvers([
  userResolvers,
  driverResolvers,
  adsPlanResolvers,
  materialResolvers,       // Added material resolvers
]);

// Create Express app
const app = express();

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  })
  .then(() => console.log('\n💾 Database connected'))
  .catch((err) => {
    console.error('\n❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Create Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

// Start the server
async function startServer() {
  await server.start();

  app.use(express.json());

  app.use(
    '/graphql',
    cors({
      origin: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost',
        'http://127.0.0.1',
        'http://192.168.1.5:3000',
      ],
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    }),
    expressMiddleware(server, { context: authMiddleware })
  );

  // Fallback error handler
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
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
      console.error(`Port ${PORT} is already in use. Please free the port.`);
      process.exit(1);
    } else {
      console.error('Server startup error:', error);
    }
  });
}

startServer().catch(console.error);
