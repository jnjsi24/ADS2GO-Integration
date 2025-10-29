const express = require('express');
const router = express.Router();
const ContactMessage = require('../models/ContactMessage');
const Newsletter = require('../models/Newsletter');

// Submit contact form from landing page
router.post('/send', async (req, res) => {
  try {
    const { name, email, message } = req.body;

    // Validate required fields
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and message'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Save contact message
    const contactMessage = new ContactMessage({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      message: message.trim(),
      status: 'PENDING',
      category: 'CONTACT_US'
    });

    await contactMessage.save();
    console.log(`✅ Contact message saved: ${email}`);

    // Subscribe email to newsletter
    try {
      const User = require('../models/User');
      
      // Check if email belongs to a registered user (any user, even archived)
      const user = await User.findOne({ email: email.toLowerCase() });
      
      // Determine source and active status
      let newsletterSource;
      let shouldBeActive;
      
      if (user) {
        // Registered user (active or archived) - source is always 'registration'
        newsletterSource = 'registration';
        shouldBeActive = !user.isArchived; // Active only if not archived
      } else {
        // Not a user - new contact form submission
        newsletterSource = 'contact_form';
        shouldBeActive = true; // Active for new submissions
      }
      
      const existingSubscription = await Newsletter.findOne({ 
        email: email.toLowerCase() 
      });

      if (!existingSubscription) {
        // Create new newsletter subscription
        const newsletter = new Newsletter({
          email: email.toLowerCase(),
          subscribedAt: new Date(),
          isActive: shouldBeActive,
          source: newsletterSource
        });

        await newsletter.save();
        console.log(`✅ Email subscribed to newsletter (source: ${newsletterSource}, active: ${shouldBeActive}): ${email}`);
      } else {
        // Update existing subscription if needed
        let updated = false;
        
        if (existingSubscription.source !== newsletterSource) {
          existingSubscription.source = newsletterSource;
          updated = true;
        }
        
        // Only update isActive if user exists (respect deletion for archived users)
        if (user && existingSubscription.isActive !== shouldBeActive) {
          existingSubscription.isActive = shouldBeActive;
          updated = true;
        } else if (!user && !existingSubscription.isActive) {
          // Non-user submitting contact form - reactivate them
          existingSubscription.isActive = true;
          updated = true;
        }
        
        if (updated) {
          await existingSubscription.save();
          const statusNote = user && user.isArchived ? ' (archived user - kept inactive)' : '';
          console.log(`✅ Updated newsletter (source: ${newsletterSource}, active: ${existingSubscription.isActive}): ${email}${statusNote}`);
        } else {
          console.log(`ℹ️  Email already in newsletter database with correct source and status: ${email}`);
        }
      }
    } catch (newsletterError) {
      // Don't fail the contact form if newsletter subscription fails
      console.error('⚠️  Newsletter subscription error:', newsletterError.message);
    }

    res.json({
      success: true,
      message: 'Your message has been sent successfully! We will get back to you soon.'
    });

  } catch (error) {
    console.error('❌ Contact form submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send your message. Please try again later.'
    });
  }
});

// Get all contact messages (admin only)
router.get('/messages', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    const filters = {};
    if (status) {
      filters.status = status.toUpperCase();
    }

    const messages = await ContactMessage.getAllMessages(filters, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      sort: { createdAt: -1 }
    });

    const totalCount = await ContactMessage.countDocuments(filters);
    const statusCounts = await ContactMessage.getStatusCounts();

    res.json({
      success: true,
      messages,
      totalCount,
      statusCounts
    });

  } catch (error) {
    console.error('❌ Get contact messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contact messages'
    });
  }
});

module.exports = router;

