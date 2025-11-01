# ADS2GO System - Entity Relationship Diagram (ERD)

## System Overview

ADS2GO is a comprehensive advertising management platform that connects advertisers (Users) with drivers who display ads on their vehicles using digital materials (LCD screens, HEADDRESS displays, etc.). The system manages ad campaigns, payments, driver compensation, device tracking, and analytics.

---

## Core Entities

### 1. USER (Advertisers)
**Primary Key:** `id`  
**Description:** Advertisers who create and pay for ad campaigns

**Attributes:**
- `id` (ID!)
- `firstName`, `middleName`, `lastName` (String!)
- `email` (String!, unique)
- `password` (String!)
- `companyName`, `companyAddress`, `houseAddress` (String!)
- `contactNumber` (String!)
- `profilePicture` (String)
- `role` (UserRole: USER)
- `isEmailVerified` (Boolean!)
- `lastLogin` (Date)
- `authProvider` (local/google)
- `googleId` (String, unique)
- `notificationPreferences` (embedded)
- `isArchived`, `archivedAt`, `scheduledDeletionDate` (soft delete)
- `createdAt`, `updatedAt` (timestamps)

**Relationships:**
- One-to-Many: `ads` → Ad
- One-to-Many: `payments` → Payment
- One-to-Many: `userReports` → UserReport
- One-to-Many: `notifications` → Notification
- One-to-One: `analytics` → UserAnalytics

---

### 2. ADMIN
**Primary Key:** `id`  
**Description:** System administrators with limited permissions

**Attributes:**
- `id` (ID!)
- `firstName`, `middleName`, `lastName` (String!)
- `email` (String!, unique)
- `password` (String!)
- `companyName`, `companyAddress` (String!)
- `contactNumber` (String!)
- `profilePicture` (String)
- `role` (AdminRole: ADMIN)
- `isEmailVerified` (Boolean!, default: true)
- `isActive` (Boolean!)
- `permissions` (embedded: userManagement, adManagement, driverManagement, tabletManagement, paymentManagement, reports)
- `notificationPreferences` (embedded)
- `lastLogin` (Date)
- `createdAt`, `updatedAt` (timestamps)

**Relationships:**
- One-to-Many: `managedUsers` → User (via actions)
- One-to-Many: `managedAds` → Ad (via approvals)
- One-to-Many: `managedDrivers` → Driver (via approvals)
- One-to-Many: `notifications` → Notification
- One-to-Many: `contactMessageReplies` → ContactMessage
- One-to-Many: `userReportResponses` → UserReport
- One-to-Many: `driverReportResponses` → DriverReport

---

### 3. SUPERADMIN
**Primary Key:** `id`  
**Description:** Super administrators with full system access

**Attributes:**
- `id` (ID!)
- `firstName`, `middleName`, `lastName` (String!)
- `email` (String!, unique)
- `password` (String!)
- `companyName`, `companyAddress` (String!)
- `contactNumber` (String!)
- `profilePicture` (String)
- `role` (SuperAdminRole: SUPERADMIN)
- `isEmailVerified` (Boolean!, default: true)
- `isActive` (Boolean!)
- `permissions` (embedded: all admin permissions + systemSettings, databaseManagement, auditLogs)
- `notificationPreferences` (embedded)
- `lastLogin` (Date)
- `createdAt`, `updatedAt` (timestamps)

**Relationships:**
- One-to-Many: `managedAdmins` → Admin
- One-to-Many: `managedUsers` → User
- One-to-Many: `managedAds` → Ad
- One-to-Many: `managedDrivers` → Driver
- One-to-Many: `pricingConfigs` → PricingConfig
- One-to-Many: `driverSalaryPricing` → DriverSalaryPricing
- One-to-Many: `driverSalaryCalculations` → DriverSalaryCalculation
- One-to-Many: `notifications` → Notification

---

### 4. DRIVER
**Primary Key:** `id`, `driverId` (String, unique: DRV-001)  
**Description:** Vehicle drivers who display ads on their vehicles

