import React, { useRef, useState } from 'react';
import { FiCheck, FiCopy, FiTool } from 'react-icons/fi';

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
    <div className="mt-2">
      {where && <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{where}</p>}
      <div className="flex items-stretch gap-2 rounded-lg bg-slate-900 p-2">
        <code ref={codeRef} className="min-w-0 flex-1 select-all break-all px-1 py-1 font-mono text-xs leading-5 text-cyan-100">{text}</code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
        >
          {state === 'copied' ? <FiCheck /> : <FiCopy />}
          {state === 'copied' ? 'Copied' : state === 'manual' ? 'Press Ctrl+C' : 'Copy'}
        </button>
      </div>
    </div>
  );
};

const Link = ({ href, children }) => (
  <a className="font-semibold text-cyan-800 underline" href={href} target="_blank" rel="noreferrer">{children}</a>
);

const Step = ({ n, title, children }) => (
  <li className="flex gap-3 py-4">
    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cyan-700 text-xs font-bold text-white">{n}</span>
    <div className="min-w-0 flex-1 text-sm leading-6 text-slate-700">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      {children}
    </div>
  </li>
);

const problems = [
  {
    seen: 'Windows Script Host — “Invalid character”, code 800A03F6',
    fix: <>You opened <code>install.js</code>. Close it and double-click <strong>install-windows.cmd</strong> instead (the file with the gear icon).</>,
  },
  {
    seen: '“Setup stopped: Docker Desktop must be running”',
    fix: <>Open Docker Desktop from the Start menu and wait until the bottom-left says <strong>Engine running</strong> (about a minute), then run <code>install-windows.cmd</code> again.</>,
  },
  {
    seen: 'Docker: “Virtual Machine Platform not enabled”',
    fix: <>Do step 3 (the Windows features command in an <strong>administrator</strong> PowerShell), then <strong>restart Windows</strong>. Restarting only Docker is not enough.</>,
  },
  {
    seen: 'Docker: “WSL needs updating”, or “wsl --update” prints a long help text',
    fix: <>The old built-in WSL is installed. Run <code>wsl --install --no-distribution --web-download</code> in an administrator PowerShell, then restart Windows.</>,
  },
  {
    seen: 'Docker: “WSL_E_WSL_OPTIONAL_COMPONENT_REQUIRED”',
    fix: <>WSL is not installed yet, or Windows has not restarted since installing it. Run <code>wsl.exe --install --no-distribution</code> as administrator, then <strong>restart</strong> (Start → Power → Restart, not Shut down).</>,
  },
  {
    seen: 'Docker says virtualization is not supported / not enabled',
    fix: <>Turn on <strong>Intel VT-x</strong> or <strong>AMD-V (SVM Mode)</strong> in the computer’s BIOS/UEFI settings. The key to enter BIOS depends on the computer’s make (often F2, F10, Del or Esc at start-up).</>,
  },
  {
    seen: '“This Supabase server uses Linux containers”',
    fix: <>Right-click the Docker whale in the system tray and choose <strong>Switch to Linux containers</strong>, wait for Docker to restart, then run setup again.</>,
  },
  {
    seen: '“Install folder already exists”',
    fix: <>The installer never overwrites data. Type a new folder name when it asks, for example <code>C:\Users\Reception\DigitalCityLocalServer2</code>.</>,
  },
  {
    seen: '“At least 40 GB of free disk space is required”',
    fix: <>Free up space on the drive, or type an install folder on another drive that has 40 GB free (for example <code>D:\DigitalCityLocalServer</code>).</>,
  },
];

