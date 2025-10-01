const Ad = require('../models/Ad');
const MaterialAvailability = require('../models/MaterialAvailability');

/**
 * Cleanup unpaid ads that have exceeded the payment timeout period
 * This should be run periodically (e.g., every hour) via cron job
 */
async function cleanupUnpaidAds() {
  try {
    console.log('🧹 Starting cleanup of unpaid ads...');
    
    // Define payment timeout period (e.g., 24 hours)
    const PAYMENT_TIMEOUT_HOURS = 24;
    const timeoutDate = new Date();
    timeoutDate.setHours(timeoutDate.getHours() - PAYMENT_TIMEOUT_HOURS);
    
    // Find unpaid ads older than timeout period
    const unpaidAds = await Ad.find({
      paymentStatus: 'PENDING',
      createdAt: { $lt: timeoutDate },
      status: { $in: ['PENDING', 'APPROVED'] } // Only cleanup pending/approved ads, not rejected ones
    });
    
    console.log(`📊 Found ${unpaidAds.length} unpaid ads to cleanup`);
    
    let cleanedCount = 0;
    let errorCount = 0;
    
    for (const ad of unpaidAds) {
      try {
        console.log(`🧹 Cleaning up unpaid ad: ${ad._id} (${ad.title})`);
        
        // Free up slots for all target devices
        if (ad.targetDevices && ad.targetDevices.length > 0) {
          for (const deviceId of ad.targetDevices) {
            const availability = await MaterialAvailability.findOne({ materialId: deviceId });
            if (availability) {
              // Remove this ad from the material's current ads
              const initialLength = availability.currentAds.length;
              availability.currentAds = availability.currentAds.filter(
                adSlot => adSlot.adId.toString() !== ad._id.toString()
              );
              
              // Update slot counts
              availability.occupiedSlots = availability.currentAds.length;
              availability.availableSlots = availability.totalSlots - availability.occupiedSlots;
              availability.updateAvailabilityDates();
              await availability.save();
              
              console.log(`   ✅ Freed slot on device ${deviceId}: ${initialLength} → ${availability.currentAds.length} ads`);
            }
          }
        }
        
        // Update ad status to indicate it was cleaned up due to non-payment
        ad.status = 'REJECTED';
        ad.paymentStatus = 'FAILED';
        ad.reasonForReject = `Ad automatically cancelled due to non-payment after ${PAYMENT_TIMEOUT_HOURS} hours`;
        ad.rejectTime = new Date();
        await ad.save();
        
        cleanedCount++;
        console.log(`   ✅ Ad ${ad._id} marked as rejected due to non-payment`);
        
      } catch (error) {
        console.error(`   ❌ Error cleaning up ad ${ad._id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`✅ Cleanup completed: ${cleanedCount} ads cleaned, ${errorCount} errors`);
    return {
      success: true,
      cleanedCount,
      errorCount,
      totalFound: unpaidAds.length
    };
    
  } catch (error) {
    console.error('❌ Error during unpaid ads cleanup:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Cleanup expired ads (ads that have passed their end time)
 */
async function cleanupExpiredAds() {
  try {
    console.log('🧹 Starting cleanup of expired ads...');
    
    const now = new Date();
    
    // Find ads that have passed their end time
    const expiredAds = await Ad.find({
      endTime: { $lt: now },
      status: { $in: ['RUNNING', 'APPROVED'] } // Only cleanup running/approved ads
    });
    
    console.log(`📊 Found ${expiredAds.length} expired ads to cleanup`);
    
    let cleanedCount = 0;
    let errorCount = 0;
    
    for (const ad of expiredAds) {
      try {
        console.log(`🧹 Cleaning up expired ad: ${ad._id} (${ad.title})`);
        
        // Free up slots for all target devices
        if (ad.targetDevices && ad.targetDevices.length > 0) {
          for (const deviceId of ad.targetDevices) {
            const availability = await MaterialAvailability.findOne({ materialId: deviceId });
            if (availability) {
              // Remove this ad from the material's current ads
              const initialLength = availability.currentAds.length;
              availability.currentAds = availability.currentAds.filter(
                adSlot => adSlot.adId.toString() !== ad._id.toString()
              );
              
              // Update slot counts
              availability.occupiedSlots = availability.currentAds.length;
              availability.availableSlots = availability.totalSlots - availability.occupiedSlots;
              availability.updateAvailabilityDates();
              await availability.save();
              
              console.log(`   ✅ Freed slot on device ${deviceId}: ${initialLength} → ${availability.currentAds.length} ads`);
            }
          }
        }
        
        // Update ad status to indicate it has ended
        ad.status = 'ENDED';
        ad.adStatus = 'FINISHED';
        await ad.save();
        
        cleanedCount++;
        console.log(`   ✅ Ad ${ad._id} marked as ended`);
        
      } catch (error) {
        console.error(`   ❌ Error cleaning up expired ad ${ad._id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`✅ Expired ads cleanup completed: ${cleanedCount} ads cleaned, ${errorCount} errors`);
    return {
      success: true,
      cleanedCount,
      errorCount,
      totalFound: expiredAds.length
    };
    
  } catch (error) {
    console.error('❌ Error during expired ads cleanup:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Run both cleanup functions
 */
async function runCleanup() {
  console.log('🚀 Starting comprehensive ad cleanup...');
  
  const unpaidResult = await cleanupUnpaidAds();
  const expiredResult = await cleanupExpiredAds();
  
  console.log('📊 Cleanup Summary:');
  console.log(`   Unpaid ads: ${unpaidResult.cleanedCount} cleaned, ${unpaidResult.errorCount} errors`);
  console.log(`   Expired ads: ${expiredResult.cleanedCount} cleaned, ${expiredResult.errorCount} errors`);
  
  return {
    unpaid: unpaidResult,
    expired: expiredResult
  };
}

module.exports = {
  cleanupUnpaidAds,
  cleanupExpiredAds,
  runCleanup
};
