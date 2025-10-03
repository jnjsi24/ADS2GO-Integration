const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.development' });

const AdminNotificationService = require('../src/services/notifications/AdminNotificationService');

async function sendRetroactivePaymentNotifications() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go');
    console.log('Connected to MongoDB');
    
    const Payment = require('../src/models/Payment');
    
    // Find recent payments (last 7 days) that don't have notifications yet
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentPayments = await Payment.find({
      paymentStatus: 'PAID',
      adsId: { $ne: null },
      createdAt: { $gte: sevenDaysAgo }
    })
      .populate('adsId userId')
      .sort({ createdAt: -1 });
    
    console.log(`Found ${recentPayments.length} recent payments to process`);
    
    for (const payment of recentPayments) {
      try {
        console.log(`Processing payment ${payment._id} for "${payment.adsId?.title}"`);
        
        // Send payment success notification
        const notifications = await AdminNotificationService.sendPaymentSuccessNotification(payment._id);
        console.log(`✅ Sent ${notifications.length} notifications for payment ${payment._id}`);
        
      } catch (error) {
        console.error(`❌ Error processing payment ${payment._id}:`, error.message);
      }
    }
    
    console.log('✅ Retroactive payment notifications completed');
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
  }
}

// Run the script
sendRetroactivePaymentNotifications();

