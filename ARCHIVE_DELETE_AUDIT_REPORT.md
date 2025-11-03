# Archive-Then-Delete Audit Report

## Overview
This report audits all delete operations in the codebase to verify if they follow the archive-then-delete (soft delete) pattern with 30-day deferred deletion.

---

## ✅ Entities Following Archive Pattern (Correct)

### 1. **Ad** (`adResolver.js`)
- ✅ **Status**: Archives before deletion
- **Location**: `Ads2Go-Server/src/resolvers/adResolver.js:830`
- **Pattern**: Sets `isArchived = true`, `archivedAt`, `scheduledDeletionDate` (30 days)
- **Additional**: Changes status to `ARCHIVED`

### 2. **Driver** (`driverResolver.js`)
- ✅ **Status**: Archives before deletion
- **Location**: `Ads2Go-Server/src/resolvers/driverResolver.js:1011`
- **Pattern**: Sets `isArchived = true`, `archivedAt`, `scheduledDeletionDate` (30 days)
- **Additional**: Invalidates tokens, unassigns materials

### 3. **Material** (`materialResolver.js`)
- ✅ **Status**: Archives before deletion
- **Location**: `Ads2Go-Server/src/resolvers/materialResolver.js:651`
- **Pattern**: Sets `isArchived = true`, `archivedAt`, `scheduledDeletionDate` (30 days)
- **Additional**: Changes status to `RETIRED`

### 4. **FAQ** (`faqResolver.js`)
- ✅ **Status**: Archives before deletion
- **Location**: `Ads2Go-Server/src/resolvers/faqResolver.js:235`
- **Pattern**: Sets `isArchived = true`, `archivedAt`, `scheduledDeletionDate` (30 days)
- **Additional**: Sets `isActive = false`

### 5. **Payment** (`paymentResolver.js`)
- ✅ **Status**: Archives before deletion
- **Location**: `Ads2Go-Server/src/resolvers/paymentResolver.js:674`
- **Pattern**: Sets `isArchived = true`, `archivedAt`, `scheduledDeletionDate` (30 days)
- **Restriction**: Cannot delete paid payments

### 6. **CompanyAd** (`companyAdResolver.js`)
- ✅ **Status**: Archives before deletion
- **Location**: `Ads2Go-Server/src/resolvers/companyAdResolver.js:198`
- **Pattern**: Sets `isArchived = true`, `archivedAt`, `scheduledDeletionDate` (30 days)
- **Additional**: Sets `isActive = false`

### 7. **DriverSalaryPricing** (`driverSalaryResolver.js`)
- ✅ **Status**: Archives before deletion
- **Location**: `Ads2Go-Server/src/resolvers/driverSalaryResolver.js:535`
- **Pattern**: Sets `isArchived = true`, `archivedAt`, `scheduledDeletionDate` (30 days)
- **Additional**: Sets `isActive = false`

### 8. **Admin** (in `adminResolver.js` and `superAdminResolver.js`)
- ✅ **Status**: Archives before deletion
- **Locations**: 
  - `Ads2Go-Server/src/resolvers/adminResolver.js:247`
  - `Ads2Go-Server/src/resolvers/superAdminResolver.js:606`
- **Pattern**: Sets `isArchived = true`, `archivedAt`, `scheduledDeletionDate` (30 days)
- **Additional**: Invalidates tokens (`tokenVersion += 1`)

### 9. **User** (in `adminResolver.js` and `userResolver.js`)
- ✅ **Status**: Archives before deletion
- **Locations**: 
  - `Ads2Go-Server/src/resolvers/adminResolver.js:373`
  - `Ads2Go-Server/src/resolvers/userResolver.js:646`
- **Pattern**: Sets `isArchived = true`, `archivedAt`, `scheduledDeletionDate` (30 days)
- **Additional**: Invalidates tokens, auto-unsubscribes from newsletter

### 10. **AdsDeployment** (`adsDeploymentResolver.js`)
- ✅ **Status**: Archives before deletion
- **Location**: `Ads2Go-Server/src/resolvers/adsDeploymentResolver.js:828`
- **Pattern**: Sets `isArchived = true`, `archivedAt`, `scheduledDeletionDate` (30 days)
- **Restriction**: Cannot delete `RUNNING` or `COMPLETED` deployments

---

## ❌ Entities NOT Following Archive Pattern (Need Fix)

### 1. **SuperAdmin** (`superAdminResolver.js`)
- ❌ **Status**: Hard delete (permanent deletion)
- **Location**: `Ads2Go-Server/src/resolvers/superAdminResolver.js:285`
- **Issue**: Uses `findByIdAndDelete(id)` - permanently deletes immediately
- **Recommendation**: Should archive first, then delete after 30 days
- **Priority**: **HIGH** (SuperAdmin deletion should be extra careful)

