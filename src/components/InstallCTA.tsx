import { useEffect, useState } from "react";

export default function InstallCTA() {
  const [prompt, setPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setPrompt(e);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const installApp = () => {
    if (!prompt) return;
    prompt.prompt();
    prompt.userChoice.finally(() => setShow(false));
  };

  if (!show) return null;

  return (
    <button
      onClick={installApp}
      className="px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
    >
      Install App
    </button>
  );
}
