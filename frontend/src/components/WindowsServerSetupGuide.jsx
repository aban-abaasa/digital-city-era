import React, { useEffect, useRef, useState } from 'react';
import { FiCheck, FiCopy } from 'react-icons/fi';

// Styles live in pages/BusinessLocalServerSetup.css (this guide is only rendered inside that page).

const DONE_KEY = 'ican-local-server-guide-done';

const readDone = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(DONE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// A command the user pastes into Windows. The button copies it; if the browser blocks the
// clipboard (plain-HTTP pages do) the text is selected so Ctrl+C works.
const Command = ({ text, where }) => {
  const [state, setState] = useState('idle');
  const codeRef = useRef(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      const range = document.createRange();
      range.selectNodeContents(codeRef.current);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      setState('manual');
    }
    setTimeout(() => setState('idle'), 2500);
  };

  return (
    <div>
      {where && <p className="bls-cmd-label">{where}</p>}
      <div className="bls-cmd">
        <code ref={codeRef}>{text}</code>
        <button type="button" onClick={copy}>
          {state === 'copied' ? <FiCheck /> : <FiCopy />}
          {state === 'copied' ? 'Copied' : state === 'manual' ? 'Press Ctrl+C' : 'Copy'}
        </button>
      </div>
    </div>
  );
};

const Ext = ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>;

