# Firebase Storage Only Architecture

This document describes the simplified architecture using **Firebase Storage** for file management and **MongoDB** for all data operations.

## 🏗️ **Architecture Overview**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Android       │    │   Web Admin     │    │   Mobile App    │
│   Tablets       │    │   Dashboard     │    │   (Expo)        │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │    GraphQL Server         │
                    │   (Apollo Server)         │
                    └─────────────┬─────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
    ┌─────▼─────┐         ┌───────▼───────┐         ┌─────▼─────┐
    │  Firebase  │         │   MongoDB    │         │  MongoDB  │
    │  Storage   │         │   (Real-time │         │ (Analytics│
    │  (Files)   │         │   Data)      │         │  & Reports│
    └───────────┘         └───────────────┘         └───────────┘
```

## 🔥 **Firebase Storage (File Management)**

### **Storage Structure**
```
📁 /ads/
  ├── ad-123/
  │   ├── video.mp4
  │   ├── thumbnail.jpg
  │   ├── metadata.json
  │   └── config.json
  └── ad-456/
      ├── video.mp4
      └── thumbnail.jpg

📁 /tablets/
  ├── tablet-001/
  │   ├── config.json
  │   ├── assets/
  │   │   ├── logo.png
  │   │   └── background.jpg
  │   └── logs/
  │       └── latest.log
  └── tablet-002/
      └── config.json

📁 /materials/
  ├── templates/
  │   ├── ad-template-1.json
  │   └── ad-template-2.json
  └── assets/
      ├── default-thumbnail.jpg
      └── placeholder-video.mp4
```

### **Use Cases**
- ✅ **Ad materials**: Videos, images, thumbnails
- ✅ **Tablet configurations**: Settings, assets, logs
- ✅ **Templates**: Ad templates, default assets
- ✅ **File management**: Upload, download, delete
- ✅ **CDN**: Fast global content delivery

## 🍃 **MongoDB (All Data Operations)**

### **Collections**
- **`users`**: User management (regular users only)
- **`admins`**: Admin user management
- **`superadmins`**: SuperAdmin user management
- **`tablets`**: Tablet management and real-time status
- **`ads`**: Ad campaign management
- **`materials`**: Ad materials metadata
- **`screenTracking`**: Playback analytics
- **`notifications`**: Push notifications
- **`locations`**: Real-time location tracking

### **Use Cases**
- ✅ **Real-time data**: Tablet status, location, playback
- ✅ **User management**: Authentication, authorization
- ✅ **Analytics**: Historical data, reports
- ✅ **Notifications**: Push notifications
- ✅ **Metadata**: File information, relationships

## 🚀 **Key Benefits of This Approach**

### **Simplified Setup**
- ✅ **No Firestore**: Only Firebase Storage for files
- ✅ **Existing project**: Use your current Firebase setup
- ✅ **Lower costs**: Storage is cheaper than Firestore
- ✅ **Familiar**: Standard file storage approach

### **Performance**
- ✅ **Fast file delivery**: Firebase Storage CDN
- ✅ **Real-time data**: MongoDB for live updates
- ✅ **Scalable**: Both services scale independently
- ✅ **Reliable**: Proven technologies

## 📊 **Data Flow Examples**

### **1. Ad Upload Process**
```
1. Admin uploads ad video via GraphQL
2. File stored in Firebase Storage: /ads/ad-123/video.mp4
3. Metadata stored in MongoDB: materials collection
4. Tablet downloads video URL from MongoDB
5. Video streamed from Firebase Storage CDN
```

### **2. Tablet Configuration**
```
1. Admin updates tablet config via GraphQL
2. Config JSON stored in Firebase Storage: /tablets/tablet-001/config.json
3. Tablet status updated in MongoDB: tablets collection
4. Tablet fetches config URL from MongoDB
5. Config downloaded from Firebase Storage
```

### **3. Real-time Tracking**
```
1. Tablet sends location update via GraphQL
2. Location stored in MongoDB: locations collection
3. Admin sees live location in dashboard
4. Historical data available for analytics
5. No files involved - pure data
```

## 🔧 **Configuration**

### **Environment Variables**
```env
# Firebase Storage Configuration
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef123456

# Firebase Admin (for signed URLs)
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key\n-----END PRIVATE KEY-----\n"

# MongoDB
MONGODB_URI=your_mongodb_connection_string
```

### **Firebase Storage Rules**
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Ad materials - read/write for authenticated users
    match /ads/{adId}/{fileName} {
      allow read, write: if request.auth != null;
    }
    
    // Tablet configs - read/write for authenticated users
    match /tablets/{tabletId}/{fileName} {
      allow read, write: if request.auth != null;
    }
    
    // Materials - read/write for authenticated users
    match /materials/{fileName} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 📱 **Mobile App Integration**

### **Android Tablet App**
```javascript
// Download ad video from Firebase Storage
const downloadAdVideo = async (adId, fileName) => {
  // Get download URL from MongoDB (via GraphQL)
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query GetAdMaterial($adId: String!, $fileName: String!) {
          getAdMaterial(adId: $adId, fileName: $fileName) {
            downloadURL
            fileName
          }
        }
      `,
      variables: { adId, fileName }
    })
  });
  
  const { data } = await response.json();
  return data.getAdMaterial.downloadURL;
};

// Stream video from Firebase Storage
const videoUrl = await downloadAdVideo('ad-123', 'video.mp4');
// Use videoUrl in video player
```

### **Web Admin Dashboard**
```javascript
// Upload ad material to Firebase Storage
const uploadAdMaterial = async (adId, file) => {
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        mutation UploadAdMaterial($adId: String!, $file: Upload!) {
          uploadAdMaterial(adId: $adId, file: $file) {
            success
            downloadURL
            fileName
          }
        }
      `,
      variables: { adId, file }
    })
  });
  
  const { data } = await response.json();
  return data.uploadAdMaterial;
};
```

## 🎯 **Comparison: Storage Only vs Full Firebase**

### **Storage Only (Recommended)**
| Feature | Firebase Storage | MongoDB |
|---------|------------------|---------|
| **Files** | ✅ Videos, images | ❌ |
| **Real-time data** | ❌ | ✅ |
| **User management** | ❌ | ✅ |
| **Analytics** | ❌ | ✅ |
| **Cost** | 💰 Low | 💰 Low |
| **Complexity** | 🟢 Simple | 🟢 Simple |

### **Full Firebase (Previous Implementation)**
| Feature | Firebase | MongoDB |
|---------|----------|---------|
| **Files** | ✅ Videos, images | ❌ |
| **Real-time data** | ✅ | ✅ |
| **User management** | ✅ | ✅ |
| **Analytics** | ❌ | ✅ |
| **Cost** | 💰💰 Higher | 💰 Low |
| **Complexity** | 🔴 Complex | 🟢 Simple |

## 🚀 **Migration Path**

### **From Current Setup**
1. **Keep Firebase Storage**: Your existing setup
2. **Add MongoDB**: For real-time data and analytics
3. **Update GraphQL**: Add storage operations
4. **Test integration**: Verify file uploads/downloads

### **Benefits**
- ✅ **No Firestore setup**: Use existing Storage
- ✅ **Lower costs**: Storage is cheaper
- ✅ **Simpler architecture**: Less complexity
- ✅ **Better performance**: CDN for files

## 📋 **Next Steps**

1. **Verify Firebase Storage**: Test your existing setup
2. **Update environment variables**: Add Storage config
3. **Test file operations**: Upload/download files
4. **Integrate with MongoDB**: For real-time data
5. **Update mobile apps**: Use Storage URLs

## 🔍 **Testing**

### **Test Firebase Storage**
```bash
# Test file upload
node test-storage.js
```

### **Test Integration**
```bash
# Test complete flow
node test-integration.js
```

---

This simplified architecture gives you the best of both worlds:
- **Firebase Storage** for efficient file management
- **MongoDB** for real-time data and analytics
- **Lower costs** and **simpler setup**
- **Better performance** with CDN delivery
