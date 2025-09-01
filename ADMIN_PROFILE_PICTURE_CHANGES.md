# Admin Profile Picture Upload Changes

## Overview
Admin profile pictures are now stored in a dedicated `admin/` folder in Firebase Storage instead of the `drivers/` folder.

## Changes Made

### 1. Updated File Upload Utility (`Ads2Go-Client/src/utils/fileUpload.ts`)
- Added new function `uploadAdminProfilePicture()` that uploads to the `admin/` folder
- Kept existing `uploadProfilePicture()` function for driver uploads (backward compatibility)

### 2. Updated Super Admin Dashboard (`Ads2Go-Client/src/pages/SUPERADMIN/SadminDashboard.tsx`)
- Changed import from `uploadProfilePicture` to `uploadAdminProfilePicture`
- Updated function calls in both create and edit admin forms

### 3. Updated Firebase Storage Rules (`Ads2Go-Server/firestore.rules`)
- Added new rule for admin profile picture uploads:
  ```javascript
  match /admin/{fileId} {
    allow write: if request.auth != null && 
                 request.resource.size < 5 * 1024 * 1024 && // 5MB limit
                 request.resource.contentType.matches('image/.*');
  }
  ```

### 4. Updated API Documentation (`API_DOCUMENTATION.md`)
- Added example for admin profile picture uploads

## Storage Structure

### Before
```
Firebase Storage:
├── drivers/
│   ├── profile_pictures/
│   └── documents/
└── users/
    └── avatars/
```

### After
```
Firebase Storage:
├── admin/
│   └── profile_pictures/ (admin profile pictures)
├── drivers/
│   ├── profile_pictures/ (driver profile pictures)
│   └── documents/
└── users/
    └── avatars/
```

## Usage

### Client-Side Upload
```typescript
import { uploadAdminProfilePicture } from '../../utils/fileUpload';

// Upload admin profile picture
const profilePictureUrl = await uploadAdminProfilePicture(file);
```

### Database Storage
- Profile picture URLs are stored as strings in MongoDB Admin documents
- The actual image files are stored in Firebase Storage under `admin/` folder

## Benefits
1. **Better Organization**: Admin profile pictures are now separated from driver uploads
2. **Security**: Dedicated Firebase Storage rules for admin uploads
3. **Scalability**: Easier to manage and scale admin-specific content
4. **Maintenance**: Clear separation makes it easier to manage different user types

## Migration Notes
- Existing admin profile pictures in the `drivers/` folder will continue to work
- New admin profile pictures will be uploaded to the `admin/` folder
- No database migration required as only URLs are stored in MongoDB