const phases = [
  {
    title: 'Part 1 — Prepare the computer',
    steps: [
      {
        id: 'check',
        title: 'Check the computer',
        hint: 'Windows version, memory, disk space',
        body: (
          <>
            <p>Windows 10 (version 22H2) or Windows 11, at least <strong>4 GB of memory</strong>, <strong>2 processor cores</strong> and internet during setup. Leave the computer switched on at the business afterwards.</p>
            <p>The installer needs <strong>40 GB free</strong> on the drive you install to, and Docker keeps its own data on drive <strong>C:</strong>, so leave C: some room too. See how much each drive has:</p>
            <Command where="PowerShell — look at the FreeGB column" text="Get-PSDrive C,D | Select-Object Name, @{n='FreeGB';e={[math]::Round($_.Free/1GB,1)}}" />
            <p className="bls-tip">If no drive shows 40 or more, free up space first (empty the Recycle Bin, run <strong>Disk Cleanup</strong> from the Start menu, remove programs you do not use). If you only have a C: drive, install to C:. Do not start another big download while the installer runs.</p>
          </>
        ),
      },
      {
        id: 'programs',
        title: 'Install Node.js, Git and Docker Desktop',
        hint: 'Three free programs the installer uses',
        body: (
          <>
            <ul>
              <li><Ext href="https://nodejs.org/">Node.js</Ext> — version 20 or newer (choose “LTS”).</li>
              <li><Ext href="https://git-scm.com/download/win">Git for Windows</Ext> — accept the default options.</li>
              <li><Ext href="https://docs.docker.com/desktop/setup/install/windows-install/">Docker Desktop for Windows</Ext> — accept the default options.</li>
            </ul>
            <p>Close and reopen any command windows after installing so they notice the new programs.</p>
          </>
        ),
      },
      {
        id: 'features',
        title: 'Switch on the Windows features Docker needs',
        hint: 'Two commands in an administrator PowerShell',
        body: (
          <>
            <p>Open the Start menu, type <strong>PowerShell</strong>, right-click <strong>Windows PowerShell</strong> and choose <strong>Run as administrator</strong>. The title bar must say “Administrator: Windows PowerShell”. Paste these two commands, one at a time, pressing Enter after each:</p>
            <Command where="Administrator PowerShell — command 1" text="Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart" />
            <Command where="Administrator PowerShell — command 2" text="wsl --install --no-distribution --web-download" />
            <p className="bls-tip">The second command may say “Changes will not be effective until the system is rebooted”. That is normal — the restart is the next step. Do not use <code>wsl --update</code> at this point; the old built-in WSL does not support it.</p>
          </>
        ),
      },
      {
        id: 'restart',
        title: 'Restart Windows',
        hint: 'A real restart, not Shut down',
        body: (
          <p>Save your work, then use <strong>Start → Power → Restart</strong>. Do not use Shut down: with Fast Startup the new features only switch on after a genuine restart.</p>
        ),
      },
      {
        id: 'docker',
        title: 'Start Docker and check it is ready',
        hint: 'Wait for “Engine running”',
        body: (
          <>
            <p>Open <strong>Docker Desktop</strong> and wait until the bottom-left says <strong>Engine running</strong> (the first start can take a couple of minutes). Then check these two commands in a normal PowerShell window:</p>
            <Command where="PowerShell — should print “WSL version: 2.x.x”" text="wsl --version" />
            <Command where="PowerShell — should print “linux”" text={'docker info --format "{{.OSType}}"'} />
            <p>If the second one prints <code>windows</code>, right-click the Docker whale in the system tray and choose <strong>Switch to Linux containers</strong>.</p>
            <p className="bls-tip">The server only runs while Docker Desktop is running. In Docker’s <strong>Settings → General</strong>, tick <strong>Start Docker Desktop when you sign in to Windows</strong> so it comes back after the computer restarts.</p>
          </>
        ),
      },
    ],
  },
  {
    title: 'Part 2 — Run the installer',
    steps: [
      {
        id: 'address',
        title: 'Find this computer’s address — and keep it fixed',
        hint: 'Phones will connect to this number',
        body: (
          <>
            <p>Open a Command Prompt and run:</p>
            <Command where="Command Prompt or PowerShell" text="ipconfig" />
            <p>Under your <strong>Wi-Fi</strong> or <strong>Ethernet</strong> adapter, copy the <strong>IPv4 Address</strong> (for example <code>192.168.1.13</code>). Ignore adapters that say “Media disconnected” and anything called <em>vEthernet (WSL)</em> or <em>Docker</em> — phones cannot reach those. The <strong>Default Gateway</strong> (often <code>192.168.1.1</code>) is your router, not this computer.</p>
            <p className="bls-tip"><strong>Keep the address from changing before you install.</strong> The installer records it, and phones stop reaching the server if it changes later. Either ask whoever manages the router to <strong>reserve</strong> it for this computer’s MAC address, or set a fixed address on the computer itself: Start → <em>View network connections</em> → right-click Wi-Fi/Ethernet → <strong>Properties</strong> → <strong>Internet Protocol Version 4</strong> → <strong>Use the following IP address</strong>. Use a high number the router is unlikely to hand out (such as <code>192.168.1.240</code>), the same subnet mask <code>255.255.255.0</code>, your router as the gateway and <code>8.8.8.8</code> as DNS. Check the number is free first with <code>ping 192.168.1.240</code> — you want “Request timed out”.</p>
          </>
        ),
      },
      {
        id: 'run',
        title: 'Download, extract and start the installer',
        hint: 'Run install-windows.cmd — not install.js',
        body: (
          <>
            <p>Press <strong>Download setup package</strong> at the top of this page. In File Explorer, right-click the ZIP and choose <strong>Extract All</strong> — never run it from inside the ZIP. Open the extracted <code>local-server → installers</code> folder and double-click <strong>install-windows.cmd</strong> (the one with the gear icon).</p>
            <p className="bls-tip">Do not double-click <code>install.js</code>. Windows cannot run it and shows “Invalid character … 800A03F6”.</p>
            <p>The window closes when you press a key at the end. To keep the messages on screen, open a Command Prompt first and drag <code>install-windows.cmd</code> into it.</p>
          </>
        ),
      },
      {
        id: 'questions',
        title: 'Answer the first three questions',
        hint: 'Folder, address, YES — one at a time',
        body: (
          <>
            <p>The installer asks one question at a time. Wait for each to appear, type the answer, press Enter:</p>
            <ol>
              <li><strong>Install folder</strong> — type a full path that starts with the drive and a backslash, and sits <strong>one folder inside</strong> the drive. Copy the example, or press Enter to accept the suggested folder on C:.</li>
              <li><strong>Server LAN IPv4 address</strong> — the address from the previous step.</li>
              <li><strong>Continue? Type YES</strong> — type <code>YES</code> in capital letters.</li>
            </ol>
            <Command where="Example install folder (needs 40 GB free on that drive)" text="D:\Servers\DigitalCityLocalServer" />
            <p className="bls-tip">The folder must not exist yet — the installer never overwrites an existing one. Do not put it straight in the drive’s root (<code>D:\Name</code> can fail with “EPERM … mkdir”), and do not leave out the backslash after <code>D:</code>.</p>
          </>
        ),
      },
      {
        id: 'cloud',
        title: 'Connect the server to your account',
        hint: 'Three pastes — one at a time',
        body: (
          <>
            <p>The installer then asks for three values. They come from the <strong>Connect your server</strong> card further down this page. <strong>Copy one value, paste it, press Enter, then copy the next.</strong> Never copy several things together — a multi-line paste presses Enter for you and puts answers in the wrong prompts.</p>
            <ol>
              <li><strong>Cloud Supabase URL</strong> — Copy it from the card, then right-click inside the installer window to paste. It must be one line starting with <code>https://</code>.</li>
              <li><strong>Anon/publishable key</strong> — Copy it from the card and paste it. It is one very long line that wraps across the window; that is normal.</li>
              <li><strong>One-time pairing code</strong> — only now, press <strong>Create one-time pairing code</strong> on this page, Copy it and paste it. It is 64 letters and numbers, works once and expires in 10 minutes.</li>
            </ol>
            <p className="bls-tip">You must be signed in as the business owner, with the right business chosen in the card. If the installer says the cloud migrations are missing, the platform administrator has to finish the one-time platform setup first — the code was not used.</p>
            <p>After this the installer downloads and starts the server. That takes several minutes; keep the window open and the computer awake.</p>
          </>
        ),
      },
    ],
  },
  {
    title: 'Part 3 — Finish',
    steps: [
      {
        id: 'finish',
        title: 'After the installer finishes',
        hint: 'Open the address on your phones',
        body: (
          <>
            <p>The installer prints the address of the local app, like <code>http://192.168.1.13:8080</code>, and a <strong>one-time local owner setup code</strong> to enter on the first staff sign-in screen. Write both down. On any phone, tablet or computer on the same business Wi-Fi, open that address in the browser.</p>
            <p>If Windows asks whether to let Docker through the firewall, allow it on <strong>Private networks</strong>.</p>
            <p>Stop the computer from sleeping while plugged in, so the server stays reachable:</p>
            <Command where="PowerShell" text="powercfg /change standby-timeout-ac 0" />
            <p className="bls-sub">Keep the server on the business network. Never forward its ports from the internet.</p>
          </>
        ),
      },
    ],
  },
];