**Attributes:**
- `id` (ID!)
- `driverId` (String!, unique: DRV-001)
- `firstName`, `middleName`, `lastName` (String!)
- `email` (String!, unique)
- `password` (String!)
- `contactNumber` (String!)
- `address` (String!)
- `profilePicture` (String)
- `licenseNumber`, `licensePictureURL` (String!)
- `vehiclePlateNumber`, `vehicleType`, `vehicleModel`, `vehicleYear` (String/Number!)
- `vehiclePhotoURL`, `orCrPictureURL` (String!)
- `accountStatus` (PENDING/ACTIVE/SUSPENDED/REJECTED/RESUBMITTED)
- `reviewStatus` (PENDING/APPROVED/REJECTED/RESUBMITTED)
- `dateJoined` (Date!)
- `currentBalance`, `totalEarnings` (Float!)
- `materialId` (ObjectId, ref: Material)
- `installedMaterialType` (LCD/BANNER/HEADDRESS/STICKER/POSTER)
- `preferredMaterialType` ([MaterialTypeEnum!])
- `adminOverrideMaterialType` ([InstalledMaterialType])
- `qrCodeIdentifier` (String!)
- `isEmailVerified` (Boolean!)
- `pushToken` (String, for mobile notifications)
- `editRequestStatus`, `editRequestData` (embedded)
- `isArchived`, `archivedAt`, `scheduledDeletionDate` (soft delete)
- `createdAt`, `updatedAt` (timestamps)

**Relationships:**
- One-to-One: `material` → Material (assigned material)
- One-to-Many: `adsDeployments` → AdsDeployment
- One-to-Many: `deviceTracking` → DeviceTracking
- One-to-Many: `driverReports` → DriverReport
- One-to-Many: `driverSalaryCalculations` → DriverSalaryCalculation
- One-to-Many: `notifications` → Notification
- One-to-One: `tablet` → Tablet (for LCD materials)

---

### 5. MATERIAL
**Primary Key:** `id`, `materialId` (String: DGL-LCD-CAR-001)  
**Description:** Physical materials (LCD screens, HEADDRESS displays, etc.) mounted on vehicles

**Attributes:**
- `id` (ID!)
- `materialId` (String!, unique: DGL-LCD-CAR-001)
- `materialName` (String!)
- `materialType` (POSTER/LCD/STICKER/HEADDRESS/BANNER)
- `category` (DIGITAL/NON_DIGITAL)
- `vehicleType` (CAR/MOTORCYCLE/BUS/JEEP/E_TRIKE)
- `description`, `requirements` (String)
- `driverId` (String, ref: Driver.driverId)
- `status` (ACTIVE/INACTIVE/MAINTENANCE/RETIRED)
- `assignedDate`, `mountedAt`, `dismountedAt` (Date)
- `location` (embedded: address, coordinates)
- `materialCondition`, `photoComplianceStatus` (String)
- `lastInspectionDate`, `nextInspectionDue` (Date)
- `createdAt`, `updatedAt` (timestamps)

**Relationships:**
- One-to-One: `driver` → Driver (assigned driver)
- One-to-Many: `adsDeployments` → AdsDeployment
- One-to-Many: `ads` → Ad (via materialId array)
- One-to-One: `tablet` → Tablet (for LCD materials)
- One-to-Many: `deviceTracking` → DeviceTracking
- One-to-Many: `qrScanTracking` → QRScanTracking
- One-to-Many: `materialTracking` → MaterialTracking
- One-to-Many: `materialUsageHistory` → MaterialUsageHistory

---

### 6. AD
**Primary Key:** `id`  
**Description:** Advertisement campaigns created by users

