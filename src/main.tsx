import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import './i18n';

// Theme initialization - prevent white flash
export function initializeThemeClass(
  doc: Pick<Document, 'documentElement'> = document,
  storage: Pick<Storage, 'getItem'> = localStorage,
  matchMediaFn: ((query: string) => { matches: boolean }) | undefined = typeof window !== 'undefined' ? window.matchMedia?.bind(window) : undefined,
): 'dark' | 'light' {
  const savedTheme = storage.getItem('omninauka-theme');
  const isDark = savedTheme === 'dark' || (!savedTheme && Boolean(matchMediaFn?.('(prefers-color-scheme: dark)').matches));
  if (isDark) {
    doc.documentElement.classList.add('dark');
  } else {
    doc.documentElement.classList.remove('dark');
  }
  return isDark ? 'dark' : 'light';
}

initializeThemeClass();

// Vite Dynamic Import Reload Recovery (Hotfix 23B.2)
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const key = "omninauka_vite_preload_reloaded";
  if (sessionStorage.getItem(key) === "1") {
    return;
  }
  sessionStorage.setItem(key, "1");
  window.location.reload();
});

// Clear the flag after successful load
const preloadKey = "omninauka_vite_preload_reloaded";
if (sessionStorage.getItem(preloadKey) === "1") {
  setTimeout(() => sessionStorage.removeItem(preloadKey), 5000);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
