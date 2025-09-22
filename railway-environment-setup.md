# Railway Environment Configuration Setup

## 1. Update Client Environment Files

### Ads2Go-Client/.env.development
```bash
# Development Environment Configuration
# Uncomment the option you want to use:

# Option 1: Use Railway Server (Production-like)
REACT_APP_API_URL=https://ads2go-integration-production.up.railway.app/graphql

# Option 2: Use Local Server (for local development)
# REACT_APP_API_URL=http://localhost:5000/graphql
```

### Ads2Go-Client/.env.production
```bash
# Production Environment Configuration
# This will be overridden by Railway environment variables
# Railway will set REACT_APP_API_URL to the actual server URL

# Default fallback (will be replaced by Railway)
REACT_APP_API_URL=https://ads2go-integration-production.up.railway.app/graphql

# Firebase Configuration (same as development)
REACT_APP_FIREBASE_API_KEY=AIzaSyBcJD2Ttm5ykalj-PK8T4ttgodGqVNc-Do
REACT_APP_FIREBASE_AUTH_DOMAIN=ads2go-6ead4.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=ads2go-6ead4
REACT_APP_FIREBASE_STORAGE_BUCKET=ads2go-6ead4.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=380830146533
REACT_APP_FIREBASE_APP_ID=1:380830146533:web:86708e4a57a07ab59f590c
REACT_APP_FIREBASE_MEASUREMENT_ID=G-P0TNVP9BEX
```

## 2. Railway Environment Variables to Set

### For Client Service (ads2go-client)
Go to Railway Dashboard → ads2go-client → Variables tab and add:

```bash
REACT_APP_API_URL = https://ads2go-integration-production.up.railway.app/graphql
```

### For Server Service (ads2go-server)
Go to Railway Dashboard → ads2go-server → Variables tab and add:

