# Error Fixes Summary

## ✅ Fixed: Apollo Client useLazyQuery Error

### Error Message
```
An error occurred! For more details, see the full error text at https://go.apollo.dev/c/err#%7B%22version%22%3A%223.14.0%22%2C%22message%22%3A104%2C%22args%22%3A%5B%22useLazyQuery.execute%22%2C%22fetchPolicy%22%2C%22Please%20pass%20the%20option%20to%20the%20%60useLazyQuery%60%20hook%20instead.%22%5D%7D
```

### Problem
In Apollo Client 3.14.0, `fetchPolicy` cannot be passed to the `execute` function returned by `useLazyQuery`. It must be passed to the hook definition instead.

### Solution Applied
- Moved `fetchPolicy: 'cache-and-network'` to the `useLazyQuery` hook definition
- Created a separate `fetchUserDetailsNetwork` hook with `fetchPolicy: 'network-only'` for retry scenarios
- Removed `fetchPolicy` from all `execute()` function calls

### Files Modified
- `src/contexts/UserAuthContext.tsx`

---

## ⚠️ Firebase Analytics Measurement ID Mismatch

### Error Message
```
[2026-01-16T10:03:40.142Z]  @firebase/analytics: The measurement ID in the local Firebase config (G-D7B9RZCT75) does not match the measurement ID fetched from the server (G-3ZD4ZWP955). To ensure analytics events are always sent to the correct Analytics property, update the measurement ID field in the local config or remove it from the local config.
```

### Problem
The environment variable `REACT_APP_FIREBASE_MEASUREMENT_ID` contains `G-D7B9RZCT75`, but Firebase expects `G-3ZD4ZWP955`.

### Solution Required
Update your environment variable:

**In your `.env` file or deployment environment:**
```bash
REACT_APP_FIREBASE_MEASUREMENT_ID=G-3ZD4ZWP955
```

**Or remove the measurement ID from local config** (Firebase will fetch it automatically):
- Remove `measurementId` from `firebaseConfig` in `src/firebase/init.js`
- Firebase will automatically fetch the correct measurement ID from the server

### Files to Check
- `.env` file (or Railway/environment variables)
- `src/firebase/init.js` (line 35)

---

## ⚠️ Firebase Installation 403 Permission Error

### Error Message
```
FirebaseError: Installations: Create Installation request failed with error "403 PERMISSION_DENIED: The caller does not have permission" (installations/request-failed).
```

### Problem
The Firebase Installations API is returning a 403 permission denied error. This typically happens when:
1. The Firebase Installations API is not enabled in Google Cloud Console
2. The service account lacks proper permissions
3. Firebase project configuration issues

### Solutions to Try

#### 1. Enable Firebase Installations API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project (`ads2go-267f3`)
3. Navigate to **APIs & Services** > **Library**
4. Search for "Firebase Installations API"
5. Click **Enable** if it's not already enabled

#### 2. Check Service Account Permissions
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **IAM & Admin** > **Service Accounts**
3. Find your Firebase service account (usually `firebase-adminsdk-xxxxx@xxxxx.iam.gserviceaccount.com`)
4. Ensure it has the **Firebase Admin** or **Editor** role

#### 3. Verify Firebase Project Configuration
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** > **General**
4. Verify the project ID matches your environment variables
5. Check that all required APIs are enabled

#### 4. Check Environment Variables
Ensure these are correctly set:
- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`

### Note
This error may not break core functionality, but it prevents Firebase from creating installation IDs for analytics and other services. The WebSocket connection still works (as shown by "✅ [WebSocket] Connected successfully").

---

## Summary

1. ✅ **Apollo Client Error**: Fixed by moving `fetchPolicy` to hook definition
2. ⚠️ **Firebase Analytics**: Update `REACT_APP_FIREBASE_MEASUREMENT_ID` to `G-3ZD4ZWP955`
3. ⚠️ **Firebase Installations**: Enable API and check permissions in Google Cloud Console
