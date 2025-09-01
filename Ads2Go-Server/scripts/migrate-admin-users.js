require('dotenv').config({ path: './.env' });

const mongoose = require('mongoose');
const User = require('../src/models/User');
const Admin = require('../src/models/Admin');
const SuperAdmin = require('../src/models/SuperAdmin');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('\n💾 MongoDB: Connected to Atlas');
    
    try {
      // Find all admin users
      const adminUsers = await User.find({ role: 'ADMIN' });
      console.log(`\n📊 Found ${adminUsers.length} admin users to migrate`);

      // Migrate admin users
      for (const adminUser of adminUsers) {
        const existingAdmin = await Admin.findOne({ email: adminUser.email });
        
        if (!existingAdmin) {
          const newAdmin = new Admin({
            firstName: adminUser.firstName,
            middleName: adminUser.middleName,
            lastName: adminUser.lastName,
            email: adminUser.email,
            password: adminUser.password,
            role: 'ADMIN',
            isEmailVerified: adminUser.isEmailVerified,
            companyName: adminUser.companyName,
            companyAddress: adminUser.companyAddress,
            contactNumber: adminUser.contactNumber,
            loginAttempts: adminUser.loginAttempts,
            accountLocked: adminUser.accountLocked,
            lockUntil: adminUser.lockUntil,
            lastLogin: adminUser.lastLogin,
            tokenVersion: adminUser.tokenVersion,
            createdAt: adminUser.createdAt,
            updatedAt: adminUser.updatedAt
          });

          await newAdmin.save();
          console.log(`✅ Migrated admin: ${adminUser.email}`);
        } else {
          console.log(`⚠️  Admin already exists: ${adminUser.email}`);
        }
      }

      // Find all superadmin users
      const superAdminUsers = await User.find({ role: 'SUPERADMIN' });
      console.log(`\n📊 Found ${superAdminUsers.length} superadmin users to migrate`);

      // Migrate superadmin users
      for (const superAdminUser of superAdminUsers) {
        const existingSuperAdmin = await SuperAdmin.findOne({ email: superAdminUser.email });
        
        if (!existingSuperAdmin) {
          const newSuperAdmin = new SuperAdmin({
            firstName: superAdminUser.firstName,
            middleName: superAdminUser.middleName,
            lastName: superAdminUser.lastName,
            email: superAdminUser.email,
            password: superAdminUser.password,
            role: 'SUPERADMIN',
            isEmailVerified: superAdminUser.isEmailVerified,
            companyName: superAdminUser.companyName,
            companyAddress: superAdminUser.companyAddress,
            contactNumber: superAdminUser.contactNumber,
            loginAttempts: superAdminUser.loginAttempts,
            accountLocked: superAdminUser.accountLocked,
            lockUntil: superAdminUser.lockUntil,
            lastLogin: superAdminUser.lastLogin,
            tokenVersion: superAdminUser.tokenVersion,
            createdAt: superAdminUser.createdAt,
            updatedAt: superAdminUser.updatedAt
          });

          await newSuperAdmin.save();
          console.log(`✅ Migrated superadmin: ${superAdminUser.email}`);
        } else {
          console.log(`⚠️  SuperAdmin already exists: ${superAdminUser.email}`);
        }
      }

      console.log('\n🎉 Migration completed successfully!');
      
      // Optional: Remove admin/superadmin users from User collection
      const shouldRemove = process.argv.includes('--remove');
      if (shouldRemove) {
        console.log('\n🗑️  Removing admin/superadmin users from User collection...');
        await User.deleteMany({ role: { $in: ['ADMIN', 'SUPERADMIN'] } });
        console.log('✅ Removed admin/superadmin users from User collection');
      }

    } catch (error) {
      console.error('\n❌ Migration failed:', error);
    } finally {
      mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    }
  })
  .catch((err) => {
    console.error('\n❌ MongoDB connection error:', err);
    process.exit(1);
  });
