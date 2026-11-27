#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statfsSync, chmodSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir, platform, totalmem, availableParallelism, networkInterfaces } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const installerDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(installerDir, '..');
const upstreamTag = 'self-hosted/v0.8.1';
const composeMinimum = [2, 24, 4];
const localHost = '127.0.0.1';
const installerProfiles = Object.freeze({
  '2gb-lite-20gb-disk': Object.freeze({ id: '2gb-lite-20gb-disk', title: '2 GB RAM Lite / 20 GB disk', edition: 'lite', minimumMemoryGB: 2, minimumDiskGB: 20 }),
  '2gb-lite-40gb-disk': Object.freeze({ id: '2gb-lite-40gb-disk', title: '2 GB RAM Lite / 40 GB disk', edition: 'lite', minimumMemoryGB: 2, minimumDiskGB: 40 }),
  '4gb-full-40gb-disk': Object.freeze({ id: '4gb-full-40gb-disk', title: '4 GB RAM Full / 40 GB disk', edition: 'full', minimumMemoryGB: 4, minimumDiskGB: 40 }),
});
const prompt = createInterface({ input: stdin, output: stdout });

function failIf(command, args, label, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    input: options.input,
    stdio: options.inherit ? 'inherit' : 'pipe',
    windowsHide: true,
    maxBuffer: 12 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    const detail = options.showError ? String(result.stderr || result.error?.message || '').trim() : '';
    throw new Error(`${label}${detail ? `: ${detail.slice(-800)}` : ''}`);
  }
  return String(result.stdout || '').trim();
}

function shellCommand() {
  const shell = platform() === 'win32' ? 'bash' : 'sh';
  const probeArgs = platform() === 'win32'
    ? ['--noprofile', '--norc', '-c', 'exit 0']
    : ['-c', 'exit 0'];
  const check = spawnSync(shell, probeArgs, { encoding: 'utf8', windowsHide: true });
  if (check.error || check.status !== 0) {
    if (platform() === 'win32') {
      throw new Error('Install Git for Windows with Git Bash, then run this installer from a terminal where `bash` is available.');
    }
    throw new Error('A POSIX shell is required to run the upstream Supabase key generator.');
  }
  return shell;
}

function composeVersion() {
  const output = failIf('docker', ['compose', 'version', '--short'], 'Docker Compose is required');
  const match = output.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) throw new Error(`Could not read Docker Compose version from: ${output}`);
  const actual = match.slice(1).map(Number);
  const tooOld = actual.some((part, index) => part < composeMinimum[index] && actual.slice(0, index).every((n, i) => n === composeMinimum[i]));
  if (tooOld) throw new Error(`Docker Compose ${composeMinimum.join('.')} or newer is required for the secure local-storage/port overrides (found ${match[0]}).`);
  return match[0];
}

function isUsableLanIpv4Address(value) {
  const parts = value.split('.').map(Number);
  if (parts.length !== 4
      || !parts.every((part, index) => Number.isInteger(part) && part >= 0 && part <= 255
        && (index !== 0 || (part !== 0 && part !== 127 && part < 224)))) return false;

  const ignoredInterface = /(loopback|docker|wsl|vEthernet|hyper-v|virtualbox|vmware)/i;
  return Object.entries(networkInterfaces()).some(([name, addresses]) => !ignoredInterface.test(name)
    && (addresses || []).some(({ address, family, internal }) =>
      (family === 4 || family === 'IPv4') && !internal && address === value));
}

function checkRequirements(
  edition,
  minimumMemoryGB = edition === 'lite' ? 2 : 4,
  minimumDiskGB = edition === 'lite' ? 20 : 40
) {
  const currentNode = Number(process.versions.node.split('.')[0]);
  if (currentNode < 20) throw new Error('Node.js 20 or newer is required.');
  failIf('git', ['--version'], 'Git is required');
  const composeVer = composeVersion();
  const engineOs = failIf('docker', ['info', '--format', '{{.OSType}}'], 'Docker Desktop must be running. Open Docker Desktop from the Start menu (install it from https://www.docker.com/products/docker-desktop/ if it is missing), wait until it says "Engine running" (about a minute), then run install-windows.cmd again');
  if (engineOs.toLowerCase() !== 'linux') {
    throw new Error('This Supabase server uses Linux containers and can run on a Windows computer. Open the Docker Desktop menu, choose "Switch to Linux containers", wait for Docker to restart, then run setup again.');
  }
  const shell = shellCommand();
  failIf('docker', ['info'], 'Docker is installed but its engine is not running');
  if (totalmem() < minimumMemoryGB * 1024 ** 3) {
    throw new Error(`This ${edition === 'lite' ? 'Lite' : 'Full'} package needs at least ${minimumMemoryGB} GB RAM.`);
  }
  if (availableParallelism() < 2) throw new Error('This Supabase stack needs at least 2 CPU cores.');
  return { composeVer, shell };
}

