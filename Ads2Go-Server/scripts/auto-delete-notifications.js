const mongoose = require('mongoose');
const NotificationService = require('../src/services/notificationService');
require('dotenv').config();

async function autoDeleteOldNotifications() {
  try {
    console.log('🧹 Starting auto-deletion of old notifications...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to database');
    
    // Run auto-deletion
    const result = await NotificationService.autoDeleteOldNotifications();
    
    console.log('🎉 Auto-deletion completed:', result.message);
    
  } catch (error) {
    console.error('❌ Error during auto-deletion:', error);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}

// Run the auto-deletion
autoDeleteOldNotifications();
