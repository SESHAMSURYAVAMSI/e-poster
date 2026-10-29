"use client";

import { useEffect } from "react";

export default function OfflineServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("ePoster offline worker registration failed:", error);
      });
    };
    register();
  }, []);

  return null;
}
