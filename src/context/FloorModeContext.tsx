"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export const FLOOR_MODE_STORAGE_KEY = "cookcue-floor-mode";

interface FloorModeContextType {
  floorMode: boolean;
  toggleFloorMode: () => void;
  setFloorMode: (enabled: boolean) => void;
}

const FloorModeContext = createContext<FloorModeContextType>({
  floorMode: false,
  toggleFloorMode: () => {},
  setFloorMode: () => {},
});

export function FloorModeProvider({ children }: { children: React.ReactNode }) {
  const [floorMode, setFloorModeState] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(FLOOR_MODE_STORAGE_KEY);
      if (stored === "1") {
        setFloorModeState(true);
      }
    } catch {
      // LocalStorage unavailable in certain environments
    }
  }, []);

  const setFloorMode = (enabled: boolean) => {
    setFloorModeState(enabled);
    try {
      localStorage.setItem(FLOOR_MODE_STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      // Ignore storage errors
    }
  };

  const toggleFloorMode = () => {
    setFloorMode(!floorMode);
  };

  return (
    <FloorModeContext.Provider value={{ floorMode, toggleFloorMode, setFloorMode }}>
      <div data-floor-mode={floorMode ? "true" : "false"} className="contents">
        {children}
      </div>
    </FloorModeContext.Provider>
  );
}

export function useFloorMode() {
  return useContext(FloorModeContext);
}
