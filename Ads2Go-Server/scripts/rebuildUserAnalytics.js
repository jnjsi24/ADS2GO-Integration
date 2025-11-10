/**
 * Rebuild UserAnalytics Collection Script
 * 
 * This script rebuilds the UserAnalytics collection from DeviceDataHistoryV2.
 * It can either:
 * 1. Delete the collection first (clean rebuild)
 * 2. Update existing documents (safe rebuild)
 * 
 * Usage:
 *   node scripts/rebuildUserAnalytics.js --delete    # Delete collection first
 *   node scripts/rebuildUserAnalytics.js             # Update existing (safe)
 *   node scripts/rebuildUserAnalytics.js --userId=xxx # Rebuild specific user only
 */

const path = require('path');
const fs = require('fs');

// Load .env file - try multiple locations
const envPaths = [
  path.join(__dirname, '..', '.env'), // Ads2Go-Server/.env
  path.join(__dirname, '..', '..', '.env'), // Root .env
  path.join(process.cwd(), '.env'), // Current working directory
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    envLoaded = true;
    console.log(`✅ Found .env file at: ${envPath}`);
    
    // Manually parse .env file to handle special characters in MongoDB URI
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split(/\r?\n/);
      
      console.log(`📄 Parsing .env file: ${lines.length} lines`);
      
      // Debug: Find MONGODB_URI line
      for (let j = 0; j < lines.length; j++) {
        if (lines[j].includes('MONGODB')) {
          console.log(`🔍 Found MONGODB line ${j}: "${lines[j].substring(0, 50)}..."`);
        }
      }
      
      for (let i = 0; i < lines.length; i++) {
        const originalLine = lines[i];
        const line = originalLine.trim();
        
        // Skip comments and empty lines
        if (!line || line.startsWith('#')) continue;
        
        // Look for MONGODB_URI (case-insensitive check)
        if (line.toUpperCase().startsWith('MONGODB_URI')) {
          // Extract everything after the = sign
          const eqIndex = line.indexOf('=');
          if (eqIndex === -1) continue;
          
          let value = line.substring(eqIndex + 1).trim();
          
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          
          // Check next line for continuation (if it doesn't have = and isn't a comment)
          if (i + 1 < lines.length && value) {
            const nextLine = lines[i + 1].trim();
            if (nextLine && !nextLine.includes('=') && !nextLine.startsWith('#') && !nextLine.toUpperCase().startsWith('MONGODB') && nextLine.length > 0) {
              // Append continuation (remove any leading/trailing whitespace)
              value = value.trim() + nextLine.trim();
            }
          }
          
          if (value && value.length > 0) {
            process.env.MONGODB_URI = value;
            console.log('✅ Manually loaded MONGODB_URI from .env file');
            console.log(`📊 MONGODB_URI length: ${value.length} characters`);
            console.log(`📊 MONGODB_URI starts with: ${value.substring(0, 20)}...`);
          } else {
            console.log('⚠️  MONGODB_URI found but value is empty');
          }
        } else if (line.includes('=')) {
          // Parse other environment variables
          const eqIndex = line.indexOf('=');
          const key = line.substring(0, eqIndex).trim();
          let value = line.substring(eqIndex + 1).trim();
          
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          
          // Only set if not already set (don't override existing env vars)
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    } catch (error) {
      console.log('⚠️  Error manually parsing .env file:', error.message);
      // Fallback to dotenv
      require('dotenv').config({ path: envPath });
    }
    
    break;
  }
}

if (!envLoaded) {
  // Try default dotenv config (looks in current directory and parent directories)
  require('dotenv').config();
  console.log('⚠️  .env file not found in expected locations, using default dotenv behavior');
}

// Debug: Check if MONGODB_URI was loaded
if (process.env.MONGODB_URI) {
  console.log('✅ MONGODB_URI loaded successfully');
  // Mask the password in the URI for security
  const maskedUri = process.env.MONGODB_URI.replace(/:([^:@]+)@/, ':***@');
  console.log(`📊 MongoDB URI: ${maskedUri.substring(0, 50)}...`);
} else {
  console.log('⚠️  MONGODB_URI not found in environment variables');
  console.log('📋 Available env vars starting with MONGO:', Object.keys(process.env).filter(k => k.includes('MONGO')).join(', '));
}

const mongoose = require('mongoose');
const UserAnalyticsService = require('../src/services/userAnalyticsService');
const User = require('../src/models/User');
const UserAnalytics = require('../src/models/userAnalytics');

