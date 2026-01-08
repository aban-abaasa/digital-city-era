#!/usr/bin/env node

/**
 * Diagnose SendGrid Configuration
 */

import 'dotenv/config.js';
import sgMail from '@sendgrid/mail';

console.log('🔍 Diagnosing SendGrid Configuration...\n');

const apiKey = process.env.SENDGRID_API_KEY;
const fromEmail = process.env.SENDGRID_FROM_EMAIL;

console.log('📋 Configuration:');
console.log(`   API Key starts with: ${apiKey?.substring(0, 10)}...`);
console.log(`   From Email: ${fromEmail}`);
console.log(`   API Key length: ${apiKey?.length || 0}`);

// Verify API key format
if (!apiKey) {
  console.error('\n❌ SENDGRID_API_KEY is not set');
  console.log('📝 Add to .env: SENDGRID_API_KEY=your_key_here');
  process.exit(1);
}

if (!apiKey.startsWith('SG.')) {
  console.error('\n❌ API key format is invalid');
  console.log('📝 API key should start with "SG."');
  console.log(`   Received: ${apiKey.substring(0, 20)}...`);
  process.exit(1);
}

console.log('\n✅ API Key format is valid');

// Check from email
if (!fromEmail) {
  console.error('\n❌ SENDGRID_FROM_EMAIL is not set');
  console.log('📝 Add to .env: SENDGRID_FROM_EMAIL=noreply@yourcompany.com');
  process.exit(1);
}

console.log('✅ From email is configured');

console.log('\n⚠️  Possible Issues:');
console.log('1. API key is correct but from email is not verified in SendGrid');
console.log('2. API key has invalid permissions');
console.log('3. SendGrid account may have restrictions');
console.log('\n📝 To fix:');
console.log('1. Go to https://app.sendgrid.com');
console.log('2. Check Settings → Sender Authentication');
console.log('3. Verify your sender email address');
console.log('4. Ensure your API key has mail.send permissions');
console.log('\n💡 Tip: For testing, use a SendGrid verified sender email');
