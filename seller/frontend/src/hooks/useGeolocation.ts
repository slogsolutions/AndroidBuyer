import { useState, useEffect } from 'react';
import { getCurrentPosition } from '../utils/geolocation';

interface GeolocationState {
  latitude: number;
  longitude: number;
  error: string | null;
  loading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: 0,
    longitude: 0,
    error: null,
    loading: true,
  });

  useEffect(() => {
    getCurrentPosition()
      .then((position) => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          error: null,
          loading: false,
        });
      })
      .catch((error) => {
        setState({
          latitude: 0,
          longitude: 0,
          error: error.message,
          loading: false,
        });
      });
  }, []);

  return state;
}