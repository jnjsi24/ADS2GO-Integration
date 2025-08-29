require('dotenv').config();
const admin = require('firebase-admin');

// ✅ Ensure FIREBASE_PRIVATE_KEY exists
if (!process.env.FIREBASE_PRIVATE_KEY) {
  throw new Error("❌ FIREBASE_PRIVATE_KEY is not defined in .env");
}

// Build service account object
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
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

// Initialize Firebase Admin
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: bucketName,
  });
  console.log("✅ Firebase Admin SDK initialized");
} catch (error) {
  console.error("❌ Failed to initialize Firebase Admin SDK:", error.message);
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
