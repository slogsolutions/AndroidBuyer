import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

/**
 * Apply saved dark-mode preference to the document root BEFORE React renders.
 * This ensures Tailwind `dark:` variants take effect immediately (header, sidebar, pages, etc).
 *
 * We only read localStorage here and add/remove the "dark" class on <html>.
 * Keep this file as the single place that applies the root class.
 */
try {
  const saved = localStorage.getItem('darkMode');
  if (saved === 'true') {
    document.documentElement.classList.add('dark');
    
  } else if (saved === 'false') {
    document.documentElement.classList.remove('dark');
  }
  // If saved is null/undefined we leave it to app defaults (no forced change).
} catch (e) {
  // Ignore errors (e.g. SSR, private mode) — do not block rendering.
  // eslint-disable-next-line no-console
  console.warn('Could not read theme preference from localStorage.', e);
}

createRoot(document.getElementById('root')!).render(
  
    <App />
 
);
