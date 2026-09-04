import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Registered from here rather than index.html so the path picks up Vite's
// `base`, which is '/family-care-hub/' on GitHub Pages.
//
// Skipped in dev: the worker serves non-navigation requests cache-first, which
// includes Vite's module requests, so source edits stop reaching the page while
// HMR still looks healthy. Also tear down anything a previous dev session left
// registered, otherwise that stale worker keeps serving this one.
if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    });
    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys
          .filter((key) => key.startsWith('family-care-hub'))
          .forEach((key) => caches.delete(key));
      });
    }
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}service-worker.js`)
        .then((reg) => console.log('SW registered', reg))
        .catch((err) => console.log('SW failed', err));
    });
  }
}