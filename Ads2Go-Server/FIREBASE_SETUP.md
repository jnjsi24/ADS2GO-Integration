# Firebase Setup Guide

This guide will help you set up Firebase for the hybrid Firebase + MongoDB architecture.

## 🔥 **Step 1: Create Firebase Project**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: `ads2go-realtime`
4. Enable Google Analytics (optional)
5. Click "Create project"

## 🔥 **Step 2: Enable Firebase Services**

### **Firestore Database**
1. Go to Firestore Database
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location (choose closest to your users)
5. Click "Done"

### **Authentication**
1. Go to Authentication
2. Click "Get started"
3. Enable Email/Password authentication
4. Add your admin emails as authorized users

### **Storage**
1. Go to Storage
2. Click "Get started"
3. Choose "Start in test mode" (for development)
4. Select a location
5. Click "Done"

## 🔥 **Step 3: Get Firebase Configuration**

### **Web App Configuration**
1. Go to Project Settings (gear icon)
2. Scroll down to "Your apps"
3. Click "Add app" → "Web"
4. Register app with name: `ADS2GO Web`
5. Copy the configuration object

### **Service Account Key**
1. Go to Project Settings → Service accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Keep this file secure (never commit to git)

## 🔥 **Step 4: Update Environment Variables**

Add these variables to your `.env` file:

```env
# Firebase Configuration
FIREBASE_API_KEY=your_api_key_here
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef123456
FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Firebase Admin (Service Account)
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
```

## 🔥 **Step 5: Security Rules**

### **Firestore Rules**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Tablet data - read/write for authenticated users
    match /tablets/{tabletId} {
      allow read, write: if request.auth != null;
    }
    
    // Tracking data - read/write for authenticated users
    match /tracking/{tabletId} {
      allow read, write: if request.auth != null;
    }
    
    // Playback data - read/write for authenticated users
    match /playback/{playbackId} {
      allow read, write: if request.auth != null;
    }
    
    // Notifications - read/write for authenticated users
    match /notifications/{notificationId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### **Storage Rules**
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 🔥 **Step 6: Test the Setup**

### **Test Firebase Connection**
```bash
# Run the test script
node test-firebase.js
```

### **Test Real-time Features**
1. Register a tablet
2. Update tablet status
3. Send a notification
4. Check sync to MongoDB

## 🔥 **Step 7: Production Considerations**

### **Security**
1. Update Firestore rules for production
2. Set up proper authentication
3. Enable App Check
4. Set up monitoring and alerts

### **Performance**
1. Set up Firestore indexes
2. Configure caching strategies
3. Monitor usage and costs
4. Set up backup strategies

### **Monitoring**
1. Enable Firebase Analytics
2. Set up Crashlytics
3. Monitor Firestore usage
4. Set up alerts for high usage

## 🔥 **Step 8: Mobile App Integration**

### **Android Setup**
1. Add `google-services.json` to your Android app
2. Initialize Firebase in your app
3. Set up real-time listeners
4. Handle offline data

### **iOS Setup**
1. Add `GoogleService-Info.plist` to your iOS app
2. Initialize Firebase in your app
3. Set up real-time listeners
4. Handle offline data

## 🔥 **Step 9: Troubleshooting**

### **Common Issues**
1. **Authentication errors**: Check service account key
2. **Permission denied**: Update Firestore rules
3. **Connection timeouts**: Check network connectivity
4. **Sync failures**: Check MongoDB connection

### **Debug Commands**
```bash
# Check Firebase connection
node -e "const { db } = require('./src/config/firebase'); console.log('Firebase connected:', !!db);"

# Test sync service
node -e "const syncService = require('./src/services/syncService'); console.log('Sync status:', syncService.getStatus());"
```

## 🔥 **Step 10: Cost Optimization**

### **Firestore Optimization**
1. Use efficient queries
2. Implement pagination
3. Use offline persistence
4. Monitor read/write operations

### **Storage Optimization**
1. Compress images/videos
2. Use appropriate formats
3. Implement cleanup policies
4. Monitor storage usage

---

## 📋 **Next Steps**

1. **Set up Firebase project** following this guide
2. **Update environment variables** with your Firebase config
3. **Test the real-time features** using GraphQL playground
4. **Integrate with mobile apps** for tablet communication
5. **Monitor and optimize** performance and costs

For more information, check the [Firebase Documentation](https://firebase.google.com/docs).
