// src/pages/Home.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css'; // ensure map styles load
import { toast } from 'react-toastify';
import type { ParkingSpace } from '../types/parking';
import ParkingSpaceList from '../components/parking/ParkingSpaceList';
import ParkingMarker from '../components/map/ParkingMarker';
import ParkingPopup from '../components/map/ParkingPopup';
import { useMapContext } from '../context/MapContext';
import { parkingService } from '../services/parking.service';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import type { GeocodingResult } from '../utils/geocoding';

import {
  MdLocationOn,
  MdFilterList,
  MdGpsFixed,
  MdSearch,
  MdMyLocation,
  MdClose,
  MdAccessTime,
  MdSchedule,
  MdList,
  MdDragHandle
} from 'react-icons/md';
import { FaParking, FaMapMarkerAlt, FaShieldAlt, FaBolt, FaWheelchair, FaVideo, FaUmbrella } from 'react-icons/fa';
import LoadingScreen from './LoadingScreen';
import { useSocket } from '../context/SocketContext';
import { motion, AnimatePresence } from 'framer-motion';

// Debounce utility
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export default function Home() {
  const { viewport, setViewport } = useMapContext();
  const { user } = useAuth();
  const socket = useSocket();

  const [parkingSpaces, setParkingSpaces] = useState<ParkingSpace[]>([]);
  const [filteredSpaces, setFilteredSpaces] = useState<ParkingSpace[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<ParkingSpace | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchedLocation, setSearchedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [routeData, setRouteData] = useState<any>(null);
  const [popupTimeout, setPopupTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isPopupHovered, setIsPopupHovered] = useState(false);

  // UI state (bottom-sheet / modal)
  const [showFiltersBottomSheet, setShowFiltersBottomSheet] = useState(false);
  const [showParkingListBottomSheet, setShowParkingListBottomSheet] = useState(true);
  const [showTimeFilterModal, setShowTimeFilterModal] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFilterActive, setIsSearchFilterActive] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Time filter state
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);

  // Filters state
  const [filters, setFilters] = useState({
    amenities: {
      covered: false,
      security: false,
      charging: false,
      cctv: false,
      wheelchair: false,
    },
    priceRange: [0, 1000] as [number, number],
    isPriceFilterActive: false,
  });

  const amenityFilters = [
    { id: 'covered', label: 'Covered', icon: FaUmbrella, description: 'Protected from weather' },
    { id: 'security', label: 'Security', icon: FaShieldAlt, description: '24/7 security guard' },
    { id: 'charging', label: 'EV Charging', icon: FaBolt, description: 'Electric vehicle charging' },
    { id: 'cctv', label: 'CCTV', icon: FaVideo, description: 'Surveillance cameras' },
    { id: 'wheelchair', label: 'Accessible', icon: FaWheelchair, description: 'Wheelchair accessible' },
  ];

  // ---- time helpers ----
  const getCurrentDateTimeRounded = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    const roundedMinutes = minutes < 30 ? 30 : 0;
    now.setMinutes(roundedMinutes, 0, 0);
    if (roundedMinutes === 0 && minutes >= 30) {
      now.setHours(now.getHours() + 1);
    }
    return now.toISOString().slice(0, 16);
  };

  const getMinEndTime = () => {
    if (!startTime) return getCurrentDateTimeRounded();
    const start = new Date(startTime);
    start.setMinutes(start.getMinutes() + 30);
    return start.toISOString().slice(0, 16);
  };

  const getMaxDateTime = () => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    return maxDate.toISOString().slice(0, 16);
  };

  const validateTimeSelection = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const now = new Date();

    if (startDate < now) {
      toast.error('Start time cannot be in the past');
      return false;
    }
    if (endDate <= startDate) {
      toast.error('End time must be after start time');
      return false;
    }
    const diffMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
    if (diffMinutes < 30) {
      toast.error('Minimum booking duration is 30 minutes');
      return false;
    }
    return true;
  };

  const formatDisplayTime = (datetime: string) => {
    if (!datetime) return '';
    const date = new Date(datetime);
    return date
      .toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
      .replace('AM', '')
      .replace('PM', '')
      .trim();
  };

  // ---- price meta (unchanged functionality) ----
  const computePriceMeta = (space: any) => {
    const baseRaw = space?.priceParking ?? space?.pricePerHour ?? space?.price ?? 0;
    const base = Number(baseRaw) || 0;
    const rawDiscount = space?.discount ?? 0;
    const discount = Number(rawDiscount);
    const clamped = Number.isFinite(discount) ? Math.max(0, Math.min(100, discount)) : 0;
    const discounted = +(base * (1 - clamped / 100)).toFixed(2);
    return {
      basePrice: +base.toFixed(2),
      discountedPrice: discounted,
      discountPercent: clamped,
      hasDiscount: clamped > 0 && discounted < base,
    };
  };

  // only approved + online (unchanged)
  const onlyApproved = (spaces: any[] | undefined | null) => {
    if (!Array.isArray(spaces)) return [];
    return spaces.filter((s) => {
      const status = String(s?.status || '').toLowerCase();
      const online = typeof s?.isOnline !== 'undefined' ? Boolean(s.isOnline) : false;
      return status === 'submitted' && online;
    });
  };

  // keep filteredSpaces in sync
  useEffect(() => {
    setFilteredSpaces(parkingSpaces);
  }, [parkingSpaces]);

  // sockets: realtime updates honoring time filter (unchanged behavior)
  useEffect(() => {
    if (!socket) return;

    const handleParkingUpdate = (data: any) => {
      if (!data) return;
      const parkingId = data.parkingId || data._id || data.id;
      const availableSpots =
        typeof data.availableSpots === 'number' ? data.availableSpots : data.available || data.availableSpots;

      setParkingSpaces((prev) => {
        const pid = String(parkingId);
        const idx = prev.findIndex((s: any) => {
          const sid = s._id ? (typeof s._id === 'string' ? s._id : String(s._id)) : s.id;
          return sid === pid;
        });

        const incomingStatus = String(data.status || '').toLowerCase();
        const incomingOnline = typeof data.isOnline !== 'undefined' ? Boolean(data.isOnline) : true;

        if ((incomingStatus && incomingStatus !== 'submitted') || incomingOnline === false) {
          if (idx >= 0) {
            const copy = [...prev];
            copy.splice(idx, 1);
            return copy;
          }
          return prev;
        }

        if (startTime && endTime && typeof availableSpots === 'number' && availableSpots <= 0) {
          if (idx >= 0) {
            const copy = [...prev];
            copy.splice(idx, 1);
            return copy;
          }
          return prev;
        }

        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...data, ...(typeof availableSpots === 'number' ? { availableSpots } : {}) };
          return copy;
        } else {
          if ((data.status && String(data.status).toLowerCase() !== 'submitted') || (typeof data.isOnline !== 'undefined' && !data.isOnline)) {
            return prev;
          }
          if (startTime && endTime && typeof availableSpots === 'number' && availableSpots <= 0) {
            return prev;
          }
          const newSpace = { ...data, __price: data.__price ?? computePriceMeta(data) };
          return [newSpace, ...prev];
        }
      });

      setFilteredSpaces((prev) => {
        const pid = String(parkingId);
        const idx = prev.findIndex((s: any) => {
          const sid = s._id ? (typeof s._id === 'string' ? s._id : String(s._id)) : s.id;
          return sid === pid;
        });

        const incomingStatus = String(data.status || '').toLowerCase();
        const incomingOnline = typeof data.isOnline !== 'undefined' ? Boolean(data.isOnline) : true;

        if ((incomingStatus && incomingStatus !== 'submitted') || incomingOnline === false) {
          if (idx >= 0) {
            const copy = [...prev];
            copy.splice(idx, 1);
            return copy;
          }
          return prev;
        }

        if (startTime && endTime && typeof availableSpots === 'number' && availableSpots <= 0) {
          if (idx >= 0) {
            const copy = [...prev];
            copy.splice(idx, 1);
            return copy;
          }
          return prev;
        }

        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...data, ...(typeof availableSpots === 'number' ? { availableSpots } : {}) };
          return copy;
        } else {
          if ((data.status && String(data.status).toLowerCase() !== 'submitted') || (typeof data.isOnline !== 'undefined' && !data.isOnline)) return prev;
          if (startTime && endTime && typeof availableSpots === 'number' && availableSpots <= 0) return prev;
          const newSpace = { ...data, __price: data.__price ?? computePriceMeta(data) };
          return [newSpace, ...prev];
        }
      });

      setSelectedSpace((prev) => {
        if (!prev) return prev;
        const sid = prev._id ? (typeof prev._id === 'string' ? prev._id : String(prev._id)) : (prev as any).id;
        if (sid === String(parkingId)) {
          if ((data.status && String(data.status).toLowerCase() !== 'submitted') || (typeof data.isOnline !== 'undefined' && !data.isOnline)) {
            return null;
          }
          if (startTime && endTime && typeof availableSpots === 'number' && availableSpots <= 0) {
            return null;
          }
          return { ...prev, ...(typeof availableSpots === 'number' ? { availableSpots } : {}), ...data } as any;
        }
        return prev;
      });
    };

    socket.on('parking-updated', handleParkingUpdate);
    socket.on('parking-released', handleParkingUpdate);
    return () => {
      socket.off('parking-updated', handleParkingUpdate);
      socket.off('parking-released', handleParkingUpdate);
    };
  }, [socket, startTime, endTime]);

  // debounced popup close
  const debouncedClosePopup = useCallback(() => {
    if (popupTimeout) clearTimeout(popupTimeout);
    if (!isPopupHovered) {
      const timeout = setTimeout(() => setSelectedSpace(null), 300);
      setPopupTimeout(timeout);
    }
  }, [popupTimeout, isPopupHovered]);

  useEffect(() => {
    return () => {
      if (popupTimeout) clearTimeout(popupTimeout);
    };
  }, [popupTimeout]);

  // ----- Geolocation & initial load -----
  useEffect(() => {
    const init = async () => {
      try {
        if ('permissions' in navigator) {
          const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          if (permission.state === 'granted' || permission.state === 'prompt') {
            await getUserLocation();
          } else {
            await setDefaultLocation();
          }
        } else {
          await getUserLocation();
        }
      } catch {
        await setDefaultLocation();
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setDefaultLocation = async () => {
    const defaultLat = 28.6139;
    const defaultLng = 77.2090;
    setViewport({
      latitude: defaultLat,
      longitude: defaultLng,
      zoom: 16,
      pitch: 30,
      bearing: -10,
    } as any);
    setCurrentLocation({ lat: defaultLat, lng: defaultLng });
    await loadDefaultParkingMarkers(defaultLat, defaultLng);
    setLoading(false);
  };

  const getUserLocation = async () => {
    if (!navigator.geolocation) {
      await setDefaultLocation();
      return;
    }
    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setViewport({
            latitude,
            longitude,
            zoom: 16,
            pitch: 35,
            bearing: -12,
          } as any);
          setCurrentLocation({ lat: latitude, lng: longitude });
          await loadDefaultParkingMarkers(latitude, longitude);
          setLoading(false);
          resolve();
        },
        async (error) => {
          console.error('Location error:', error);
          toast.error(
            <div className="flex items-center justify-between">
              <span>Could not get your location. Please enable location services.</span>
              <button
                onClick={() => {
                  if (navigator.userAgent.includes('Chrome')) {
                    window.open('chrome://settings/content/location', '_blank');
                  } else if (navigator.userAgent.includes('Firefox')) {
                    window.open('about:preferences#privacy', '_blank');
                  } else {
                    window.open('chrome://settings/content/location', '_blank');
                  }
                }}
                className="bg-blue-600 text-white px-3 py-1 ml-2 rounded-lg hover:bg-blue-700 text-sm transition-all duration-300 hover:scale-105"
              >
                Enable Location
              </button>
            </div>,
            { autoClose: false }
          );
          await setDefaultLocation();
          resolve();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    });
  };

  const loadDefaultParkingMarkers = async (lat: number, lng: number) => {
    try {
      setLoading(true);
      if (typeof (parkingService as any).getAllSpaces === 'function') {
        try {
          const all = await (parkingService as any).getAllSpaces(startTime ?? undefined, endTime ?? undefined, true);
          if (Array.isArray(all) && all.length > 0) {
            let allowed = onlyApproved(all).map((s) => ({ ...s, __price: s.__price ?? computePriceMeta(s) }));
            if (startTime && endTime) {
              allowed = allowed.filter((s: any) => Number(s.availableSpots) > 0);
            }
            setParkingSpaces(allowed);
            return;
          }
        } catch (err) {
          console.warn('getAllSpaces failed, falling back to getNearbySpaces', err);
        }
      }
      const spaces = await parkingService.getNearbySpaces(
        lat, lng, startTime ?? undefined, endTime ?? undefined, true
      );
      let allowed = onlyApproved(spaces).map((s) => ({ ...s, __price: s.__price ?? computePriceMeta(s) }));
      if (startTime && endTime) {
        allowed = allowed.filter((s: any) => Number(s.availableSpots) > 0);
      }
      setParkingSpaces(allowed || []);
    } catch (err) {
      console.error('Failed to load default parking markers', err);
      setParkingSpaces([]);
      toast.error('Failed to load parking markers.');
    } finally {
      setLoading(false);
    }
  };

  const fetchNearbyParkingSpaces = async (_lat: number, _lng: number) => {
    try {
      setLoading(true);
      const spaces = await parkingService.getAllSpaces(startTime ?? undefined, endTime ?? undefined, true);
      const spacesWithPrice = (spaces || []).map((s: any) => ({ ...s, __price: s.__price ?? computePriceMeta(s) }));
      let allowed = onlyApproved(spacesWithPrice);
      if (startTime && endTime) allowed = allowed.filter((s) => Number(s.availableSpots) > 0);
      setParkingSpaces(allowed);
      if (allowed && allowed.length > 0) {
        setTimeout(() => {
          setViewport((prev: any) => ({
            ...(prev || {}),
            zoom: Math.min((prev?.zoom ?? 9), 11),
          }));
        }, 500);
      }
    } catch (error) {
      console.error('Failed to fetch parking spaces.', error);
      toast.error('Failed to fetch parking spaces.');
    } finally {
      setLoading(false);
    }
  };

  // handlers (unchanged behavior)
  const handleSearchByCurrentLocation = () => {
    if (currentLocation) {
      setIsSearchFilterActive(false);
      setSearchedLocation(null);
      setSearchQuery('');
      setViewport((prev: any) => ({
        ...(prev || {}),
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        zoom: 16
      }));
      loadDefaultParkingMarkers(currentLocation.lat, currentLocation.lng);
      toast.success('Showing parking spaces around you');
    } else {
      toast.info('Current location not available.');
    }
  };

  const handleMarkerClick = async (space: ParkingSpace) => {
    setSelectedSpace(space);
    if (popupTimeout) clearTimeout(popupTimeout);
    setViewport((prev: any) => ({
      ...(prev || {}),
      latitude: space.location.coordinates[1],
      longitude: space.location.coordinates[0],
    }));
    if (currentLocation) {
      const { lat: originLat, lng: originLng } = currentLocation;
      const [destLng, destLat] = space.location.coordinates;
      await fetchRoute(originLat, originLng, destLat, destLng);
    }
  };

  const handleMarkerHover = (space: ParkingSpace) => {
    setSelectedSpace(space);
    if (popupTimeout) clearTimeout(popupTimeout);
  };

  const handlePopupMouseEnter = () => {
    setIsPopupHovered(true);
    if (popupTimeout) clearTimeout(popupTimeout);
  };
  const handlePopupMouseLeave = () => {
    setIsPopupHovered(false);
    debouncedClosePopup();
  };
  const handleClosePopup = () => {
    setSelectedSpace(null);
    if (popupTimeout) clearTimeout(popupTimeout);
  };

  const handleFilterToggle = (amenity: string) => {
    setFilters((prev) => ({
      ...prev,
      amenities: { ...prev.amenities, [amenity]: !prev.amenities[amenity as keyof typeof prev.amenities] },
    }));
  };
  const handlePriceRangeChange = (min: number, max: number) => {
    setFilters((prev) => ({ ...prev, priceRange: [min, max], isPriceFilterActive: true }));
  };
  const clearAllFilters = () => {
    setFilters({
      amenities: { covered: false, security: false, charging: false, cctv: false, wheelchair: false },
      priceRange: [0, 1000],
      isPriceFilterActive: false,
    });
  };
  const getActiveFilterCount = () => {
    const activeAmenities = Object.values(filters.amenities).filter(Boolean).length;
    const isPriceFiltered = filters.isPriceFilterActive;
    return activeAmenities + (isPriceFiltered ? 1 : 0);
  };

  const fetchRoute = async (originLat: number, originLng: number, destLat: number, destLng: number) => {
    try {
      const response = await axios.get(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${originLng},${originLat};${destLng},${destLat}`,
        {
          params: {
            alternatives: false,
            geometries: 'geojson',
            overview: 'full',
            steps: true,
            access_token:
              'pk.eyJ1IjoicGFya2Vhc2UxIiwiYSI6ImNtNGN1M3pmZzBkdWoya3M4OGFydjgzMzUifQ.wbsW51a7zFMq0yz0SeV6_A',
          },
        }
      );
      setRouteData(response.data.routes[0]);
    } catch (error) {
      console.error('Route fetch error:', error);
    }
  };

  const handleGoToCurrentLocation = () => {
    if (currentLocation) {
      setViewport((prev: any) => ({
        ...(prev || {}),
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        zoom: 16
      }));
      loadDefaultParkingMarkers(currentLocation.lat, currentLocation.lng);
    } else {
      toast.info('Current location not available.');
    }
  };

  // Route layer (unchanged)
  const routeLayer = {
    id: 'route',
    type: 'line' as const,
    source: 'route',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#3887be', 'line-width': 5 },
  };
  const routeSourceData = routeData ? { type: 'Feature', geometry: routeData.geometry } : null;

  // Geocoding (unchanged)
  const searchLocations = async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    try {
      const response = await axios.get(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
        {
          params: {
            access_token:
              'pk.eyJ1IjoicGFya2Vhc2UxIiwiYSI6ImNtNGN1M3pmZzBkdWoya3M4OGFydjgzMzUifQ.wbsW51a7zFMq0yz0SeV6_A',
            limit: 5,
            types: 'place,locality,neighborhood,address',
            proximity: currentLocation ? `${currentLocation.lng},${currentLocation.lat}` : undefined,
          },
        }
      );
      const results: GeocodingResult[] = response.data.features.map((f: any) => ({
        latitude: f.center[1],
        longitude: f.center[0],
        address: f.place_name,
      }));
      setSearchResults(results);
      setShowSearchResults(true);
    } catch (e) {
      console.error('Geocoding error:', e);
      toast.error('Failed to search locations');
    }
  };
  const debouncedSearch = useCallback(debounce((query: string) => searchLocations(query), 300), [currentLocation]);

  const handleSearchInputChange = async (query: string) => {
    setSearchQuery(query);
    setIsSearchFilterActive(true);
    debouncedSearch(query);
  };

  const handleLocationSelect = async (result: GeocodingResult) => {
    setIsSearchFilterActive(false);
    setSearchQuery(result.address || '');
    setSearchedLocation({ lat: result.latitude, lng: result.longitude });
    setViewport((prev: any) => ({
      ...(prev || {}),
      longitude: result.longitude,
      latitude: result.latitude,
      zoom: 16,
    }));
    setShowSearchResults(false);

    try {
      setLoading(true);
      const spaces = await parkingService.getNearbySpaces(
        result.latitude, result.longitude, startTime ?? undefined, endTime ?? undefined, true
      );
      const spacesWithPrice = (spaces || []).map((s: any) => ({ ...s, __price: s.__price ?? computePriceMeta(s) }));
      let allowed = onlyApproved(spacesWithPrice);
      if (startTime && endTime) allowed = allowed.filter((s) => Number(s.availableSpots) > 0);
      setParkingSpaces(allowed);
      if (!allowed || allowed.length === 0) {
        toast.info('No parking spaces found in this area. Try increasing the search radius or remove time filter.');
      } else {
        toast.success(`Found ${allowed.length} parking spaces near ${result.address.split(',')[0]}`);
      }
    } catch {
      toast.error('Failed to fetch parking spaces for the selected location.');
    } finally {
      setLoading(false);
    }
  };

  // ----- Draggable Bottom Sheet Logic: Parking List -----
  const listSheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isDragging = useRef(false);
  const initialSheetHeight = useRef(0);

  const MIN_HEIGHT = 120;
  const MAX_HEIGHT = typeof window !== 'undefined' ? window.innerHeight * 0.85 : 600;
  const MID_HEIGHT = typeof window !== 'undefined' ? window.innerHeight * 0.5 : 400;

  const [sheetHeight, setSheetHeight] = useState(0);

  useEffect(() => {
    if (!showParkingListBottomSheet) {
      setSheetHeight(0);
      return;
    }
    if (!sheetHeight) setSheetHeight(MIN_HEIGHT);
  }, [showParkingListBottomSheet]);

  const onDragStart = (e: React.PointerEvent) => {
    if (!listSheetRef.current) return;
    isDragging.current = true;
    startY.current = e.clientY;
    initialSheetHeight.current = listSheetRef.current.offsetHeight;
    listSheetRef.current.style.transition = 'none';
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onDragMove = (e: PointerEvent) => {
    if (!isDragging.current || !listSheetRef.current) return;
    const deltaY = startY.current - e.clientY;
    let newHeight = initialSheetHeight.current + deltaY;
    newHeight = Math.min(Math.max(newHeight, MIN_HEIGHT), MAX_HEIGHT);
    listSheetRef.current.style.height = `${newHeight}px`;
  };

  const onDragEnd = () => {
    if (!isDragging.current || !listSheetRef.current) return;
    isDragging.current = false;
    listSheetRef.current.style.transition = 'height 0.3s ease-out';
    const finalHeight = listSheetRef.current.offsetHeight;
    if (finalHeight > MID_HEIGHT) setSheetHeight(MAX_HEIGHT);
    else if (finalHeight > MIN_HEIGHT && finalHeight <= MID_HEIGHT) setSheetHeight(MIN_HEIGHT);
    else setSheetHeight(MIN_HEIGHT);
  };

  useEffect(() => {
    if (showParkingListBottomSheet) {
      window.addEventListener('pointermove', onDragMove);
      window.addEventListener('pointerup', onDragEnd);
      window.addEventListener('pointercancel', onDragEnd);
    }
    return () => {
      window.removeEventListener('pointermove', onDragMove);
      window.removeEventListener('pointerup', onDragEnd);
      window.removeEventListener('pointercancel', onDragEnd);
    };
  }, [showParkingListBottomSheet]);

  const openListSheet = (height?: number) => {
    const target = typeof height === 'number' ? Math.min(Math.max(height, MIN_HEIGHT), MAX_HEIGHT) : MIN_HEIGHT;
    setShowParkingListBottomSheet(true);
    setSheetHeight(target);
    if (listSheetRef.current) listSheetRef.current.style.height = `${target}px`;
  };

  // ----- Draggable Bottom Sheet Logic: Filters -----
  const filterSheetRef = useRef<HTMLDivElement>(null);
  const startFilterY = useRef(0);
  const initialFilterHeight = useRef(0);
  const isFilterDragging = useRef(false);

  const MIN_FILTER_HEIGHT = typeof window !== 'undefined' ? window.innerHeight * 0.45 : 360;
  const MAX_FILTER_HEIGHT = typeof window !== 'undefined' ? window.innerHeight * 0.95 : 760;
  const MID_FILTER_HEIGHT = typeof window !== 'undefined' ? window.innerHeight * 0.6 : 520;

  const [filterSheetHeight, setFilterSheetHeight] = useState(MIN_FILTER_HEIGHT);

  useEffect(() => {
    if (!showFiltersBottomSheet) {
      setFilterSheetHeight(0);
      return;
    }
    setFilterSheetHeight(MIN_FILTER_HEIGHT);
  }, [showFiltersBottomSheet]);

  const onFilterDragStart = (e: React.PointerEvent) => {
    if (!filterSheetRef.current) return;
    isFilterDragging.current = true;
    startFilterY.current = e.clientY;
    initialFilterHeight.current = filterSheetRef.current.offsetHeight;
    filterSheetRef.current.style.transition = 'none';
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onFilterDragMove = (e: PointerEvent) => {
    if (!isFilterDragging.current || !filterSheetRef.current) return;
    const deltaY = startFilterY.current - e.clientY;
    let newHeight = initialFilterHeight.current + deltaY;
    newHeight = Math.min(Math.max(newHeight, MIN_FILTER_HEIGHT), MAX_FILTER_HEIGHT);
    filterSheetRef.current.style.height = `${newHeight}px`;
  };

  const onFilterDragEnd = () => {
    if (!isFilterDragging.current || !filterSheetRef.current) return;
    isFilterDragging.current = false;
    filterSheetRef.current.style.transition = 'height 0.3s ease-out';
    const finalHeight = filterSheetRef.current.offsetHeight;
    if (finalHeight > MID_FILTER_HEIGHT) setFilterSheetHeight(MAX_FILTER_HEIGHT);
    else setFilterSheetHeight(MIN_FILTER_HEIGHT);
  };

  useEffect(() => {
    if (showFiltersBottomSheet) {
      window.addEventListener('pointermove', onFilterDragMove);
      window.addEventListener('pointerup', onFilterDragEnd);
      window.addEventListener('pointercancel', onFilterDragEnd);
    }
    return () => {
      window.removeEventListener('pointermove', onFilterDragMove);
      window.removeEventListener('pointerup', onFilterDragEnd);
      window.removeEventListener('pointercancel', onFilterDragEnd);
    };
  }, [showFiltersBottomSheet]);

  // ✅ Safe fallback view state so Map never receives undefined values
  const safeViewState = {
    latitude: typeof viewport?.latitude === 'number' ? viewport.latitude : 28.6139,
    longitude: typeof viewport?.longitude === 'number' ? viewport.longitude : 77.2090,
    zoom: typeof viewport?.zoom === 'number' ? viewport.zoom : 12,
    pitch: typeof viewport?.pitch === 'number' ? viewport.pitch : 0,
    bearing: typeof viewport?.bearing === 'number' ? viewport.bearing : 0,
  };

  // ----- Loading -----
  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 animate-gradient-x">
        <LoadingScreen />
      </div>
    );
  }

  // ----- Render -----
  return (
    <div className="h-screen relative bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 animate-gradient-x overflow-hidden">
      {/* Top Header - Compact */}
      <div className="absolute top-0 left-0 right-0 z-20 p-3 bg-white/95 backdrop-blur-md shadow-lg animate-fade-in-down">
        {/* Search Input */}
        <div className="relative mb-3">
          <MdSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-xl z-10" />
          <input
            type="text"
            placeholder="Search for locations, areas, or landmarks..."
            value={searchQuery}
            onChange={(e) => handleSearchInputChange(e.target.value)}
            className="w-full pl-12 pr-12 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-sm font-medium placeholder-gray-500 transition-all duration-300"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setShowSearchResults(false);
                setIsSearchFilterActive(false);
                if (currentLocation) loadDefaultParkingMarkers(currentLocation.lat, currentLocation.lng);
              }}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-all duration-300"
            >
              <MdClose className="text-xl" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute top-full left-3 right-3 mt-1 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 overflow-hidden z-30 max-h-40 overflow-y-auto animate-fade-in-up">
            {searchResults.map((result, index) => (
              <button
                key={index}
                onClick={() => handleLocationSelect(result)}
                className="w-full px-4 py-2 text-left hover:bg-blue-50 transition-all duration-300 border-b border-gray-100 last:border-b-0 flex items-center gap-2"
              >
                <MdLocationOn className="text-blue-500 text-lg flex-shrink-0" />
                <div className="text-left">
                  <div className="font-medium text-gray-900 text-xs">{result.address.split(',')[0]}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {result.address.split(',').slice(1).join(',').trim()}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Action Buttons Row */}
        <div className="flex gap-2 justify-between">
          {/* Time Filter Button */}
          <button
            onClick={() => setShowTimeFilterModal(true)}
            className="flex-1 bg-white/80 backdrop-blur-sm px-3 py-2 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-center gap-2 text-sm border border-gray-100 group transform hover:scale-105"
          >
            <MdAccessTime className="text-lg text-blue-600" />
            <span className="font-medium text-gray-700">Time</span>
            {(startTime || endTime) && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse ml-1" />}
          </button>

          {/* Filters Button */}
          <button
            onClick={() => setShowFiltersBottomSheet(true)}
            className="flex-1 bg-white/80 backdrop-blur-sm px-3 py-2 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-center gap-2 text-sm border border-gray-100 group transform hover:scale-105"
          >
            <MdFilterList className="text-lg text-purple-600" />
            <span className="font-medium text-gray-700">Filters</span>
            {getActiveFilterCount() > 0 && (
              <span className="w-4 h-4 bg-purple-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse ml-1">
                {getActiveFilterCount()}
              </span>
            )}
          </button>

          {/* Toggle Parking List Button */}
          <button
            onClick={() => {
              if (!showParkingListBottomSheet) {
                openListSheet(MIN_FILTER_HEIGHT);
              } else {
                setShowParkingListBottomSheet(false);
              }
            }}
            className="flex-1 bg-white/80 backdrop-blur-sm px-3 py-2 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-center gap-2 text-sm border border-gray-100 group transform hover:scale-105"
          >
            <MdList className="text-lg text-green-600" />
            <span className="font-medium text-gray-700">List</span>
            {filteredSpaces.length > 0 && (
              <span className="w-4 h-4 bg-green-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-pulse ml-1">
                {filteredSpaces.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Current Location Floating Button */}
      <motion.button
        onClick={handleGoToCurrentLocation}
        className="fixed bottom-24 right-4 z-10 bg-white/90 backdrop-blur-sm p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 group transform hover:scale-110"
        title="Go to current location"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, type: 'spring', stiffness: 300 }}
      >
        <MdGpsFixed className="text-2xl text-blue-600 group-hover:scale-110 transition-transform duration-300" />
      </motion.button>

      {/* Map */}
      <div className="relative w-full h-full">
        <Map
          {...safeViewState}
          onMove={(evt) => setViewport(evt.viewState as any)}
          mapboxAccessToken="pk.eyJ1IjoicGFya2Vhc2UxIiwiYSI6ImNtNGN1M3pmZzBkdWoya3M4OGFydjgzMzUifQ.wbsW51a7zFMq0yz0SeV6_A"
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
        >
          {/* Current Location Marker */}
          {currentLocation && (
            <ParkingMarker
              latitude={currentLocation.lat}
              longitude={currentLocation.lng}
              color="#3b82f6"
              isCurrentLocation={true}
              icon={FaMapMarkerAlt}
            />
          )}

          {/* Parking markers */}
          {filteredSpaces.map((space) => {
            const key =
              typeof (space as any)._id === 'object' && ((space as any)._id as any).toString
                ? ((space as any)._id as any).toString()
                : ((space as any)._id as string);
            return (
              <ParkingMarker
                key={key}
                space={space}
                latitude={(space as any).location.coordinates[1]}
                longitude={(space as any).location.coordinates[0]}
                onClick={() => handleMarkerClick(space)}
                onMouseEnter={() => handleMarkerHover(space)}
                onMouseLeave={debouncedClosePopup}
                color="#10b981"
                icon={FaParking}
              />
            );
          })}

          {/* Route visualization */}
          {routeSourceData && (
            <Source id="route" type="geojson" data={routeSourceData}>
              <Layer {...routeLayer} />
            </Source>
          )}

          {/* Searched location marker */}
          {searchedLocation && (
            <ParkingMarker
              latitude={searchedLocation.lat}
              longitude={searchedLocation.lng}
              color="#ef4444"
              icon={() => <MdLocationOn style={{ fontSize: '28px', color: '#ef4444' }} />}
              isCurrentLocation={false}
            />
          )}

          {/* Popup */}
          {selectedSpace && (
            <ParkingPopup
              space={selectedSpace}
              latitude={selectedSpace.location.coordinates[1]}
              longitude={selectedSpace.location.coordinates[0]}
              onClose={handleClosePopup}
              onMouseEnter={handlePopupMouseEnter}
              onMouseLeave={handlePopupMouseLeave}
              user={user ?? null}
              startTime={startTime}
              endTime={endTime}
            />
          )}
        </Map>
      </div>

      {/* Time Filter Modal (Full-Screen bottom sheet style) */}
      <AnimatePresence>
        {showTimeFilterModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
            onClick={() => setShowTimeFilterModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white/95 backdrop-blur-sm rounded-t-2xl shadow-2xl p-6 w-full max-w-lg fixed bottom-0 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                  <MdSchedule className="text-blue-600 text-xl" />
                  Select Parking Time
                  {(startTime || endTime) && (
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium animate-pulse">
                      Active
                    </span>
                  )}
                </h3>
                <button
                  onClick={() => setShowTimeFilterModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-all duration-300"
                >
                  <MdClose className="text-xl" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Start Time */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <MdAccessTime className="text-blue-500" />
                    Start Time
                    {startTime && (
                      <span className="text-green-600 text-xs bg-green-50 px-2 py-1 rounded-lg animate-fade-in">
                        📅 {formatDisplayTime(startTime)}
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="datetime-local"
                      step="1800"
                      min={getCurrentDateTimeRounded()}
                      max={getMaxDateTime()}
                      value={startTime ?? ''}
                      onChange={(e) => {
                        const newStartTime = e.target.value;
                        setStartTime(newStartTime);
                        if (endTime && newStartTime && new Date(endTime) <= new Date(newStartTime)) {
                          setEndTime('');
                        }
                      }}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 bg-white"
                    />
                  </div>
                </div>

                {/* End Time */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <MdAccessTime className="text-green-500" />
                    End Time
                    {endTime && (
                      <span className="text-green-600 text-xs bg-green-50 px-2 py-1 rounded-lg animate-fade-in">
                        🕒 {formatDisplayTime(endTime)}
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="datetime-local"
                      step="1800"
                      min={getMinEndTime()}
                      max={getMaxDateTime()}
                      value={endTime ?? ''}
                      onChange={(e) => setEndTime(e.target.value)}
                      className={`w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300 ${
                        !startTime ? 'bg-gray-100 cursor-not-allowed' : 'bg-white focus:border-green-500'
                      }`}
                      disabled={!startTime}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={async () => {
                      if (startTime && endTime && !validateTimeSelection(startTime, endTime)) return;
                      try {
                        setLoading(true);
                        if (currentLocation) {
                          const spaces = await parkingService.getNearbySpaces(
                            currentLocation.lat, currentLocation.lng, startTime ?? undefined, endTime ?? undefined, true
                          );
                          let spacesWithPrice = (spaces || []).map((s: any) => ({ ...s, __price: s.__price ?? computePriceMeta(s) }));
                          let allowed = onlyApproved(spacesWithPrice);
                          if (startTime && endTime) allowed = allowed.filter((s) => Number(s.availableSpots) > 0);
                          setParkingSpaces(allowed);
                        } else {
                          const spaces = await parkingService.getAllSpaces(startTime ?? undefined, endTime ?? undefined, true);
                          let spacesWithPrice = (spaces || []).map((s: any) => ({ ...s, __price: s.__price ?? computePriceMeta(s) }));
                          let allowed = onlyApproved(spacesWithPrice);
                          if (startTime && endTime) allowed = allowed.filter((s) => Number(s.availableSpots) > 0);
                          setParkingSpaces(allowed);
                        }
                        toast.success('🎯 Time filter applied successfully!');
                        setShowTimeFilterModal(false);
                      } catch {
                        toast.error('Unable to apply time filter.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={startTime && endTime ? !validateTimeSelection(startTime, endTime) : true}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform hover:scale-105 shadow-lg hover:shadow-xl"
                  >
                    <MdSchedule className="text-lg" />
                    Apply Time Filter
                  </button>

                  <button
                    onClick={async () => {
                      setStartTime(null);
                      setEndTime(null);
                      try {
                        setLoading(true);
                        if (currentLocation) {
                          const spaces = await parkingService.getNearbySpaces(currentLocation.lat, currentLocation.lng);
                          const spacesWithPrice = (spaces || []).map((s: any) => ({ ...s, __price: s.__price ?? computePriceMeta(s) }));
                          setParkingSpaces(onlyApproved(spacesWithPrice));
                        } else {
                          const spaces = await parkingService.getAllSpaces();
                          const spacesWithPrice = (spaces || []).map((s: any) => ({ ...s, __price: s.__price ?? computePriceMeta(s) }));
                          setParkingSpaces(onlyApproved(spacesWithPrice));
                        }
                        toast.info('🕒 Time filter cleared');
                        setShowTimeFilterModal(false);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="px-6 py-3 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all duration-300 bg-white flex items-center justify-center gap-2 transform hover:scale-105"
                  >
                    <MdClose className="text-lg" />
                    Clear
                  </button>
                </div>

                {/* Info */}
                <div className="text-xs text-gray-500 text-center pt-3 border-t border-gray-100 bg-blue-50 rounded-lg p-3">
                  <p className="font-medium mb-1">⏰ 24-hour format • 30-minute intervals</p>
                  <p>Book parking slots in advance (up to 30 days)</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters Bottom Sheet */}
      <AnimatePresence>
        {showFiltersBottomSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black bg-opacity-50"
            onClick={() => setShowFiltersBottomSheet(false)}
          >
            <motion.div
              ref={filterSheetRef}
              initial={{ y: '100%', height: MIN_FILTER_HEIGHT }}
              animate={{ y: 0, height: filterSheetHeight }}
              exit={{ y: '100%', height: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300, height: { duration: 0.3 } }}
              className="bg-white/95 backdrop-blur-sm rounded-t-2xl shadow-2xl w-full max-w-lg fixed bottom-0 flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              style={{ maxHeight: MAX_FILTER_HEIGHT, minHeight: MIN_FILTER_HEIGHT }}
            >
              {/* Grab handle */}
              <div className="w-full flex justify-center py-3 cursor-grab touch-none" onPointerDown={onFilterDragStart}>
                <MdDragHandle className="text-gray-400 text-3xl" />
              </div>

              {/* Header */}
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-gray-800 text-lg">Filter Parking</h3>
                <div className="flex gap-2">
                  <button
                    onClick={clearAllFilters}
                    className="text-xs bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-1 rounded-full hover:opacity-90 transition-all duration-300 font-medium"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => setShowFiltersBottomSheet(false)}
                    className="text-gray-400 hover:text-gray-600 transition-all duration-300"
                  >
                    <MdClose className="text-xl" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Price Range */}
                <div>
                  <h4 className="font-semibold text-gray-700 text-sm mb-3 flex items-center gap-2">
                    <span>Price Range</span>
                    <span className="text-xs bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text font-medium">
                      {filters.isPriceFilterActive ? `₹${filters.priceRange[0]} - ₹${filters.priceRange[1]}/hr` : 'Any price'}
                    </span>
                  </h4>
                  <div className="flex items-center justify-between mb-2 text-xs text-gray-600">
                    <span>₹0</span>
                    <span>₹1000</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    step="50"
                    value={filters.priceRange[1]}
                    onChange={(e) => handlePriceRangeChange(filters.priceRange[0], parseInt(e.target.value))}
                    className="w-full slider-thumb"
                  />
                </div>

                {/* Amenities */}
                <div>
                  <h4 className="font-semibold text-gray-700 text-sm mb-3">Amenities</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {amenityFilters.map((amenity) => {
                      const IconComponent = amenity.icon;
                      const isActive = filters.amenities[amenity.id as keyof typeof filters.amenities];
                      return (
                        <button
                          key={amenity.id}
                          onClick={() => handleFilterToggle(amenity.id)}
                          className={`relative w-full flex flex-col items-center p-3 rounded-lg transition-all duration-300 transform hover:scale-[1.02] border ${
                            isActive
                              ? 'bg-gradient-to-b from-blue-50 to-purple-50 border-blue-300 shadow-md'
                              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <div
                            className={`p-2 rounded-full mb-2 transition-all duration-300 ${
                              isActive
                                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white transform scale-110 shadow-lg'
                                : 'bg-gray-200 text-gray-600'
                            }`}
                          >
                            <IconComponent className="text-xl" />
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-gray-800 text-xs leading-tight">{amenity.label}</div>
                          </div>
                          <div
                            className={`absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                              isActive
                                ? 'bg-gradient-to-r from-blue-500 to-purple-500 border-blue-500 transform scale-110'
                                : 'bg-white border-gray-300'
                            }`}
                          >
                            {isActive && <span className="text-white text-xs font-bold animate-scale-in">✓</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Apply */}
              <div className="p-4 border-t border-gray-100 bg-white/95 sticky bottom-0">
                <button
                  onClick={() => setShowFiltersBottomSheet(false)}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl text-base font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.01]"
                >
                  Apply Filters
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Parking List Bottom Sheet */}
      <AnimatePresence>
        {showParkingListBottomSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 flex items-end justify-center bg-black bg-opacity-50 pointer-events-none"
            onClick={() => setShowParkingListBottomSheet(false)}
          >
            <motion.div
              ref={listSheetRef}
              initial={{ y: '100%', height: MIN_HEIGHT }}
              animate={{ y: 0, height: sheetHeight }}
              exit={{ y: '100%', height: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300, height: { duration: 0.3 } }}
              className="bg-white/95 backdrop-blur-sm rounded-t-2xl shadow-2xl w-full max-w-lg fixed bottom-0 flex flex-col pointer-events-auto overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              style={{ maxHeight: MAX_HEIGHT, minHeight: MIN_HEIGHT, height: sheetHeight }}
            >
              {/* Grab handle */}
              <div className="w-full flex justify-center py-3 cursor-grab touch-none" onPointerDown={onDragStart}>
                <MdDragHandle className="text-gray-400 text-3xl" />
              </div>

              {/* Header */}
              <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold mb-1">Find your perfect parking...</h2>
                    <p className="text-blue-100 text-sm opacity-90">Drag this panel</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowParkingListBottomSheet(false)}
                      className="bg-white/10 p-2 rounded-full text-sm hover:bg-white/20 transition-all duration-300"
                    >
                      <MdClose className="text-lg" />
                    </button>
                    <button
                      onClick={() => setSheetHeight(MIN_HEIGHT)}
                      className="bg-white/10 p-2 rounded-full text-sm hover:bg-white/20 transition-all duration-300"
                    >
                      <MdMyLocation className="text-lg" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Near Me */}
              <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50">
                <button
                  onClick={handleSearchByCurrentLocation}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <MdMyLocation className="text-lg" />
                  <span>Near Me</span>
                </button>
              </div>

              {/* Parking list */}
              <div className="flex-1 overflow-y-auto p-3">
                <ParkingSpaceList
                  spaces={filteredSpaces}
                  onSpaceSelect={(space) => {
                    handleMarkerClick(space);
                    setSheetHeight(MIN_HEIGHT);
                  }}
                  filters={filters}
                  userLocation={searchedLocation || currentLocation || { lat: 0, lng: 0 }}
                  startTime={startTime}
                  endTime={endTime}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* styles */}
      <style>{`
        @keyframes gradient-x { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes fade-in-down { from { opacity: 0; transform: translateY(-20px);} to { opacity: 1; transform: translateY(0);} }
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px);} to { opacity: 1; transform: translateY(0);} }
        @keyframes fade-in-left { from { opacity: 0; transform: translateX(-20px);} to { opacity: 1; transform: translateX(0);} }
        @keyframes fade-in-right { from { opacity: 0; transform: translateX(20px);} to { opacity: 1; transform: translateX(0);} }
        @keyframes fade-in { from { opacity: 0;} to { opacity: 1;} }
        @keyframes scale-in { from { transform: scale(0);} to { transform: scale(1);} }

        .animate-gradient-x { animation: gradient-x 15s ease infinite; background-size: 200% 200%; }
        .animate-fade-in-down { animation: fade-in-down 0.6s ease-out; }
        .animate-fade-in-up { animation: fade-in-up 0.6s ease-out; }
        .animate-fade-in-left { animation: fade-in-left 0.6s ease-out; }
        .animate-fade-in-right { animation: fade-in-right 0.6s ease-out; }
        .animate-fade-in { animation: fade-in 0.8s ease-out; }
        .animate-scale-in { animation: scale-in 0.2s ease-out; }

        .slider-thumb::-webkit-slider-thumb {
          appearance: none; height: 24px; width: 24px; border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6); cursor: pointer; border: 3px solid #ffffff;
          box-shadow: 0 4px 15px rgba(59, 130, 246, 0.5); transition: all 0.3s ease;
        }
        .slider-thumb::-webkit-slider-thumb:hover { transform: scale(1.1); box-shadow: 0 6px 20px rgba(59, 130, 246, 0.7); }
        .slider-thumb::-moz-range-thumb {
          height: 24px; width: 24px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          cursor: pointer; border: 3px solid #ffffff; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.5); transition: all 0.3s ease;
        }
        .slider-thumb::-moz-range-thumb:hover { transform: scale(1.1); box-shadow: 0 6px 20px rgba(59, 130, 246, 0.7); }
      `}</style>
    </div>
  );
}