**Attributes:**
- `id` (ID!)
- `userId` (ObjectId!, ref: User)
- `driverId` (ObjectId, ref: Driver)
- `materialId` ([ObjectId!]!, ref: Material)
- `targetDevices` ([ObjectId!], ref: Material)
- `planId` (ObjectId, ref: AdsPlan)
- `title`, `description`, `website` (String!)
- `adFormat` (VIDEO/IMAGE)
- `adType` (DIGITAL/NON_DIGITAL)
- `mediaFile` (String!, URL)
- `price`, `totalPrice`, `pricePerPlay` (Float!)
- `durationDays`, `adLengthSeconds` (Int!)
- `numberOfDevices`, `playsPerDayPerDevice`, `totalPlaysPerDay` (Int!)
- `status` (PENDING/APPROVED/REJECTED/SCHEDULED/RUNNING/ENDED/CANCELLED/ARCHIVED)
- `adStatus` (INACTIVE/ACTIVE/FINISHED)
- `paymentStatus` (PENDING/PAID/FAILED)
- `impressions` (Int!, default: 0)
- `startTime`, `endTime`, `userDesiredStartTime` (Date!)
- `reasonForReject`, `approveTime`, `rejectTime` (String/Date)
- `materialType`, `vehicleType`, `category` (String, flexible ad fields)
- `deploymentStatus` (PENDING/DEPLOYING/DEPLOYED/FAILED)
- `reservationExpires` (Date)
- `isArchived`, `archivedAt`, `scheduledDeletionDate` (soft delete)
- `createdAt`, `updatedAt` (timestamps)

**Relationships:**
- Many-to-One: `user` → User
- Many-to-One: `plan` → AdsPlan (optional)
- Many-to-Many: `materials` → Material (via materialId array)
- One-to-Many: `payments` → Payment
- One-to-Many: `adsDeployments` → AdsDeployment (via adId or lcdSlots)
- One-to-Many: `deviceTracking` → DeviceTracking (via adPlayback)
- One-to-Many: `qrScanTracking` → QRScanTracking
- One-to-Many: `notifications` → Notification

---

### 7. ADSPLAN
**Primary Key:** `id`  
**Description:** Advertising plans/packages that define pricing and duration

**Attributes:**
- `id` (ID!)
- `name`, `description` (String!)
- `durationDays` (Int!)
- `category` (String!)
- `materialType`, `vehicleType` (String!)
- `numberOfDevices`, `adLengthSeconds` (Int!)
- `playsPerDayPerDevice`, `totalPlaysPerDay` (Int!)
- `pricePerPlay` (Float!)
- `dailyRevenue`, `totalPrice` (Float!)
- `status` (String!)
- `startDate`, `endDate` (Date)
- `currentDurationDays` (Int!)
- `createdAt`, `updatedAt` (timestamps)

**Relationships:**
- One-to-Many: `ads` → Ad
- One-to-Many: `payments` → Payment
- Many-to-Many: `materials` → Material (via availability checks)

---

### 8. PAYMENT
**Primary Key:** `id`  
**Description:** Payment records for ad campaigns

**Attributes:**
- `id` (ID!)
- `userId` (ObjectId!, ref: User)
- `adsId` (ObjectId!, ref: Ad)
- `planID` (ObjectId, ref: AdsPlan)
- `paymentType` (CREDIT_CARD/DEBIT_CARD/GCASH/PAYPAL/BANK_TRANSFER/CASH)
- `amount` (Float!)
- `receiptId` (String!, unique)
- `paymentStatus` (PENDING/PAID/FAILED)
- `paymentDate` (Date)
- `createdAt`, `updatedAt` (timestamps)

**Relationships:**
- Many-to-One: `user` → User
- Many-to-One: `ad` → Ad
- Many-to-One: `plan` → AdsPlan (optional)

---

### 9. ADSDEPLOYMENT
**Primary Key:** `id`, `adDeploymentId` (String)  
**Description:** Active deployments of ads to materials/devices

**Attributes:**
- `id` (ID!)
- `adDeploymentId` (String, unique)
- `materialId` (String!, ref: Material.materialId)
- `driverId` (String!, ref: Driver.driverId)
- `userId` (ObjectId, ref: User)
- `adId` (ObjectId, ref: Ad, for non-LCD materials)
- `lcdSlots` ([LCDSlot], embedded array)
- `startTime`, `endTime` (Date)
- `currentStatus` (RUNNING)
- `lastFrameUpdate` (Date)
- `deployedAt`, `completedAt`, `removedAt` (Date)
- `removedBy` (ObjectId, ref: User)
- `removalReason` (String)
- `createdAt`, `updatedAt` (timestamps)

