// server/utils/emailService.js

const { Resend } = require('resend');
require('dotenv').config();

class EmailService {
  static resend = null;
  static isConfigured = false;

  // Initialize Resend client
  static initializeTransporter() {
    if (this.resend) {
      return this.resend;
    }

    // Debug: Check if RESEND_API_KEY exists (don't log the actual key for security)
    console.log('🔍 Checking RESEND_API_KEY:', process.env.RESEND_API_KEY ? '✅ Found (hidden)' : '❌ Not found');
    console.log('🔍 All env vars containing "RESEND":', Object.keys(process.env).filter(k => k.includes('RESEND')).join(', ') || 'None');

    // Validate required environment variable
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ Email service not configured: Missing RESEND_API_KEY');
      console.error('💡 Make sure RESEND_API_KEY is added in Railway and the service has been restarted');
      this.isConfigured = false;
      return null;
    }

    try {
      this.resend = new Resend(process.env.RESEND_API_KEY);
      this.isConfigured = true;
      console.log('✅ Email service initialized successfully with Resend');
      return this.resend;
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

    if (!this.isConfigured || !this.resend) {
      console.error('❌ Email service not configured');
      return false;
    }

    try {
      // Resend doesn't need verification like SMTP - just check if API key is set
      console.log('✅ Email service configuration verified (Resend API)');
      return true;
    } catch (error) {
      console.error('❌ Email service verification failed:', error.message);
      return false;
    }
  }

  // Get Resend instance directly
  static getResendInstance() {
    if (!this.resend && !this.initializeTransporter()) {
      console.error('❌ EmailService: Failed to initialize Resend');
      console.error('❌ EmailService: Check RESEND_API_KEY environment variable');
      return null;
    }
    return this.resend;
  }

  // Get transporter (wrapper for backward compatibility with old nodemailer code)
  static getTransporter() {
    if (!this.resend && !this.initializeTransporter()) {
      console.error('❌ EmailService: Failed to initialize Resend');
      console.error('❌ EmailService: Check RESEND_API_KEY environment variable');
      return null;
    }

    // Capture resend instance for closure
    const resend = this.resend;

    // Return a wrapper object with sendMail method for backward compatibility
    return {
      sendMail: async (mailOptions) => {
        try {
          // Use provided from, or fallback to default
          const fromEmail = mailOptions.from || this.getFromEmail();
          
          const { data, error } = await resend.emails.send({
            from: fromEmail,
            to: mailOptions.to,
            subject: mailOptions.subject,
            html: mailOptions.html,
            text: mailOptions.text,
            cc: mailOptions.cc,
            bcc: mailOptions.bcc,
            replyTo: mailOptions.replyTo,
            attachments: mailOptions.attachments
          });

          if (error) {
            throw new Error(error.message || 'Failed to send email');
          }

          // Return in nodemailer-compatible format
          return {
            messageId: data?.id || 'unknown',
            accepted: [mailOptions.to].flat(),
            rejected: [],
            pending: [],
            response: 'Email sent via Resend API'
          };
        } catch (error) {
          console.error('❌ Error in sendMail wrapper:', error.message);
          throw error;
        }
      }
    };
  }

  // Get the "from" email address (uses env var or default)
  static getFromEmail() {
    // Priority: 1. Environment variable, 2. Default Resend domain
    return process.env.RESEND_FROM_EMAIL || 'Ads2Go <onboarding@resend.dev>';
  }

