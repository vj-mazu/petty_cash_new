import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type ZoomLevel = 'fit' | '110' | '130' | '150';

interface ZoomContextType {
  zoomLevel: ZoomLevel;
  zoomScale: number;
  setZoomLevel: (level: ZoomLevel) => void;
}

const ZOOM_MAP: Record<ZoomLevel, number> = {
  fit: 1,
  '110': 1.1,
  '130': 1.3,
  '150': 1.5,
};

const ZoomContext = createContext<ZoomContextType | undefined>(undefined);

export const ZoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [zoomLevel, setZoomLevelState] = useState<ZoomLevel>(() => {
    const stored = localStorage.getItem('petty-cash-zoom');
    if (stored && stored in ZOOM_MAP) return stored as ZoomLevel;
    return 'fit';
  });

  const zoomScale = ZOOM_MAP[zoomLevel];

  const setZoomLevel = useCallback((level: ZoomLevel) => {
    setZoomLevelState(level);
    localStorage.setItem('petty-cash-zoom', level);
  }, []);

  return (
    <ZoomContext.Provider value={{ zoomLevel, zoomScale, setZoomLevel }}>
      {children}
    </ZoomContext.Provider>
  );
};

export const useZoom = () => {
  const ctx = useContext(ZoomContext);
  if (!ctx) throw new Error('useZoom must be used within a ZoomProvider');
  return ctx;
};