// Configuration
const DELETE_FIRST = process.argv.includes('--delete');
const USER_ID_ARG = process.argv.find(arg => arg.startsWith('--userId='));
const SPECIFIC_USER_ID = USER_ID_ARG ? USER_ID_ARG.split('=')[1] : null;
const DATE_RANGE_YEARS = 2; // How many years back to sync

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'bright');
  console.log('='.repeat(80) + '\n');
}

async function connectDatabase() {
  try {
    // Check if MONGODB_URI is defined
    if (!process.env.MONGODB_URI) {
      log('❌ MONGODB_URI is not defined in the .env file', 'red');
      log('ℹ️  Please make sure your .env file contains MONGODB_URI', 'yellow');
      process.exit(1);
    }
    
    const mongoUri = process.env.MONGODB_URI;
    log(`🔗 Connecting to MongoDB...`, 'cyan');
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
      socketTimeoutMS: 45000,
    });
    
    log('✅ Connected to MongoDB', 'green');
    log(`📊 Database: ${mongoose.connection.name}`, 'cyan');
  } catch (error) {
    log(`❌ Failed to connect to MongoDB: ${error.message}`, 'red');
    log('ℹ️  Please check:', 'yellow');
    log('   1. MongoDB server is running', 'yellow');
    log('   2. MONGODB_URI in .env file is correct', 'yellow');
    log('   3. Network connectivity to MongoDB', 'yellow');
    process.exit(1);
  }
}

async function deleteUserAnalyticsCollection() {
  try {
    logSection('🗑️  DELETING USERANALYTICS COLLECTION');
    
    const count = await UserAnalytics.countDocuments();
    log(`📊 Found ${count} documents in UserAnalytics collection`, 'yellow');
    
    if (count === 0) {
      log('ℹ️  Collection is already empty, skipping deletion', 'cyan');
      return;
    }
    
    await UserAnalytics.deleteMany({});
    log(`✅ Deleted ${count} documents from UserAnalytics collection`, 'green');
  } catch (error) {
    log(`❌ Error deleting UserAnalytics collection: ${error.message}`, 'red');
    throw error;
  }
}