const problems = [
  {
    seen: 'Windows Script Host — “Invalid character”, code 800A03F6',
    fix: <>You opened <code>install.js</code>. Close it and double-click <strong>install-windows.cmd</strong> (the file with the gear icon).</>,
  },
  {
    seen: '“Setup stopped: Docker Desktop must be running”',
    fix: <>Open Docker Desktop from the Start menu and wait until the bottom-left says <strong>Engine running</strong>, then run <code>install-windows.cmd</code> again.</>,
  },
  {
    seen: 'Docker: “Virtual Machine Platform not enabled”',
    fix: <>Do the Windows-features step in an <strong>administrator</strong> PowerShell, then <strong>restart Windows</strong>. Restarting only Docker is not enough.</>,
  },
  {
    seen: 'Docker: “WSL needs updating”, or “wsl --update” prints a long help text',
    fix: <>The old built-in WSL is installed. Run <code>wsl --install --no-distribution --web-download</code> in an administrator PowerShell, then restart Windows.</>,
  },
  {
    seen: 'Docker: “WSL_E_WSL_OPTIONAL_COMPONENT_REQUIRED”',
    fix: <>WSL is not installed yet, or Windows has not restarted since installing it. Run <code>wsl.exe --install --no-distribution</code> as administrator, then restart (Start → Power → Restart, not Shut down).</>,
  },
  {
    seen: 'Docker says virtualization is not supported / not enabled',
    fix: <>Turn on <strong>Intel VT-x</strong> or <strong>AMD-V (SVM Mode)</strong> in the computer’s BIOS/UEFI settings. The key to enter BIOS depends on the make (often F2, F10, Del or Esc at start-up).</>,
  },
  {
    seen: '“This Supabase server uses Linux containers”',
    fix: <>Right-click the Docker whale in the system tray and choose <strong>Switch to Linux containers</strong>, wait for Docker to restart, then run setup again.</>,
  },
  {
    seen: '“At least 40 GB of free disk space is required”',
    fix: <>Free up space, or type an install folder on another drive that has 40 GB free (for example <code>D:\Servers\DigitalCityLocalServer</code>).</>,
  },
  {
    seen: "“EPERM: operation not permitted, mkdir 'D:\\'”",
    fix: <>The install folder was placed directly in the root of a drive. Use one folder level inside it, for example <code>D:\Servers\DigitalCityLocalServer</code>.</>,
  },
  {
    seen: '“Enter the server computer IPv4 address” or “Invalid URL”',
    fix: <>An answer went into the wrong prompt, usually because several lines were pasted at once. <strong>Delete the half-made install folder</strong> in File Explorer (it is only partly filled and nothing is running), then start again with a <em>new</em> folder name and paste one value at a time.</>,
  },
  {
    seen: '“Install folder already exists”',
    fix: <>The installer never overwrites data. If it is a half-made folder from a failed attempt, delete it in File Explorer first; otherwise type a new folder name.</>,
  },
  {
    seen: '“Pairing did not complete”',
    fix: <>The code expired (10 minutes), was already used, or was mistyped. Press <strong>Create one-time pairing code</strong> again and use the fresh code. You can revoke any uncertain server under <em>Registered local servers</em>.</>,
  },
];

