#!/usr/bin/env node

/**
 * Test Email Service
 * Sends a test email to verify SendGrid integration
 */

import 'dotenv/config.js';
import emailService from './src/services/emailService.js';

async function testEmail() {
  console.log('🧪 Testing SendGrid Email Service...\n');

  // Test recipient - change this to your email
  const testEmail = 'test@example.com';
  const testName = 'Test User';

  try {
    console.log(`📧 Sending test email to: ${testEmail}\n`);

    // Test sending admin signup email
    const result = await emailService.sendAdminSignupEmail(
      testEmail,
      testName,
      'http://localhost:5173/admin-auth'
    );

    if (result.success) {
      console.log('✅ Email sent successfully!');
      console.log('\n📋 Email Details:');
      console.log(`   To: ${testEmail}`);
      console.log(`   Name: ${testName}`);
      console.log(`   Type: Admin Signup Confirmation`);
      console.log('\n✨ Check your inbox for the email.');
      console.log('📊 Or visit SendGrid Activity log: https://app.sendgrid.com/email_activity');
    } else {
      console.error('❌ Email failed to send');
      console.error('📋 Error:', result.message);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test failed with error:');
    console.error('📋 Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check if SENDGRID_API_KEY is set in .env');
    console.error('2. Verify API key format (should start with SG.)');
    console.error('3. Ensure @sendgrid/mail is installed: npm install');
    console.error('4. Check SendGrid account status and limits');
    process.exit(1);
  }
}

// Run test
testEmail();
