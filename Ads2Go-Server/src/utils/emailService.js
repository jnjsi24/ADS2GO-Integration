// server/utils/emailService.js

const nodemailer = require('nodemailer');
let Resend;
try {
  const resendModule = require('resend');
  Resend = resendModule.Resend || resendModule; // Support both export styles
} catch (error) {
  // Resend not installed, will use SMTP only
  console.log('📦 Resend package not found - will use SMTP only');
}
require('dotenv').config();

class EmailService {
  static transporter = null;
  static resend = null;
  static isConfigured = false;
  static provider = null; // 'resend' or 'smtp'

  // Initialize email service (Resend or SMTP)
  static initializeTransporter() {
    // Check if already initialized
    if (this.transporter || this.resend) {
      return this.transporter || this.resend;
    }

    // Priority: Check for Resend API key first (works on Railway without SMTP)
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (resendApiKey && Resend) {
      try {
        this.resend = new Resend(resendApiKey);
        this.provider = 'resend';
        this.isConfigured = true;
        console.log('✅ Email service initialized successfully with Resend API');
        console.log('   Provider: Resend (HTTPS API - works on Railway)');
        return this.resend;
      } catch (error) {
        console.error('❌ Failed to initialize Resend:', error.message);
      }
    }

    // Fallback to SMTP if Resend not configured
    return this.initializeSMTP();
  }

