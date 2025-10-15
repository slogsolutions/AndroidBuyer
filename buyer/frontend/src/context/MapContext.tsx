import React, { createContext, useContext, useState } from 'react';
import type { ViewState } from 'react-map-gl';

interface MapContextType {
  viewport: ViewState;
  setViewport: (viewport: ViewState) => void;
}

const MapContext = createContext<MapContextType | undefined>(undefined);

export function MapProvider({ children }: { children: React.ReactNode }) {
  const [viewport, setViewport] = useState<ViewState>({
    longitude: 0,
    latitude: 0,
    zoom: 13,
    bearing: 0,
    pitch: 0,
    padding: { top: 0, bottom: 0, left: 0, right: 0 }
  });

  return (
    <MapContext.Provider value={{ viewport, setViewport }}>
      {children}
    </MapContext.Provider>
  );
}

export function useMapContext() {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMapContext must be used within a MapProvider');
  }
  return context;
}