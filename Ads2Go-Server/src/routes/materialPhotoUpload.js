const express = require('express');
const router = express.Router();
const { PhotoUploadService, upload } = require('../services/photoUploadService');
const DeviceCompliance = require('../models/deviceCompliance');
const { checkDriver } = require('../middleware/driverAuth');
const { checkAdminMiddleware } = require('../middleware/auth');

const photoUploadService = new PhotoUploadService();

/**
 * @route POST /api/material-photos/upload
 * @desc Upload monthly material photos (Driver only)
 * @access Private - Driver
 */
router.post('/upload', 
  checkDriver, 
  upload.array('photos', 5), // Allow up to 5 photos
  async (req, res) => {
    try {
      const { materialId, month } = req.body;
      const driverId = req.driver.driverId;

      // Validate required fields
      if (!materialId || !month) {
        return res.status(400).json({
          success: false,
          message: 'Material ID and month are required'
        });
      }

      // Validate month format (YYYY-MM)
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({
          success: false,
          message: 'Month must be in YYYY-MM format'
        });
      }

      // Check if files were uploaded
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No photos were uploaded'
        });
      }

      // Find the DeviceCompliance record
      const deviceCompliance = await DeviceCompliance.findOne({ 
        materialId,
        driverId: req.driver._id // Use ObjectId from driver context
      });

      if (!deviceCompliance) {
        return res.status(404).json({
          success: false,
          message: 'Device compliance record not found'
        });
      }

      // Upload photos to Firebase Storage
      const photoUrls = [];
      for (const file of req.files) {
        const filename = photoUploadService.generateUniqueFilename(
          file.originalname, 
          driverId, 
          materialId, 
          month
        );

        const photoUrl = await photoUploadService.uploadMonthlyPhoto(
          file.buffer,
          driverId,
          materialId,
          month,
          filename
        );

        photoUrls.push(photoUrl);
      }

      // Update DeviceCompliance record with new photos
      await deviceCompliance.addMonthlyPhoto(month, photoUrls, driverId);

      console.log(`✅ Monthly photos uploaded for material ${materialId}, month ${month}`);

      res.status(200).json({
        success: true,
        message: 'Photos uploaded successfully',
        data: {
          materialId,
          month,
          photoUrls,
          totalPhotos: photoUrls.length,
          nextPhotoDue: deviceCompliance.nextPhotoDue,
          complianceStatus: deviceCompliance.photoComplianceStatus
        }
      });

    } catch (error) {
      console.error('❌ Error uploading photos:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload photos',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/material-photos/:materialId/:month
 * @desc Get monthly photos for a material (Driver & Admin)
 * @access Private
 */
router.get('/:materialId/:month', 
  async (req, res) => {
    try {
      const { materialId, month } = req.params;
      const { driverId } = req.query;

      // Validate month format
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({
          success: false,
          message: 'Month must be in YYYY-MM format'
        });
      }

      // Find DeviceCompliance record
      const deviceCompliance = await DeviceCompliance.findOne({ materialId });

      if (!deviceCompliance) {
        return res.status(404).json({
          success: false,
          message: 'Device compliance record not found'
        });
      }

      // Get monthly photos
      const monthlyPhoto = deviceCompliance.monthlyPhotos?.find(
        photo => photo.month === month
      );

      if (!monthlyPhoto) {
        return res.status(200).json({
          success: true,
          message: 'No photos found for this month',
          data: {
            materialId,
            month,
            photos: [],
            status: 'PENDING'
          }
        });
      }

      res.status(200).json({
        success: true,
        data: {
          materialId,
          month,
          photos: monthlyPhoto.photoUrls,
          status: monthlyPhoto.status,
          uploadedAt: monthlyPhoto.uploadedAt,
          uploadedBy: monthlyPhoto.uploadedBy,
          adminNotes: monthlyPhoto.adminNotes,
          reviewedBy: monthlyPhoto.reviewedBy,
          reviewedAt: monthlyPhoto.reviewedAt
        }
      });

    } catch (error) {
      console.error('❌ Error getting monthly photos:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get monthly photos',
        error: error.message
      });
    }
  }
);

/**
 * @route DELETE /api/material-photos/:materialId/:month
 * @desc Delete monthly photos (Driver can delete their own, Admin can delete any)
 * @access Private
 */