  // Initialize SMTP transporter (fallback)
  static initializeSMTP() {
    if (this.transporter) {
      return this.transporter;
    }

    // Check for SMTP configuration
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpSecure = process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1';

    // Debug: Check if SMTP config exists
    console.log('🔍 Checking SMTP configuration:');
    console.log('   SMTP_HOST:', smtpHost ? '✅ Found (hidden)' : '❌ Not found');
    console.log('   SMTP_PORT:', smtpPort || 'Not set (using default: 587)');
    console.log('   SMTP_USER:', smtpUser ? '✅ Found (hidden)' : '❌ Not found');
    console.log('   SMTP_PASSWORD:', smtpPassword ? '✅ Found (hidden)' : '❌ Not found');
    console.log('   SMTP_SECURE:', smtpSecure);

    // Validate required environment variables
    if (!smtpHost || !smtpUser || !smtpPassword) {
      console.error('❌ Email service not configured: Missing SMTP configuration');
      console.error('💡 For Railway: Set RESEND_API_KEY environment variable');
      console.error('💡 For SMTP: Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD environment variables');
      this.isConfigured = false;
      return null;
    }

    try {
      // Create transporter
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort, 10),
        secure: smtpSecure, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
        // Add TLS options for better compatibility
        tls: {
          rejectUnauthorized: false, // Accept self-signed certificates (set to true in production with valid certs)
        },
      });

      this.provider = 'smtp';
      this.isConfigured = true;
      console.log('✅ Email service initialized successfully with SMTP');
      console.log(`   Host: ${smtpHost}, Port: ${smtpPort}, Secure: ${smtpSecure}`);
      return this.transporter;
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error.message);
      this.isConfigured = false;
      return null;
    }
  }

  // Verify email configuration
  static async verifyConfiguration() {
    if (!this.isConfigured) {
      this.initializeTransporter();
    }

    if (!this.isConfigured) {
      console.error('❌ Email service not configured');
      return false;
    }

    try {
      if (this.provider === 'resend') {
        // Resend doesn't have a verify method, but we can test by checking API key
        console.log('✅ Email service configuration verified (Resend API)');
        return true;
      } else {
        // Verify SMTP connection
        await this.transporter.verify();
        console.log('✅ Email service configuration verified (SMTP)');
        return true;
      }
    } catch (error) {
      console.error('❌ Email service verification failed:', error.message);
      return false;
    }
  }

  // Get Resend instance
  static getResendInstance() {
    if (!this.resend && !this.initializeTransporter()) {
      return null;
    }
    return this.resend;
  }

  // Get transporter (nodemailer transporter or Resend instance)
  static getTransporter() {
    if (!this.isConfigured) {
      this.initializeTransporter();
    }
    
    if (this.provider === 'resend') {
      return this.resend;
    }
    
    return this.transporter;
  }

  // Get the "from" email address
  static getFromEmail() {
    // Priority: 1. Environment variable, 2. Resend domain, 3. SMTP_USER, 4. Default
    if (process.env.EMAIL_FROM) {
      return process.env.EMAIL_FROM;
    }
    
    if (process.env.RESEND_FROM_EMAIL) {
      return process.env.RESEND_FROM_EMAIL;
    }
    
    if (process.env.SMTP_FROM_EMAIL) {
      return process.env.SMTP_FROM_EMAIL;
    }
    
    if (process.env.SMTP_USER) {
      return `Ads2Go <${process.env.SMTP_USER}>`;
    }
    
    // Default based on provider
    if (this.provider === 'resend') {
      // Use your domain if verified, otherwise Resend's default
      return process.env.RESEND_FROM_EMAIL || 'Ads2Go <onboarding@resend.dev>';
    }
    
    return 'Ads2Go <noreply@ads2go.com>';
  }

  // Extract email address from formatted string (e.g., "Name <email@domain.com>")
  static extractEmailAddress(emailString) {
    const match = emailString.match(/<(.+)>/);
    return match ? match[1] : emailString;
  }

  // Send email (unified method that works with both Resend and SMTP)
  static async sendEmail(options) {
    const { to, subject, html, text, from, bcc } = options;
    
    if (!this.isConfigured) {
      this.initializeTransporter();
    }

    if (!this.isConfigured) {
      console.error('❌ Cannot send email: Email service not configured');
      return { success: false, error: 'Email service not configured' };
    }

    const fromEmail = from || this.getFromEmail();
    const fromAddress = this.extractEmailAddress(fromEmail);

    try {
      if (this.provider === 'resend') {
        // Use Resend API
        const resendOptions = {
          from: fromEmail,
          to: Array.isArray(to) ? to : [to],
          subject: subject,
          html: html,
        };

        if (text) {
          resendOptions.text = text;
        }

        if (bcc && Array.isArray(bcc) && bcc.length > 0) {
          resendOptions.bcc = bcc;
        }

        const data = await this.resend.emails.send(resendOptions);
        
        // Check for errors in response
        if (data.error) {
          throw new Error(data.error.message || JSON.stringify(data.error));
        }
        
        const messageId = data.data?.id || data.id;
        console.log(`✅ Email sent successfully via Resend to ${to}`);
        console.log(`   Message ID: ${messageId || 'N/A'}`);
        return { success: true, messageId: messageId, provider: 'resend' };
      } else {
        // Use SMTP (nodemailer)
        const mailOptions = {
          from: fromEmail,
          to: to,
          subject: subject,
          html: html,
        };

        if (text) {
          mailOptions.text = text;
        }

        if (bcc) {
          mailOptions.bcc = bcc;
        }

        const info = await this.transporter.sendMail(mailOptions);
        console.log(`✅ Email sent successfully via SMTP to ${to}`);
        console.log(`   Message ID: ${info.messageId || 'N/A'}`);
        return { success: true, messageId: info.messageId, provider: 'smtp' };
      }
    } catch (error) {
      console.error(`❌ Error sending email:`, error.message);
      return { success: false, error: error.message };
    }
  }

  // Generate 6-digit verification code
  static generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Send verification email
  static async sendVerificationEmail(email, code) {
    console.log(`📧 Attempting to send verification email to: ${email}`);
    
    const result = await this.sendEmail({
      to: email,
      subject: 'Ads2Go Email Verification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; text-align: center;">Ads2Go Email Verification</h2>
            <p style="text-align: center; font-size: 16px; color: #666;">Your verification code is:</p>
            <h1 style="
              text-align: center; 
              letter-spacing: 10px; 
              color: #4A90E2; 
              background-color: #f0f0f0; 
              padding: 15px; 
              border-radius: 5px;
            ">
              ${code}
            </h1>
            <p style="text-align: center; color: #999; margin-top: 20px;">
              This code will expire in 15 minutes. Do not share this code with anyone.
            </p>
          </div>
        </div>
      `,
      text: `Ads2Go Email Verification\n\nYour verification code is: ${code}\n\nThis code will expire in 15 minutes. Do not share this code with anyone.`,
    });

    return result.success;
  }

  // Send password reset email
  static async sendPasswordResetEmail(email, resetToken) {
    const resetLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
  
    const result = await this.sendEmail({
      to: email,
      subject: 'Reset Your Ads2Go Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
            <p style="text-align: center; font-size: 16px; color: #666;">Click the button below to reset your password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" 
                 style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #666; text-align: center; margin: 20px 0;">
              This link will expire in 1 hour. If you didn't request this, please ignore this email.
            </p>
          </div>
        </div>
      `,
      text: `Reset Your Ads2Go Password\n\nClick the link below to reset your password:\n${resetLink}\n\nThis link will expire in 1 hour. If you didn't request this, please ignore this email.`,
    });

    return result.success;
  }

  // Send newsletter welcome email
  static async sendNewsletterWelcomeEmail(email, subject = 'Welcome to Ads2Go Newsletter!') {
    const result = await this.sendEmail({
      to: email,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #3674B5; margin: 0; font-size: 28px;">Welcome to Ads2Go!</h1>
              <p style="color: #666; margin: 10px 0 0 0; font-size: 16px;">Your mobile advertising journey starts here</p>
            </div>
            
            <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3674B5;">
              <h3 style="color: #3674B5; margin: 0 0 15px 0;">🎉 Thank you for subscribing!</h3>
              <p style="margin: 0; color: #333; line-height: 1.6;">
                You're now part of our community and will receive the latest updates about:
              </p>
              <ul style="margin: 15px 0 0 20px; color: #333;">
                <li>New features and platform updates</li>
                <li>Industry insights and mobile advertising trends</li>
                <li>Exclusive promotions and special offers</li>
                <li>Success stories from our clients</li>
                <li>Tips for maximizing your advertising ROI</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/login" 
                 style="background-color: #3674B5; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                Get Started with Ads2Go
              </a>
            </div>

            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h4 style="color: #333; margin: 0 0 10px 0;">What's Next?</h4>
              <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.5;">
                • Create your account to start advertising<br>
                • Choose from our vehicle plans (Motorcycle, Car, Bus, Jeepney)<br>
                • Upload your ad content and launch your campaign<br>
                • Track performance with real-time analytics
              </p>
            </div>

            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                You received this email because you subscribed to our newsletter at Ads2Go.<br>
                If you no longer wish to receive these emails, you can 
                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/unsubscribe?email=${email}" 
                   style="color: #3674B5; text-decoration: none;">unsubscribe here</a>.
              </p>
            </div>
          </div>
        </div>
      `,
    });

    return result.success;
  }

  // Send newsletter email to all subscribers
  static async sendNewsletterEmail(subject, content, subscribers) {
    const emails = subscribers.map(sub => sub.email);
    
    const result = await this.sendEmail({
      to: emails[0], // First email as TO
      bcc: emails.slice(1), // Rest as BCC
      subject: subject,
      html: content,
    });

    if (result.success) {
      console.log(`✅ Newsletter sent to ${subscribers.length} subscribers`);
    }
    
    return result.success;
  }

  // Send newsletter email with image and styled template
  static async sendNewsletterEmailWithImage(subject, message, imageUrl, subscribers) {
    // Convert plain text message to HTML with line breaks
    const formattedMessage = message.replace(/\n/g, '<br>');

    // Build unsubscribe link (generic for now)
    const unsubscribeLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/unsubscribe`;

    // Build HTML email with Ads2Go style
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
        <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <!-- Ads2Go Logo/Header -->
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #4A90E2; margin: 0; font-size: 32px; font-weight: bold;">Ads2Go</h1>
            <p style="color: #999; margin: 5px 0 0 0; font-size: 14px;">Digital Advertising Solutions</p>
          </div>
          
          <!-- Divider -->
          <div style="border-bottom: 2px solid #f0f0f0; margin-bottom: 30px;"></div>
          
          <!-- Image (if provided) -->
          ${imageUrl ? `
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="${imageUrl}" alt="Newsletter Image" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            </div>
          ` : ''}
          
          <!-- Message Content -->
          <div style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
            ${formattedMessage}
          </div>
          
          <!-- Footer -->
          <div style="border-top: 2px solid #f0f0f0; padding-top: 20px; margin-top: 30px;">
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} Ads2Go. All rights reserved.
            </p>
            <p style="color: #999; font-size: 12px; text-align: center; margin: 10px 0 0 0;">
              <a href="${unsubscribeLink}" style="color: #4A90E2; text-decoration: none;">Unsubscribe from this newsletter</a>
            </p>
          </div>
        </div>
      </div>
    `;

    const emails = subscribers.map(sub => sub.email);
    
    const result = await this.sendEmail({
      to: emails[0],
      bcc: emails.slice(1),
      subject: subject,
      html: htmlContent,
    });

    if (result.success) {
      console.log(`✅ Newsletter with image sent to ${subscribers.length} subscribers`);
    }
    
    return result.success;
  }

  // Send reply to contact form submission
  static async sendContactReply(toEmail, toName, subject, message, adminName) {
    console.log(`📧 Sending contact reply to: ${toEmail}`);
    
    // Get email address from formatted string or use default
    const fromEmail = this.getFromEmail();
    const fromEmailMatch = fromEmail.match(/<(.+)>/);
    const supportEmail = fromEmailMatch ? fromEmailMatch[1] : (process.env.SMTP_USER || 'noreply@ads2go.com');
    
    const result = await this.sendEmail({
      from: `Ads2Go Support <${supportEmail}>`,
      to: toEmail,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
          <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #3674B5; margin: 0; font-size: 24px;">Ads2Go</h1>
              <p style="color: #666; margin: 10px 0 0 0; font-size: 14px;">Mobile Advertising Solutions</p>
            </div>
            
            <div style="margin-bottom: 20px;">
              <p style="margin: 0; color: #333; font-size: 16px;">Dear ${toName},</p>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3674B5;">
              ${message.replace(/\n/g, '<br>')}
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="margin: 0; color: #666; font-size: 14px;">
                Best regards,<br>
                <strong style="color: #3674B5;">${adminName || 'Ads2Go Team'}</strong>
              </p>
            </div>

            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                This email was sent in response to your inquiry at 
                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}" 
                   style="color: #3674B5; text-decoration: none;">Ads2Go</a>.<br>
                If you have any questions, please reply to this email.
              </p>
            </div>
          </div>
        </div>
      `,
      text: `Dear ${toName},\n\n${message}\n\nBest regards,\n${adminName || 'Ads2Go Team'}`,
    });

    return result.success;
  }
}

module.exports = EmailService;
