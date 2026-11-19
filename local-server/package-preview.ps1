$ErrorActionPreference = 'Stop'

$localServerRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $localServerRoot
$stageId = [Guid]::NewGuid().ToString('N')
$stageRoot = Join-Path ([System.IO.Path]::GetTempPath()) "dce-local-server-package-$stageId"
$stagedPackage = Join-Path $stageRoot 'local-server'
$downloadsDirectory = Join-Path $projectRoot 'frontend\public\downloads'
$cloudMigrationsDirectory = Join-Path $projectRoot 'frontend\public\local-server-migrations'
$profiles = @(
  [pscustomobject]@{ Id = '2gb-lite-20gb-disk'; Edition = 'lite'; MinimumMemoryGB = 2; MinimumDiskGB = 20; Archive = 'business-local-server-2gb-ram-lite-20gb-disk.zip' },
  [pscustomobject]@{ Id = '2gb-lite-40gb-disk'; Edition = 'lite'; MinimumMemoryGB = 2; MinimumDiskGB = 40; Archive = 'business-local-server-2gb-ram-lite-40gb-disk.zip' },
  [pscustomobject]@{ Id = '4gb-full-40gb-disk'; Edition = 'full'; MinimumMemoryGB = 4; MinimumDiskGB = 40; Archive = 'business-local-server-4gb-ram-full-40gb-disk.zip' }
)
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
  # Tax settings used to label catalog prices consistently on every local till
  'ADD_SUPERMARKET_TAX_INCLUSION_SETTING.sql',
  'ADD_PRODUCT_TAX_INCLUSION_OVERRIDE.sql',
  'ADD_BUSINESS_LOCAL_SYNC_CONTROL_PLANE.sql',
  'ADD_BUSINESS_LOCAL_TEAM_MESSAGE_SYNC.sql',
  'ADD_BUSINESS_LOCAL_SYNC_PROTOCOL_V2.sql',
  'ADD_BUSINESS_LOCAL_CATALOG_SYNC.sql',
  # Cloud stock correction migration: lets Admin changes made on a server reach cloud inventory
  'ADD_BUSINESS_LOCAL_STOCK_ADJUSTMENTS.sql',
  # Shared local cash receipts, stock deduction, and cloud transaction sync
  'ADD_BUSINESS_LOCAL_CASH_SALES.sql',
  # Product detail edits made by local Admins sync back to the paired store
  'ADD_BUSINESS_LOCAL_PRODUCT_EDITING.sql'
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
  $distDownloads = Join-Path $frontendDist 'downloads'
  New-Item -ItemType Directory -Path $distDownloads -Force | Out-Null
  $profilePath = Join-Path $stagedPackage 'install-profile.json'
  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  foreach ($profile in $profiles) {
    $profileJson = [ordered]@{
      id = $profile.Id
      edition = $profile.Edition
      minimumMemoryGB = $profile.MinimumMemoryGB
      minimumDiskGB = $profile.MinimumDiskGB
    } | ConvertTo-Json -Compress
    [System.IO.File]::WriteAllText($profilePath, $profileJson, $utf8NoBom)

    $archivePath = Join-Path $downloadsDirectory $profile.Archive
    Compress-Archive -Path $stagedPackage -DestinationPath $archivePath -CompressionLevel Optimal -Force
    $distArchivePath = Join-Path $distDownloads $profile.Archive
    Copy-Item -LiteralPath $archivePath -Destination $distArchivePath -Force
    Get-FileHash -LiteralPath $archivePath -Algorithm SHA256 | Format-List
    Write-Output "Created $archivePath"
  }

  # Replace the old one-size download with the three RAM/disk packages.
  foreach ($downloads in @($downloadsDirectory, $distDownloads)) {
    $legacyArchive = Join-Path $downloads 'business-local-server-installer.zip'
    if (Test-Path -LiteralPath $legacyArchive) {
      Remove-Item -LiteralPath $legacyArchive -Force
    }
  }
} finally {
  $resolvedStageRoot = [System.IO.Path]::GetFullPath($stageRoot)
  $systemTempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
  if ($resolvedStageRoot.StartsWith($systemTempRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
      (Split-Path -Leaf $resolvedStageRoot).StartsWith('dce-local-server-package-')) {
    Remove-Item -LiteralPath $resolvedStageRoot -Recurse -Force
  }
}
