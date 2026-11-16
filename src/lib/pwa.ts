/** Production-only root service worker, kept separate from Vite's dev HMR. */
export function registerPwa(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const install = () => {
    void navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      })
      .catch(() => {
        // Installability is optional; online use and manual paste still work.
      });
  };
  if (document.readyState === "complete") install();
  else window.addEventListener("load", install, { once: true });
}
