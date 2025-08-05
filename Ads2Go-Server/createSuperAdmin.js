require('dotenv').config({ path: './.env' });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User'); // Adjust if needed

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const email = 'ads2go.superadmin@example.com';

    const existing = await User.findOne({ email });
    if (existing) {
      console.log('❌ Superadmin already exists.');
      return mongoose.disconnect();
    }

    const hashedPassword = await bcrypt.hash('Ads2gosuperadmin_123', 10);

    await User.create({
      firstName: 'Mr',
      middleName: 'Super',
      lastName: 'Admin',
      email: 'ads2go.superadmin@example.com',
      password: hashedPassword,
      role: 'SUPERADMIN',
      isEmailVerified: true,
      companyName: 'ADS TO GO',
      companyAddress: '1216 A. Bonifacio Ave, Quezon City',
      houseAddress: '4561 Admin Ave',
      contactNumber: '+639113451789',
      lastLogin: new Date(),
      loginAttempts: 0,
      accountLocked: false,
      lockUntil: null
    });

    console.log('✅ Superadmin created successfully.');
    mongoose.disconnect();
  })
  .catch((err) => {
    console.error('❌ Error creating superadmin:', err);
    mongoose.disconnect();
  });
