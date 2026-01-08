#!/usr/bin/env node

/**
 * Setup Email Service
 * Installs dependencies and verifies configuration
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('📧 Setting up Email Service for FAREDEAL...\n');

// Check if .env exists
const envPath = '.env';
if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found');
  console.log('📋 Please create .env with SendGrid configuration');
  process.exit(1);
}

// Check for SENDGRID_API_KEY
const envContent = fs.readFileSync(envPath, 'utf-8');
if (!envContent.includes('SENDGRID_API_KEY')) {
  console.error('❌ SENDGRID_API_KEY not found in .env');
  console.log('📋 Please add: SENDGRID_API_KEY=your_api_key');
  process.exit(1);
}

console.log('✅ .env configuration found');

// Check if node_modules exists
if (!fs.existsSync('node_modules')) {
  console.log('\n📦 Installing dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed');
  } catch (error) {
    console.error('❌ Failed to install dependencies');
    console.error('Run: npm install');
    process.exit(1);
  }
} else {
  console.log('✅ Dependencies already installed');
}

// Check if @sendgrid/mail is installed
const packageJsonPath = 'package.json';
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
if (!packageJson.dependencies['@sendgrid/mail']) {
  console.log('\n📦 Installing @sendgrid/mail...');
  try {
    execSync('npm install @sendgrid/mail', { stdio: 'inherit' });
    console.log('✅ @sendgrid/mail installed');
  } catch (error) {
    console.error('❌ Failed to install @sendgrid/mail');
    process.exit(1);
  }
} else {
  console.log('✅ @sendgrid/mail is installed');
}

console.log('\n✅ Email service setup complete!');
console.log('\n📝 Next steps:');
console.log('1. Run: node test-email.js (to test sending)');
console.log('2. Update SENDGRID_FROM_EMAIL with a verified sender');
console.log('3. Integrate email functions into your application');
