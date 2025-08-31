# GraphQL Operations Organization

This directory contains all GraphQL queries and mutations organized by user role for better maintainability and clarity.

## 📁 Directory Structure

```
graphql/
├── index.ts              # Main export file
├── user/                 # User role operations
│   ├── index.ts         # User exports
│   ├── queries/         # User queries
│   └── mutations/       # User mutations
├── admin/               # Admin role operations
│   ├── index.ts         # Admin exports
│   ├── queries/         # Admin queries
│   └── mutations/       # Admin mutations
└── superadmin/          # SuperAdmin role operations
    ├── index.ts         # SuperAdmin exports
    ├── queries/         # SuperAdmin queries
    └── mutations/       # SuperAdmin mutations
```

## 🎯 Usage Examples

### Import by Role
```typescript
// Import all user operations
import { user } from '@/graphql';
const { GET_MY_ADS, GET_OWN_USER_DETAILS, LOGIN } = user;

// Import all admin operations
import { admin } from '@/graphql';
const { GET_ALL_MATERIALS, CREATE_AD, LOGIN_ADMIN } = admin;

// Import all superadmin operations
import { superadmin } from '@/graphql';
const { GET_ALL_ADMINS, DELETE_USER } = superadmin;
```

### Import Specific Operations
```typescript
// Import specific user operations
import { GET_MY_ADS, LOGIN } from '@/graphql/user';

// Import specific admin operations
import { GET_ALL_MATERIALS, CREATE_AD } from '@/graphql/admin';

// Import specific superadmin operations
import { GET_ALL_ADMINS } from '@/graphql/superadmin';
```

## 📋 File Organization

### 👤 User Operations
- **Queries**: `getMyAds`, `getOwnUserDetails`
- **Mutations**: `Login`, `Register`, `VerifyEmail`, `Logout`

### 👨‍💼 Admin Operations
- **Queries**: `materials`, `adsPlans`, `getAd`, `getFilteredPlans`, `getPendingForms`, `createAd`, `getVehicleTypes`
- **Mutations**: `LoginAdmin`, `createAdminUser`, `updateAdminUser`, `manageForms`, `createAd`

### 👑 SuperAdmin Operations
- **Queries**: `getAllAdmins`
- **Mutations**: `deleteUser`, `updateSuperAdminDetail`

## 🔄 Migration Guide

If you have existing imports, update them to use the new structure:

### Before
```typescript
import { GET_MY_ADS } from '@/graphql/queries/getMyAds';
import { LOGIN } from '@/graphql/mutations/Login';
```

### After
```typescript
import { GET_MY_ADS, LOGIN } from '@/graphql/user';
```

This organization makes it easier to:
- ✅ Find operations by role
- ✅ Maintain role-based permissions
- ✅ Add new operations in the correct location
- ✅ Import related operations together