function setEnvValue(envText, key, value) {
  const line = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=.*$`, 'm');
  if (!line.test(envText)) throw new Error(`Expected setting ${key} was missing from Supabase .env.example.`);
  return envText.replace(line, `${key}=${value}`);
}

function getEnvValue(envText, key) {
  const prefix = `${key}=`;
  const line = envText.split(/\r?\n/).find((candidate) => candidate.startsWith(prefix));
  if (!line) return null;
  return line.slice(prefix.length).trim().replace(/^(['"])(.*)\1$/, '$2');
}

function getInstallerProfile() {
  const profilePath = join(packageRoot, 'install-profile.json');
  if (!existsSync(profilePath)) return null;

  let requestedProfile;
  try {
    requestedProfile = JSON.parse(readFileSync(profilePath, 'utf8'));
  } catch {
    throw new Error('The ZIP installer profile is invalid. Download a fresh installer package.');
  }

  const profile = installerProfiles[requestedProfile?.id];
  if (!profile
      || requestedProfile.edition !== profile.edition
      || requestedProfile.minimumMemoryGB !== profile.minimumMemoryGB
      || requestedProfile.minimumDiskGB !== profile.minimumDiskGB) {
    throw new Error('The ZIP installer profile is not supported. Download a fresh installer package.');
  }
  return profile;
}

function runCompose(projectDir, envFiles, files, args, { input, inherit = true } = {}) {
  const parameters = [];
  for (const envFile of envFiles) parameters.push('--env-file', envFile);
  for (const composeFile of files) parameters.push('-f', composeFile);
  parameters.push(...args);
  return failIf('docker', ['compose', ...parameters], `Docker Compose command failed (${args.join(' ')})`, {
    cwd: projectDir,
    input,
    inherit,
    showError: true,
  });
}

function createDesktopShortcut(serverHost) {
  const appUrl = `http://${serverHost}:8080`;
  if (platform() === 'win32') {
    const script = `
$desktop = [Environment]::GetFolderPath('Desktop')
if ([string]::IsNullOrWhiteSpace($desktop)) { throw 'Could not find the Desktop folder.' }
$shortcutPath = Join-Path $desktop 'STIMA.lnk'
$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $env:SystemRoot 'explorer.exe'
$shortcut.Arguments = '${appUrl}'
$shortcut.Description = 'Open STIMA local server'
$shortcut.IconLocation = (Join-Path $env:SystemRoot 'System32\\shell32.dll') + ',220'
$shortcut.Save()
Write-Output $shortcutPath
`;
    const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
    return failIf('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodedScript], 'Could not create the Windows desktop shortcut', { showError: true });
  }

  const desktop = join(homedir(), 'Desktop');
  mkdirSync(desktop, { recursive: true });
  if (platform() === 'darwin') {
    const shortcutPath = join(desktop, 'STIMA.webloc');
    writeFileSync(shortcutPath,
      `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict><key>URL</key><string>${appUrl}</string></dict></plist>\n`,
      'utf8'
    );
    return shortcutPath;
  }

  const shortcutPath = join(desktop, 'STIMA.desktop');
  writeFileSync(shortcutPath,
    `[Desktop Entry]\nType=Application\nName=STIMA\nComment=Open the local server\nExec=xdg-open ${appUrl}\nIcon=web-browser\nTerminal=false\nCategories=Utility;\n`,
    'utf8'
  );
  chmodSync(shortcutPath, 0o755);
  return shortcutPath;
}

async function ask(label, fallback = '') {
  const answer = (await prompt.question(fallback ? `${label} [${fallback}]: ` : `${label}: `)).trim();
  return answer || fallback;
}

async function main() {
  const profile = getInstallerProfile();
  console.log('\nDigital City Era local business server preview');
  if (profile) {
    console.log(`This ZIP installs ${profile.title}; it requires at least ${profile.minimumMemoryGB} GB RAM and ${profile.minimumDiskGB} GB free disk space.`);
  } else {
    console.log('Choose an edition: Full (4 GB RAM and 40 GB free disk) or Lite (2 GB RAM and 20 GB free disk for local product additions and cash sales).');
  }
  console.log('Both editions use the same pairing and Admin/Cashier account setup.');
  console.log('The local server only uses its own store catalog; it does not search other stores for product names.');
  console.log('Purchasing, wallet payments, TLS, backups, and other offline workflows are not included.');
  console.log('Choose local-only access or optional access from devices on the business LAN.\n');

  let edition;
  let minimumMemoryGB;
  let minimumDiskGB;
  if (profile) {
    edition = profile.edition;
    minimumMemoryGB = profile.minimumMemoryGB;
    minimumDiskGB = profile.minimumDiskGB;
  } else {
    const suggestedEdition = totalmem() < 4 * 1024 ** 3 ? '2' : '1';
    const editionChoice = await ask('Choose server edition (1 = Full, 2 = Lite)', suggestedEdition);
    if (!['1', '2'].includes(editionChoice)) throw new Error('Choose 1 for Full or 2 for Lite.');
    edition = editionChoice === '2' ? 'lite' : 'full';
    minimumMemoryGB = edition === 'lite' ? 2 : 4;
    minimumDiskGB = edition === 'lite' ? 20 : 40;
  }
  const { composeVer, shell } = checkRequirements(edition, minimumMemoryGB, minimumDiskGB);
  const defaultDir = join(homedir(), 'DigitalCityLocalServer');
  const targetDir = resolve(await ask('Install folder', defaultDir));
  // Node throws EPERM when asked to "create" a drive root such as D:\ on Windows, even though it exists.
  if (!existsSync(dirname(targetDir))) mkdirSync(dirname(targetDir), { recursive: true });
  const parentInfo = statfsSync(dirname(targetDir));
  const freeBytes = Number(parentInfo.bavail) * Number(parentInfo.bsize);
  // Disk thresholds use decimal GB to match the guide and Windows reporting.
  if (freeBytes < minimumDiskGB * 1000 ** 3) {
    throw new Error(`At least ${minimumDiskGB} GB of free disk space is required for this server package.`);
  }
  if (existsSync(targetDir)) {
    throw new Error(`Install folder already exists: ${targetDir}. Choose a new empty folder; existing data is never overwritten.`);
  }

  const accessChoice = await ask('Server access (1 = this computer only, 2 = business LAN devices)', '1');
  if (!['1', '2'].includes(accessChoice)) throw new Error('Choose 1 for this computer only or 2 for business LAN devices.');
  let serverHost = localHost;
  const lanAccess = accessChoice === '2';
  if (lanAccess) {
    serverHost = await ask('Server LAN IPv4 address (reserve this address in your router)');
    if (!isUsableLanIpv4Address(serverHost)) {
      throw new Error('Enter the IPv4 address assigned to this computer by its active Wi-Fi or Ethernet adapter. Do not use the router, Docker, WSL, or loopback address.');
    }
  }

  const accepted = await ask('This is a transport preview, not production offline app service. Continue? Type YES');
  if (accepted !== 'YES') throw new Error('Installation cancelled.');

  mkdirSync(targetDir, { recursive: true });
  if (platform() !== 'win32') chmodSync(targetDir, 0o700);

  const tempCheckout = join(tmpdir(), `dce-supabase-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(tempCheckout, { recursive: true });
  try {
    console.log(`\nFetching the pinned Supabase self-hosted release (${upstreamTag})...`);
    failIf('git', [
      'clone', '--depth', '1', '--filter=blob:none', '--sparse',
      '--single-branch', '--branch', upstreamTag,
      'https://github.com/supabase/supabase.git', tempCheckout,
    ], 'Could not download the pinned Supabase Docker configuration', { showError: true });
    failIf('git', ['sparse-checkout', 'set', 'docker'], 'Could not select the Supabase Docker configuration', { cwd: tempCheckout, showError: true });

    const upstreamDocker = join(tempCheckout, 'docker');
    for (const entry of readdirSync(upstreamDocker)) {
      cpSync(join(upstreamDocker, entry), join(targetDir, entry), {
        recursive: true,
        errorOnExist: true,
        force: false,
      });
    }
  } finally {
    const safeTempRoot = resolve(tmpdir());
    const resolvedTemp = resolve(tempCheckout);
    if (resolvedTemp.startsWith(`${safeTempRoot}${process.platform === 'win32' ? '\\' : '/'}`)) {
      rmSync(resolvedTemp, { recursive: true, force: true });
    }
  }

  const packagedAgent = join(packageRoot, 'agent');
  if (!existsSync(join(packagedAgent, 'src', 'index.js'))) throw new Error('The installer bundle is missing its sync agent files.');
  const packagedWeb = join(packageRoot, 'web');
  if (!existsSync(join(packagedWeb, 'app', 'index.html'))) throw new Error('The installer bundle is missing the built app shell. Recreate the installer ZIP after building the frontend.');
  const installedAgent = join(targetDir, 'local-server', 'agent');
  mkdirSync(dirname(installedAgent), { recursive: true });
  cpSync(packagedAgent, installedAgent, { recursive: true, errorOnExist: true, force: false });
  const installedWeb = join(targetDir, 'local-server', 'web');
  cpSync(packagedWeb, installedWeb, { recursive: true, errorOnExist: true, force: false });
  copyFileSync(join(packagedAgent, 'docker-compose.override.yml'), join(targetDir, 'docker-compose.local-business.yml'));
  if (edition === 'lite') {
    copyFileSync(join(packagedAgent, 'docker-compose.lite.yml'), join(targetDir, 'docker-compose.lite.yml'));
  }
  copyFileSync(join(targetDir, '.env.example'), join(targetDir, '.env'));

  console.log('\nGenerating unique local Supabase keys and passwords...');
  failIf(shell, ['utils/generate-keys.sh', '--update-env'], 'Could not generate local Supabase secrets', { cwd: targetDir });
  failIf(shell, ['utils/add-new-auth-keys.sh', '--update-env'], 'Could not generate local Supabase API keys', { cwd: targetDir });
  for (const backup of ['.env.old']) {
    const backupPath = join(targetDir, backup);
    if (existsSync(backupPath)) rmSync(backupPath, { force: true });
  }

  let envText = readFileSync(join(targetDir, '.env'), 'utf8');
  envText = setEnvValue(envText, 'SUPABASE_PUBLIC_URL', `http://${serverHost}:8000`);
  envText = setEnvValue(envText, 'API_EXTERNAL_URL', `http://${serverHost}:8000/auth/v1`);
  envText = setEnvValue(envText, 'SITE_URL', `http://${serverHost}:8080`);
  envText = setEnvValue(envText, 'ADDITIONAL_REDIRECT_URLS', `http://${serverHost}:8080`);
  envText = `${envText.trimEnd()}\nLOCAL_SERVER_BIND_IP=${serverHost}\n`;
  envText = setEnvValue(envText, 'DISABLE_SIGNUP', 'true');
  envText = setEnvValue(envText, 'POOLER_TENANT_ID', 'digital-city-local');
  writeFileSync(join(targetDir, '.env'), envText, 'utf8');
  if (platform() !== 'win32') chmodSync(join(targetDir, '.env'), 0o600);

  console.log('\nClaim the one-time pairing code created in the cloud Offline server settings.');
  const claim = spawnSync(process.execPath, [join(installedAgent, 'src', 'claim-node.js'), '.env.local-sync'], {
    cwd: targetDir,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (claim.error || claim.status !== 0) throw new Error('Pairing did not complete. The owner can revoke any uncertain node and create a fresh code.');

  const localSetupToken = randomBytes(32).toString('hex');
  writeFileSync(
    join(targetDir, '.env.local-sync'),
    `${readFileSync(join(targetDir, '.env.local-sync'), 'utf8').trimEnd()}\nLOCAL_SETUP_TOKEN=${localSetupToken}\n`,
    'utf8'
  );

  const localSyncEnv = readFileSync(join(targetDir, '.env.local-sync'), 'utf8');
  const localAnonKey = getEnvValue(envText, 'ANON_KEY') || getEnvValue(envText, 'SUPABASE_ANON_KEY');
  const businessType = getEnvValue(localSyncEnv, 'BUSINESS_SYNC_BUSINESS_TYPE');
  const businessId = getEnvValue(localSyncEnv, 'BUSINESS_SYNC_BUSINESS_ID');
  if (!localAnonKey || !businessType || !businessId) {
    throw new Error('The generated local app configuration is incomplete; check the Supabase anon-key name and node pairing output.');
  }
  const runtimeConfig = {
    supabaseUrl: `http://${serverHost}:8000`,
    supabaseAnonKey: localAnonKey,
    localBusinessServer: true,
    localServerEdition: edition,
    businessType,
    businessId,
    publicWebsiteUrl: getEnvValue(localSyncEnv, 'BUSINESS_PUBLIC_WEBSITE_URL') || 'https://icanera.space',
    receiptIncludeQr: getEnvValue(localSyncEnv, 'BUSINESS_RECEIPT_INCLUDE_QR') === 'true',
  };
  writeFileSync(
    join(installedWeb, 'runtime-config.js'),
    `window.__APP_RUNTIME_CONFIG__ = Object.freeze(${JSON.stringify(runtimeConfig)});\n`,
    'utf8'
  );

  const baseCompose = join(targetDir, 'docker-compose.yml');
  const localCompose = join(targetDir, 'docker-compose.local-business.yml');
  const envFiles = [join(targetDir, '.env'), join(targetDir, '.env.local-sync')];
  const composeFiles = edition === 'lite'
    ? [baseCompose, localCompose, join(targetDir, 'docker-compose.lite.yml')]
    : [baseCompose, localCompose];
  const upstreamServices = edition === 'lite'
    ? ['db', 'api-gw', 'auth', 'rest']
    : ['db', 'api-gw', 'auth', 'rest', 'realtime', 'storage', 'imgproxy', 'meta', 'functions', 'studio', 'supavisor'];
  const appServices = edition === 'lite'
    ? ['api-gw', 'rest', 'business-local-sync-agent', 'business-local-app']
    : undefined;

  console.log(`\nPulling the pinned ${edition === 'lite' ? 'Lite' : 'Full'} server services and starting the local database...`);
  runCompose(targetDir, envFiles, composeFiles, ['pull', ...upstreamServices]);
  // The sync SQL uses auth.jwt(), which the auth service (GoTrue) only creates the first time it starts,
  // so auth must be up and healthy before the SQL runs.
  runCompose(targetDir, envFiles, composeFiles, ['up', '-d', '--wait', 'db', 'auth']);

  console.log('Creating local sync inbox/outbox tables...');
  const syncSql = readFileSync(join(installedAgent, 'sql', 'local-sync-storage.sql'), 'utf8');
  runCompose(targetDir, envFiles, composeFiles,
    ['exec', '-T', 'db', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
    { input: syncSql, inherit: false }
  );

  console.log('\nStarting the local Supabase stack and sync transport...');
  const startArgs = ['up', '-d', '--build', '--wait', ...(appServices || [])];
  try {
    runCompose(targetDir, envFiles, composeFiles, startArgs);
  } catch {
    // On a first start some services can take longer than --wait allows; give
    // them a moment and retry once before giving up.
    console.log('\nSome services were slow to start. Waiting a moment and trying once more...');
    spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},30000)'], { windowsHide: true });
    runCompose(targetDir, envFiles, composeFiles, startArgs);
  }

  console.log(`\nLocal business server ${edition === 'lite' ? 'Lite' : 'Full'} preview is running.`);
  console.log(`Local business app: http://${serverHost}:8080`);
  console.log(`Local Supabase API: http://${serverHost}:8000`);
  console.log(`Install directory: ${targetDir}`);
  console.log(`Docker Compose: ${composeVer}`);
  console.log(lanAccess
    ? 'Other devices on the same trusted LAN can connect over HTTP. Reserve this IP in the router, and never forward the ports to the public internet.'
    : 'The app and API are available only on this computer at 127.0.0.1.');
  try {
    console.log(`Desktop shortcut: ${createDesktopShortcut(serverHost)}`);
  } catch (shortcutError) {
    console.warn(`Could not create a desktop shortcut automatically: ${shortcutError.message || shortcutError}`);
  }
  console.log(edition === 'lite'
    ? 'Lite includes this store\'s local catalog, product additions, and cash sales. Team chat and other optional services are not started.'
    : 'Full includes the app shell, local team chat, this store\'s catalog/stock mirror, and the shared cash-sales ledger.');
  console.log('\nOne-time local Admin setup code (enter it on the first staff sign-in screen):');
  console.log(localSetupToken);
  console.log('Keep this code private. It stops working after the Admin account is created.');
  console.log('Staff accounts use local PINs and do not sync to cloud Auth. Digital City Era enables cloud sale sync once for the platform; contact support if pairing is unavailable. HTTPS and production security still need work.');
}

try {
  await main();
} catch (error) {
  console.error(`\nSetup stopped: ${error.message || error}`);
  process.exitCode = 1;
} finally {
  prompt.close();
}
