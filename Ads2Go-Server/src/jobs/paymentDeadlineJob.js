const cron = require('node-cron');
const Ad = require('../models/Ad');
const NotificationService = require('../services/notifications/NotificationService');

// Run daily at 9:00 AM to check for unpaid ads after 7 days
const checkPaymentDeadlines = cron.schedule('0 9 * * *', async () => {
  try {
    console.log('🔍 Running payment deadline check...');
    
    // Find ads that are approved but not paid, and approved more than 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const unpaidAds = await Ad.find({
      status: 'APPROVED',
      paymentStatus: 'PENDING',
      approveTime: { $lt: sevenDaysAgo }
    }).populate('userId');
    
    console.log(`📊 Found ${unpaidAds.length} ads with exceeded payment deadlines`);
    
    for (const ad of unpaidAds) {
      try {
        console.log(`⚠️ Processing payment failure for ad: ${ad._id} - "${ad.title}"`);
        
        // Update ad status to failed payment
        ad.status = 'REJECTED';
        ad.paymentStatus = 'FAILED';
        ad.reasonForReject = 'Payment deadline exceeded (7 days)';
        ad.rejectTime = new Date();
        await ad.save();
        
        // Send notification to admins
        await NotificationService.sendPaymentFailureNotification(ad._id);
        
        console.log(`✅ Payment failure processed for ad: ${ad._id}`);
      } catch (error) {
        console.error(`❌ Error processing payment failure for ad ${ad._id}:`, error);
      }
    }
    
    console.log(`✅ Payment deadline check completed. Processed ${unpaidAds.length} failed payments.`);
  } catch (error) {
    console.error('❌ Error in payment deadline check:', error);
  }
});

// Start the job when the server starts
const startPaymentDeadlineJob = () => {
  checkPaymentDeadlines.start();
  console.log('⏰ Payment deadline monitoring job started (runs daily at 9:00 AM)');
};

module.exports = {
  startPaymentDeadlineJob
};