**Embedded: LCDSlot**
- `id` (ID!)
- `adId` (ObjectId!, ref: Ad)
- `userId` (ObjectId, ref: User)
- `slotNumber` (Int!, 1-5)
- `startTime`, `endTime` (Date!)
- `status` (SCHEDULED/RUNNING/COMPLETED/PAUSED/CANCELLED/REMOVED)
- `deployedAt`, `completedAt`, `removedAt` (Date)
- `removedBy` (ObjectId, ref: User)
- `removalReason` (String)
- `lastFrameUpdate` (Date)
- `mediaFile` (String!)

**Relationships:**
- Many-to-One: `material` → Material
- Many-to-One: `driver` → Driver
- Many-to-One: `ad` → Ad (or via lcdSlots)
- Many-to-One: `user` → User
- One-to-Many: `lcdSlots` → Ad (embedded)

---

### 10. TABLET
**Primary Key:** `id`  
**Description:** Tablet devices registered for LCD materials

**Attributes:**
- `id` (ID!)
- `materialId` (String!, ref: Material.materialId)
- `carGroupId` (String!)
- `tablets` ([TabletUnit], embedded array)
- `createdAt`, `updatedAt` (timestamps)

**Embedded: TabletUnit**
- `tabletNumber` (Int!, 1-2)
- `deviceId` (String, unique)
- `status` (ONLINE/OFFLINE)
- `gps` (embedded: lat, lng)
- `lastSeen` (Date)

**Relationships:**
- One-to-One: `material` → Material
- One-to-Many: `deviceTracking` → DeviceTracking (via deviceId)

---

### 11. DEVICETRACKING
**Primary Key:** `id`  
**Description:** Real-time tracking data for devices (one document per material per day)

**Attributes:**
- `id` (ID!)
- `materialId` (String!, ref: Material.materialId)
- `carGroupId` (String!)
- `screenType` (HEADDRESS/LCD/BILLBOARD/DIGITAL_DISPLAY)
- `date` (Date!)
- `slots` ([Slot], embedded array)
- `currentLocation` (embedded: LocationPoint)
- `totalDistance` (Float, km)
- `totalHours` (Float, hours)
- `currentHours` (Float, hours)
- `hoursRemaining` (Float, hours)
- `isCompliant` (Boolean!)
- `totalAdPlays`, `totalQRScans` (Int!)
- `totalAdPlayTime`, `totalAdImpressions` (Float!)
- `hourlyStats` ([HourlyStats], embedded array)
- `adPlayback` ([AdPlayback], embedded array)
- `qrScans` ([QRScan], embedded array)
- `networkStatus` (embedded)
- `createdAt`, `updatedAt` (timestamps)

**Embedded: Slot**
- `slotNumber` (Int!, 1-5)
- `deviceId` (String)
- `isOnline` (Boolean!)
- `lastSeen` (Date)
- `unregisteredAt` (Date)
- `deviceInfo` (embedded)
- `isDisplaying`, `brightness`, `volume`, `maintenanceMode` (Boolean/Int)

**Embedded: AdPlayback**
- `adId`, `userId`, `adTitle` (String!)
- `materialId` (String!)
- `slotNumber` (Int!, 1-5)
- `adDuration` (Int!, seconds)
- `startTime`, `endTime` (Date!)
- `viewTime`, `completionRate`, `impressions` (Number)

**Embedded: QRScan**
- `adId`, `userId`, `adTitle` (String!)
- `materialId` (String!)
- `slotNumber` (Int!, 1-5)
- `scanTimestamp` (Date!)
- `qrCodeUrl`, `website`, `redirectUrl` (String)
- `location` (embedded: LocationPoint)
- `userAgent`, `deviceType`, `browser`, `operatingSystem` (String)
- `ipAddress`, `country`, `city` (String)
- `timeOnPage`, `converted`, `conversionValue` (Number/Boolean)

**Relationships:**
- Many-to-One: `material` → Material
- Many-to-One: `driver` → Driver (via material)
- One-to-Many: `adPlayback` → Ad (embedded references)
- One-to-Many: `qrScans` → QRScanTracking (similar data)

