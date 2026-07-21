import { useEffect, useState } from 'react';

/** Élément non standard (Safari/anciens WebKit) exposant l'API plein écran préfixée. */
type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type WebkitDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

function isFullscreen(): boolean {
  const doc = document as WebkitDocument;
  return Boolean(document.fullscreenElement ?? doc.webkitFullscreenElement);
}

export function FullscreenToggle() {
  const [active, setActive] = useState(isFullscreen);

  useEffect(() => {
    const onChange = () => setActive(isFullscreen());
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  const toggle = () => {
    if (isFullscreen()) {
      const doc = document as WebkitDocument;
      void (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
    } else {
      const el = document.documentElement as WebkitElement;
      void (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
    }
  };

  return (
    <button
      className={`btn px-2 py-1 text-xs ${active ? 'btn-cyan active' : ''}`}
      aria-label={active ? 'Quitter le plein écran' : 'Passer en plein écran'}
      aria-pressed={active}
      title={active ? 'Quitter le plein écran' : 'Plein écran'}
      onClick={toggle}
    >
      {active ? '⤡' : '⤢'}
    </button>
  );
}
