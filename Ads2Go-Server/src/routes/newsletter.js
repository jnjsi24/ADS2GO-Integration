const express = require('express');
const router = express.Router();
const Newsletter = require('../models/Newsletter');
const EmailService = require('../utils/emailService');

// Subscribe to newsletter
router.post('/subscribe', async (req, res) => {
  try {
    const { email, source = 'landing_page' } = req.body;

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

module.exports = router;