---

### 12. QRSCANTRACKING
**Primary Key:** `id`  
**Description:** Historical QR code scan tracking records

**Attributes:**
- `id` (ID!)
- `adId`, `adTitle` (String!)
- `materialId` (String!, ref: Material.materialId)
- `slotNumber` (Int!, 1-5)
- `scanTimestamp` (Date!)
- `qrCodeUrl`, `website`, `redirectUrl` (String)
- `location` (embedded: LocationPoint)
- `userAgent`, `deviceType`, `browser`, `operatingSystem` (String)
- `ipAddress`, `country`, `city`, `address` (String)
- `timeOnPage`, `converted`, `conversionType`, `conversionValue` (Number/Boolean/String)
- `createdAt`, `updatedAt` (timestamps)

**Relationships:**
- Many-to-One: `ad` → Ad
- Many-to-One: `material` → Material

---

### 13. NOTIFICATION
**Primary Key:** `id` (embedded in UserNotifications)  
**Description:** In-app notifications for users, admins, drivers, and superadmins

**Attributes:**
- `userId` (ObjectId!, ref: User/Admin/Driver/SuperAdmin, unique)
- `userRole` (USER/DRIVER/ADMIN/SUPERADMIN)
- `notifications` ([NotificationItem], embedded array)
- `unreadCount` (Int!)
- `notificationPreferences` (embedded)
- `createdAt`, `updatedAt` (timestamps)

**Embedded: NotificationItem**
- `title`, `message` (String!)
- `type` (SUCCESS/INFO/WARNING/ERROR)
- `category` (enum: AD_APPROVAL, PAYMENT_CONFIRMATION, etc.)
- `priority` (HIGH/MEDIUM/LOW)
- `read`, `readAt` (Boolean/Date)
- `adId` (ObjectId, ref: Ad)
- `adTitle` (String)
- `data` (Mixed/JSON)

**Relationships:**
- One-to-One: `user` → User/Admin/Driver/SuperAdmin

---

### 14. USERREPORT
**Primary Key:** `id`  
**Description:** User-submitted reports (bugs, payments, account issues, etc.)

**Attributes:**
- `id` (ID!)
- `userId` (ObjectId!, ref: User)
- `title`, `description` (String!)
- `reportType` (BUG/PAYMENT/ACCOUNT/CONTENT_VIOLATION/FEATURE_REQUEST/OTHER)
- `status` (PENDING/IN_PROGRESS/RESOLVED/CLOSED)
- `attachments` ([String!], URLs)
- `adminNotes`, `adminNotesUpdatedAt` (String/Date)
- `adminNotesBy` (embedded: adminId, adminName, adminEmail)
- `resolvedAt` (Date)
- `createdAt`, `updatedAt` (timestamps)

**Relationships:**
- Many-to-One: `user` → User
- Many-to-One: `adminResponder` → Admin (via adminNotesBy)

---

### 15. DRIVERREPORT
**Primary Key:** `id`  
**Description:** Driver-submitted reports (issues, documents, etc.)

**Attributes:**
- `id` (ID!)
- `driverId` (String!, ref: Driver.driverId)
- `title`, `description` (String!)
- `reportType` (String!)
- `status` (PENDING/IN_PROGRESS/RESOLVED/CLOSED)
- `attachments` ([String!], URLs)
- `adminNotes`, `adminNotesUpdatedAt` (String/Date)
- `adminNotesBy` (embedded: adminId, adminName, adminEmail)
- `resolvedAt` (Date)
- `createdAt`, `updatedAt` (timestamps)

**Relationships:**
- Many-to-One: `driver` → Driver
- Many-to-One: `adminResponder` → Admin (via adminNotesBy)

---

### 16. DRIVERSALARYCALCULATION
**Primary Key:** `id`  
**Description:** Driver salary calculations based on distance and hours

