import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

const isStandalone = () => (
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true
);

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const promptRef = useRef(null);
  const pendingInstallRef = useRef(false);
  const appIcon = '/images/supermarketera-apk.jpg';

  useEffect(() => {
    setInstalled(isStandalone());
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      promptRef.current = event;
      setDeferredPrompt(event);
      if (pendingInstallRef.current) {
        pendingInstallRef.current = false;
        event.prompt();
        event.userChoice.then((choice) => {
          if (choice.outcome === 'accepted') {
            promptRef.current = null;
            setDeferredPrompt(null);
          }
        });
      }
    };
    const handleAppInstalled = () => {
      setInstalled(true);
      promptRef.current = null;
      setDeferredPrompt(null);
    };
    const handleLandingInstallRequest = async () => {
      const prompt = promptRef.current;
      if (!prompt) {
        pendingInstallRef.current = true;
        setTimeout(() => {
          if (pendingInstallRef.current) {
            pendingInstallRef.current = false;
            setInstructionsOpen(true);
          }
        }, 4000);
        return;
      }
      prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') {
        promptRef.current = null;
        setDeferredPrompt(null);
      }
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('supermartkera-install-requested', handleLandingInstallRequest);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('supermartkera-install-requested', handleLandingInstallRequest);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (!deferredPrompt) {
      setInstructionsOpen(true);
      return;
    }
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      promptRef.current = null;
      setDeferredPrompt(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={install}
        className="fixed bottom-4 right-4 z-[100] flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-emerald-700"
        aria-label="Install SupermartKera"
      >
        <img src={appIcon} alt="" className="h-[18px] w-[18px] rounded object-cover" />
        Install app
      </button>
      {instructionsOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Install SupermartKera</h2>
              <button type="button" onClick={() => setInstructionsOpen(false)} aria-label="Close install instructions"><X size={20} /></button>
            </div>
            <p className="text-sm leading-6 text-slate-600">Open your browser menu, choose <strong>Install app</strong> or <strong>Add to Home screen</strong>, then confirm.</p>
            <button type="button" onClick={() => setInstructionsOpen(false)} className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white">Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
