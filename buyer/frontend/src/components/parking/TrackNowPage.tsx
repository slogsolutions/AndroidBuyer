import React, { useEffect, useState, useRef } from "react";
import Map, { Source, Layer, Marker } from "react-map-gl";
import { toast } from "react-toastify";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  MdGpsFixed, 
  MdOutlineThumbUp, 
  MdTimer, 
  MdDirectionsCar, 
  MdPark,
  MdWarning,
  MdSchedule
} from "react-icons/md";
import { FaParking, FaMapMarkerAlt, FaExclamationTriangle } from "react-icons/fa";
import { useMapContext } from "../../context/MapContext";
import axios from "axios";

export default function TrackNowPage() {
  const { viewport, setViewport } = useMapContext();
  const navigate = useNavigate();
  const location = useLocation();

  const [booking, setBooking] = useState<any>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [routeData, setRouteData] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [timeWarning, setTimeWarning] = useState<string | null>(null);
  const [pulseAnimation, setPulseAnimation] = useState(false);

  const [initialOtp, setInitialOtp] = useState<string | null>(null);
  const [initialOtpExpires, setInitialOtpExpires] = useState<string | null>(null);

  const intervalRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);
  const warningRef = useRef<number | null>(null);

  // Accept both `otp` and `firstOtp` because different places might use either name
  const { bookingId, parkingSpace, otp: otpFromState, firstOtp: firstOtpFromState, expiresAt } = (location.state || {}) as any;
  const base = import.meta.env.VITE_BASE_URL;

  useEffect(() => {
    // initialize initial OTP values from navigation state (if present)
    if (otpFromState) setInitialOtp(String(otpFromState));
    else if (firstOtpFromState) setInitialOtp(String(firstOtpFromState));

    if (expiresAt) setInitialOtpExpires(String(expiresAt));
  }, [otpFromState, firstOtpFromState, expiresAt]);

  useEffect(() => {
    if (!bookingId) {
      toast.error("No booking selected");
      navigate(-1);
      return;
    }

    // Fetch user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ lat: latitude, lng: longitude });
          setViewport({ ...viewport, latitude, longitude });

          if (parkingSpace) {
            const [destLng, destLat] = parkingSpace.location.coordinates;
            fetchRoute(latitude, longitude, destLat, destLng);
          }
        },
        (error) => {
          console.error("Location error:", error);
          toast.error("Could not get your location.");
        }
      );
    }

    const fetchBooking = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${base}/api/booking/${bookingId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        // backend could return booking directly or { booking: ... }
        const respBooking = res.data?.booking || res.data;
        setBooking(respBooking);

        // If backend includes an OTP field for buyer (rare), keep it
        if (respBooking?.otp) {
          setInitialOtp(String(respBooking.otp));
          if (respBooking.otpExpires) setInitialOtpExpires(String(respBooking.otpExpires));
        }

        // If booking is completed, navigate away
        if (respBooking && respBooking.status === "completed") {
          toast.info("Booking session has completed.");
          navigate("/my-bookings");
        }
      } catch (err: any) {
        console.error("Failed to fetch booking", err);
        if (err.response?.status === 404) {
          toast.info("Booking session has ended");
          navigate("/my-bookings");
        }
      }
    };

    fetchBooking();
    // Poll booking every 3 seconds for status updates
    pollRef.current = window.setInterval(fetchBooking, 3000);

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      if (warningRef.current) window.clearInterval(warningRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  // Calculate remaining time based on current status
  useEffect(() => {
    if (!booking) {
      setRemainingMs(null);
      setTimeWarning(null);
      setPulseAnimation(false);
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (warningRef.current) {
        window.clearInterval(warningRef.current);
        warningRef.current = null;
      }
      return;
    }

    const calculateRemainingTime = () => {
      let targetTime: Date | null = null;
      
      if (booking.status === "active" && booking.endTime) {
        // Show time remaining until end time
        targetTime = new Date(booking.endTime);
      } else if (booking.status === "confirmed" && booking.startTime) {
        // Show time remaining until start time
        targetTime = new Date(booking.startTime);
      } else if (booking.status === "overdue" && booking.endTime) {
        // Show overdue time (negative)
        targetTime = new Date(booking.endTime);
      }

      if (targetTime) {
        const remaining = targetTime.getTime() - Date.now();
        setRemainingMs(remaining);

        // Set warnings and animations based on time remaining
        if (booking.status === "active") {
          if (remaining <= 15 * 60 * 1000 && remaining > 0) { // 15 minutes warning
            setTimeWarning("Session ending soon! Consider extending your booking.");
            setPulseAnimation(true);
          } else if (remaining <= 0) {
            setTimeWarning("Session expired! Please check out or pay fine.");
            setPulseAnimation(true);
          } else {
            setTimeWarning(null);
            setPulseAnimation(false);
          }
        } else if (booking.status === "confirmed") {
          if (remaining <= 30 * 60 * 1000 && remaining > 0) { // 30 minutes warning
            setTimeWarning("Your booking starts soon! Get ready to check in.");
            setPulseAnimation(true);
          } else {
            setTimeWarning(null);
            setPulseAnimation(false);
          }
        }
      } else {
        setRemainingMs(null);
        setTimeWarning(null);
        setPulseAnimation(false);
      }
    };

    calculateRemainingTime();
    
    if (!intervalRef.current) {
      intervalRef.current = window.setInterval(calculateRemainingTime, 1000);
    }

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [booking]);

  const fetchRoute = async (originLat: number, originLng: number, destLat: number, destLng: number) => {
    try {
      const response = await axios.get(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${originLng},${originLat};${destLng},${destLat}`,
        {
          params: {
            alternatives: false,
            geometries: "geojson",
            overview: "full",
            access_token: "pk.eyJ1IjoicGFya2Vhc2UxIiwiYSI6ImNtNGN1M3pmZzBkdWoya3M4OGFydjgzMzUifQ.wbsW51a7zFMq0yz0SeV6_A",
          },
        }
      );
      setRouteData(response.data.routes[0]);
    } catch (error) {
      console.error("Failed to fetch route:", error);
    }
  };

  const formatTime = (ms: number | null) => {
    if (ms === null) return "--:--:--";
    const absoluteMs = Math.abs(ms);
    const hours = Math.floor(absoluteMs / 3600000);
    const minutes = Math.floor((absoluteMs % 3600000) / 60000);
    const seconds = Math.floor((absoluteMs % 60000) / 1000);
    
    const sign = ms < 0 ? "-" : "";
    return `${sign}${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const getTimeLabel = () => {
    if (!booking || !remainingMs) return "Time";
    
    switch (booking.status) {
      case "confirmed":
        return "Starts in";
      case "active":
        return remainingMs > 0 ? "Time left" : "Overdue by";
      case "overdue":
        return "Overdue by";
      default:
        return "Time";
    }
  };

  const getTimeColor = () => {
    if (!remainingMs) return "text-slate-600";
    
    if (booking?.status === "active" || booking?.status === "overdue") {
      if (remainingMs <= 0) return "text-red-600";
      if (remainingMs <= 15 * 60 * 1000) return "text-amber-600";
      return "text-green-600";
    }
    
    return "text-blue-600";
  };

  const getTimeCardColor = () => {
    if (!remainingMs) return "from-blue-50 to-indigo-50 border-blue-100";
    
    if (booking?.status === "active" || booking?.status === "overdue") {
      if (remainingMs <= 0) return "from-red-50 to-orange-50 border-red-100";
      if (remainingMs <= 15 * 60 * 1000) return "from-amber-50 to-orange-50 border-amber-100";
      return "from-green-50 to-emerald-50 border-green-100";
    }
    
    return "from-blue-50 to-indigo-50 border-blue-100";
  };

  const getTimerIcon = () => {
    if (!remainingMs) return MdSchedule;
    
    if (booking?.status === "active" || booking?.status === "overdue") {
      if (remainingMs <= 0) return FaExclamationTriangle;
      if (remainingMs <= 15 * 60 * 1000) return MdWarning;
      return MdTimer;
    }
    
    return MdSchedule;
  };

  // Determine which OTP to show:
  // - If booking is active/overdue show only the provider-generated secondOtp (CHECK OUT OTP)
  // - If booking is not active, show the initial/buyer OTP (CHECK IN OTP) if available
  const displayOtp = booking && (booking.status === "active" || booking.status === 'overdue') ? booking.secondOtp || null : initialOtp;

  const otpLabel = booking && (booking.status === "active" || booking.status === 'overdue') ? "CHECK OUT OTP" : "CHECK IN OTP";

  // nice compact summary values for route
  const routeDistance = routeData?.distance ? `${(routeData.distance / 1000).toFixed(1)} km` : null;
  const routeDuration = routeData?.duration ? `${Math.ceil(routeData.duration / 60)} min` : null;

  const routeLayer = {
    id: "route",
    type: "line" as const,
    source: "route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#6366f1",
      "line-width": 5,
      "line-opacity": 0.8
    },
  };

  const routeSourceData = routeData
    ? {
        type: "Feature" as const,
        geometry: routeData.geometry,
      }
    : null;

  const TimerIcon = getTimerIcon();

  return (
    <div className="h-[calc(100vh-64px)] relative bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-blue-200/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 animate-pulse" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 animate-pulse" />
      <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent z-10 pointer-events-none" />
      
      {/* Warning Pulse Animation */}
      {pulseAnimation && (
        <div className="absolute inset-0 bg-red-500/5 animate-pulse z-0 pointer-events-none" />
      )}
      
      <div className="relative h-full">
        <Map
          {...viewport}
          onMove={(evt) => setViewport(evt.viewState)}
          mapboxAccessToken="pk.eyJ1IjoicGFya2Vhc2UxIiwiYSI6ImNtNGN1M3pmZzBkdWoya3M4OGFydjgzMzUifQ.wbsW51a7zFMq0yz0SeV6_A"
          style={{ width: "100%", height: "100%" }}
          mapStyle="mapbox://styles/mapbox/streets-v11"
        >
          {/* Current Location Marker */}
          {currentLocation && (
            <Marker latitude={currentLocation.lat} longitude={currentLocation.lng}>
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20" />
                <div className="relative bg-gradient-to-br from-blue-500 to-blue-600 text-white p-2 rounded-full shadow-2xl border-2 border-white">
                  <MdGpsFixed size={20} />
                </div>
              </div>
            </Marker>
          )}

          {/* Parking Space Marker */}
          {parkingSpace && (
            <Marker latitude={parkingSpace.location.coordinates[1]} longitude={parkingSpace.location.coordinates[0]}>
              <div className="relative">
                <div className="absolute inset-0 bg-green-500 rounded-full animate-pulse opacity-20" />
                <div className="relative bg-gradient-to-br from-green-500 to-emerald-600 text-white p-2 rounded-full shadow-2xl border-2 border-white">
                  <FaParking size={20} />
                </div>
              </div>
            </Marker>
          )}

          {/* Route Layer */}
          {routeSourceData && (
            <Source id="route" type="geojson" data={routeSourceData}>
              <Layer {...routeLayer} />
            </Source>
          )}
        </Map>
      </div>

      {/* Enhanced Floating status card */}
      <div className="absolute bottom-6 left-6 right-6 md:right-auto md:left-6 max-w-xl z-20">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-6 border border-white/20 transform transition-all duration-300 hover:shadow-3xl">
          {/* Header with enhanced styling */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-xl shadow-lg">
                <MdDirectionsCar className="text-white text-xl" />
              </div>
              <div>
                <div className="text-sm text-slate-500 font-medium">Current Status</div>
                <div className="text-lg font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  {booking ? (booking.status ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1) : "Loading...") : "Loading..."}
                </div>
              </div>
            </div>

            <div className="text-right bg-slate-50/80 rounded-xl p-3 min-w-[120px] backdrop-blur-sm">
              <div className="flex items-center gap-1 text-slate-600 text-sm font-medium mb-1">
                <FaMapMarkerAlt className="text-blue-500" />
                Distance
              </div>
              <div className="text-lg font-bold text-slate-800">{routeDistance || "--"}</div>
              <div className="text-xs text-slate-500">ETA: {routeDuration || "--"}</div>
            </div>
          </div>

          {/* Time Display Card */}
          {remainingMs !== null && (
            <div className={`mb-4 p-4 bg-gradient-to-r ${getTimeCardColor()} rounded-2xl border backdrop-blur-sm transform transition-all duration-500 ${
              pulseAnimation ? 'animate-pulse scale-105' : 'hover:scale-102'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`relative w-16 h-16 rounded-full bg-gradient-to-br ${
                  remainingMs <= 0 ? 'from-red-500 to-orange-500' : 
                  remainingMs <= 15 * 60 * 1000 ? 'from-amber-500 to-orange-400' : 
                  'from-blue-500 to-indigo-400'
                } flex items-center justify-center shadow-lg ${pulseAnimation ? 'animate-bounce' : ''}`}>
                  <TimerIcon className="text-white text-xl" />
                  {pulseAnimation && (
                    <div className="absolute inset-0 rounded-full bg-current animate-ping opacity-30" />
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-600 font-medium">{getTimeLabel()}</div>
                      <div className={`text-2xl font-bold ${getTimeColor()} font-mono tracking-wider`}>
                        {formatTime(remainingMs)}
                      </div>
                    </div>
                    
                    {/* Status Badge
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      booking?.status === "active" ? 
                        (remainingMs <= 0 ? 'bg-red-100 text-red-700' : 
                         remainingMs <= 15 * 60 * 1000 ? 'bg-amber-100 text-amber-700' : 
                         'bg-green-100 text-green-700') :
                        'bg-blue-100 text-blue-700'
                    }`}>
                      {booking?.status === "active" ? 
                        (remainingMs <= 0 ? 'OVERDUE' : 
                         remainingMs <= 15 * 60 * 1000 ? 'ENDING SOON' : 
                         'ACTIVE') :
                        'UPCOMING'
                      }
                    </div> */}
                  </div>
                  
                  {/* Target Time */}
                  <div className="text-xs text-slate-500 mt-2">
                    {booking?.status === "active" && booking?.endTime && 
                      `Ends: ${new Date(booking.endTime).toLocaleString()}`
                    }
                    {booking?.status === "confirmed" && booking?.startTime && 
                      `Starts: ${new Date(booking.startTime).toLocaleString()}`
                    }
                  </div>
                </div>
              </div>
              
              {/* Warning Message */}
              {timeWarning && (
                <div className={`mt-3 p-3 rounded-xl bg-gradient-to-r ${
                  remainingMs <= 0 ? 'from-red-100 to-orange-100 border border-red-200' :
                  'from-amber-100 to-orange-100 border border-amber-200'
                } flex items-center gap-3 animate-fade-in`}>
                  <MdWarning className={`text-xl ${
                    remainingMs <= 0 ? 'text-red-600' : 'text-amber-600'
                  }`} />
                  <div className="text-sm font-medium text-slate-700 flex-1">
                    {timeWarning}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Vehicle Info Card for Active Status */}
          {booking?.status === "active" && (
            <div className="mb-4 p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl border border-emerald-100 backdrop-blur-sm transform transition-all duration-300 hover:scale-102">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-3 rounded-xl shadow-lg">
                  <MdPark className="text-white text-2xl" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-emerald-700">Vehicle Parked</div>
                  <div className="text-lg font-bold text-slate-800">
                    {parkingSpace?.name || parkingSpace?.title || parkingSpace?.label || "Your parked vehicle"}
                  </div>
                  {booking?.slotNumber && (
                    <div className="text-sm text-slate-600 mt-1">Slot: {booking.slotNumber}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Enhanced OTP area */}
          <div className="mb-4">
            {displayOtp ? (
              <div className="relative overflow-hidden transform transition-all duration-300 hover:scale-102">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 transform -skew-x-6" />
                <div className="relative p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-200/60 flex items-center justify-between shadow-lg backdrop-blur-sm">
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-indigo-600/80 mb-2 uppercase tracking-wide">{otpLabel}</div>
                    <div className="text-3xl font-mono font-bold tracking-widest bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      {displayOtp}
                    </div>
                    {initialOtpExpires && booking?.status !== "active" && booking?.status !== "overdue" && (
                      <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                        <MdTimer className="text-amber-500" />
                        Expires: {new Date(initialOtpExpires).toLocaleString()}
                      </div>
                    )}
                  </div>

                  <div className="ml-4 p-3 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl shadow-lg transform transition-all duration-300 hover:scale-110">
                    <MdOutlineThumbUp className="text-white text-2xl" />
                  </div>
                </div>
              </div>
            ) : (
              booking?.status === "accepted" && (
                <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 flex items-center gap-3 backdrop-blur-sm">
                  <div className="bg-amber-500 p-2 rounded-lg">
                    <MdTimer className="text-white text-xl" />
                  </div>
                  <div className="text-sm font-medium text-amber-800">
                    Waiting for provider to verify your OTP and start the session...
                  </div>
                </div>
              )
            )}
          </div>

          {/* Enhanced Quick actions */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                if (currentLocation) setViewport({ ...viewport, latitude: currentLocation.lat, longitude: currentLocation.lng, zoom: 15 });
              }}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-300 bg-white/80 text-sm font-semibold text-slate-700 hover:bg-white hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 backdrop-blur-sm transform hover:scale-105"
            >
              <MdGpsFixed className="text-blue-500 text-lg" />
              Center to me
            </button>

            <button
              onClick={() => {
                if (parkingSpace) setViewport({ ...viewport, latitude: parkingSpace.location.coordinates[1], longitude: parkingSpace.location.coordinates[0], zoom: 16 });
              }}
              className="py-3 px-6 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 text-white text-sm font-semibold hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 transform hover:scale-105"
            >
              <MdPark className="text-lg" />
              Go to parking
            </button>
          </div>
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
        .hover\\:scale-102:hover {
          transform: scale(1.02);
        }
      `}</style>
    </div>
  );
}