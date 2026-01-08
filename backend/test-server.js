// Test Server Startup Script
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

console.log('🔧 Environment Check:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Loaded' : '❌ Missing');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ Loaded' : '❌ Missing');
console.log('PORT:', process.env.PORT || '3001');
console.log('');

// Import and start the server
import('./src/index.js')
  .then(() => {
    console.log('✅ Server module loaded successfully');
  })
  .catch((error) => {
    console.error('❌ Error loading server:', error.message);
    process.exit(1);
  });
