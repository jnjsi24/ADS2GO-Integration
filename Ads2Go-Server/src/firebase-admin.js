require('dotenv').config({ path: '.env.production' });
const admin = require('firebase-admin');

// ✅ Ensure FIREBASE_PRIVATE_KEY exists
if (!process.env.FIREBASE_PRIVATE_KEY) {
  throw new Error("❌ FIREBASE_PRIVATE_KEY is not defined in .env");
}

// Debug private key format
console.log(`🔍 Private key length: ${process.env.FIREBASE_PRIVATE_KEY.length}`);
console.log(`🔍 Private key starts with: ${process.env.FIREBASE_PRIVATE_KEY.substring(0, 50)}...`);
console.log(`🔍 Private key ends with: ...${process.env.FIREBASE_PRIVATE_KEY.substring(process.env.FIREBASE_PRIVATE_KEY.length - 50)}`);

// Fix private key formatting
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

// Handle different private key formats
if (privateKey.includes('\\n')) {
  // Replace literal \n with actual newlines
  privateKey = privateKey.replace(/\\n/g, '\n');
} else if (!privateKey.includes('\n')) {
  // If no newlines at all, add them manually
  privateKey = privateKey.replace(/-----BEGIN PRIVATE KEY-----/, '-----BEGIN PRIVATE KEY-----\n')
                         .replace(/-----END PRIVATE KEY-----/, '\n-----END PRIVATE KEY-----');
}

// Ensure proper newline formatting
if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----\n')) {
  privateKey = '-----BEGIN PRIVATE KEY-----\n' + privateKey.replace('-----BEGIN PRIVATE KEY-----', '');
}
if (!privateKey.endsWith('\n-----END PRIVATE KEY-----')) {
  privateKey = privateKey.replace('-----END PRIVATE KEY-----', '') + '\n-----END PRIVATE KEY-----';
}

console.log(`🔍 Formatted private key length: ${privateKey.length}`);
console.log(`🔍 Formatted private key starts with: ${privateKey.substring(0, 50)}...`);

// Build service account object
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: privateKey,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
};

// ✅ Always use .appspot.com for bucket
const bucketName =
  process.env.FIREBASE_STORAGE_BUCKET ||
  `${process.env.FIREBASE_PROJECT_ID}.appspot.com`;

console.log(`🔍 Using Firebase Storage bucket: ${bucketName}`);

// Validate service account object
console.log(`🔍 Service account validation:`);
console.log(`   Project ID: ${serviceAccount.project_id ? '✅' : '❌'}`);
console.log(`   Client Email: ${serviceAccount.client_email ? '✅' : '❌'}`);
console.log(`   Private Key ID: ${serviceAccount.private_key_id ? '✅' : '❌'}`);
console.log(`   Private Key: ${serviceAccount.private_key ? '✅' : '❌'}`);

// Initialize Firebase Admin
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: bucketName,
  });
  console.log("✅ Firebase Admin SDK initialized successfully");
} catch (error) {
  console.error("❌ Failed to initialize Firebase Admin SDK:", error.message);
  console.error("🔍 Error details:", error);
  
  // Additional debugging for private key issues
  if (error.message.includes('private key') || error.message.includes('ASN.1')) {
    console.error("🔧 Private key debugging:");
    console.error(`   Key length: ${serviceAccount.private_key.length}`);
    console.error(`   Contains BEGIN: ${serviceAccount.private_key.includes('-----BEGIN PRIVATE KEY-----')}`);
    console.error(`   Contains END: ${serviceAccount.private_key.includes('-----END PRIVATE KEY-----')}`);
    console.error(`   Contains newlines: ${serviceAccount.private_key.includes('\n')}`);
    console.error(`   First 100 chars: ${serviceAccount.private_key.substring(0, 100)}`);
    console.error(`   Last 100 chars: ${serviceAccount.private_key.substring(serviceAccount.private_key.length - 100)}`);
  }
  
  process.exit(1);
}

// Initialize Firebase services
const db = admin.firestore();
const auth = admin.auth();
const bucket = admin.storage().bucket(bucketName);

// Test Storage connection with a more specific check
const checkBucketAccess = async () => {
  try {
    const [exists] = await bucket.exists();
    if (exists) {
      console.log(`✅ Firebase Storage connected to bucket '${bucketName}'`);
    } else {
      console.warn(`⚠️  Bucket '${bucketName}' does not exist.`);
      console.log('ℹ️  The server will continue to run, but storage operations will fail.');
      console.log('    To fix this:');
      console.log('    1. Go to Firebase Console > Storage');
      console.log('    2. Click "Get Started" to enable Storage if not already done');
      console.log('    3. The default bucket will be created automatically');
    }
  } catch (error) {
    console.error(`❌ Error checking bucket '${bucketName}':`, error.message);
    console.log('ℹ️  The server will continue to run, but storage operations will fail.');
  }
};

// Run the check without blocking server startup
setTimeout(checkBucketAccess, 1000);

module.exports = { admin, db, bucket, auth };