**Attributes:**
- `id` (ID!)
- `driverId` (String!, ref: Driver.driverId)
- `driverName` (String!)
- `materialId` (ObjectId!, ref: Material)
- `deviceId` (String!)
- `calculationPeriod` (embedded: startDate, endDate, periodType)
- `rawData` (embedded: totalDistance, totalHours, daysWorked)
- `pricingConfig` (embedded: vehicleType, category, materialType, distanceRate, hoursRate)
- `calculations` (embedded: distanceComputation, hoursComputation, totalSalary)
- `status` (PENDING/CALCULATED/APPROVED/PAID/DISPUTED)
- `approvedBy` (ObjectId, ref: SuperAdmin)
- `approvedAt`, `paidAt` (Date)
- `paymentReference` (String)
- `notes`, `disputeReason` (String)
- `periodDisplay` (String!)
- `isActive` (Boolean!)
- `createdAt`, `updatedAt` (timestamps)

**Relationships:**
- Many-to-One: `driver` → Driver
- Many-to-One: `material` → Material
- Many-to-One: `approvedBy` → SuperAdmin

---

### 17. DRIVERSALARYPRICING
**Primary Key:** `id`  
**Description:** Pricing configuration for driver salaries (rates per vehicle/material type)

**Attributes:**
- `id` (ID!)
- `vehicleType` (CAR/MOTORCYCLE/BUS/JEEP/E_TRIKE)
- `category` (DIGITAL/NON_DIGITAL)
- `materialType` (POSTER/LCD/STICKER/HEADDRESS/BANNER)
- `distanceRate` (Float!, per km)
- `hoursRate` (Float!, per hour)
- `isActive` (Boolean!)
- `createdBy` (ObjectId!, ref: SuperAdmin)
- `updatedBy` (ObjectId, ref: SuperAdmin)
- `notes`, `displayName` (String!)
- `createdAt`, `updatedAt` (timestamps)

**Relationships:**
- Many-to-One: `createdBy` → SuperAdmin
- Many-to-One: `updatedBy` → SuperAdmin
- One-to-Many: `driverSalaryCalculations` → DriverSalaryCalculation (via pricingConfig)

---

### 18. PRICINGCONFIG
**Primary Key:** `id`  
**Description:** System-wide pricing configuration for ad plans

**Attributes:**
- `id` (ID!)
- `materialType` (String!)
- `vehicleType` (String!)
- `category` (String!)
- `basePricePerPlay` (Float!)
- `durationMultipliers` (embedded: daily, weekly, monthly)
- `deviceMultipliers` (embedded)
- `isActive` (Boolean!)
- `createdBy` (ObjectId!, ref: SuperAdmin)
- `updatedBy` (ObjectId, ref: SuperAdmin)
- `createdAt`, `updatedAt` (timestamps)

**Relationships:**
- Many-to-One: `createdBy` → SuperAdmin
- Many-to-One: `updatedBy` → SuperAdmin

---

### 19. MATERIALTRACKING
**Primary Key:** `id`  
**Description:** Material condition tracking and compliance (monthly photo uploads)

**Attributes:**
- `id` (ID!)
- `materialId` (ObjectId!, ref: Material)
- `driverId` (ObjectId, ref: Driver)
- `materialCondition` (EXCELLENT/GOOD/FAIR/POOR/DAMAGED)
- `monthlyPhotos` ([MonthlyPhoto], embedded array)
- `photoComplianceStatus` (COMPLIANT/NON_COMPLIANT/PENDING)
- `lastPhotoUpload`, `nextPhotoDue` (Date)
- `createdAt`, `updatedAt` (timestamps)

**Embedded: MonthlyPhoto**
- `month` (String!, YYYY-MM)
- `status` (PENDING/APPROVED/REJECTED)
- `photoUrls` ([String!], URLs)
- `uploadedAt` (Date!)
- `uploadedBy` (String!, driverId)
- `adminNotes`, `reviewedBy`, `reviewedAt` (String/Date)

**Relationships:**
- Many-to-One: `material` → Material
- Many-to-One: `driver` → Driver

---

### 20. MATERIALUSAGEHISTORY
**Primary Key:** `id`  
**Description:** Historical record of material assignments to drivers

