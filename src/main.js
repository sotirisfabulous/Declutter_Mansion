import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import '@fontsource/creepster/latin-400.css';
import './style.css';
import { Game } from './game.js';

const game = new Game();
window.__game = game; // handy for debugging in the console
if (import.meta.env.DEV) import('./debug.js');

if ('serviceWorker' in navigator && import.meta.env.PROD && !import.meta.env.VITE_NO_SW) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true })).catch(() => {});
}
