// emailTest.js

const EmailService = require('./src/utils/emailService');

const testEmail = 'carljustineglean@gmail.com'; // ✅ Replace this with your email
const testCode = EmailService.generateVerificationCode();

EmailService.sendVerificationEmail(testEmail, testCode)
  .then((result) => {
    if (result) {
      console.log('✅ Verification email sent successfully.');
    } else {
      console.log('❌ Failed to send verification email.');
    }
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
  });
