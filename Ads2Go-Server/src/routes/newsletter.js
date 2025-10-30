const express = require('express');
const router = express.Router();
const Newsletter = require('../models/Newsletter');
const EmailService = require('../utils/emailService');
const multer = require('multer');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Subscribe to newsletter
router.post('/subscribe', async (req, res) => {
  try {
    const { email, source = 'contact_form' } = req.body;

    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Check if email already exists
    const existingSubscription = await Newsletter.findOne({ email: email.toLowerCase() });
    
    if (existingSubscription) {
      if (existingSubscription.isActive) {
        return res.status(400).json({
          success: false,
          message: 'This email is already subscribed to our newsletter'
        });
      } else {
        // Reactivate subscription
        existingSubscription.isActive = true;
        existingSubscription.subscribedAt = new Date();
        await existingSubscription.save();
        
        // Send welcome back email
        await EmailService.sendNewsletterWelcomeEmail(email, 'Welcome Back!');
        
        return res.json({
          success: true,
          message: 'Successfully resubscribed to our newsletter!'
        });
      }
    }

    // Create new subscription
    const newsletter = new Newsletter({
      email: email.toLowerCase(),
      subscribedAt: new Date(),
      isActive: true,
      source: source
    });

    await newsletter.save();

    // Send welcome email
    try {
      await EmailService.sendNewsletterWelcomeEmail(email, 'Welcome to Ads2Go Newsletter!');
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail the subscription if email fails
    }

    res.json({
      success: true,
      message: 'Successfully subscribed to our newsletter!'
    });

  } catch (error) {
    console.error('Newsletter subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to subscribe to newsletter. Please try again later.'
    });
  }
});

// Check subscription status
router.get('/status', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email parameter is required'
      });
    }

    const subscription = await Newsletter.findOne({ 
      email: email.toLowerCase(),
      isActive: true 
    });

    res.json({
      success: true,
      isSubscribed: !!subscription
    });

  } catch (error) {
    console.error('Newsletter status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check subscription status'
    });
  }
});

// Unsubscribe from newsletter
router.post('/unsubscribe', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email parameter is required'
      });
    }

    const subscription = await Newsletter.findOne({ email: email.toLowerCase() });
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Email not found in our newsletter list'
      });
    }

    subscription.isActive = false;
    subscription.unsubscribedAt = new Date();
    await subscription.save();

    res.json({
      success: true,
      message: 'Successfully unsubscribed from our newsletter'
    });

  } catch (error) {
    console.error('Newsletter unsubscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unsubscribe from newsletter'
    });
  }
});

// Get all subscribers (admin only)
router.get('/subscribers', async (req, res) => {
  try {
    // In a real app, you'd check for admin authentication here
    const allSubscribers = await Newsletter.find({})
      .sort({ subscribedAt: -1 });

    const activeSubscribers = allSubscribers.filter(sub => sub.isActive);
    const inactiveSubscribers = allSubscribers.filter(sub => !sub.isActive);

    res.json({
      success: true,
      subscribers: allSubscribers, // Return all subscribers, not just active ones
      total: allSubscribers.length,
      active: activeSubscribers.length,
      inactive: inactiveSubscribers.length
    });

  } catch (error) {
    console.error('Get subscribers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscribers'
    });
  }
});

// Upload newsletter image to Firebase Storage
router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }

    console.log('📤 Newsletter image upload request:', {
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      fileName: req.file.originalname
    });

    // Get Firebase Storage bucket
    const bucket = admin.storage().bucket();
    
    // Create unique filename
    const fileExt = req.file.originalname.split('.').pop().toLowerCase();
    const fileName = `${Date.now()}_${uuidv4()}.${fileExt}`;
    const filePath = `newsletters/images/${fileName}`;
    
    // Create file reference
    const file = bucket.file(filePath);
    
    // Upload file to Firebase
    await file.save(req.file.buffer, {
      metadata: {
        contentType: req.file.mimetype,
        metadata: {
          uploadedAt: new Date().toISOString(),
          purpose: 'newsletter-image'
        }
      },
      public: true, // Make image publicly accessible
      resumable: false
    });

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    
    console.log('✅ Newsletter image uploaded successfully:', publicUrl);

    res.json({
      success: true,
      imageUrl: publicUrl,
      message: 'Image uploaded successfully'
    });

  } catch (error) {
    console.error('❌ Newsletter image upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload image'
    });
  }
});

// Send newsletter email to subscribers
router.post('/send-email', async (req, res) => {
  try {
    const { subject, message, imageUrl, subscriberIds, sendToAllActive } = req.body;

    console.log('📧 Newsletter send request:', {
      subject,
      messageLength: message?.length,
      hasImage: !!imageUrl,
      subscriberIdsCount: subscriberIds?.length,
      sendToAllActive
    });

    // Validate required fields
    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Subject and message are required'
      });
    }

    // Determine which subscribers to send to
    let subscribers;
    
    if (sendToAllActive) {
      // Get ALL active subscribers (ignore any filters)
      subscribers = await Newsletter.find({ isActive: true });
      console.log(`📬 Sending to ALL active subscribers: ${subscribers.length}`);
    } else if (subscriberIds && subscriberIds.length > 0) {
      // Get specific selected subscribers
      subscribers = await Newsletter.find({
        _id: { $in: subscriberIds },
        isActive: true // Only send to active subscribers
      });
      console.log(`📬 Sending to ${subscribers.length} selected subscribers`);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either sendToAllActive must be true or subscriberIds must be provided'
      });
    }

    // Check if we have subscribers to send to
    if (subscribers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active subscribers found to send email to'
      });
    }

    // Send email using EmailService
    const emailSent = await EmailService.sendNewsletterEmailWithImage(
      subject,
      message,
      imageUrl || null,
      subscribers
    );

    if (!emailSent) {
      throw new Error('Failed to send newsletter email');
    }

    // Update lastEmailSent and emailCount for each subscriber
    const subscriberIds_to_update = subscribers.map(sub => sub._id);
    const now = new Date();
    
    await Newsletter.updateMany(
      { _id: { $in: subscriberIds_to_update } },
      {
        $set: { lastEmailSent: now },
        $inc: { emailCount: 1 }
      }
    );

    console.log(`✅ Newsletter sent and ${subscribers.length} subscribers updated`);

    res.json({
      success: true,
      message: `Newsletter sent successfully to ${subscribers.length} subscriber(s)`,
      recipientCount: subscribers.length
    });

  } catch (error) {
    console.error('❌ Newsletter send error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send newsletter email'
    });
  }
});

module.exports = router;