const WindowsServerSetupGuide = () => {
  const [done, setDone] = useState(readDone);
  const totalSteps = phases.reduce((sum, phase) => sum + phase.steps.length, 0);

  useEffect(() => {
    try { localStorage.setItem(DONE_KEY, JSON.stringify(done)); } catch { /* storage unavailable: progress just isn't remembered */ }
  }, [done]);

  const toggle = (id) => setDone((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  const doneCount = phases.reduce((sum, phase) => sum + phase.steps.filter((s) => done.includes(s.id)).length, 0);

  let counter = 0;
  return (
    <>
      <details className="bls-card bls-collapse">
        <summary>
          <div className="bls-sum-text">
            <h2>Step-by-step setup guide for Windows</h2>
            <p>Everything from a fresh computer to a working server. Tap to open.</p>
          </div>
          <span className="bls-sum-badge">{doneCount} of {totalSteps} done</span>
          <span className="bls-chev" aria-hidden="true" />
        </summary>

        <p className="bls-sub" style={{ padding: '12px 18px 0' }}>Open a step, follow it, then mark it done — your progress is remembered on this device. Each grey box is a command: press <strong>Copy</strong>, paste it into the window named above it, and press Enter.</p>

        {phases.map((phase) => (
          <React.Fragment key={phase.title}>
            <p className="bls-phase">{phase.title}</p>
            <div className="bls-steps">
              {phase.steps.map((step) => {
                counter += 1;
                const isDone = done.includes(step.id);
                return (
                  <details key={step.id} className={`bls-step${isDone ? ' is-done' : ''}`}>
                    <summary>
                      <span className="bls-num">{isDone ? <FiCheck /> : counter}</span>
                      <span className="bls-step-title">{step.title}<small>{step.hint}</small></span>
                      <span className="bls-chev" aria-hidden="true" />
                    </summary>
                    <div className="bls-step-body">
                      {step.body}
                      <button type="button" className="bls-done-btn" onClick={() => toggle(step.id)} aria-pressed={isDone}>
                        <FiCheck /> {isDone ? 'Done — tap to undo' : 'Mark this step done'}
                      </button>
                    </div>
                  </details>
                );
              })}
            </div>
          </React.Fragment>
        ))}
      </details>

      <details className="bls-card bls-collapse">
        <summary>
          <div className="bls-sum-text">
            <h2>Something went wrong?</h2>
            <p>The messages you may see, and what to do about each.</p>
          </div>
          <span className="bls-sum-badge">{problems.length} fixes</span>
          <span className="bls-chev" aria-hidden="true" />
        </summary>
        <div className="bls-trouble-list" style={{ paddingTop: 12 }}>
          {problems.map((item) => (
            <details key={item.seen} className="bls-trouble">
              <summary><span>{item.seen}</span><span className="bls-chev" aria-hidden="true" /></summary>
              <p>{item.fix}</p>
            </details>
          ))}
        </div>
      </details>
    </>
  );
};

export default WindowsServerSetupGuide;
