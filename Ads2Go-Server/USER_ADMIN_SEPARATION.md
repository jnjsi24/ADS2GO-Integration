# User, Admin, and SuperAdmin Separation

This document explains the new separated structure for users, admins, and superadmins in the ADS2GO system.

## Overview

The system now has three separate collections and corresponding GraphQL schemas:

1. **Users** - Regular users who can create ads and manage their own content
2. **Admins** - Administrative users with elevated permissions
3. **SuperAdmins** - System administrators with full system access

## Database Collections

### 1. Users Collection (`users`)
- **Model**: `src/models/User.js`
- **Schema**: `src/schema/userSchema.js`
- **Resolver**: `src/resolvers/userResolver.js`
- **Role**: Only `USER`

### 2. Admins Collection (`admins`)
- **Model**: `src/models/Admin.js`
- **Schema**: `src/schema/adminSchema.js`
- **Resolver**: `src/resolvers/adminResolver.js`
- **Role**: Only `ADMIN`
- **Features**:
  - User management
  - Ad management
  - Driver management
  - Tablet management
  - Payment management
  - Reports access

### 3. SuperAdmins Collection (`superadmins`)
- **Model**: `src/models/SuperAdmin.js`
- **Schema**: `src/schema/superAdminSchema.js`
- **Resolver**: `src/resolvers/superAdminResolver.js`
- **Role**: Only `SUPERADMIN`
- **Features**:
  - All admin permissions
  - Admin management
  - System settings
  - Database management
  - Audit logs

## Key Benefits

1. **Clean Separation**: Each user type has its own collection and schema
2. **Better Security**: Isolated authentication and authorization
3. **Scalability**: Easier to manage permissions and features
4. **Maintainability**: Clear separation of concerns
5. **Performance**: Smaller, focused collections

## Authentication Flow

### User Authentication
- Uses `loginUser` mutation
- JWT token contains `userId`
- Context provides `user` object

### Admin Authentication
- Uses `loginAdmin` mutation
- JWT token contains `adminId`
- Context provides `admin` object

### SuperAdmin Authentication
- Uses `loginSuperAdmin` mutation
- JWT token contains `superAdminId`
- Context provides `superAdmin` object

## Migration

To migrate existing admin and superadmin users from the User collection:

```bash
# Run migration script
node scripts/migrate-admin-users.js

# To also remove admin/superadmin users from User collection
node scripts/migrate-admin-users.js --remove
```

## Creating New SuperAdmin

To create a new superadmin account:

```bash
node createSuperAdmin.js
```

## GraphQL Operations

### User Operations
- `createUser`
- `loginUser`
- `updateUser`
- `verifyEmail`
- `changePassword`

### Admin Operations
- `createAdmin` (SuperAdmin only)
- `loginAdmin`
- `updateAdmin`
- `deleteAdmin` (SuperAdmin only)
- `activateAdmin` (SuperAdmin only)
- `deactivateAdmin` (SuperAdmin only)

### SuperAdmin Operations
- `createSuperAdmin` (SuperAdmin only)
- `loginSuperAdmin`
- `updateSuperAdmin`
- `deleteSuperAdmin` (SuperAdmin only)
- `activateSuperAdmin` (SuperAdmin only)
- `deactivateSuperAdmin` (SuperAdmin only)

## File Structure

```
src/
├── models/
│   ├── User.js          # Regular users only
│   ├── Admin.js         # Admin users
│   └── SuperAdmin.js    # SuperAdmin users
├── schema/
│   ├── userSchema.js    # User GraphQL schema
│   ├── adminSchema.js   # Admin GraphQL schema
│   └── superAdminSchema.js # SuperAdmin GraphQL schema
├── resolvers/
│   ├── userResolver.js     # User operations
│   ├── adminResolver.js    # Admin operations
│   └── superAdminResolver.js # SuperAdmin operations
└── index.js            # Main server file
```

## Security Considerations

1. **Role Isolation**: Each user type can only access their own operations
2. **Permission System**: Admins and SuperAdmins have granular permissions
3. **Account Status**: Admins and SuperAdmins can be activated/deactivated
4. **Session Management**: Each user type has separate session management
5. **Password Security**: All passwords are hashed with bcrypt

## Future Enhancements

1. **Audit Logging**: Track all admin and superadmin actions
2. **Role-Based Access Control**: More granular permissions
3. **Multi-Factor Authentication**: Enhanced security for admin accounts
4. **API Rate Limiting**: Different limits for different user types
