const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const Driver = require('./src/models/Driver');
const bcrypt = require('bcryptjs');

async function resetDriverPassword() {
  try {
    console.log('🔑 Resetting driver password...\n');
    
    // Target driver
    const targetEmail = 'carljustineglean@gmail.com';
    const newPassword = 'Password@123';
    
    console.log(`📧 Target driver: ${targetEmail}`);
    console.log(`🔑 New password: ${newPassword}`);
    
    // Find the driver
    const driver = await Driver.findOne({ email: targetEmail });
    
    if (!driver) {
      console.log('❌ Driver not found');
      return;
    }
    
    console.log(`✅ Driver found: ${driver.firstName} ${driver.lastName} (${driver.driverId})`);
    
    // Hash the new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    console.log('🔐 Password hashed successfully');
    
    // Update the driver's password
    driver.password = hashedPassword;
    await driver.save();
    
    console.log('✅ Password updated successfully');
    
    // Verify the new password works
    const verification = await bcrypt.compare(newPassword, hashedPassword);
    console.log(`🔍 Password verification test: ${verification ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    console.log('\n🎉 Password reset completed!');
    console.log(`   Driver: ${driver.firstName} ${driver.lastName}`);
    console.log(`   Email: ${driver.email}`);
    console.log(`   New Password: ${newPassword}`);
    console.log('\n💡 You can now use this password to login to the mobile app');
    
  } catch (error) {
    console.error('❌ Password reset failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

resetDriverPassword();