const WindowsServerSetupGuide = () => (
  <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="mb-1 flex items-start gap-3">
      <FiTool className="mt-1 h-5 w-5 text-cyan-700" />
      <div>
        <h2 className="font-semibold">Step-by-step: set up the server on Windows</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Follow these in order on the computer that will stay at the business. Each grey box is a command: press <strong>Copy</strong>, paste it into the window named above it, and press Enter.</p>
      </div>
    </div>

    <ol className="mt-2 divide-y divide-slate-100">
      <Step n={1} title="Check the computer">
        <p>Windows 10 (version 22H2) or Windows 11, at least <strong>4 GB of memory</strong>, <strong>2 processor cores</strong>, <strong>40 GB free disk space</strong>, and internet during setup. Leave the computer switched on at the business afterwards.</p>
      </Step>

      <Step n={2} title="Install the three programs it needs">
        <ul className="mt-1 list-disc pl-5">
          <li><Link href="https://nodejs.org/">Node.js</Link> — version 20 or newer (choose “LTS”).</li>
          <li><Link href="https://git-scm.com/download/win">Git for Windows</Link> — accept the default options.</li>
          <li><Link href="https://docs.docker.com/desktop/setup/install/windows-install/">Docker Desktop for Windows</Link> — accept the default options.</li>
        </ul>
        <p className="mt-1">Close and reopen any command windows after installing so they notice the new programs.</p>
      </Step>

      <Step n={3} title="Switch on the Windows features Docker needs">
        <p>Open the Start menu, type <strong>PowerShell</strong>, right-click <strong>Windows PowerShell</strong> and choose <strong>Run as administrator</strong>. The title bar must say “Administrator: Windows PowerShell”. Paste these two commands, one at a time:</p>
        <Command where="Administrator PowerShell — command 1" text="Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart" />
        <Command where="Administrator PowerShell — command 2" text="wsl --install --no-distribution --web-download" />
        <p className="mt-2">When both have finished (the second may say “Changes will not be effective until the system is rebooted” — that is normal), go to the next step.</p>
      </Step>

      <Step n={4} title="Restart Windows">
        <p>Save your work, then use <strong>Start → Power → Restart</strong>. Do not use Shut down: the new features only switch on after a real restart.</p>
      </Step>

      <Step n={5} title="Start Docker and check it is ready">
        <p>Open <strong>Docker Desktop</strong> and wait until the bottom-left says <strong>Engine running</strong>. Then open PowerShell (a normal window is fine) and check these two commands:</p>
        <Command where="PowerShell — should print “WSL version: 2.x.x”" text="wsl --version" />
        <Command where="PowerShell — should print “linux”" text={'docker info --format "{{.OSType}}"'} />
        <p className="mt-2">If the second one prints <code>windows</code>, right-click the Docker whale in the system tray and choose <strong>Switch to Linux containers</strong>.</p>
      </Step>

      <Step n={6} title="Download and open the installer">
        <p>Press <strong>Download setup package</strong> at the top of this page. In File Explorer, right-click the ZIP and choose <strong>Extract All</strong> — do not run it from inside the ZIP. Open the extracted <code>local-server → installers</code> folder and double-click <strong>install-windows.cmd</strong>. Do not open <code>install.js</code>.</p>
      </Step>

      <Step n={7} title="Answer the installer’s questions">
        <ol className="mt-1 list-decimal pl-5">
          <li><strong>Install folder</strong> — press Enter to accept the suggested folder (it must not already exist).</li>
          <li><strong>Server LAN IPv4 address</strong> — this computer’s address on the business Wi-Fi or cable network. To find it, open a Command Prompt, run the command below, and use the <strong>IPv4 Address</strong> of your Wi-Fi or Ethernet adapter (ignore Docker/WSL adapters). Ask whoever manages the router to reserve this address so it never changes.</li>
          <li><strong>Continue? Type YES</strong> — type <code>YES</code> in capital letters.</li>
        </ol>
        <Command where="Command Prompt or PowerShell — shows the IPv4 Address" text="ipconfig" />
        <p className="mt-2">The installer then downloads and starts the server, which can take several minutes. When it asks for the <strong>cloud project URL</strong>, <strong>public key</strong> and <strong>one-time pairing code</strong>, use the Copy buttons on this page (the code is created further down, and works once for 10 minutes).</p>
      </Step>

      <Step n={8} title="Connect your phones and tablets">
        <p>When the installer finishes it prints the address of the local app, like <code>http://192.168.1.50:8080</code>. On any phone, tablet or computer on the same business Wi-Fi, open that address in the browser.</p>
      </Step>
    </ol>

    <h3 className="mt-2 text-sm font-semibold text-slate-900">Something went wrong?</h3>
    <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
      {problems.map((item) => (
        <details key={item.seen} className="group px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium text-slate-800">{item.seen}</summary>
          <p className="mt-1 leading-6 text-slate-600">{item.fix}</p>
        </details>
      ))}
    </div>
  </section>
);

export default WindowsServerSetupGuide;
