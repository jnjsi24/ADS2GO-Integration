# Material Photo Upload System

This system allows drivers to upload monthly photos of their assigned materials for compliance tracking and quality monitoring.

## 🏗️ Architecture

### Firebase Storage Structure
```
/materialtracking/{driverId}/{materialId}/monthly-photos/{YYYY-MM}/
  - photo1.jpg
  - photo2.jpg
  - metadata.json
```

### Database Schema
The `MaterialTracking` model has been enhanced with monthly photo tracking fields:

- `monthlyPhotos`: Array of monthly photo records
- `lastPhotoUpload`: Date of last photo upload
- `nextPhotoDue`: Next photo due date
- `photoComplianceStatus`: Current compliance status

## 📱 Mobile App Integration

### Component: `MaterialPhotoUpload`
Located at: `Ads2Go-MobileAppExpo/components/MaterialPhotoUpload.tsx`

**Features:**
- Camera integration for taking photos
- Gallery picker for selecting existing photos
- Photo preview and management
- Upload to Firebase Storage
- Real-time compliance status

**Required Dependencies:**
```bash
expo install expo-camera expo-image-picker
```

## 🚀 API Endpoints

### 1. Upload Monthly Photos
```
POST /material-photos/upload
Content-Type: multipart/form-data
Authorization: Bearer {driverToken}

Body:
- materialId: string
- month: string (YYYY-MM format)
- photos: File[] (up to 5 photos)
```

**Response:**
```json
{
  "success": true,
  "message": "Photos uploaded successfully",
  "data": {
    "materialId": "DGL-HEADDRESS-CAR-001",
    "month": "2024-01",
    "photoUrls": ["https://..."],
    "totalPhotos": 3,
    "nextPhotoDue": "2024-02-01T00:00:00.000Z",
    "complianceStatus": "COMPLIANT"
  }
}
```

### 2. Get Monthly Photos
```
GET /material-photos/{materialId}/{month}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "materialId": "DGL-HEADDRESS-CAR-001",
    "month": "2024-01",
    "photos": ["https://..."],
    "status": "PENDING",
    "uploadedAt": "2024-01-15T10:30:00.000Z",
    "uploadedBy": "DRV-001",
    "adminNotes": null,
    "reviewedBy": null,
    "reviewedAt": null
  }
}
```

### 3. Review Photos (Admin Only)
```
PUT /material-photos/{materialId}/{month}/review
Authorization: Bearer {adminToken}

Body:
{
  "status": "APPROVED" | "REJECTED",
  "notes": "Optional review notes"
}
```

### 4. Get Overdue Photos (Admin Only)
```
GET /material-photos/compliance/overdue
Authorization: Bearer {adminToken}
```

### 5. Get Storage Statistics (Admin Only)
```
GET /material-photos/storage/stats?driverId={optional}
Authorization: Bearer {adminToken}
```

## 🔧 Setup Instructions

### 1. Install Dependencies
```bash
cd Ads2Go-Server
npm install multer
```

### 2. Firebase Configuration
Ensure your Firebase Admin SDK is properly configured in `src/firebase-admin.js`

### 3. Environment Variables
Make sure these are set in your `.env` file:
```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
```

### 4. Start Server
```bash
npm start
```

## 📸 Usage Examples

### Driver Uploading Photos
1. Driver opens mobile app
2. Navigates to Material Photo Upload screen
3. Takes photos using camera or selects from gallery
4. Reviews selected photos
5. Uploads to server
6. Receives confirmation and compliance status

### Admin Reviewing Photos
1. Admin accesses admin panel
2. Views pending photo uploads
3. Reviews photos for quality and compliance
4. Approves or rejects with notes
5. Updates compliance status

## 🔒 Security Features

- **Authentication**: All endpoints require valid driver or admin tokens
- **Authorization**: Drivers can only upload/delete their own photos
- **File Validation**: Only image files allowed (JPG, PNG, GIF, WebP)
- **File Size Limit**: 10MB per photo
- **Rate Limiting**: Up to 5 photos per upload

## 📊 Compliance Tracking

### Status Types
- `COMPLIANT`: Photos uploaded for current month
- `NON_COMPLIANT`: No photos for current month
- `OVERDUE`: Past due date for photo upload

### Automatic Calculations
- `nextPhotoDue`: Automatically calculated as first day of next month
- `photoComplianceStatus`: Automatically updated based on current month photos
- `lastPhotoUpload`: Updated with most recent upload timestamp

## 🚨 Error Handling

### Common Error Scenarios
1. **Invalid File Type**: Only image files accepted
2. **File Size Exceeded**: 10MB limit per photo
3. **Permission Denied**: Driver can only access their own materials
4. **Storage Full**: Firebase Storage quota exceeded
5. **Network Issues**: Upload timeout or connection failure

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

## 📈 Monitoring & Analytics

### Admin Dashboard Features
- Overdue photo tracking
- Storage usage statistics
- Compliance rate monitoring
- Photo review queue
- Driver performance metrics

### Storage Statistics
- Total files uploaded
- Storage space used (MB)
- Per-driver usage breakdown
- Monthly upload trends

## 🔄 Monthly Workflow

### 1. Month Start
- System calculates next photo due date
- Compliance status set to "NON_COMPLIANT"

### 2. Driver Upload
- Driver takes photos of material
- Uploads via mobile app
- System updates compliance status

### 3. Admin Review
- Admin reviews uploaded photos
- Approves or rejects with feedback
- System updates final compliance status

### 4. Month End
- Compliance report generated
- Overdue notifications sent
- Next month preparation

## 🛠️ Troubleshooting

### Common Issues

1. **Photos Not Uploading**
   - Check Firebase Storage permissions
   - Verify file size limits
   - Check network connectivity

2. **Permission Errors**
   - Ensure driver is authenticated
   - Verify driver has access to material
   - Check token expiration

3. **Storage Issues**
   - Monitor Firebase Storage quota
   - Check file path permissions
   - Verify bucket configuration

### Debug Mode
Enable debug logging by setting:
```
NODE_ENV=development
```

## 📚 API Documentation

For complete API documentation, see the route files:
- `src/routes/materialPhotoUpload.js` - Main photo upload routes
- `src/services/photoUploadService.js` - Firebase Storage service
- `src/models/materialTracking.js` - Enhanced data model

## 🤝 Contributing

When adding new features:
1. Update the MaterialTracking schema if needed
2. Add corresponding API endpoints
3. Update mobile app components
4. Add proper error handling
5. Update this documentation

## 📞 Support

For technical support or questions about the photo upload system:
1. Check the error logs in the server console
2. Verify Firebase Storage configuration
3. Test with a simple photo upload
4. Review the API response for error details
