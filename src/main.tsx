import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import './i18n';

// Theme initialization - prevent white flash
const savedTheme = localStorage.getItem('omninauka-theme');
if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

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
