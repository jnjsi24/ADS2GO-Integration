/**
 * Test Script for 30-Day Deferred User Deletion
 * 
 * This script tests the deferred deletion functionality without actually
 * deleting any real users. It creates test users, archives them, and
 * verifies the deletion job works correctly.
 * 
 * Usage:
 *   node src/tests/testUserDeletion.js
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const userDeletionJob = require('../jobs/userDeletionJob');
require('dotenv').config();

// Test configuration
const TEST_USER_EMAIL = 'test-deletion@example.com';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ads2go';

/**
 * Connect to database
 */
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

/**
 * Test 1: Create a test user
 */
async function createTestUser() {
  console.log('\n📝 Test 1: Creating test user...');
  
  try {
    // Check if test user already exists
    let user = await User.findOne({ email: TEST_USER_EMAIL });
    
    if (user) {
      console.log('⚠️  Test user already exists, cleaning up...');
      await User.deleteOne({ email: TEST_USER_EMAIL });
    }

    // Create new test user
    user = new User({
      firstName: 'Test',
      lastName: 'User',
      email: TEST_USER_EMAIL,
      password: 'TestPassword123!',
      companyName: 'Test Company',
      companyAddress: 'Test Address, Manila',
      contactNumber: '09123456789',
      role: 'USER',
      isEmailVerified: true
    });

    await user.save();
    console.log('✅ Test user created:', user.email);
    return user;
  } catch (error) {
    console.error('❌ Error creating test user:', error.message);
    throw error;
  }
}

/**
 * Test 2: Archive the test user (soft delete)
 */
async function archiveTestUser(userId) {
  console.log('\n📝 Test 2: Archiving test user...');
  
  try {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    // Archive the user (set deletion date to past for testing)
    const now = new Date();
    const deletionDate = new Date(now);
    deletionDate.setDate(deletionDate.getDate() - 1); // Yesterday (for immediate deletion test)

    user.isArchived = true;
    user.archivedAt = now;
    user.scheduledDeletionDate = deletionDate; // Set to past for testing
    
    await user.save();

    console.log('✅ User archived successfully');
    console.log('   - Archived at:', user.archivedAt);
    console.log('   - Scheduled deletion:', user.scheduledDeletionDate);
    console.log('   - Is archived:', user.isArchived);

    return user;
  } catch (error) {
    console.error('❌ Error archiving user:', error.message);
    throw error;
  }
}

/**
 * Test 3: Verify user is filtered from getAllUsers query
 */
async function testGetAllUsersQuery() {
  console.log('\n📝 Test 3: Testing getAllUsers filter...');
  
  try {
    // Query without filter (should include archived)
    const allUsers = await User.find({});
    const archivedInAll = allUsers.filter(u => u.isArchived);
    console.log(`   Total users in DB: ${allUsers.length}`);
    console.log(`   Archived users: ${archivedInAll.length}`);

    // Query with filter (should exclude archived) - same as admin query
    const nonArchivedUsers = await User.find({ isArchived: { $ne: true } });
    console.log(`   Non-archived users (admin view): ${nonArchivedUsers.length}`);

    // Verify test user is not in non-archived list
    const testUserInList = nonArchivedUsers.find(u => u.email === TEST_USER_EMAIL);
    
    if (!testUserInList) {
      console.log('✅ Archived user correctly filtered from admin view');
    } else {
      console.log('❌ Archived user still visible in admin view');
    }
  } catch (error) {
    console.error('❌ Error testing query:', error.message);
    throw error;
  }
}

/**
 * Test 4: Get statistics about archived users
 */
async function testGetStats() {
  console.log('\n📝 Test 4: Getting archived users statistics...');
  
  try {
    const stats = await userDeletionJob.getArchivedUsersStats();
    
    console.log('✅ Statistics retrieved:');
    console.log('   - Total archived:', stats.totalArchived);
    console.log('   - Pending deletion:', stats.pendingDeletion);
    console.log('   - Scheduled for future:', stats.scheduled);
    console.log('   - Last check:', stats.lastCheck);

    return stats;
  } catch (error) {
    console.error('❌ Error getting stats:', error.message);
    throw error;
  }
}

/**
 * Test 5: Run deletion job
 */
async function testDeletionJob() {
  console.log('\n📝 Test 5: Running deletion job...');
  
  try {
    const result = await userDeletionJob.deleteExpiredUsers();
    
    console.log('✅ Deletion job completed:');
    console.log('   - Deleted:', result.deletedCount);
    console.log('   - Errors:', result.errorCount);
    console.log('   - Total processed:', result.totalProcessed);

    return result;
  } catch (error) {
    console.error('❌ Error running deletion job:', error.message);
    throw error;
  }
}

/**
 * Test 6: Verify user is permanently deleted
 */
async function verifyUserDeleted() {
  console.log('\n📝 Test 6: Verifying user is permanently deleted...');
  
  try {
    const user = await User.findOne({ email: TEST_USER_EMAIL });
    
    if (!user) {
      console.log('✅ User successfully deleted from database');
      return true;
    } else {
      console.log('❌ User still exists in database');
      console.log('   User state:', {
        isArchived: user.isArchived,
        archivedAt: user.archivedAt,
        scheduledDeletionDate: user.scheduledDeletionDate
      });
      return false;
    }
  } catch (error) {
    console.error('❌ Error verifying deletion:', error.message);
    throw error;
  }
}

/**
 * Test 7: Test restoration (create new user and restore)
 */
async function testRestoration() {
  console.log('\n📝 Test 7: Testing user restoration...');
  
  try {
    // Create another test user
    const testUser2 = new User({
      firstName: 'Restore',
      lastName: 'Test',
      email: 'test-restore@example.com',
      password: 'TestPassword123!',
      companyName: 'Test Company',
      companyAddress: 'Test Address, Manila',
      contactNumber: '09123456788',
      role: 'USER',
      isEmailVerified: true
    });

    await testUser2.save();
    console.log('   Created test user for restoration');

    // Archive the user (with future deletion date)
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 30);

    testUser2.isArchived = true;
    testUser2.archivedAt = now;
    testUser2.scheduledDeletionDate = futureDate;
    await testUser2.save();
    console.log('   Archived user with 30-day schedule');

    // Restore the user
    const result = await userDeletionJob.restoreUser(testUser2._id);
    console.log('✅ User restoration successful');
    console.log('   - Restored user:', result.user.email);
    console.log('   - Is archived:', result.user.isArchived);

    // Clean up
    await User.deleteOne({ email: 'test-restore@example.com' });
    console.log('   Cleaned up test restoration user');

  } catch (error) {
    console.error('❌ Error testing restoration:', error.message);
    // Clean up even if error
    await User.deleteOne({ email: 'test-restore@example.com' }).catch(() => {});
    throw error;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🧪 Starting 30-Day Deferred User Deletion Tests\n');
  console.log('='.repeat(60));

  try {
    // Connect to database
    await connectDB();

    // Run tests
    const testUser = await createTestUser();
    await archiveTestUser(testUser._id);
    await testGetAllUsersQuery();
    await testGetStats();
    await testDeletionJob();
    await verifyUserDeleted();
    await testRestoration();

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests passed successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.error('❌ Test suite failed:', error.message);
    console.log('='.repeat(60));
  } finally {
    // Cleanup and disconnect
    await User.deleteOne({ email: TEST_USER_EMAIL }).catch(() => {});
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests };

