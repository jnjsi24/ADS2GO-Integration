require('dotenv').config();
const admin = require('firebase-admin');

// Directly use the service account details
const serviceAccount = {
  "type": "service_account",
  "project_id": "adstogo-305d8",
  "private_key_id": "a6c87039be222ca1655982037294c2b339344325",
  "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  "client_email": "firebase-adminsdk-fbsvc@adstogo-305d8.iam.gserviceaccount.com",
  "client_id": "100364698031058759110",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40adstogo-305d8.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "adstogo-305d8.appspot.com"
});

const bucket = admin.storage().bucket();
const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, bucket, auth };