```bash
# MongoDB Configuration
MONGODB_URI = mongodb+srv://a-lopez:construction@cluster0.fdgbsyy.mongodb.net/ADSTOGO?retryWrites=true&w=majority&appName=Cluster0

# JWT Configuration
JWT_SECRET = Ads2Go_2025
JWT_EXPIRATION = 1d

# Email Service Configuration
EMAIL_HOST = smtp.gmail.com
EMAIL_PORT = 587
EMAIL_USER = advertisements2go@gmail.com
EMAIL_PASSWORD = tpde imec ueij faeu

# Security Settings
ALLOWED_ORIGINS = https://ads2go-integration-production.up.railway.app,https://your-client-domain.up.railway.app
RATE_LIMIT_WINDOW_MS = 900000
RATE_LIMIT_MAX_REQUESTS = 100

# Firebase Configuration
FIREBASE_PROJECT_ID = ads2go-6ead4
FIREBASE_STORAGE_BUCKET = ads2go-6ead4.firebasestorage.app
FIREBASE_CLIENT_EMAIL = firebase-adminsdk-fbsvc@ads2go-6ead4.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC85VGasRGQAU/M\nHRow06CKD9Lk1dRN6ZxKAiryKTiiVqSKUxHsL2D/jq7WCbk6RF7qxqvjhKAT4qTP\nH933MEOrNCb6KLGU1jksOktfWUUG22vdEUqWRtA1S7IeC+/8SA4/oLcvgbTKuTR4\n1paJNwobKnXExR6D2bU+y49yUDGTeo3mBMrJzfVEekIkFBey9gLwTGn4EKMfWddq\ntAp1GWj/gk7SYdCFBPEezGX5DP3WOrHk5ghu3LLVuQc/siGPO5kLbJ+JnHlgeOn6\n7aXBQd/jlftYNP4cZJj2Bmji14TBc0EpB8GeQXXRBVICMGmFUI3nSnLkAt/398iG\njXBCTdyrAgMBAAECggEAMIF+hAemJ+F+WT674//kAK/xitux6dPsU0DdQFP/fAhd\ntjuApbLA6L79/G6AxwqZiRY9O25qINEZWyqmt/wH1GXPAHwEpeCgy8+oXTKyPAGK\nYDk5ev9yJc1rTrXoCVODfSlLAQMApvIKHGGWRGQCz1kG5uFrZZY5KYfiLQuUv3bO\n429SNcEXWYMg3hM+fX8/7b+4bje3/khucKCW2FmNNw3jcApiZcZcqm6L5N22ds6u\ndxlT05wL14cZuCwsqRHATu/KfvaLBe4Z28viaOmf+RVkqQCiiyuzYIl6RS2zyEjx\nBy40hoFAu4eC4caZ6SJDKOWZJfCE45fiMB2VszGNOQKBgQDqACwaX9Lm43j15GHc\n265rctQMWj3tZUa6YD7TryM3LwryFxaYl1W8/pNUbg84ByNiN/1ki1fMWig4xhnE\n0A21VC7r6YHCfsMCfXLigeX4Xuo3qf+Kr2f8RjhquU0vrtmkNbLogBlLsIT1otLJ\nm/rjHK2y1MkY/u8kB2t0+8eJdQKBgQDOp5TJ9Bl+VDB+kQRZlobd1GVdBjBxJuDj\nXzPbUhZMVaTx0uumqw9paoOplDc1Iu+9uKABOsLOPdJZwBqIUzMKY5bxY6L/V/sP\ne89l8PEDNU4jsQyF0d4x/L+TLsIpDL9o5MzzNeQG8f6/7fwLpU3+9MSaxF+Q6IB/\n/PvVQ7TpnwKBgH+IFIFTVFhuBVDOZd+/AvKgpJ0O2c12cvPE3Lj2LNU4mFiU6MXF\nRP86KAXN7hF1In23UizoHLPNNzqqDQVM9wuqk+ATZZshBxtmT6TPcwzIfhJUXmex\nbZT6mGjiEQU54Hg0pAs/NYog7HYLhaJHlpcM3EYo3mj3GFKkkJYzWu65AoGAP6ui\nTBbJRALsbhKAJJocM3ydPmwJwNMZtvQ+JfTEqgA5Mciqkk9iEDihGD5yRAzfkLSx\nl69jFeg2RzDI+/emYi0M9JKeRc31rG+ZFu+FUle6G4URNqnSq9QTsmVVrRAgaVEV\nVFnmR72Hn9rTLUNhJIyFhqm6SAtajBSGAs85jkECgYEA0tYbeWxzUhrMgORChnxt\nTXha1GNKM7RLLIz/IsKP7Sy8VEsjIN9lbJ/MiaOKWxPjkysvWBCYG4SX5LqWaxVY\nugliM9nBW4+CkSClth3Hn2W7j2QcapD2PJAr+xyX9z/fIYbs1IQepkiurSDDyUD/\ni/iEeS+tZGxbO3ljdOwuwbo=\n-----END PRIVATE KEY-----"
FIREBASE_PRIVATE_KEY_ID = 8a762b8f4932a041c8e493f8d83c4687b1a47162
FIREBASE_CLIENT_ID = 115930695724895532784
FIREBASE_AUTH_URI = https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI = https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_CERT_URL = https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_CERT_URL = https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40ads2go-6ead4.iam.gserviceaccount.com

# Node Environment
NODE_ENV = production
```

## 3. Important Notes

1. **Update ALLOWED_ORIGINS**: Replace `your-client-domain.up.railway.app` with your actual client Railway URL
2. **Security**: These credentials should be rotated for production use
3. **CORS**: The server will automatically allow Railway domains, but you can add specific ones to ALLOWED_ORIGINS
4. **Environment Variables**: Set these in Railway Dashboard → Your Service → Variables tab

## 4. Deployment Steps

1. Update your .env files with the content above
2. Set the environment variables in Railway Dashboard
3. Redeploy both services
4. Test the connection between client and server
