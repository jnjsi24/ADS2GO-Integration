# Firebase Storage Folder Structure

## 🗂️ **Current Structure (Your Actual Usage)**
```
gs://ads2go-6ead4.firebasestorage.app/
├── 📁 advertisements/     ✅ (existing - USER-created ad videos/pictures)
└── 📁 drivers/           ✅ (existing - driver profile pictures)
```

## 📁 **Recommended Complete Structure**

```
gs://ads2go-6ead4.firebasestorage.app/
├── 📁 advertisements/         # ✅ (existing - USER-created ad videos/pictures)
│   ├── user-123/
│   │   ├── ad-001/
│   │   │   ├── video.mp4
│   │   │   ├── thumbnail.jpg
│   │   │   └── metadata.json
│   │   └── ad-002/
│   │       ├── video.mp4
│   │       └── thumbnail.jpg
│   └── user-456/
│       └── ad-003/
│           ├── video.mp4
│           └── thumbnail.jpg
│
├── 📁 drivers/               # ✅ (existing - driver profile pictures)
│   ├── driver-001/
│   │   ├── profile.jpg
│   │   ├── license.jpg
│   │   └── vehicle.jpg
│   └── driver-002/
│       └── profile.jpg
│
├── 📁 tablets/                # NEW: Admin-managed tablet configurations
│   ├── tablet-001/
│   │   ├── config.json
│   │   ├── assets/
│   │   │   ├── logo.png
│   │   │   └── background.jpg
│   │   └── logs/
│   │       └── latest.log
│   └── tablet-002/
│       └── config.json
│
└── 📁 materials/              # NEW: Admin-created templates and defaults
    ├── templates/
    │   ├── ad-template-1.json
    │   └── ad-template-2.json
    └── assets/
        ├── default-thumbnail.jpg
        └── placeholder-video.mp4
```

## 📋 **Folder Purposes (Updated for User Roles)**

### **📁 advertisements/** (existing)
- **Created by**: 👤 USERS (advertisers/clients)
- **Purpose**: Store user-created ad campaign videos and pictures
- **Content**: Ad videos, images, thumbnails, metadata
- **Structure**: `advertisements/{userId}/{adId}/{fileName}`
- **Example**: `advertisements/user-123/ad-001/video.mp4`
- **Usage**: When users upload their ad materials

### **📁 drivers/** (existing)
- **Created by**: 🚗 DRIVERS
- **Purpose**: Store driver profile pictures and documents
- **Content**: Profile photos, license images, vehicle pictures
- **Structure**: `drivers/{driverId}/{fileName}`
- **Example**: `drivers/driver-001/profile.jpg`
- **Usage**: When drivers create accounts and upload documents

### **📁 tablets/** (NEW)
- **Created by**: 👨‍💼 ADMINS
- **Purpose**: Store tablet configurations and assets
- **Content**: Config files, logos, backgrounds, logs
- **Structure**: `tablets/{tabletId}/{fileName}`
- **Example**: `tablets/tablet-001/config.json`
- **Usage**: Admin-managed tablet setup and configuration

### **📁 materials/** (NEW)
- **Created by**: 👨‍💼 ADMINS
- **Purpose**: Store templates and default assets for users
- **Content**: Ad templates, default images, placeholders
- **Structure**: `materials/{type}/{fileName}`
- **Example**: `materials/templates/ad-template-1.json`
- **Usage**: Admins create templates that users can use

## 🔄 **Ad Creation Workflow**

### **1. User Creates Ad:**
```
👤 USER
├── 1. Logs into system
├── 2. Chooses ad template (from materials/templates/)
├── 3. Uploads ad video/picture → advertisements/user-123/ad-001/
├── 4. Sets ad parameters (duration, schedule, etc.)
└── 5. Submits for admin approval
```

### **2. Admin Reviews Ad:**
```
👨‍💼 ADMIN
├── 1. Reviews user-submitted ad
├── 2. Approves/rejects ad
├── 3. Assigns to tablets
├── 4. Sets playback schedule
└── 5. Monitors performance
```

### **3. Tablet Plays Ad:**
```
📱 TABLET
├── 1. Downloads config → tablets/tablet-001/config.json
├── 2. Gets ad content → advertisements/user-123/ad-001/video.mp4
├── 3. Uses templates → materials/templates/ad-template-1.json
└── 4. Plays ad with branding
```

## 🔧 **Updated Implementation**

The Firebase Storage service should reflect user ownership:

```javascript
// User uploads ad material
await firebaseStorageService.uploadUserAd(userId, adId, file);
// Creates: advertisements/user-123/ad-001/video.mp4

// Admin uploads tablet config
await firebaseStorageService.uploadTabletConfig('tablet-001', config);
// Creates: tablets/tablet-001/config.json

// Admin uploads template for users
await firebaseStorageService.uploadMaterial('templates', 'ad-template.json', file);
// Creates: materials/templates/ad-template.json
```

## 🎯 **Benefits of This Structure**

1. **✅ User Ownership**: Clear separation of user-created vs admin-managed content
2. **✅ Security**: Users can only access their own ads
3. **✅ Scalability**: Easy to manage multiple users and their ads
4. **✅ Templates**: Admins provide templates for users to use
5. **✅ Organization**: Logical folder hierarchy based on user roles

## 📝 **Next Steps**

1. **Keep existing folders**: `advertisements/` and `drivers/` (continue using as is)
2. **Create new folders**: `tablets/` and `materials/` (for admin functionality)
3. **Update code**: Reflect user ownership in storage paths
4. **Test workflow**: Verify user ad creation and admin approval process

---

This structure properly reflects that **USERS create ads** while **ADMINS manage the system**! 🎯
