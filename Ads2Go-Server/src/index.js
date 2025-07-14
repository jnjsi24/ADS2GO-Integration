const express = require('express');
const mongoose = require('mongoose');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const cors = require('cors');
require('dotenv').config();

// 🔹 Import GraphQL typeDefs and resolvers
const { mergeTypeDefs } = require('@graphql-tools/merge');
const { mergeResolvers } = require('@graphql-tools/merge');

// 👇 Import each schema and resolver
const userTypeDefs = require('./schema/userSchema');
const adTypeDefs = require('./schema/adSchema'); // ✅ Move to /schema for consistency
const driverTypeDefs = require('./schema/driverSchema');    // ✅ NEW
const paymentTypeDefs = require('./schema/paymentSchema');  // ✅ NEW
const materialTypeDefs = require('./schema/materialSchema');




const userResolvers = require('./resolvers/userResolver');
const adResolvers = require('./resolvers/adResolver');
const driverResolvers = require('./resolvers/driverResolver');   // ✅ ADD THIS
const paymentResolvers = require('./resolvers/paymentResolver'); // ✅ ADD THIS
const materialResolver = require('./resolvers/materialResolver');




const { authMiddleware } = require('./middleware/auth');

// ✅ MERGE ALL TYPEDEFS HERE
const typeDefs = mergeTypeDefs([
  userTypeDefs,
  adTypeDefs,
  driverTypeDefs,    // ✅ NEW
  paymentTypeDefs,   // ✅ NEW
  materialTypeDefs, // ✅ ADD THIS


  // 🔽 Add additional schema here as needed
  // require('./schema/riderSchema'),
  // require('./schema/materialSchema'),
]);

// ✅ MERGE ALL RESOLVERS HERE
const resolvers = mergeResolvers([
  userResolvers,
  adResolvers,
  driverResolvers,   // ✅ NEW
  paymentResolvers,  // ✅ NEW
  materialResolver, // ✅ ADD THIS

  // 🔽 Add additional resolvers here as needed
  // require('./resolvers/riderResolver'),
  // require('./resolvers/materialResolver'),
]);

// 🔗 MongoDB connection
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not defined in the .env file');
  process.exit(1);
}

const app = express();

mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
})
  .then(() => console.log('\n💾 Database: CONNECTED to MongoDB Atlas'))
  .catch(err => {
    console.error('\n❌ MongoDB Connection Error:', err);
    process.exit(1);
  });

// 🔥 Apollo Server setup
const server = new ApolloServer({
  typeDefs,
  resolvers,
});

async function startServer() {
  await server.start();

  app.use(express.json());

  app.use(
    '/graphql',
    cors({
      origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost', 'http://127.0.0.1', 'http://192.168.1.5:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
    }),
    expressMiddleware(server, { context: authMiddleware })
  );

  // 🛑 Fallback error handler
  app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'An unexpected error occurred',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });

  const PORT = process.env.PORT || 5000;

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server ready at http://localhost:${PORT}/graphql`);
  });

  httpServer.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Please kill the process using this port.`);
      process.exit(1);
    } else {
      console.error('Server startup error:', error);
    }
  });
}

startServer().catch(console.error);