router.delete('/:materialId/:month', 
  async (req, res) => {
    try {
      const { materialId, month } = req.params;
      const { driverId, adminId } = req.body;

      // Validate month format
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({
          success: false,
          message: 'Month must be in YYYY-MM format'
        });
      }

      // Find DeviceCompliance record
      const deviceCompliance = await DeviceCompliance.findOne({ materialId });

      if (!deviceCompliance) {
        return res.status(404).json({
          success: false,
          message: 'Device compliance record not found'
        });
      }

      // Find monthly photo
      const monthlyPhoto = deviceCompliance.monthlyPhotos?.find(
        photo => photo.month === month
      );

      if (!monthlyPhoto) {
        return res.status(404).json({
          success: false,
          message: 'No photos found for this month'
        });
      }

      // Check permissions
      if (adminId) {
        // Admin can delete any photo
        console.log(`Admin ${adminId} deleting photos for month ${month}`);
      } else if (driverId && monthlyPhoto.uploadedBy === driverId) {
        // Driver can only delete their own photos
        console.log(`Driver ${driverId} deleting their photos for month ${month}`);
      } else {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to delete these photos'
        });
      }

      // Delete photos from Firebase Storage
      for (const photoUrl of monthlyPhoto.photoUrls) {
        await photoUploadService.deletePhoto(photoUrl);
      }

      // Remove monthly photo from DeviceCompliance
      deviceCompliance.monthlyPhotos = deviceCompliance.monthlyPhotos.filter(
        photo => photo.month !== month
      );

      // Update tracking fields
      deviceCompliance.lastPhotoUpload = deviceCompliance.monthlyPhotos.length > 0 
        ? Math.max(...deviceCompliance.monthlyPhotos.map(p => new Date(p.uploadedAt)))
        : null;
      
      deviceCompliance.nextPhotoDue = deviceCompliance.calculateNextPhotoDue();
      deviceCompliance.photoComplianceStatus = deviceCompliance.calculatePhotoComplianceStatus();

      await deviceCompliance.save();

      console.log(`✅ Monthly photos deleted for material ${materialId}, month ${month}`);

      res.status(200).json({
        success: true,
        message: 'Photos deleted successfully',
        data: {
          materialId,
          month,
          deletedPhotos: monthlyPhoto.photoUrls.length
        }
      });

    } catch (error) {
      console.error('❌ Error deleting monthly photos:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete photos',
        error: error.message
      });
    }
  }
);

/**
 * @route PUT /api/material-photos/:materialId/:month/review
 * @desc Review monthly photos (Admin only)
 * @access Private - Admin
 */
router.put('/:materialId/:month/review', 
  checkAdminMiddleware,
  async (req, res) => {
    try {
      const { materialId, month } = req.params;
      const { status, notes } = req.body;
      const adminId = req.user.id;

      // Validate required fields
      if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Valid status (APPROVED or REJECTED) is required'
        });
      }

      // Validate month format
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({
          success: false,
          message: 'Month must be in YYYY-MM format'
        });
      }

      // Find DeviceCompliance record
      const deviceCompliance = await DeviceCompliance.findOne({ materialId });

      if (!deviceCompliance) {
        return res.status(404).json({
          success: false,
          message: 'Device compliance record not found'
        });
      }

      // Review the monthly photo
      await deviceCompliance.reviewMonthlyPhoto(month, status, adminId, notes);

      console.log(`✅ Monthly photos reviewed for material ${materialId}, month ${month}`);

      res.status(200).json({
        success: true,
        message: 'Photos reviewed successfully',
        data: {
          materialId,
          month,
          status,
          reviewedBy: adminId,
          reviewedAt: new Date(),
          notes,
          complianceStatus: deviceCompliance.photoComplianceStatus
        }
      });

    } catch (error) {
      console.error('❌ Error reviewing monthly photos:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to review photos',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/material-photos/compliance/overdue
 * @desc Get overdue photo uploads (Admin only)
 * @access Private - Admin
 */
router.get('/compliance/overdue', 
  checkAdminMiddleware,
  async (req, res) => {
    try {
      const overdueMaterials = await DeviceCompliance.findOverduePhotos();

      res.status(200).json({
        success: true,
        data: {
          totalOverdue: overdueMaterials.length,
          materials: overdueMaterials.map(material => ({
            materialId: material.materialId,
            driverId: material.driverId,
            nextPhotoDue: material.nextPhotoDue,
            photoComplianceStatus: material.photoComplianceStatus,
            lastPhotoUpload: material.lastPhotoUpload
          }))
        }
      });

    } catch (error) {
      console.error('❌ Error getting overdue photos:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get overdue photos',
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/material-photos/storage/stats
 * @desc Get storage statistics (Admin only)
 * @access Private - Admin
 */
router.get('/storage/stats', 
  checkAdminMiddleware,
  async (req, res) => {
    try {
      const { driverId } = req.query;
      const stats = await photoUploadService.getStorageStats(driverId);

      res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('❌ Error getting storage stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get storage stats',
        error: error.message
      });
    }
  }
);

module.exports = router;
