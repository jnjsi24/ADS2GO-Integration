// Main Notification Service - Facade pattern
const BaseNotificationService = require('./BaseNotificationService');
const UserNotificationService = require('./UserNotificationService');
const DriverNotificationService = require('./DriverNotificationService');
const AdminNotificationService = require('./AdminNotificationService');
const SuperAdminNotificationService = require('./SuperAdminNotificationService');

class NotificationService {
  // ==================== BASE FUNCTIONALITY ====================
  
  static async createNotification(userId, title, message, type = 'INFO', options = {}) {
    return await BaseNotificationService.createNotification(userId, title, message, type, options);
  }

  static async getUserNotificationStats(userId) {
    return await BaseNotificationService.getUserNotificationStats(userId);
  }

  static async deleteNotification(userId, notificationId) {
    return await BaseNotificationService.deleteNotification(userId, notificationId);
  }

  static async deleteAllNotifications(userId) {
    return await BaseNotificationService.deleteAllNotifications(userId);
  }

  static async deleteNotificationsByCategory(userId, category) {
    return await BaseNotificationService.deleteNotificationsByCategory(userId, category);
  }

  static async autoDeleteOldNotifications() {
    return await BaseNotificationService.autoDeleteOldNotifications();
  }

  static async getNotifications(userId, options = {}) {
    return await BaseNotificationService.getNotifications(userId, options);
  }

  // ==================== USER NOTIFICATIONS ====================

  static async sendAdApprovalNotification(adId) {
    return await UserNotificationService.sendAdApprovalNotification(adId);
  }

  static async sendAdRejectionNotification(adId, reason) {
    return await UserNotificationService.sendAdRejectionNotification(adId, reason);
  }

  static async sendPaymentConfirmationNotification(userId, amount, adTitle) {
    return await UserNotificationService.sendPaymentConfirmationNotification(userId, amount, adTitle);
  }

  static async sendAdPerformanceNotification(userId, adTitle, impressions, plays) {
    return await UserNotificationService.sendAdPerformanceNotification(userId, adTitle, impressions, plays);
  }

  static async sendProfileChangeNotification(userId, changedFields, oldValues = {}) {
    return await UserNotificationService.sendProfileChangeNotification(userId, changedFields, oldValues);
  }

  // ==================== DRIVER NOTIFICATIONS ====================

  static async sendMaterialAssignmentNotification(driverId, materialId, materialName) {
    return await DriverNotificationService.sendMaterialAssignmentNotification(driverId, materialId, materialName);
  }

  static async sendDriverStatusChangeNotification(driverId, status, reason = null) {
    return await DriverNotificationService.sendDriverStatusChangeNotification(driverId, status, reason);
  }

  static async sendRouteUpdateNotification(driverId, routeDetails) {
    return await DriverNotificationService.sendRouteUpdateNotification(driverId, routeDetails);
  }

  static async sendDeviceIssueNotification(driverId, deviceId, issue) {
    return await DriverNotificationService.sendDeviceIssueNotification(driverId, deviceId, issue);
  }

  // ==================== ADMIN NOTIFICATIONS ====================

  static async sendNewAdSubmissionNotification(adId) {
    return await AdminNotificationService.sendNewAdSubmissionNotification(adId);
  }

  static async sendNewDriverApplicationNotification(driverId) {
    return await AdminNotificationService.sendNewDriverApplicationNotification(driverId);
  }

  static async sendNewUserRegistrationNotification(userId) {
    return await AdminNotificationService.sendNewUserRegistrationNotification(userId);
  }

  static async sendPaymentIssueNotification(issue, details) {
    return await AdminNotificationService.sendPaymentIssueNotification(issue, details);
  }

  static async sendSystemAlertNotification(alert, description) {
    return await AdminNotificationService.sendSystemAlertNotification(alert, description);
  }

  static async sendNewUserReportNotification(userId, reportId, reportType, title) {
    return await AdminNotificationService.sendNewUserReportNotification(userId, reportId, reportType, title);
  }

  // ==================== SUPERADMIN NOTIFICATIONS ====================

  static async sendCriticalSystemIssueNotification(issue, description) {
    return await SuperAdminNotificationService.sendCriticalSystemIssueNotification(issue, description);
  }

  static async sendAdminActivityNotification(adminId, activity, details) {
    return await SuperAdminNotificationService.sendAdminActivityNotification(adminId, activity, details);
  }

  static async sendSystemReportNotification(reportType, summary) {
    return await SuperAdminNotificationService.sendSystemReportNotification(reportType, summary);
  }

  static async sendSecurityAlertNotification(alert, details) {
    return await SuperAdminNotificationService.sendSecurityAlertNotification(alert, details);
  }

  static async sendDatabaseIssueNotification(issue, details) {
    return await SuperAdminNotificationService.sendDatabaseIssueNotification(issue, details);
  }

  // ==================== EMAIL NOTIFICATIONS ====================

  static async sendAdApprovalEmail(email, firstName, adTitle, adId) {
    return await UserNotificationService.sendAdApprovalEmail(email, firstName, adTitle, adId);
  }

  static async sendAdRejectionEmail(email, firstName, adTitle, reason, adId) {
    return await UserNotificationService.sendAdRejectionEmail(email, firstName, adTitle, reason, adId);
  }

  static async sendMaterialAssignmentEmail(email, firstName, materialName) {
    return await DriverNotificationService.sendMaterialAssignmentEmail(email, firstName, materialName);
  }

  static async sendDriverStatusChangeEmail(email, firstName, status, reason) {
    return await DriverNotificationService.sendDriverStatusChangeEmail(email, firstName, status, reason);
  }
}

module.exports = NotificationService;