async function rebuildUserAnalytics(userId = null) {
  try {
    logSection('🔄 REBUILDING USERANALYTICS');
    
    // Get users to rebuild
    let users;
    if (userId) {
      users = await User.find({ _id: userId }).select('_id firstName lastName email');
      if (users.length === 0) {
        log(`❌ User not found: ${userId}`, 'red');
        return { success: false, message: 'User not found' };
      }
      log(`👤 Rebuilding analytics for specific user: ${users[0].firstName} ${users[0].lastName}`, 'cyan');
    } else {
      users = await User.find({}).select('_id firstName lastName email');
      log(`👥 Found ${users.length} users to rebuild`, 'cyan');
    }
    
    if (users.length === 0) {
      log('❌ No users found', 'red');
      return { success: false, message: 'No users found' };
    }
    
    // Calculate date range (last 2 years)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - DATE_RANGE_YEARS);
    
    log(`📅 Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`, 'cyan');
    
    const results = {
      total: users.length,
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };
    
    // Process users in batches
    const batchSize = 5;
    let processed = 0;
    
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(users.length / batchSize)} (${batch.length} users)`, 'blue');
      
      const batchPromises = batch.map(async (user) => {
        try {
          processed++;
          const progress = `[${processed}/${users.length}]`;
          log(`${progress} 🔄 Rebuilding: ${user.firstName} ${user.lastName} (${user._id})`, 'cyan');
          
          // Force full sync (rebuild from scratch)
          const result = await UserAnalyticsService.syncUserAnalyticsFromHistory(
            user._id.toString(),
            startDate.toISOString(),
            endDate.toISOString(),
            null // adId = null for full sync
          );
          
          if (result && result.success !== false) {
            results.success++;
            // Get updated UserAnalytics to show totals
            const userAnalytics = await UserAnalytics.findOne({ userId: user._id });
            const totalAdPlays = userAnalytics?.totalAdPlays || 0;
            const totalQRScans = userAnalytics?.totalQRScans || 0;
            const totalDevices = userAnalytics?.totalDevices || 0;
            log(`${progress} ✅ Success: ${user.firstName} ${user.lastName} - ` +
                `Plays: ${totalAdPlays}, ` +
                `QR Scans: ${totalQRScans}, ` +
                `Devices: ${totalDevices}`, 'green');
          } else {
            results.failed++;
            const errorMsg = result?.message || result?.error || 'Unknown error';
            results.errors.push({
              userId: user._id.toString(),
              name: `${user.firstName} ${user.lastName}`,
              error: errorMsg
            });
            log(`${progress} ❌ Failed: ${user.firstName} ${user.lastName} - ${errorMsg}`, 'red');
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            userId: user._id.toString(),
            name: `${user.firstName} ${user.lastName}`,
            error: error.message
          });
          log(`❌ Error: ${user.firstName} ${user.lastName} - ${error.message}`, 'red');
        }
      });
      
      // Wait for batch to complete
      await Promise.all(batchPromises);
      
      // Small delay between batches to avoid overwhelming the database
      if (i + batchSize < users.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }
    
    // Print summary
    logSection('📊 REBUILD SUMMARY');
    log(`Total users: ${results.total}`, 'cyan');
    log(`✅ Successful: ${results.success}`, 'green');
    log(`❌ Failed: ${results.failed}`, 'red');
    log(`⏭️  Skipped: ${results.skipped}`, 'yellow');
    
    if (results.errors.length > 0) {
      log('\n❌ Errors:', 'red');
      results.errors.forEach((error, index) => {
        log(`  ${index + 1}. ${error.name} (${error.userId}): ${error.error}`, 'red');
      });
    }
    
    return {
      success: results.failed === 0,
      message: `Rebuild completed: ${results.success} successful, ${results.failed} failed`,
      results
    };
  } catch (error) {
    log(`❌ Error in rebuild process: ${error.message}`, 'red');
    return {
      success: false,
      message: error.message
    };
  }
}

async function verifyRebuild() {
  try {
    logSection('🔍 VERIFYING REBUILD');
    
    const totalUsers = await User.countDocuments();
    const totalUserAnalytics = await UserAnalytics.countDocuments();
    const usersWithData = await UserAnalytics.countDocuments({
      $or: [
        { totalAdPlays: { $gt: 0 } },
        { totalQRScans: { $gt: 0 } },
        { totalAdPlayTime: { $gt: 0 } }
      ]
    });
    const usersWithEmptyData = totalUserAnalytics - usersWithData;
    
    log(`📊 Total users: ${totalUsers}`, 'cyan');
    log(`📊 UserAnalytics documents: ${totalUserAnalytics}`, 'cyan');
    log(`✅ Users with data: ${usersWithData}`, 'green');
    log(`⚠️  Users with empty data: ${usersWithEmptyData}`, usersWithEmptyData > 0 ? 'yellow' : 'green');
    
    // Sample a few documents
    const samples = await UserAnalytics.find({})
      .limit(5)
      .select('userId totalAdPlays totalQRScans totalAdPlayTime lastUpdated')
      .populate('userId', 'firstName lastName');
    
    if (samples.length > 0) {
      log('\n📋 Sample documents:', 'cyan');
      samples.forEach((doc, index) => {
        const user = doc.userId;
        const userName = user ? `${user.firstName} ${user.lastName}` : 'Unknown';
        log(`  ${index + 1}. ${userName}: ` +
            `Plays=${doc.totalAdPlays || 0}, ` +
            `QR Scans=${doc.totalQRScans || 0}, ` +
            `Play Time=${doc.totalAdPlayTime || 0}s, ` +
            `Updated=${doc.lastUpdated ? new Date(doc.lastUpdated).toISOString() : 'Never'}`, 'cyan');
      });
    }
  } catch (error) {
    log(`❌ Error verifying rebuild: ${error.message}`, 'red');
  }
}

async function main() {
  try {
    logSection('🚀 USERANALYTICS REBUILD SCRIPT');
    
    log(`Mode: ${DELETE_FIRST ? 'DELETE AND REBUILD' : 'UPDATE EXISTING (SAFE)'}`, DELETE_FIRST ? 'yellow' : 'green');
    if (SPECIFIC_USER_ID) {
      log(`Target: Specific user (${SPECIFIC_USER_ID})`, 'cyan');
    } else {
      log('Target: All users', 'cyan');
    }
    
    // Connect to database
    await connectDatabase();
    
    // Delete collection if requested
    if (DELETE_FIRST) {
      await deleteUserAnalyticsCollection();
    }
    
    // Rebuild UserAnalytics
    const result = await rebuildUserAnalytics(SPECIFIC_USER_ID);
    
    // Verify rebuild
    await verifyRebuild();
    
    // Final summary
    logSection('✅ REBUILD COMPLETED');
    if (result.success) {
      log('✅ All users rebuilt successfully!', 'green');
    } else {
      log(`⚠️  Rebuild completed with ${result.results?.failed || 0} errors`, 'yellow');
    }
    
    // Close database connection
    await mongoose.connection.close();
    log('✅ Database connection closed', 'green');
    
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    log(`❌ Fatal error: ${error.message}`, 'red');
    console.error(error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { rebuildUserAnalytics, deleteUserAnalyticsCollection };

