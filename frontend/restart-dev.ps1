# Fix Vite Cache Issue - Restart Dev Server
Write-Host "🔧 Fixing Vite Cache Issue..." -ForegroundColor Cyan
Write-Host ""

# Navigate to frontend directory
Set-Location -Path "c:\Users\Aban\Downloads\Faredeal-main\Faredeal-main\frontend"

Write-Host "📁 Current directory: $PWD" -ForegroundColor Yellow
Write-Host ""

# Check if .vite cache exists
if (Test-Path "node_modules\.vite") {
    Write-Host "🗑️  Removing Vite cache..." -ForegroundColor Red
    Remove-Item -Recurse -Force "node_modules\.vite"
    Write-Host "✅ Vite cache cleared!" -ForegroundColor Green
} else {
    Write-Host "ℹ️  No Vite cache found (already clean)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🚀 Starting development server..." -ForegroundColor Cyan
Write-Host ""

# Start dev server
npm run dev
