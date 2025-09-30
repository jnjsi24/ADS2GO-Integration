# Gmail App Password Setup Guide

## 🚨 Current Issue
Your email notifications are failing with this error:
```
535-5.7.8 Username and Password not accepted
```

This means Gmail is rejecting your authentication because you're using a regular password instead of an App Password.

## 🔧 Solution: Set Up Gmail App Password

### Step 1: Enable 2-Factor Authentication
1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Click on **Security** in the left sidebar
3. Under "Signing in to Google", find **2-Step Verification**
4. If not enabled, click **Get started** and follow the setup process
5. You'll need a phone number to receive verification codes

### Step 2: Generate App Password
1. In Google Account Settings, go to **Security**
2. Under "Signing in to Google", click **App passwords**
3. You might need to sign in again
4. Select **Mail** as the app type
5. Select **Other (Custom name)** and type "Ads2Go Server"
6. Click **Generate**
7. **COPY THE 16-CHARACTER PASSWORD** (it looks like: `abcd efgh ijkl mnop`)

### Step 3: Update Your .env File
1. Open your `.env` file in the Ads2Go-Server directory
2. Find the line: `EMAIL_PASSWORD=your_current_password`
3. Replace it with: `EMAIL_PASSWORD=abcd efgh ijkl mnop` (use the actual App Password from Step 2)
4. **Important**: Remove all spaces from the password (it should be: `abcdefghijklmnop`)
5. Save the file

### Step 4: Test the Fix
Run this command to test:
```bash
cd /Users/Nico_Enriquez/Desktop/ADS2GO-Integration/Ads2Go-Server
node test-email-send.js
```

## 🔍 Troubleshooting

### If you can't find "App passwords":
- Make sure 2-Factor Authentication is enabled
- Try accessing it directly: https://myaccount.google.com/apppasswords

### If the password still doesn't work:
- Make sure there are no spaces in the password
- Make sure you're using the App Password, not your regular Gmail password
- Try generating a new App Password

### Alternative Solution: Use a Different Email Service
If Gmail continues to cause issues, consider switching to:
- **SendGrid** (recommended for production)
- **Mailgun**
- **AWS SES**

## 📧 What Will Work After This Fix
- ✅ Ad approval emails to users
- ✅ Payment confirmation emails
- ✅ Driver notification emails
- ✅ Email verification codes
- ✅ Password reset emails
- ✅ Newsletter emails

## 🎯 Expected Result
After completing these steps, you should see:
```
✅ SUCCESS: Verification email sent to nicofaith011@gmail.com!
✅ SUCCESS: Ad approval email sent to nicofaith011@gmail.com!
✅ SUCCESS: Payment confirmation email sent to nicofaith011@gmail.com!
```