**Attributes:**
- `id` (ID!)
- `materialId` (ObjectId!, ref: Material)
- `materialStringId` (String!)
- `driverId` (String!, ref: Driver.driverId)
- `driverInfo` (embedded: driverId, fullName, email, contactNumber, vehiclePlateNumber)
- `assignedAt`, `unassignedAt` (Date!)
- `mountedAt`, `dismountedAt` (Date)
- `usageDuration` (Int!, days)
- `assignmentReason`, `unassignmentReason`, `customDismountReason` (String!)
- `assignedByAdmin`, `unassignedByAdmin` (embedded: adminId, adminName, adminEmail)
- `notes` (String)
- `isActive` (Boolean!)
- `createdAt`, `updatedAt` (timestamps)

**Relationships:**
- Many-to-One: `material` → Material
- Many-to-One: `driver` → Driver

---

### 21. COMPANYAD
**Primary Key:** `id`  
**Description:** Company-owned advertisements that fill empty slots on LCD materials

**Attributes:**
- `id` (ID!)
- `title`, `description` (String!)
- `mediaFile` (String!, URL)
- `adFormat` (VIDEO/IMAGE)
- `duration` (Int!, seconds)
- `isActive` (Boolean!)
- `priority` (Int!)
- `playCount` (Int!)
- `lastPlayed` (Date)
- `createdBy` (ObjectId!, ref: User)
- `updatedBy` (ObjectId, ref: User)
- `tags` ([String!])
- `notes` (String)
- `isScheduled` (Boolean!)
- `startDate`, `endDate` (Date)
- `scheduleType` (IMMEDIATE/SCHEDULED)
- `createdAt`, `updatedAt` (timestamps)

**Relationships:**
- Many-to-One: `createdBy` → User
- Many-to-One: `updatedBy` → User
- Many-to-Many: `materials` → Material (via AdsDeployment empty slots)

---

### 22. CONTACTMESSAGE
**Primary Key:** `id`  
**Description:** Contact messages from users to admins

**Attributes:**
- `id` (ID!)
- `userId` (ObjectId!, ref: User)
- `subject`, `message` (String!)
- `status` (PENDING/REPLIED/RESOLVED/CLOSED)
- `adminReplies` ([AdminReply], embedded array)
- `createdAt`, `updatedAt` (timestamps)

**Embedded: AdminReply**
- `adminId` (ObjectId!, ref: Admin)
- `adminInfo` (embedded: adminId, adminName, adminEmail)
- `message` (String!)
- `repliedAt` (Date!)

**Relationships:**
- Many-to-One: `user` → User
- One-to-Many: `adminReplies` → Admin

---

### 23. FAQ
**Primary Key:** `id`  
**Description:** Frequently Asked Questions

**Attributes:**
- `id` (ID!)
- `question`, `answer` (String!)
- `category` (String!)
- `order` (Int!)
- `isActive` (Boolean!)
- `createdAt`, `updatedAt` (timestamps)

---

### 24. NEWSLETTER
**Primary Key:** `id`  
**Description:** Newsletter subscriptions and campaigns

**Attributes:**
- `id` (ID!)
- `title`, `content` (String!)
- `subject` (String!)
- `sentAt` (Date)
- `recipientCount` (Int!)
- `createdBy` (ObjectId!, ref: Admin/SuperAdmin)
- `createdAt`, `updatedAt` (timestamps)

**Relationships:**
- Many-to-One: `createdBy` → Admin/SuperAdmin

---

### 25. USERANALYTICS
**Primary Key:** `id` (embedded in User collection)  
**Description:** Aggregated analytics data for users

**Attributes:**
- `userId` (ObjectId!, ref: User)
- `summary` (embedded: totalAdImpressions, totalAdsPlayed, totalDisplayTime, averageCompletionRate, totalAds, activeAds, totalMaterials, totalDevices, totalQRScans, qrScanConversionRate)
- `adPerformance` ([UserAdPerformance], embedded array)
- `dailyStats` ([UserDailyStats], embedded array)
- `deviceStats` ([UserDeviceStats], embedded array)
- `period`, `startDate`, `endDate`, `lastUpdated` (String/Date)
- `isActive` (Boolean!)
- `createdAt`, `updatedAt` (timestamps)

