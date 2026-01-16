import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Register service worker (public/sw.js)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Silent: offline support is a convenience, not a functional dependency.
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
