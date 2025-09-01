require('dotenv').config({ path: './.env' });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const SuperAdmin = require('./src/models/SuperAdmin'); // Adjust path if needed

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const email = 'ads2go.superadmin2@example.com'; // 👈 NEW email to avoid conflict

    const existing = await SuperAdmin.findOne({ email });
    if (existing) {
      console.log('❌ Superadmin already exists.');
      return mongoose.disconnect();
    }

    const hashedPassword = await bcrypt.hash('Ads2gosuperadmin2_123', 10);

    await SuperAdmin.create({
      firstName: 'Ms',
      middleName: 'Ultra',
      lastName: 'AdminTwo',
      email,
      password: hashedPassword,
      role: 'SUPERADMIN',
      isEmailVerified: true,
      companyName: 'ADS TO GO PH',
      companyAddress: '999 Kalayaan Ave, QC',
      houseAddress: '789 Super St',
      contactNumber: '+639228889999',
      lastLogin: new Date(),
      loginAttempts: 0,
      accountLocked: false,
      lockUntil: null
    });

    console.log('✅ Superadmin 2 created successfully.');
    mongoose.disconnect();
  })
  .catch((err) => {
    console.error('❌ Error creating superadmin 2:', err);
    mongoose.disconnect();
  });
