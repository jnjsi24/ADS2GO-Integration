const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// CompanyAd schema (simplified for migration)
const CompanyAdSchema = new mongoose.Schema({
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { strict: false });

const CompanyAd = mongoose.model('CompanyAd', CompanyAdSchema);

async function fixCompanyAdsCreatedBy() {
  try {
    console.log('🔍 Checking for company ads with null createdBy...');
    
    // Find all company ads with null or missing createdBy
    const adsWithNullCreatedBy = await CompanyAd.find({
      $or: [
        { createdBy: null },
        { createdBy: { $exists: false } }
      ]
    });
    
    console.log(`📊 Found ${adsWithNullCreatedBy.length} company ads with null createdBy`);
    
    if (adsWithNullCreatedBy.length === 0) {
      console.log('✅ No company ads need fixing!');
      return;
    }
    
    // Get a default admin user (or create one if none exists)
    const User = mongoose.model('User');
    let defaultAdmin = await User.findOne({ role: 'ADMIN' });
    
    if (!defaultAdmin) {
      console.log('⚠️ No admin user found. Creating a default admin for migration...');
      defaultAdmin = new User({
        firstName: 'System',
        lastName: 'Admin',
        email: 'system@ads2go.app',
        role: 'ADMIN',
        isActive: true
      });
      await defaultAdmin.save();
      console.log('✅ Created default admin user');
    }
    
    // Update all company ads with null createdBy
    const updateResult = await CompanyAd.updateMany(
      {
        $or: [
          { createdBy: null },
          { createdBy: { $exists: false } }
        ]
      },
      {
        $set: { createdBy: defaultAdmin._id }
      }
    );
    
    console.log(`✅ Updated ${updateResult.modifiedCount} company ads with createdBy: ${defaultAdmin.email}`);
    
    // Verify the fix
    const remainingNullAds = await CompanyAd.find({
      $or: [
        { createdBy: null },
        { createdBy: { $exists: false } }
      ]
    });
    
    if (remainingNullAds.length === 0) {
      console.log('🎉 All company ads now have valid createdBy values!');
    } else {
      console.log(`⚠️ ${remainingNullAds.length} company ads still have null createdBy`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing company ads:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the migration
fixCompanyAdsCreatedBy();
