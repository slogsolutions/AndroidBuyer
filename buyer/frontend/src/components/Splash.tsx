import React, { useEffect, useState } from "react";
import "./Splash.css";

type SplashProps = {
  duration?: number; // how long splash stays visible (ms)
  onFinish?: () => void;
  message?: string;
};

export default function Splash({ duration = 2000, onFinish, message }: SplashProps) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setHidden(true);
      setTimeout(() => {
        onFinish && onFinish();
      }, 400); // allow fade-out to finish
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onFinish]);

  return (
    <div className={`splash-screen ${hidden ? "hidden" : ""}`}>
      <div className="splash-inner">
        <img
          src="/Park_your_Vehicle_log.png"
          alt="App Logo"
          className="splash-logo"
        />
        {message && <div className="splash-message">{message}</div>}
      </div>
    </div>
  );
}
