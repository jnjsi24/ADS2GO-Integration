require('dotenv').config({ path: './.env' });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User'); // Adjust if your structure is different

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  const email = 'superadmin@example.com';

  const existing = await User.findOne({ email });
  if (existing) {
    console.log('❌ Superadmin already exists.');
    return mongoose.disconnect();
  }

  const hashedPassword = await bcrypt.hash('Adminpass!', 10);

  await User.create({
    firstName: 'Super',
    middleName: 'A.',
    lastName: 'Admin',
    email,
    password: hashedPassword,
    role: 'SUPERADMIN',
    isEmailVerified: true,
    companyName: 'ADS TO GO',
    companyAddress: '123 Super Street, Cityville',
    houseAddress: '456 Admin Ave',
    contactNumber: '+639123456789',
    lastLogin: new Date()
  });

  console.log('✅ Superadmin created successfully.');
  mongoose.disconnect();
})
.catch((err) => {
  console.error('❌ Error creating superadmin:', err);
  mongoose.disconnect();
});
