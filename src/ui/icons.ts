// Minimal line icons drawn for this app (no icon library).
const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICON = {
  play: svg('<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>'),
  pause: svg('<path d="M8 5v14M16 5v14" stroke-width="2.6"/>'),
  replay: svg('<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>'),
  captions: svg('<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M7 14.5h4M13 14.5h4M7 11h10"/>'),
  sound: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  muted: svg('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
};

/** The gunungan in ink line-art, with the four brand accents as small highlights. */
export const GUNUNGAN_INK = `<svg viewBox="0 0 120 160" width="1em" height="1.33em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M60 6 C42 30 20 52 18 88 C17 104 24 112 34 116 L34 148 L86 148 L86 116 C96 112 103 104 102 88 C100 52 78 30 60 6 Z"/>
  <path d="M60 30 L60 116"/>
  <path d="M60 52 C52 58 44 60 36 70 M60 52 C68 58 76 60 84 70"/>
  <path d="M60 74 C50 80 40 84 30 96 M60 74 C70 80 80 84 90 96"/>
  <path d="M60 96 C54 100 48 104 42 110 M60 96 C66 100 72 104 78 110"/>
  <path d="M46 148 L46 126 L74 126 L74 148"/>
  <path d="M60 126 L60 148"/>
  <circle cx="60" cy="40" r="3.2" fill="#FFC300" stroke="none"/>
  <circle cx="36" cy="70" r="2.6" fill="#FF6B35" stroke="none"/>
  <circle cx="84" cy="70" r="2.6" fill="#9D4EDD" stroke="none"/>
  <path d="M38 148 L82 148" stroke="#0F4C5C" stroke-width="4"/>
</svg>`;
