/// <reference types="vite/client" />

interface VitePreloadErrorEvent extends Event {
  payload: Error;
}

interface WindowEventMap {
  "vite:preloadError": VitePreloadErrorEvent;
}
