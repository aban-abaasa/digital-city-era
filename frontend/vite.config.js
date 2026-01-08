import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite"
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');
  const isAdminMode = env.ADMIN_MODE === 'true';
  
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'src': path.resolve(__dirname, './src')
      }
    },
    server: {
      host: '0.0.0.0', // Listen on all network interfaces
      port: isAdminMode ? 7780 : 7779, // Admin portal runs on 7780, regular on 7779
      https: isAdminMode ? true : false, // Force HTTPS for admin portal
      strictPort: false, // Allow fallback to other ports if busy
      headers: isAdminMode ? {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
      } : {},
    },
    // Define global constants
    define: {
      __DEV__: mode === 'development',
      __PROD__: mode === 'production',
    },
    // Ensure environment variables are available
    envPrefix: ['VITE_', 'REACT_APP_']
  }
})
