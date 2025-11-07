// Don't use dotenv in production - Railway provides environment variables directly
// Only use dotenv in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: '.env.production' });
}
const admin = require('firebase-admin');

// ✅ Ensure FIREBASE_PRIVATE_KEY exists and is valid
if (!process.env.FIREBASE_PRIVATE_KEY) {
  console.error("❌ FIREBASE_PRIVATE_KEY is not defined in environment variables");
  console.error("⚠️  Firebase Admin will not be initialized. Storage operations will fail.");
  module.exports = { admin: null, db: null, bucket: null, auth: null };
  return;
}

// Debug private key format
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
console.log(`🔍 Private key length: ${rawPrivateKey.length}`);

// Check if private key seems truncated (should be at least 1000 characters)
if (rawPrivateKey.length < 1000) {
  console.error("❌ WARNING: Private key appears to be truncated!");
  console.error(`   Expected length: ~1600+ characters`);
  console.error(`   Actual length: ${rawPrivateKey.length} characters`);
  console.error("   This usually means the environment variable in Railway is not set correctly.");
  console.error("   Please check that FIREBASE_PRIVATE_KEY contains the FULL private key.");
  console.error("⚠️  Firebase Admin will not be initialized. Storage operations will fail.");
  module.exports = { admin: null, db: null, bucket: null, auth: null };
  return;
}

console.log(`🔍 Private key starts with: ${rawPrivateKey.substring(0, 50)}...`);
console.log(`🔍 Private key ends with: ...${rawPrivateKey.substring(rawPrivateKey.length - 50)}`);

// Fix private key formatting
let privateKey = rawPrivateKey.trim();

// Remove any surrounding quotes that might have been added
privateKey = privateKey.replace(/^["']+|["']+$/g, '');

// Handle different private key formats
if (privateKey.includes('\\n')) {
  // Replace literal \n with actual newlines
  privateKey = privateKey.replace(/\\n/g, '\n');
}

// Check if END marker is missing and add it if needed
if (!privateKey.includes('-----END PRIVATE KEY-----')) {
  console.warn('⚠️  Private key is missing END marker, attempting to fix...');
  // Try to find where the key ends (usually ends with base64 characters)
  // Add the END marker
  privateKey = privateKey.trim() + '\n-----END PRIVATE KEY-----';
}

// Ensure proper newline formatting after BEGIN marker
if (privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
  privateKey = privateKey.replace(/-----BEGIN PRIVATE KEY-----[\s\n]*/, '-----BEGIN PRIVATE KEY-----\n');
}

// Ensure proper newline formatting before END marker
if (privateKey.includes('-----END PRIVATE KEY-----')) {
  privateKey = privateKey.replace(/[\s\n]*-----END PRIVATE KEY-----/, '\n-----END PRIVATE KEY-----');
}

// Clean up any extra whitespace/newlines
privateKey = privateKey.trim();

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
  if (error.message.includes('private key') || error.message.includes('ASN.1') || error.message.includes('PEM')) {
    console.error("🔧 Private key debugging:");
    console.error(`   Key length: ${serviceAccount.private_key.length}`);
    console.error(`   Contains BEGIN: ${serviceAccount.private_key.includes('-----BEGIN PRIVATE KEY-----')}`);
    console.error(`   Contains END: ${serviceAccount.private_key.includes('-----END PRIVATE KEY-----')}`);
    console.error(`   Contains newlines: ${serviceAccount.private_key.includes('\n')}`);
    console.error(`   First 150 chars: ${serviceAccount.private_key.substring(0, 150)}`);
    console.error(`   Last 150 chars: ${serviceAccount.private_key.substring(serviceAccount.private_key.length - 150)}`);
    console.error("\n🔧 Common issues:");
    console.error("   1. Missing -----END PRIVATE KEY----- marker");
    console.error("   2. Extra quotes in Railway environment variable");
    console.error("   3. Incorrect newline handling (should use \\n for literal newlines)");
    console.error("\n💡 Fix in Railway:");
    console.error("   FIREBASE_PRIVATE_KEY should be:");
    console.error('   "-----BEGIN PRIVATE KEY-----\\n...key content...\\n-----END PRIVATE KEY-----"');
    console.error("   (Note: Single quote at start, \\n for newlines, must include END marker)");
  }
  
  // Don't exit - let the server start even if Firebase fails
  // This allows Railway health checks to pass
  console.error("⚠️  Firebase Admin initialization failed, but server will continue to run");
  console.error("⚠️  Storage operations will fail until Firebase is properly configured");
  module.exports = { admin: null, db: null, bucket: null, auth: null };
  return;
}

// Initialize Firebase services (only if admin was successfully initialized)
const db = admin ? admin.firestore() : null;
const auth = admin ? admin.auth() : null;
const bucket = admin ? admin.storage().bucket(bucketName) : null;

// Test Storage connection with a more specific check (only if bucket is available)
const checkBucketAccess = async () => {
  if (!bucket) {
    console.warn('⚠️  Firebase bucket is not available - skipping bucket access check');
    return;
  }
  
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
