# File Upload API Documentation

This document outlines the two methods for handling file uploads in the application:

## 1. Direct Client-Side Upload

For non-sensitive content like user avatars and ad media, use direct client-side uploads to Firebase Storage.

### Usage

```javascript
import { uploadFileToFirebase } from './utils/mediaUploader';

// Example: Uploading a profile picture
const uploadProfilePicture = async (file, userId) => {
  try {
    const result = await uploadFileToFirebase(
      file,                  // File object from file input
      'users/avatars',       // Storage path
      userId,                // Current user ID
      { purpose: 'profile' } // Optional metadata
    );

// Example: Uploading an admin profile picture
const uploadAdminProfilePicture = async (file) => {
  try {
    const result = await uploadFileToFirebase(
      file,                  // File object from file input
      'admin',               // Storage path for admin profile pictures
      { purpose: 'admin-profile' } // Optional metadata
    );
    
    if (result.success) {
      console.log('File uploaded successfully:', result.url);
      return result;
    } else {
      console.error('Upload failed:', result.error);
    }
  } catch (error) {
    console.error('Error during upload:', error);
  }
};
```

### Parameters

| Parameter | Type     | Required | Description                                      |
|-----------|----------|----------|--------------------------------------------------|
| file      | File     | Yes      | The file to upload                               |
| path      | String   | Yes      | Storage path (e.g., 'users/avatars')             |
| userId    | String   | Yes      | ID of the user uploading the file                |
| metadata  | Object   | No       | Additional metadata to store with the file       |
| onProgress| Function| No       | Callback function for upload progress (0-100)    |

### Response

```javascript
{
  success: true,
  url: 'https://storage.googleapis.com/...',
  path: 'users/avatars/user123_1234567890.jpg',
  name: 'profile.jpg',
  type: 'image/jpeg',
  size: 102345,
  metadata: { /* File metadata */ }
}
```

## 2. Server-Side Upload (For Sensitive Documents)

For sensitive documents like driver licenses and vehicle registrations, use the server-side upload endpoint.

### Endpoint

```
POST /api/upload/driver-documents
Content-Type: multipart/form-data
Authorization: Bearer <token>

Body:
- file: <file>
- userId: string
- documentType: 'license' | 'vehicle' | 'orcr' | 'profile'
```

### Example Request

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('userId', 'user123');
formData.append('documentType', 'license');

const response = await fetch('/api/upload/driver-documents', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${authToken}`
  },
  body: formData
});

const result = await response.json();
```

### Response

#### Success (200 OK)
```javascript
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {
    "url": "https://storage.googleapis.com/...",
    "path": "drivers/licenses/license_user123_1234567890.jpg",
    "filename": "license_user123_1234567890.jpg",
    "originalName": "my_license.jpg",
    "contentType": "image/jpeg",
    "size": 102345
  }
}
```

#### Error (4xx/5xx)
```javascript
{
  "success": false,
  "error": "Invalid file type. Only JPG, PNG, and PDF are allowed.",
  "details": "..." // Only in development
}
```

## Security Rules

### Direct Uploads
- Max file size: 5MB for avatars, 10MB for ads
- Allowed types: Images and videos only
- Users can only write to their own directories

### Server-Side Uploads
- Only server can write to driver document paths
- Files are validated server-side
- All uploads are logged for auditing

## Best Practices

1. **Client-Side**
   - Use for non-sensitive content
   - Show upload progress to users
   - Handle errors gracefully
   - Validate file types before upload

2. **Server-Side**
   - Use for sensitive documents
   - Include proper authentication
   - Log all uploads for auditing
   - Implement rate limiting

## Error Handling

Always handle these common errors:

- `400 Bad Request`: Invalid input or missing fields
- `401 Unauthorized`: Missing or invalid authentication
- `413 Payload Too Large`: File exceeds size limit
- `415 Unsupported Media Type`: Invalid file type
- `500 Internal Server Error`: Server error

## Testing

Test uploads with different:
- File types (images, PDFs)
- File sizes (small, large, over limit)
- Network conditions (slow, unstable)
- Authentication states (logged in/out)