**Relationships:**
- One-to-One: `user` → User

---

## Entity Relationships Summary

### Primary Relationships

1. **User → Ad** (1:N)
   - One user can create many ads

2. **User → Payment** (1:N)
   - One user can make many payments

3. **Ad → Payment** (1:N)
   - One ad can have multiple payment attempts

4. **Ad → AdsDeployment** (1:N)
   - One ad can be deployed to multiple materials/devices

5. **Material → Driver** (1:1)
   - One material is assigned to one driver

6. **Driver → Material** (1:1)
   - One driver can have one assigned material

7. **Material → AdsDeployment** (1:N)
   - One material can have multiple ad deployments (LCD slots)

8. **Material → DeviceTracking** (1:N)
   - One material generates tracking data per day

9. **Material → Tablet** (1:1, for LCD materials)
   - One LCD material has one tablet configuration

10. **Ad → DeviceTracking** (N:M, via adPlayback)
    - Ads are tracked in device playback records

11. **Ad → QRScanTracking** (1:N)
    - One ad can generate multiple QR scans

12. **SuperAdmin → Admin** (1:N)
    - SuperAdmin creates and manages admins

13. **Admin → UserReport** (1:N, via responses)
    - Admins respond to user reports

14. **SuperAdmin → DriverSalaryPricing** (1:N)
    - SuperAdmin creates salary pricing configs

15. **Driver → DriverSalaryCalculation** (1:N)
    - One driver has multiple salary calculation periods

---

## Database Architecture

- **Database Type:** MongoDB (NoSQL)
- **ODM:** Mongoose
- **API:** GraphQL (Apollo Server)
- **Authentication:** JWT tokens
- **File Storage:** Firebase Storage

---

## Key Business Rules

1. **Ad Status Flow:**
   - PENDING → APPROVED → PAID → ACTIVE → RUNNING → ENDED/FINISHED

2. **Driver Approval Flow:**
   - PENDING → APPROVED/REJECTED → ACTIVE

3. **Material Assignment:**
   - Material must be assigned to an approved driver before ad deployment

4. **Payment Activation:**
   - Ad becomes ACTIVE only after payment status is PAID

5. **LCD Slot Management:**
   - LCD materials have 5 slots (1-5)
   - Empty slots are filled with company ads
   - Slots can be SCHEDULED, RUNNING, COMPLETED, PAUSED, CANCELLED, REMOVED

6. **Soft Delete:**
   - All major entities support 30-day deferred deletion (isArchived, archivedAt, scheduledDeletionDate)

7. **Tracking:**
   - DeviceTracking: One document per material per day
   - QRScanTracking: Individual records for each scan
   - Real-time location updates via GPS

8. **Driver Compensation:**
   - Calculated based on distance (km) and hours (display time)
   - Rates vary by vehicle type, material type, and category

---

## Indexes (Performance Optimization)

**Critical Indexes:**
- User: `email`, `userId`, `isArchived`, `scheduledDeletionDate`
- Ad: `userId`, `status`, `paymentStatus`, `adStatus`, `targetDevices`, `startTime`, `endTime`, `isArchived`
- Material: `materialId`, `driverId`, `materialType`, `vehicleType`, `category`
- Driver: `driverId`, `email`, `accountStatus`, `reviewStatus`, `isArchived`
- DeviceTracking: `materialId`, `date`, `slots.deviceId`
- Payment: `userId`, `adsId`, `paymentStatus`
- AdsDeployment: `materialId`, `driverId`, `adId`, `userId`, `lcdSlots.adId`

---

## Notes

- All timestamps use MongoDB Date type
- String IDs (like `driverId`, `materialId`) are human-readable (e.g., DRV-001, DGL-LCD-CAR-001)
- ObjectIds are used for MongoDB document references
- Many relationships use embedded documents for performance (notable: LCDSlots, NotificationItems, Tracking data)
- The system supports both "plan-based" ads (via AdsPlan) and "flexible" ads (direct material selection)

