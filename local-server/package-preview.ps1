$ErrorActionPreference = 'Stop'

$localServerRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $localServerRoot
$stageId = [Guid]::NewGuid().ToString('N')
$stageRoot = Join-Path ([System.IO.Path]::GetTempPath()) "dce-local-server-package-$stageId"
$stagedPackage = Join-Path $stageRoot 'local-server'
$downloadsDirectory = Join-Path $projectRoot 'frontend\public\downloads'
$cloudMigrationsDirectory = Join-Path $projectRoot 'frontend\public\local-server-migrations'
$archivePath = Join-Path $downloadsDirectory 'business-local-server-installer.zip'
$frontendDist = Join-Path $projectRoot 'frontend\dist'
$distMigrationsDirectory = Join-Path $frontendDist 'local-server-migrations'

if (-not (Test-Path -LiteralPath (Join-Path $frontendDist 'index.html'))) {
  throw 'Build the frontend first (npm run build in frontend); the installer bundle includes its offline-capable app shell.'
}

New-Item -ItemType Directory -Path $stagedPackage -Force | Out-Null
New-Item -ItemType Directory -Path $downloadsDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $cloudMigrationsDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $distMigrationsDirectory -Force | Out-Null

$migrationFiles = @(
  'ADD_BUSINESS_LOCAL_SYNC_CONTROL_PLANE.sql',
  'ADD_BUSINESS_LOCAL_TEAM_MESSAGE_SYNC.sql',
  'ADD_BUSINESS_LOCAL_SYNC_PROTOCOL_V2.sql',
  'ADD_BUSINESS_LOCAL_CATALOG_SYNC.sql',
  # Optional fifth migration: lets owner/manager stock changes made on a server reach cloud inventory
  'ADD_BUSINESS_LOCAL_STOCK_ADJUSTMENTS.sql',
  # Sixth migration: a server paired to a business profile syncs products and stock with the profile's store
  'ADD_BUSINESS_LOCAL_PROFILE_STORE_SYNC.sql'
)
foreach ($migrationFile in $migrationFiles) {
  $migrationPath = Join-Path $projectRoot "backend\database\migrations\$migrationFile"
  Copy-Item -LiteralPath $migrationPath -Destination $cloudMigrationsDirectory -Force
  Copy-Item -LiteralPath $migrationPath -Destination $distMigrationsDirectory -Force
}
Copy-Item -LiteralPath (Join-Path $projectRoot 'LOCAL_BUSINESS_SERVER.md') -Destination (Join-Path $projectRoot 'frontend\public\LOCAL_BUSINESS_SERVER.md') -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'LOCAL_BUSINESS_SERVER.md') -Destination (Join-Path $frontendDist 'LOCAL_BUSINESS_SERVER.md') -Force

try {
  Copy-Item -LiteralPath (Join-Path $localServerRoot 'agent') -Destination $stagedPackage -Recurse
  Copy-Item -LiteralPath (Join-Path $localServerRoot 'installers') -Destination $stagedPackage -Recurse
  Copy-Item -LiteralPath (Join-Path $localServerRoot 'web') -Destination $stagedPackage -Recurse
  New-Item -ItemType Directory -Path (Join-Path $stagedPackage 'web\app') -Force | Out-Null
  Get-ChildItem -LiteralPath $frontendDist -Force |
    Where-Object { $_.Name -ne 'downloads' } |
    Copy-Item -Destination (Join-Path $stagedPackage 'web\app') -Recurse -Force
  Copy-Item -LiteralPath (Join-Path $localServerRoot 'INSTALL_PREVIEW.md') -Destination $stagedPackage
  Compress-Archive -Path $stagedPackage -DestinationPath $archivePath -CompressionLevel Optimal -Force
  $distDownloads = Join-Path $frontendDist 'downloads'
  New-Item -ItemType Directory -Path $distDownloads -Force | Out-Null
  Copy-Item -LiteralPath $archivePath -Destination (Join-Path $distDownloads 'business-local-server-installer.zip') -Force
  Get-FileHash -LiteralPath $archivePath -Algorithm SHA256 | Format-List
  Write-Output "Created $archivePath"
} finally {
  $resolvedStageRoot = [System.IO.Path]::GetFullPath($stageRoot)
  $systemTempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
  if ($resolvedStageRoot.StartsWith($systemTempRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
      (Split-Path -Leaf $resolvedStageRoot).StartsWith('dce-local-server-package-')) {
    Remove-Item -LiteralPath $resolvedStageRoot -Recurse -Force
  }
}
