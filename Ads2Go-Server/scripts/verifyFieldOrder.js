/**
 * Verification script to check if userName appears right after userId
 */

const path = require('path');
const fs = require('fs');

// Load .env file
const envPaths = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '..', '.env'),
  path.join(process.cwd(), '.env'),
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  require('dotenv').config();
}

// Add the server directory to the path so we can require models
const serverPath = path.join(__dirname, '..');
process.chdir(serverPath);

const mongoose = require('mongoose');
const UserAnalytics = require('../src/models/userAnalytics');

async function verifyFieldOrder() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get a few sample documents
    const samples = await UserAnalytics.find({}).limit(3).lean();
    
    console.log('📋 Verifying field order in sample documents:\n');
    console.log('='.repeat(80));

    samples.forEach((doc, index) => {
      console.log(`\n[${index + 1}] Document: ${doc.userName || 'Unknown'} (${doc.userId})`);
      console.log('Field order:');
      
      // Get field order from the document
      const fields = Object.keys(doc);
      const userIdIndex = fields.indexOf('userId');
      const userNameIndex = fields.indexOf('userName');
      
      console.log(`  - userId at position: ${userIdIndex}`);
      console.log(`  - userName at position: ${userNameIndex}`);
      
      if (userNameIndex === userIdIndex + 1) {
        console.log(`  ✅ CORRECT: userName appears right after userId`);
      } else {
        console.log(`  ❌ INCORRECT: userName should be at position ${userIdIndex + 1}, but it's at ${userNameIndex}`);
        console.log(`  Fields around userId: ${fields.slice(Math.max(0, userIdIndex - 2), userIdIndex + 3).join(', ')}`);
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Verification complete!\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Verification error:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

verifyFieldOrder();

