// Simple script to verify Gmail App Password setup
require('dotenv').config({ path: '.env.development' });
const nodemailer = require('nodemailer');

async function verifyGmailSetup() {
  console.log('🔍 Verifying Gmail App Password Setup...');
  console.log('=====================================');
  
  // Check if credentials are set
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('❌ EMAIL_USER or EMAIL_PASSWORD not set in .env file');
    return;
  }
  
  console.log('📧 Email User:', process.env.EMAIL_USER);
  console.log('🔑 Password Length:', process.env.EMAIL_PASSWORD.length);
  
  // Check if password looks like an App Password (16 characters)
  if (process.env.EMAIL_PASSWORD.length !== 16) {
    console.warn('⚠️  Warning: App Password should be 16 characters long');
    console.warn('   Current password length:', process.env.EMAIL_PASSWORD.length);
    console.warn('   Make sure you\'re using an App Password, not your regular password');
  }
  
  // Create transporter with current settings
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
  
  console.log('\n🔧 Testing Gmail Connection...');
  
  try {
    await transporter.verify();
    console.log('✅ SUCCESS: Gmail authentication working!');
    console.log('🎉 Your email notifications should now work properly!');
    
    // Test sending a simple email
    console.log('\n📧 Testing Email Send...');
    const result = await transporter.sendMail({
      from: `Ads2Go <${process.env.EMAIL_USER}>`,
      to: 'nicofaith011@gmail.com',
      subject: 'Test Email from Ads2Go',
      html: '<h1>Success!</h1><p>Your email notifications are now working properly.</p>'
    });
    
    console.log('✅ SUCCESS: Test email sent to nicofaith011@gmail.com!');
    console.log('📬 Check your inbox (and spam folder) for the test email.');
    
  } catch (error) {
    console.error('❌ FAILED: Gmail authentication error');
    console.error('Error:', error.message);
    
    if (error.message.includes('535-5.7.8')) {
      console.log('\n💡 SOLUTION: You need to set up Gmail App Password');
      console.log('   1. Enable 2-Factor Authentication on your Gmail account');
      console.log('   2. Go to Google Account > Security > App passwords');
      console.log('   3. Generate an App Password for "Mail"');
      console.log('   4. Replace EMAIL_PASSWORD in your .env file with the App Password');
      console.log('   📖 Full guide: GMAIL_SETUP_GUIDE.md');
    }
  }
}

verifyGmailSetup().catch(console.error);
