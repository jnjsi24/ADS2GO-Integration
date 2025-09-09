# Railway Memory Fix Guide

## Problem
The Railway client deployment is failing with "JavaScript heap out of memory" error during the build process.

## Solution Applied

### 1. Updated Build Scripts
- Modified `package.json` to use memory-optimized build commands
- Added `--max-old-space-size=4096` to increase Node.js memory limit
- Created optimized build script (`build-optimized.js`)

### 2. Railway Configuration
- Added `railway.toml` with memory optimization settings
- Set `NODE_OPTIONS=--max-old-space-size=4096` in Railway environment
- Configured proper start command and health checks

### 3. Build Optimizations
- Disabled source map generation (`GENERATE_SOURCEMAP=false`)
- Disabled inline runtime chunk (`INLINE_RUNTIME_CHUNK=false`)
- Added build cleanup before new builds

## Files Modified/Created

### Modified Files:
- `Ads2Go-Client/package.json` - Updated build scripts
- `Ads2Go-Client/src/firebase/init.js` - Environment variable support
- `Ads2Go-Client/src/firebase.ts` - Environment variable support

### New Files:
- `Ads2Go-Client/railway.toml` - Railway deployment configuration
- `Ads2Go-Client/.nvmrc` - Node.js version specification
- `Ads2Go-Client/build-optimized.js` - Memory-optimized build script
- `Ads2Go-Client/env.production.template` - Production environment template

## Deployment Steps

### 1. Update Railway Environment Variables
In your Railway dashboard, add these environment variables:

```
NODE_OPTIONS=--max-old-space-size=4096
GENERATE_SOURCEMAP=false
INLINE_RUNTIME_CHUNK=false
REACT_APP_API_URL=https://your-server-url.up.railway.app/graphql
```

### 2. Update API URL
Make sure to update the `REACT_APP_API_URL` in your Railway environment variables to point to your actual server URL.

### 3. Redeploy
The next deployment should use the optimized build process and avoid memory issues.

## Build Commands Available

- `npm run build` - Optimized build for Railway (recommended)
- `npm run build:standard` - Standard build with memory limit
- `npm run build:dev` - Development build with memory limit
- `npm run start:prod` - Start production server

## Troubleshooting

### If build still fails:
1. Check Railway logs for specific error messages
2. Ensure all environment variables are set correctly
3. Verify the server URL is accessible
4. Try increasing memory limit to 6144 or 8192 if needed

### Memory Limit Options:
- `--max-old-space-size=4096` (4GB) - Current setting
- `--max-old-space-size=6144` (6GB) - If 4GB is not enough
- `--max-old-space-size=8192` (8GB) - Maximum recommended

## Verification

After deployment, check:
1. Railway logs show successful build
2. Application loads without errors
3. API calls work correctly
4. No memory-related crashes in logs

The optimized build should resolve the JavaScript heap out of memory error and allow successful deployment on Railway.
