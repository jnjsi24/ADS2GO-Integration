# 🚀 ADS2GO System Hosting Setup Guide

## Quick Start for GPS Testing

### 1. **Install Dependencies** (Run this first)

```bash
# Windows - Run the batch file:
install-all-deps.bat

# Or manually install:
cd Ads2Go-Server
npm install
npm install node-geocoder

cd ../Ads2Go-Client  
npm install

cd ../Ads2Go-MobileAppExpo
npm install
```

### 2. **Environment Setup**

Create `.env` file in `Ads2Go-Server/` directory:

```env
# MongoDB Configuration (Required)
MONGODB_URI=mongodb://localhost:27017/ads2go

# Server Configuration
PORT=5000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Firebase Configuration (Optional - for real-time features)
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef123456

# Firebase Admin (Service Account)
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
```

### 3. **Database Setup**

#### Option A: Local MongoDB
```bash
# Install MongoDB locally or use Docker:
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

#### Option B: MongoDB Atlas (Cloud - Recommended)
1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create free cluster
3. Get connection string
4. Update `MONGODB_URI` in `.env`

### 4. **Start the System**

#### Terminal 1 - Backend Server:
```bash
cd Ads2Go-Server
npm start
```

#### Terminal 2 - Web Dashboard:
```bash
cd Ads2Go-Client
npm start
```

### 5. **Access the System**

- **Web Dashboard**: http://localhost:3000
- **GraphQL API**: http://localhost:5000/graphql
- **GPS Tracking API**: http://localhost:5000/screenTracking

## 🧪 **Testing GPS Functionality**

### 1. **Register a Test Tablet**
```bash
curl -X POST http://localhost:5000/tablet/registerTablet \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "TEST-TABLET-001",
    "materialId": "DGL-HEADDRESS-CAR-001",
    "slotNumber": 1,
    "carGroupId": "GRP-TEST123"
  }'
```

### 2. **Simulate GPS Location Updates**
```bash
curl -X POST http://localhost:5000/screenTracking/updateLocation \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "TEST-TABLET-001",
    "lat": 14.5995,
    "lng": 120.9842,
    "speed": 25,
    "heading": 90,
    "accuracy": 10
  }'
```

### 3. **Check GPS Status**
```bash
curl http://localhost:5000/screenTracking/status/TEST-TABLET-001
```

### 4. **View Real-time Map**
- Go to http://localhost:3000/admin/tablet-tracking
- Login as admin
- See live GPS tracking on map

## 📱 **Mobile App Testing**

### 1. **Start Mobile App**
```bash
cd Ads2Go-MobileAppExpo
npm start
```

### 2. **Test on Device**
- Install Expo Go app on your phone
- Scan QR code from terminal
- Test GPS location features

## 🔧 **Troubleshooting**

### Common Issues:

1. **Port Already in Use**
```bash
# Kill process on port 5000
netstat -ano | findstr :5000
taskkill /PID <PID_NUMBER> /F
```

2. **MongoDB Connection Error**
- Check if MongoDB is running
- Verify connection string in `.env`
- For Atlas: Check IP whitelist

3. **GPS Not Working**
- Check browser location permissions
- Verify HTTPS in production
- Check network connectivity

### Debug Commands:
```bash
# Check server status
curl http://localhost:5000/graphql

# Check GPS tracking
curl http://localhost:5000/screenTracking/screens

# View server logs
cd Ads2Go-Server
npm run dev
```

## 🌐 **Production Deployment**

### 1. **Environment Variables**
Update `.env` for production:
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/ads2go
JWT_SECRET=strong-production-secret
```

### 2. **Build Client**
```bash
cd Ads2Go-Client
npm run build
```

### 3. **Deploy Options**
- **Heroku**: Easy deployment with MongoDB Atlas
- **DigitalOcean**: VPS with Docker
- **AWS**: EC2 with RDS MongoDB
- **Vercel**: Frontend + Serverless functions

## 📊 **GPS Features Available**

✅ **Real-time Location Tracking**
- GPS updates every 30 seconds
- Speed and heading monitoring
- Address reverse geocoding

✅ **8-Hour Compliance Monitoring**
- Daily driving time tracking
- Automatic session management
- Compliance alerts

✅ **Interactive Map Dashboard**
- Live screen locations
- Path history visualization
- Material-based filtering

✅ **Alert System**
- Speed violations (>80 km/h)
- Low hours warnings
- Offline detection

## 🎯 **Next Steps**

1. **Set up environment** following this guide
2. **Test GPS functionality** with provided commands
3. **Configure Firebase** for real-time features (optional)
4. **Deploy to production** when ready
5. **Monitor and optimize** performance

---

**Need Help?** Check the troubleshooting section or review the detailed documentation in the project files.
