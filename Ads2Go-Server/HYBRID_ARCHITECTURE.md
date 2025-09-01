# Hybrid Firebase + MongoDB Architecture

This document describes the hybrid architecture that combines Firebase for real-time data and MongoDB for analytics and reporting.

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
                    ┌─────────────▼─────────────┐
                    │    Hybrid Data Layer      │
                    └─────────────┬─────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
    ┌─────▼─────┐         ┌───────▼───────┐         ┌─────▼─────┐
    │  Firebase  │         │   Sync       │         │  MongoDB  │
    │  (Real-time│         │   Service    │         │ (Analytics│
    │   Data)    │         │              │         │  & Reports│
    └───────────┘         └───────────────┘         └───────────┘
```

## 🔥 **Firebase (Real-time Data)**

### **Collections**
- **`tablets`**: Real-time tablet status and information
- **`tracking`**: Live location tracking data
- **`playback`**: Active ad playback sessions
- **`notifications`**: Push notifications for tablets

### **Use Cases**
- ✅ Real-time tablet status updates
- ✅ Live location tracking
- ✅ Active ad playback monitoring
- ✅ Push notifications
- ✅ Offline data storage
- ✅ Instant data synchronization

## 🍃 **MongoDB (Analytics & Reports)**

### **Collections**
- **`users`**: User management (regular users only)
- **`admins`**: Admin user management
- **`superadmins`**: SuperAdmin user management
- **`screenTracking`**: Historical playback analytics
- **`tablets`**: Tablet management and historical data
- **`ads`**: Ad campaign management
- **`materials`**: Ad materials management

### **Use Cases**
- ✅ Historical analytics and reporting
- ✅ User/Admin management
- ✅ Ad campaign management
- ✅ Complex data relationships
- ✅ Financial data and billing
- ✅ Long-term data storage

## 🔄 **Sync Service**

### **Purpose**
Automatically syncs real-time data from Firebase to MongoDB for analytics and reporting.

### **Sync Frequency**
- **Default**: Every 5 minutes
- **Configurable**: Can be adjusted via GraphQL mutation
- **Manual**: Can trigger sync for specific tablets

### **Data Flow**
```
Firebase Real-time Data → Sync Service → MongoDB Analytics
```

## 📊 **Data Flow Examples**

### **1. Tablet Registration**
```
1. Admin registers tablet via GraphQL
2. Data stored in Firebase (real-time)
3. Sync service copies to MongoDB (analytics)
4. Both systems have the data
```

### **2. Ad Playback**
```
1. Tablet starts playing ad
2. Firebase updates playback status (real-time)
3. Admin sees live status in dashboard
4. Sync service saves to MongoDB (historical)
5. Analytics and reports generated from MongoDB
```

### **3. Location Tracking**
```
1. Tablet sends location update
2. Firebase stores current location (real-time)
3. Admin sees live location on map
4. Sync service saves to MongoDB (historical)
5. Route analysis and reports generated
```

## 🚀 **GraphQL Operations**

### **Real-time Queries**
```graphql
# Get all tablets with real-time status
query {
  getAllTablets {
    id
    tabletId
    status
    location {
      latitude
      longitude
    }
    currentAd
    batteryLevel
  }
}

# Get dashboard data
query {
  getDashboardData {
    tablets {
      id
      status
      location
    }
    summary {
      totalTablets
      onlineTablets
      playingTablets
    }
  }
}
```

### **Real-time Mutations**
```graphql
# Register a new tablet
mutation {
  registerTablet(input: {
    tabletId: "tablet-001"
    name: "Makati Mall Tablet"
    location: {
      latitude: 14.5995
      longitude: 120.9842
    }
  }) {
    id
    tabletId
    status
  }
}

# Update tablet status
mutation {
  updateTabletStatus(
    tabletId: "tablet-001"
    input: {
      status: ONLINE
      batteryLevel: 85
      currentAd: "ad-123"
    }
  ) {
    id
    status
    batteryLevel
  }
}

# Start ad playback
mutation {
  startPlayback(input: {
    tabletId: "tablet-001"
    adId: "ad-123"
    adName: "Coca-Cola Ad"
  }) {
    id
    tabletId
    adId
    status
  }
}
```

### **Sync Management**
```graphql
# Start sync service
mutation {
  startSync {
    isRunning
    syncInterval
  }
}

# Manual sync for specific tablet
mutation {
  manualSync(tabletId: "tablet-001")
}
```

## 🔧 **Configuration**

### **Environment Variables**
```env
# Firebase Configuration
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef123456
FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Firebase Admin
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key\n-----END PRIVATE KEY-----\n"

# MongoDB
MONGODB_URI=your_mongodb_connection_string
```

## 📱 **Mobile App Integration**

### **Android Tablet App**
```javascript
// Initialize Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';

// Listen to real-time updates
const tabletRef = doc(db, 'tablets', 'tablet-001');
onSnapshot(tabletRef, (doc) => {
  const data = doc.data();
  console.log('Tablet status:', data.status);
  console.log('Current ad:', data.currentAd);
});

// Update location
const updateLocation = async (latitude, longitude) => {
  await updateDoc(doc(db, 'tracking', 'tablet-001'), {
    location: { latitude, longitude },
    timestamp: serverTimestamp()
  });
};
```

### **Web Admin Dashboard**
```javascript
// GraphQL subscription for real-time updates
const TABLET_STATUS_SUBSCRIPTION = gql`
  subscription OnTabletStatusChange($tabletId: String!) {
    tabletStatusChanged(tabletId: $tabletId) {
      id
      status
      location
      currentAd
      batteryLevel
    }
  }
`;

// Use subscription in React component
const { data } = useSubscription(TABLET_STATUS_SUBSCRIPTION, {
  variables: { tabletId: 'tablet-001' }
});
```

## 🎯 **Benefits of Hybrid Architecture**

### **Firebase Benefits**
- ✅ **Real-time updates**: Instant data synchronization
- ✅ **Offline support**: Works without internet connection
- ✅ **Push notifications**: Built-in FCM support
- ✅ **Mobile optimized**: Designed for mobile apps
- ✅ **Scalability**: Handles high-frequency updates

### **MongoDB Benefits**
- ✅ **Complex queries**: Advanced analytics and reporting
- ✅ **Data relationships**: Easy joins and aggregations
- ✅ **Cost effective**: Cheaper for large datasets
- ✅ **ACID compliance**: Data consistency guarantees
- ✅ **Flexible schema**: Easy to modify data structure

### **Combined Benefits**
- ✅ **Best of both worlds**: Real-time + Analytics
- ✅ **Cost optimization**: Use each for its strengths
- ✅ **Scalability**: Handle both real-time and historical data
- ✅ **Reliability**: Redundant data storage
- ✅ **Flexibility**: Choose the right tool for each use case

## 🔒 **Security Considerations**

### **Firebase Security**
- Firestore rules for data access control
- Authentication for user verification
- App Check for app verification
- Private key security for admin SDK

### **MongoDB Security**
- User authentication and authorization
- Network access control
- Data encryption at rest and in transit
- Regular security audits

### **GraphQL Security**
- JWT token validation
- Role-based access control
- Input validation and sanitization
- Rate limiting for API calls

## 📈 **Performance Optimization**

### **Firebase Optimization**
- Use efficient queries with indexes
- Implement pagination for large datasets
- Use offline persistence for mobile apps
- Monitor read/write operations

### **MongoDB Optimization**
- Create proper indexes for queries
- Use aggregation pipeline for complex operations
- Implement caching strategies
- Monitor query performance

### **Sync Optimization**
- Batch operations for efficiency
- Error handling and retry logic
- Configurable sync intervals
- Manual sync for critical data

## 🚀 **Deployment**

### **Development**
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Firebase and MongoDB configs

# Test Firebase integration
node test-firebase.js

# Start development server
npm run dev
```

### **Production**
```bash
# Build the application
npm run build

# Start production server
npm start

# Sync service starts automatically in production
```

## 🔍 **Monitoring and Debugging**

### **Firebase Monitoring**
- Firebase Console for real-time data
- Firebase Analytics for usage metrics
- Crashlytics for error tracking
- Performance monitoring

### **MongoDB Monitoring**
- MongoDB Atlas dashboard
- Query performance analysis
- Storage and index monitoring
- Backup and restore status

### **Application Monitoring**
- GraphQL query performance
- Sync service status
- Error logging and alerting
- API usage metrics

## 📋 **Next Steps**

1. **Set up Firebase project** following the setup guide
2. **Configure environment variables** with your credentials
3. **Test the integration** using the test script
4. **Integrate with mobile apps** for tablet communication
5. **Set up monitoring** for production deployment
6. **Optimize performance** based on usage patterns

## 📚 **Additional Resources**

- [Firebase Documentation](https://firebase.google.com/docs)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Apollo GraphQL Documentation](https://www.apollographql.com/docs/)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)

---

This hybrid architecture provides the best solution for your ADS2GO system, combining real-time capabilities with powerful analytics and reporting features.