### 2. **PricingConfig** (`pricingConfigResolver.js`)
- ❌ **Status**: Hard delete (permanent deletion)
- **Location**: `Ads2Go-Server/src/resolvers/pricingConfigResolver.js:118`
- **Issue**: Uses `findByIdAndDelete(id)` - permanently deletes immediately
- **Recommendation**: Should archive first, then delete after 30 days
- **Priority**: **MEDIUM**

### 3. **UserReport** (`userReportResolver.js`)
- ❌ **Status**: Hard delete (permanent deletion)
- **Location**: `Ads2Go-Server/src/resolvers/userReportResolver.js:252`
- **Issue**: Uses `findByIdAndDelete(id)` - permanently deletes immediately
- **Restriction**: Only allows deletion if report is still pending
- **Recommendation**: Should archive first for audit trail
- **Priority**: **LOW** (but good for audit purposes)

### 4. **DriverReport** (`driverReportResolver.js`)
- ❌ **Status**: Hard delete (permanent deletion)
- **Location**: `Ads2Go-Server/src/resolvers/driverReportResolver.js:243`
- **Issue**: Uses `report.deleteOne()` - permanently deletes immediately
- **Restriction**: Only allows deletion if report status is `PENDING`
- **Recommendation**: Should archive first for audit trail
- **Priority**: **LOW** (but good for audit purposes)

### 5. **DeviceCompliance** (`materialTrackingResolver.js`)
- ❌ **Status**: Hard delete (permanent deletion)
- **Location**: `Ads2Go-Server/src/resolvers/materialTrackingResolver.js:60`
- **Issue**: Uses `findByIdAndDelete(id)` - permanently deletes immediately
- **Recommendation**: Should archive first for compliance/audit trail
- **Priority**: **MEDIUM** (compliance records should be kept)

### 6. **Notification** (`notificationResolver.js`)
- ⚠️ **Status**: Array manipulation (removes from array)
- **Location**: `Ads2Go-Server/src/resolvers/notificationResolver.js:1020`
- **Issue**: Removes notification from `notifications` array in `UserNotifications`
- **Note**: This is likely intentional (notifications don't need archival)
- **Priority**: **LOW** (probably okay as-is)

---

## 🔍 Special Cases / Notes

### 1. **Ad Error Handling** (`adResolver.js:455, 473`)
- **Location**: Error handling code paths
- **Issue**: Uses `findByIdAndDelete` when ad creation fails
- **Analysis**: This appears to be cleanup of failed ad creation attempts
- **Recommendation**: Review if these should be kept for debugging

### 2. **Material Cleanup Operations** (`materialResolver.js:36, 47, 60`)
- **Location**: Material creation cleanup
- **Issue**: Uses `findOneAndDelete` for cleanup during material creation
- **Analysis**: These appear to be cleanup of orphaned records during creation
- **Recommendation**: These are probably fine as cleanup operations

---

## 📊 Summary Statistics

- **Total Delete Operations Found**: 21
- **Following Archive Pattern**: 10 ✅
- **NOT Following Archive Pattern**: 6 ❌
- **Special Cases (probably fine)**: 5 ⚠️

---

## 🎯 Recommended Actions

### High Priority Fixes:
1. **SuperAdmin deletion** - Should archive first (critical for admin security)

### Medium Priority Fixes:
2. **PricingConfig deletion** - Should archive for configuration history
3. **DeviceCompliance deletion** - Should archive for compliance/audit trail

### Low Priority (but recommended):
4. **UserReport deletion** - Archive for audit trail
5. **DriverReport deletion** - Archive for audit trail

### Review/Clarify:
6. **Notification deletion** - Verify if array removal is acceptable (likely fine)

---

## 📝 Archive Pattern Template

All delete operations should follow this pattern:

```javascript
// 1. Find the entity
const entity = await Entity.findById(id);
if (!entity) throw new Error('Entity not found');

// 2. Check if already archived
if (entity.isArchived) {
  throw new Error('Entity is already archived');
}

// 3. Archive instead of delete (30-day deferred deletion)
const now = new Date();
const deletionDate = new Date(now);
deletionDate.setDate(deletionDate.getDate() + 30); // 30 days from now

entity.isArchived = true;
entity.archivedAt = now;
entity.scheduledDeletionDate = deletionDate;

// 4. Optional: Set status/active flags
entity.isActive = false; // if applicable
entity.status = 'ARCHIVED'; // if applicable

// 5. Save
await entity.save();

// 6. Log
console.log(`✅ Entity archived. Scheduled for permanent deletion on: ${deletionDate.toISOString()}`);
```

---

## 📅 Next Steps

1. Review this report
2. Decide which entities need archive pattern implementation
3. Implement archive pattern for selected entities
4. Update deletion job to handle all archived entities
5. Test restore functionality for all entities

