#!/usr/bin/env node

/**
 * Script to fix the analytics collection structure
 * - Migrates from old device-based structure to new ad-based structure
 * - Creates missing slots for disconnected devices
 * - Cleans up duplicate and fallback entries
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Analytics = require('../src/models/analytics');
const Ad = require('../src/models/Ad');
const Material = require('../src/models/Material');

async function fixAnalyticsCollection() {
  try {
    console.log('🔧 Starting analytics collection fix...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get all ads
    const ads = await Ad.find({ adStatus: 'ACTIVE' });
    console.log(`📊 Found ${ads.length} active ads`);
    
    // Get all materials
    const materials = await Material.find({});
    console.log(`📱 Found ${materials.length} materials`);
    
    // Group materials by type for slot creation
    const materialGroups = {};
    materials.forEach(material => {
      if (!materialGroups[material.materialType]) {
        materialGroups[material.materialType] = [];
      }
      materialGroups[material.materialType].push(material);
    });
    
    console.log('📋 Material groups:', Object.keys(materialGroups));
    
    // Process each ad
    for (const ad of ads) {
      console.log(`\n🔄 Processing ad: ${ad.title} (${ad._id})`);
      
      // Find or create analytics document for this ad
      let analytics = await Analytics.findOne({ adId: ad._id });
      
      if (!analytics) {
        console.log('  🆕 Creating new analytics document for ad');
        analytics = new Analytics({
          adId: ad._id,
          adTitle: ad.title,
          userId: ad.userId,
          adDeploymentId: ad.adDeploymentId,
          materials: [],
          materialPerformance: [],
          isActive: true
        });
      } else {
        console.log('  📊 Found existing analytics document for ad');
      }
      
      // Get target materials for this ad
      let targetMaterials = [];
      
      if (ad.targetDevices && ad.targetDevices.length > 0) {
        // Get materials by target device IDs
        targetMaterials = await Material.find({ _id: { $in: ad.targetDevices } });
      } else if (ad.materialId) {
        // Single material ad
        const material = await Material.findById(ad.materialId);
        if (material) {
          targetMaterials = [material];
        }
      }
      
      console.log(`  📱 Found ${targetMaterials.length} target materials for this ad`);
      
      // Create material analytics for each target material
      for (const material of targetMaterials) {
        // Use the helper method to get correct slots for material type
        const slots = Analytics.getSlotsForMaterialType(material.materialType);
        
        console.log(`    📱 ${material.materialType} material ${material.materialId} will have ${slots.length} slot(s): ${slots.join(', ')}`);
        
        for (const slotNumber of slots) {
          console.log(`    🔧 Processing ${material.materialId} slot ${slotNumber}`);
          
          // Check if material analytics already exists
          const existingMaterial = analytics.materials.find(m => 
            m.materialId === material.materialId && m.slotNumber === slotNumber
          );
          
          if (!existingMaterial) {
            // Create new material analytics
            const materialData = {
              materialId: material.materialId,
              materialType: material.materialType, // Add material type for validation
              slotNumber: slotNumber,
              deviceId: `PLACEHOLDER-${material.materialId}-${slotNumber}-${Date.now()}`,
              carGroupId: material.carGroupId || null,
              driverId: material.driverId || null,
              isOnline: false, // Will be updated when device connects
              currentLocation: null,
              networkStatus: { isOnline: false, lastSeen: new Date() },
              deviceInfo: null,
              adPlaybacks: [],
              totalAdPlayTime: 0,
              totalAdImpressions: 0,
              averageAdCompletionRate: 0,
              currentAd: null,
              qrScans: [],
              totalQRScans: 0,
              qrScanConversionRate: 0,
              lastQRScan: null,
              qrScansByAd: [],
              totalDistanceTraveled: 0,
              averageSpeed: 0,
              maxSpeed: 0,
              uptimePercentage: 0,
              complianceRate: 0,
              averageDailyHours: 0,
              totalInteractions: 0,
              totalScreenTaps: 0,
              totalDebugActivations: 0,
              dailySessions: [],
              locationHistory: [],
              isActive: true,
              lastSeen: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            analytics.materials.push(materialData);
            console.log(`      ✅ Created material analytics for ${material.materialId} slot ${slotNumber}`);
          } else {
            console.log(`      ℹ️  Material analytics already exists for ${material.materialId} slot ${slotNumber}`);
          }
        }
      }
      
      // Update aggregated stats
      analytics.updateAggregatedStats();
      
      // Validate slot counts
      analytics.validateSlotCounts();
      
      // Save analytics document
      await analytics.save();
      console.log(`  ✅ Updated analytics for ad: ${ad.title}`);
    }
    
    // Clean up old analytics documents (device-based)
    console.log('\n🧹 Cleaning up old analytics documents...');
    const oldAnalytics = await Analytics.find({
      $or: [
        { deviceId: { $regex: '^TABLET-' } },
        { deviceId: { $regex: '^FALLBACK-' } }
      ]
    });
    
    console.log(`🗑️  Found ${oldAnalytics.length} old analytics documents to clean up`);
    
    for (const oldDoc of oldAnalytics) {
      console.log(`  🗑️  Removing old document: ${oldDoc.deviceId} (${oldDoc.materialId})`);
      await Analytics.findByIdAndDelete(oldDoc._id);
    }
    
    console.log('\n✅ Analytics collection fix completed!');
    
    // Show summary
    const newAnalytics = await Analytics.find({});
    console.log(`\n📊 Summary:`);
    console.log(`  - Total analytics documents: ${newAnalytics.length}`);
    console.log(`  - Total materials tracked: ${newAnalytics.reduce((sum, doc) => sum + (doc.materials ? doc.materials.length : 0), 0)}`);
    
    // Show materials per ad
    for (const analytics of newAnalytics) {
      if (analytics.adTitle) {
        console.log(`  - Ad "${analytics.adTitle}": ${analytics.materials ? analytics.materials.length : 0} materials`);
        if (analytics.materials) {
          analytics.materials.forEach(material => {
            console.log(`    - ${material.materialId} slot ${material.slotNumber} (${material.isOnline ? 'online' : 'offline'})`);
          });
        }
      } else {
        console.log(`  - Old analytics document (no adTitle): ${analytics._id}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error fixing analytics collection:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  fixAnalyticsCollection();
}

module.exports = fixAnalyticsCollection;