  // Generate 6-digit verification code
  static generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Send verification email
  static async sendVerificationEmail(email, code) {
    console.log(`📧 Attempting to send verification email to: ${email}`);
    
    const resend = this.getResendInstance();
    if (!resend) {
      console.error('❌ Cannot send email: Email service not configured');
      console.error('   Please check your .env file for RESEND_API_KEY');
      return false;
    }

    try {
      const { data, error } = await resend.emails.send({
        from: this.getFromEmail(),
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
        `
      });

      if (error) {
        console.error('❌ Error sending verification email:', error.message);
        return false;
      }

      console.log(`✅ Verification email sent successfully to ${email}`);
      console.log(`   Email ID: ${data?.id || 'N/A'}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending verification email:', error.message);
      return false;
    }
  }

  // Send password reset email
  static async sendPasswordResetEmail(email, resetToken) {
    const resend = this.getResendInstance();
    if (!resend) {
      console.error('❌ Cannot send email: Email service not configured');
      return false;
    }

    const resetLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
  
    try {
      const { data, error } = await resend.emails.send({
        from: this.getFromEmail(),
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
        `
      });

      if (error) {
        console.error('❌ Error sending password reset email:', error.message);
        return false;
      }

      console.log(`✅ Password reset email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending password reset email:', error.message);
      return false;
    }
  }

  // Send newsletter welcome email
  static async sendNewsletterWelcomeEmail(email, subject = 'Welcome to Ads2Go Newsletter!') {
    const resend = this.getResendInstance();
    if (!resend) {
      console.error('❌ Cannot send email: Email service not configured');
      return false;
    }

    try {
      const { data, error } = await resend.emails.send({
        from: this.getFromEmail(),
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
        `
      });

      if (error) {
        console.error('❌ Error sending newsletter welcome email:', error.message);
        return false;
      }

      console.log(`✅ Newsletter welcome email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending newsletter welcome email:', error.message);
      return false;
    }
  }

  // Send newsletter email to all subscribers
  static async sendNewsletterEmail(subject, content, subscribers) {
    const resend = this.getResendInstance();
    if (!resend) {
      console.error('❌ Cannot send email: Email service not configured');
      return false;
    }

    try {
      // Resend supports BCC, send to all subscribers with BCC
      const emails = subscribers.map(sub => sub.email);
      
      const { data, error } = await resend.emails.send({
        from: this.getFromEmail(),
        to: emails[0], // First email as TO
        bcc: emails.slice(1), // Rest as BCC
        subject: subject,
        html: content
      });

      if (error) {
        console.error('❌ Error sending newsletter email:', error.message);
        return false;
      }

      console.log(`✅ Newsletter sent to ${subscribers.length} subscribers`);
      return true;
    } catch (error) {
      console.error('❌ Error sending newsletter email:', error.message);
      return false;
    }
  }

  // Send newsletter email with image and styled template
  static async sendNewsletterEmailWithImage(subject, message, imageUrl, subscribers) {
    const resend = this.getResendInstance();
    if (!resend) {
      console.error('❌ Cannot send email: Email service not configured');
      return false;
    }

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

    try {
      const emails = subscribers.map(sub => sub.email);
      
      const { data, error } = await resend.emails.send({
        from: this.getFromEmail(),
        to: emails[0],
        bcc: emails.slice(1),
        subject: subject,
        html: htmlContent
      });

      if (error) {
        console.error('❌ Error sending newsletter email with image:', error.message);
        return false;
      }

      console.log(`✅ Newsletter with image sent to ${subscribers.length} subscribers`);
      return true;
    } catch (error) {
      console.error('❌ Error sending newsletter email with image:', error.message);
      return false;
    }
  }

  // Send reply to contact form submission
  static async sendContactReply(toEmail, toName, subject, message, adminName) {
    console.log(`📧 Sending contact reply to: ${toEmail}`);
    
    const resend = this.getResendInstance();
    if (!resend) {
      console.error('❌ Cannot send email: Email service not configured');
      return false;
    }

    try {
      // Get email address from formatted string or use default
      const fromEmailMatch = this.getFromEmail().match(/<(.+)>/);
      const supportEmail = fromEmailMatch ? fromEmailMatch[1] : 'onboarding@resend.dev';
      
      const { data, error } = await resend.emails.send({
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
        `
      });

      if (error) {
        console.error('❌ Error sending contact reply:', error.message);
        return false;
      }

      console.log(`✅ Contact reply sent successfully to ${toEmail}`);
      console.log(`   Email ID: ${data?.id || 'N/A'}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending contact reply:', error.message);
      return false;
    }
  }
}

module.exports = EmailService;
