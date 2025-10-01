# Announcements & Updates Email Feature Implementation

## Overview

This implementation adds a comprehensive Announcements & Updates email toggle functionality to the user settings. When turned off, users won't receive announcement email notifications, but all notifications will be queued and sent when the toggle is turned back on.

## Features

### ✅ Core Functionality
- **Toggle Control**: Users can enable/disable Announcements & Updates emails in their settings
- **Email Queuing**: When disabled, all announcement email notifications are queued instead of being sent
- **Batch Processing**: When enabled, all queued emails are processed and sent
- **User Feedback**: Clear indicators show queued email count and status
- **Error Handling**: Robust error handling with fallback queuing

### ✅ User Experience
- **Visual Indicators**: Users see how many emails are waiting when disabled
- **Real-time Updates**: Settings page updates immediately when toggles are changed
- **Status Messages**: Clear feedback when emails are being processed
- **Toast Notifications**: Success/error messages for user actions

## Technical Implementation

### Database Schema

#### EmailNotificationQueue Model
```javascript
{
  userId: ObjectId,
  userRole: String,
  email: String,
  firstName: String,
  notificationType: String,
  emailData: {
    subject: String,
    html: String,
    templateData: Mixed
  },
  priority: String,
  attempts: Number,
  maxAttempts: Number,
  status: String, // PENDING, SENT, FAILED, CANCELLED
  lastAttemptAt: Date,
  sentAt: Date,
  errorMessage: String,
  originalNotificationId: ObjectId
}
```

#### User Model (Updated)
The existing `notificationPreferences.announcementsEmails` field is used to control the feature.

### Services

#### EnhancedEmailNotificationService
- **Primary Service**: Handles all email notifications with preference checking
- **Queuing Logic**: Automatically queues emails when announcements emails are disabled
- **Batch Processing**: Processes queued emails when announcements emails are enabled
- **Error Handling**: Includes retry logic and fallback queuing

#### Updated Notification Services
- **UserNotificationService**: Updated to use enhanced email service
- **DriverNotificationService**: Updated to use enhanced email service  
- **AdminNotificationService**: Updated to use enhanced email service

### GraphQL API

#### New Query
```graphql
query GetQueuedEmailStats {
  getQueuedEmailStats {
    pending
    sent
    failed
    cancelled
  }
}
```

#### Updated Mutation
```graphql
mutation UpdateUserNotificationPreferences($input: UpdateUserNotificationPreferencesInput!) {
  updateUserNotificationPreferences(input: $input) {
    success
    message
    user {
      id
      notificationPreferences {
        communicationEmails
        # ... other preferences
      }
    }
  }
}
```

### Frontend Components

#### Settings Page Updates
- **Announcements & Updates Toggle**: Enhanced with queued email indicators
- **Status Messages**: Shows pending email count and processing status
- **Real-time Updates**: Automatically refreshes queued email stats

## How It Works

### 1. Email Notification Flow

```
User Action/Event
       ↓
Notification Service
       ↓
EnhancedEmailNotificationService
       ↓
Check User Preferences
       ↓
┌─────────────────┬─────────────────┐
│ Announcements   │ Announcements   │
│ & Updates ON    │ & Updates OFF   │
│                 │                 │
│ Send Email      │ Queue Email     │
│ Immediately     │ for Later       │
└─────────────────┴─────────────────┘
```

### 2. Queue Processing Flow

```
User Enables Announcements & Updates
       ↓
updateUserNotificationPreferences
       ↓
processQueuedEmails
       ↓
Send All Queued Emails
       ↓
Update Queue Status
```

### 3. User Interface Flow

```
User Opens Settings
       ↓
Load Notification Preferences
       ↓
Load Queued Email Stats
       ↓
Display Toggle with Status
       ↓
User Toggles Setting
       ↓
Save Preferences + Process Queue
       ↓
Update UI with New Status
```

## Usage Examples

### For Users

1. **Disable Announcements & Updates**:
   - Go to Settings → Notifications
   - Turn off "Announcements & Updates" toggle
   - All future announcement email notifications will be queued

2. **View Queued Emails**:
   - When disabled, see "📧 You have X emails waiting to be sent"
   - Turn on Announcements & Updates to receive them

3. **Enable Announcements & Updates**:
   - Turn on "Announcements & Updates" toggle
   - All queued emails are automatically sent
   - See "✅ Your queued emails are being processed and sent"

### For Developers

#### Sending Notifications
```javascript
// Use EnhancedEmailNotificationService instead of direct email sending
const result = await EnhancedEmailNotificationService.sendEmailNotification(
  userId,
  userRole,
  email,
  firstName,
  notificationType,
  emailData,
  priority,
  originalNotificationId
);

if (result.sent) {
  console.log('Email sent immediately');
} else if (result.queued) {
  console.log('Email queued for later');
}
```

#### Processing Queued Emails
```javascript
// Process all queued emails for a user
const result = await EnhancedEmailNotificationService.processQueuedEmails(userId);
console.log(`Processed ${result.processed} emails: ${result.sent} sent, ${result.failed} failed`);
```

#### Getting Queue Statistics
```javascript
// Get queued email statistics
const stats = await EnhancedEmailNotificationService.getQueuedEmailStats(userId);
console.log(`Pending: ${stats.pending}, Sent: ${stats.sent}, Failed: ${stats.failed}`);
```

## Testing

### Test Script
Run the included test script to verify functionality:

```bash
cd Ads2Go-Server
node test-communication-emails.js
```

### Manual Testing Steps

1. **Create a test user** with Announcements & Updates disabled
2. **Trigger notifications** (approve/reject ads, etc.)
3. **Verify emails are queued** (check database or use getQueuedEmailStats query)
4. **Enable Announcements & Updates** in user settings
5. **Verify queued emails are sent** (check email delivery and queue status)

## Configuration

### Environment Variables
No additional environment variables are required. The system uses existing email configuration.

### Database Indexes
The following indexes are automatically created for optimal performance:
- `{ userId: 1, status: 1 }`
- `{ createdAt: 1 }`
- `{ priority: 1, status: 1 }`

## Monitoring and Maintenance

### Queue Cleanup
Old queued emails (older than 30 days) are automatically cleaned up by the `clearOldQueuedEmails()` method.

### Error Handling
- Failed emails are retried up to 3 times
- After max attempts, emails are marked as FAILED
- All errors are logged for debugging

### Performance Considerations
- Emails are processed with a 1-second delay between sends to avoid overwhelming the email service
- Queue processing is batched for efficiency
- Database queries are optimized with proper indexing

## Future Enhancements

### Potential Improvements
1. **Scheduled Processing**: Process queued emails on a schedule instead of immediately
2. **Priority Queuing**: Implement priority-based email processing
3. **Email Templates**: Centralize email template management
4. **Analytics**: Add email delivery analytics and reporting
5. **Bulk Operations**: Allow bulk processing of queued emails for multiple users

### API Extensions
1. **Queue Management**: Add APIs to manually manage queued emails
2. **Bulk Processing**: Add endpoints for bulk email processing
3. **Delivery Reports**: Add APIs to get detailed delivery reports

## Troubleshooting

### Common Issues

1. **Emails not being queued**:
   - Check if EnhancedEmailNotificationService is being used
   - Verify user notification preferences are being read correctly

2. **Queued emails not being sent**:
   - Check email service configuration
   - Verify processQueuedEmails is being called
   - Check for email service errors in logs

3. **UI not showing queue status**:
   - Verify GraphQL query is working
   - Check if getQueuedEmailStats resolver is properly implemented

### Debug Commands

```javascript
// Check queued emails for a user
const stats = await EnhancedEmailNotificationService.getQueuedEmailStats(userId);

// Manually process queued emails
const result = await EnhancedEmailNotificationService.processQueuedEmails(userId);

// Clear old queued emails
const deleted = await EnhancedEmailNotificationService.clearOldQueuedEmails();
```

## Conclusion

This implementation provides a robust, user-friendly solution for managing announcement email notification preferences. Users have full control over their announcement email notifications while ensuring no important communications are lost when emails are temporarily disabled.
