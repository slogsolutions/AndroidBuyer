import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bike, Car, PlusCircle, Check, Clock, Calendar, Shield, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import LoadingScreen from './LoadingScreen';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export default function VehicleDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [availability, setAvailability] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [manualStartTime, setManualStartTime] = useState<Date | null>(null);
  const [manualEndTime, setManualEndTime] = useState<Date | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [showStartTimeDropdown, setShowStartTimeDropdown] = useState(false);
  const [showEndTimeDropdown, setShowEndTimeDropdown] = useState(false);

  const { spaceId, userId, startTime: incomingStartTime, endTime: incomingEndTime, totalAmount: incomingTotalAmount } = location.state || {};

  const generateTimeSlots = (forDate: Date | null, isStartTime: boolean) => {
    const slots: string[] = [];
    const now = new Date();
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const slotDate = forDate ? new Date(forDate) : new Date();
        slotDate.setHours(hour, minute, 0, 0);
        if (isStartTime && slotDate < now) continue;
        if (!isStartTime && manualStartTime && slotDate <= manualStartTime) continue;
        slots.push(timeString);
      }
    }
    return slots;
  };

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const response = await fetch(`${import.meta.env.VITE_BASE_URL}/api/booking/data/vehicles`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Failed to fetch vehicles');
        const data = await response.json();
        setVehicles(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchVehicles();
  }, []);

  useEffect(() => {
    const fetchAvailability = async () => {
      if (spaceId) {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${import.meta.env.VITE_BASE_URL}/api/parking/availability/${spaceId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) throw new Error('Failed to fetch parking availability');
          const data = await response.json();
          if (data && data.availability && Array.isArray(data.availability)) {
            const formattedAvailability = data.availability
              .filter((slot: any) => !slot.isBooked)
              .map((slot: any) => ({
                startTime: new Date(slot.startTime),
                endTime: new Date(slot.endTime),
                display: `${new Date(slot.startTime).toLocaleString()} - ${new Date(slot.endTime).toLocaleString()}`,
              }));
            setAvailability(formattedAvailability);
          } else {
            console.error('No valid availability data received');
          }
        } catch (error) {
          console.error('Error fetching parking space availability:', error);
        }
      }
    };
    fetchAvailability();
  }, [spaceId]);

  useEffect(() => {
    if (incomingStartTime) {
      const parsed = new Date(incomingStartTime);
      if (!isNaN(parsed.getTime())) setManualStartTime(parsed);
    }
    if (incomingEndTime) {
      const parsed = new Date(incomingEndTime);
      if (!isNaN(parsed.getTime())) setManualEndTime(parsed);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingStartTime, incomingEndTime]);

  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    const now = new Date();

    if (!manualStartTime) errors.startTime = 'Start time is required';
    else if (manualStartTime < now) errors.startTime = 'Start time cannot be in the past';

    if (!manualEndTime) errors.endTime = 'End time is required';
    else if (manualEndTime <= manualStartTime!) errors.endTime = 'End time must be after start time';

    const phoneNumber = selectedVehicle?.contactNumber || '';
    const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');
    if (!phoneNumber) errors.phoneNumber = 'Contact number is required';
    else if (!/^\d{10}$/.test(cleanPhoneNumber)) errors.phoneNumber = 'Please enter exactly 10 digit phone number';

    if (!acceptedTerms) errors.terms = 'You must accept the terms and conditions';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      if (!spaceId) { alert('No parking space info — go back and try again.'); return; }
      if (!userId) { alert('No user info — log in and try again.'); return; }
      if (!selectedVehicle) { alert('Please select a vehicle from the list.'); return; }

      const payload = {
        parkingSpaceId: spaceId,
        userId,
        startTime: manualStartTime!.toISOString(),
        endTime: manualEndTime!.toISOString(),
        vehicleNumber: selectedVehicle.licensePlate,
        vehicleType: selectedVehicle.vehicleType ?? selectedVehicle.model,
        vehicleModel: selectedVehicle.model,
        contactNumber: selectedVehicle.contactNumber,
        chassisNumber: selectedVehicle.chassisNumber,
        status: 'confirmed',
      };

      const url = `${import.meta.env.VITE_BASE_URL}/api/booking`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { message: text }; }

      if (!response.ok) {
        alert(`Error: ${data.message || response.statusText}`);
        return;
      }

      alert('Booking confirmed!');
      navigate('/bookings', { state: { referenceId: data.booking?._id ?? data.referenceId } });
    } catch (err) {
      console.error('Error submitting booking:', err);
      alert('An error occurred. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (vehicle: any) => {
    setSelectedVehicle(vehicle);
    setFormErrors({});
  };

  const handleAddVehicleClick = () => {
    navigate('/add-vechile');
  };

  const handleBackClick = () => {
    if (selectedVehicle) {
      setSelectedVehicle(null);
      setAcceptedTerms(false);
      setFormErrors({});
    } else {
      navigate(-1);
    }
  };

  const formatTimeDisplay = (date: Date | null) => {
    if (!date) return 'Select time';
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const setTimeOnDate = (date: Date | null, timeString: string, isStartTime: boolean) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    if (!date) {
      const newDate = new Date();
      newDate.setHours(hours, minutes, 0, 0);
      if (isStartTime && newDate < new Date()) {
        const now = new Date();
        const currentMinutes = now.getMinutes();
        const roundedMinutes = currentMinutes < 30 ? 30 : 60;
        now.setMinutes(roundedMinutes, 0, 0);
        if (roundedMinutes === 60) now.setHours(now.getHours() + 1, 0, 0, 0);
        return now;
      }
      return newDate;
    }
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    if (isStartTime && newDate < new Date()) {
      const now = new Date();
      const currentMinutes = now.getMinutes();
      const roundedMinutes = currentMinutes < 30 ? 30 : 60;
      now.setMinutes(roundedMinutes, 0, 0);
      if (roundedMinutes === 60) now.setHours(now.getHours() + 1, 0, 0, 0);
      return now;
    }
    return newDate;
  };

  const handleStartDateChange = (date: Date | null) => {
    if (date) {
      if (manualStartTime) {
        const newDate = new Date(date);
        newDate.setHours(manualStartTime.getHours(), manualStartTime.getMinutes(), 0, 0);
        if (newDate < new Date()) {
          const now = new Date();
          newDate.setHours(now.getHours(), now.getMinutes(), 0, 0);
        }
        setManualStartTime(newDate);
      } else {
        const now = new Date();
        const currentMinutes = now.getMinutes();
        const roundedMinutes = currentMinutes < 30 ? 30 : 60;
        now.setMinutes(roundedMinutes, 0, 0);
        if (roundedMinutes === 60) now.setHours(now.getHours() + 1, 0, 0, 0);
        setManualStartTime(now);
      }
    } else {
      setManualStartTime(null);
    }
    setFormErrors({...formErrors, startTime: ''});
    setShowStartTimeDropdown(false);
  };

  const handleEndDateChange = (date: Date | null) => {
    if (date) {
      if (manualEndTime) {
        const newDate = new Date(date);
        newDate.setHours(manualEndTime.getHours(), manualEndTime.getMinutes(), 0, 0);
        setManualEndTime(newDate);
      } else if (manualStartTime) {
        const newDate = new Date(date);
        newDate.setHours(manualStartTime.getHours(), manualStartTime.getMinutes(), 0, 0);
        if (newDate <= manualStartTime) newDate.setHours(manualStartTime.getHours() + 1);
        setManualEndTime(newDate);
      }
    } else {
      setManualEndTime(null);
    }
    setFormErrors({...formErrors, endTime: ''});
    setShowEndTimeDropdown(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-white">
        <LoadingScreen/>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-red-50 to-white p-4 md:p-6 pb-44 sm:pb-40"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 6rem)' }} // <<< extra space so bottom nav never covers buttons
    >
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <button 
          onClick={handleBackClick}
          className="flex items-center mb-6 text-gray-600 hover:text-gray-900 transition-colors duration-200 group"
        >
          <ArrowLeft className="mr-2 group-hover:-translate-x-1 transition-transform" /> 
          Back
        </button>

        {!selectedVehicle ? (
          <>
            {/* Vehicle Selection Section */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-3 bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                Select Your Vehicle
              </h1>
              <p className="text-gray-600 text-lg">Choose a vehicle for your parking reservation</p>
            </div>

            {vehicles.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-white rounded-2xl p-8 shadow-lg max-w-md mx-auto">
                  <Car className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No Vehicles Found</h3>
                  <p className="text-gray-500 mb-6">You haven't added any vehicles yet.</p>
                  <button
                    onClick={handleAddVehicleClick}
                    className="bg-gradient-to-r from-red-500 to-red-600 text-white py-3 px-6 rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    <PlusCircle className="inline w-5 h-5 mr-2" />
                    Add Your First Vehicle
                  </button>
                </div>
                {/* Spacer so the button clears the fixed mobile navbar */}
                <div className="h-16 md:h-0" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-10">
                  {vehicles.map((vehicle) => {
                    const Icon = vehicle.model === "M-Cycle/Scooter(2WN)" ? Bike : Car;
                    return (
                      <div
                        key={vehicle.licensePlate}
                        className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer border border-gray-100 overflow-hidden group"
                        onClick={() => handleCardClick(vehicle)}
                      >
                        <div className="p-6">
                          <div className="flex justify-center mb-4">
                            <div className="bg-gradient-to-br from-red-100 to-red-200 p-4 rounded-2xl shadow-inner group-hover:from-red-200 group-hover:to-red-300 transition-colors">
                              <Icon className="w-12 h-12 text-red-600" />
                            </div>
                          </div>
                          
                          <div className="text-center mb-4">
                            <h4 className="text-xl font-bold text-gray-900 line-clamp-1">
                              {vehicle.make} {vehicle.model}
                            </h4>
                            <span className="inline-block bg-red-100 text-red-700 text-sm font-medium px-3 py-1 rounded-full mt-2">
                              {vehicle.licensePlate}
                            </span>
                          </div>

                          <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex justify-between">
                              <span className="font-medium">Year:</span>
                              <span>{vehicle.year}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-medium">Chassis:</span>
                              <span className="font-mono text-xs truncate max-w-[120px]">{vehicle.chassisNumber}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-medium">Registered:</span>
                              <span>{new Date(vehicle.registrationDate).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white text-center py-3 font-semibold group-hover:from-red-600 group-hover:to-red-700 transition-colors">
                          Select Vehicle
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Vehicle Button — pulled up and spaced from bottom nav */}
                <div className="text-center mb-24">
                  <button
                    onClick={handleAddVehicleClick}
                    className="inline-flex items-center bg-white text-red-600 border-2 border-red-200 py-3 px-6 rounded-xl hover:bg-red-50 hover:border-red-300 transition-all duration-200 shadow-md hover:shadow-lg font-semibold"
                  >
                    <PlusCircle className="w-5 h-5 mr-2" />
                    Add New Vehicle
                  </button>
                </div>
                {/* Extra spacer so it never sits under the mobile navbar */}
                <div className="h-20 md:h-0" />
              </>
            )}
          </>
        ) : (
          <>
            {/* Booking Form Section */}
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-gray-900 mb-3 bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
                  Complete Your Booking
                </h1>
                <p className="text-gray-600">Review details and select your parking time</p>
              </div>

              {/* Selected Vehicle Card */}
              <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">Selected Vehicle</h3>
                  <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium flex items-center">
                    <Check className="w-4 h-4 mr-1" />
                    Selected
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-red-100 p-3 rounded-xl">
                    {selectedVehicle.model === "M-Cycle/Scooter(2WN)" ? 
                      <Bike className="w-8 h-8 text-red-600" /> : 
                      <Car className="w-8 h-8 text-red-600" />
                    }
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{selectedVehicle.make} {selectedVehicle.model}</h4>
                    <p className="text-gray-600 text-sm">License: {selectedVehicle.licensePlate}</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Time Selection Section */}
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                  <div className="flex items-center mb-4">
                    <Clock className="w-6 h-6 text-red-600 mr-2" />
                    <h3 className="text-xl font-bold text-gray-900">Parking Time Selection</h3>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Start Time */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Start Time *</label>
                      <div className="space-y-3">
                        <div className="relative">
                          <DatePicker
                            selected={manualStartTime}
                            onChange={handleStartDateChange}
                            minDate={new Date()}
                            placeholderText="Select start date"
                            className={`w-full p-3 border rounded-xl focus:ring-2 focus:border-transparent transition-all ${
                              formErrors.startTime ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-red-300'
                            }`}
                            dateFormat="MMMM d, yyyy"
                          />
                          <Calendar className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
                        </div>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setShowStartTimeDropdown(!showStartTimeDropdown);
                              setShowEndTimeDropdown(false);
                            }}
                            className={`w-full p-3 border rounded-xl text-left focus:ring-2 focus:border-transparent transition-all flex justify-between items-center ${
                              formErrors.startTime ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-red-300'
                            } ${!manualStartTime ? 'text-gray-500' : 'text-gray-900'}`}
                          >
                            <span>{formatTimeDisplay(manualStartTime)}</span>
                            {showStartTimeDropdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          {showStartTimeDropdown && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                              <div className="p-2 grid grid-cols-2 gap-1">
                                {generateTimeSlots(manualStartTime, true).map((time) => (
                                  <button
                                    key={time}
                                    type="button"
                                    onClick={() => {
                                      const newDate = setTimeOnDate(manualStartTime, time, true);
                                      setManualStartTime(newDate);
                                      setShowStartTimeDropdown(false);
                                      setFormErrors({...formErrors, startTime: ''});
                                      if (manualEndTime && newDate >= manualEndTime) {
                                        const newEndDate = new Date(newDate);
                                        newEndDate.setHours(newEndDate.getHours() + 1);
                                        setManualEndTime(newEndDate);
                                      }
                                    }}
                                    className="p-2 text-sm hover:bg-red-50 rounded-lg transition-colors text-center"
                                  >
                                    {time}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      {formErrors.startTime && (
                        <p className="text-red-500 text-sm mt-1 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {formErrors.startTime}
                        </p>
                      )}
                    </div>

                    {/* End Time */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">End Time *</label>
                      <div className="space-y-3">
                        <div className="relative">
                          <DatePicker
                            selected={manualEndTime}
                            onChange={handleEndDateChange}
                            minDate={manualStartTime || new Date()}
                            placeholderText="Select end date"
                            className={`w-full p-3 border rounded-xl focus:ring-2 focus:border-transparent transition-all ${
                              formErrors.endTime ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-red-300'
                            }`}
                            dateFormat="MMMM d, yyyy"
                          />
                          <Calendar className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
                        </div>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setShowEndTimeDropdown(!showEndTimeDropdown);
                              setShowStartTimeDropdown(false);
                            }}
                            className={`w-full p-3 border rounded-xl text-left focus:ring-2 focus:border-transparent transition-all flex justify-between items-center ${
                              formErrors.endTime ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-red-300'
                            } ${!manualEndTime ? 'text-gray-500' : 'text-gray-900'}`}
                          >
                            <span>{formatTimeDisplay(manualEndTime)}</span>
                            {showEndTimeDropdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          {showEndTimeDropdown && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                              <div className="p-2 grid grid-cols-2 gap-1">
                                {generateTimeSlots(manualEndTime, false).map((time) => (
                                  <button
                                    key={time}
                                    type="button"
                                    onClick={() => {
                                      const newDate = setTimeOnDate(manualEndTime, time, false);
                                      setManualEndTime(newDate);
                                      setShowEndTimeDropdown(false);
                                      setFormErrors({...formErrors, endTime: ''});
                                    }}
                                    className="p-2 text-sm hover:bg-red-50 rounded-lg transition-colors text-center"
                                  >
                                    {time}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      {formErrors.endTime && (
                        <p className="text-red-500 text-sm mt-1 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {formErrors.endTime}
                        </p>
                      )}
                    </div>
                  </div>

                  {(manualStartTime || manualEndTime) && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <p className="text-sm text-blue-800 font-medium">Selected Parking Duration:</p>
                      <p className="text-sm text-blue-700">
                        {manualStartTime ? manualStartTime.toLocaleString() : 'Not set'} {' → '}
                        {manualEndTime ? manualEndTime.toLocaleString() : 'Not set'}
                      </p>
                      {incomingTotalAmount != null && (
                        <p className="mt-2 text-sm text-blue-900 font-semibold">
                          Estimated total: ₹{Number(incomingTotalAmount).toFixed(2)}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Vehicle Details Section */}
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                  <div className="flex items-center mb-4">
                    <Car className="w-6 h-6 text-red-600 mr-2" />
                    <h3 className="text-xl font-bold text-gray-900">Vehicle Details</h3>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Vehicle Number</label>
                      <input
                        type="text"
                        defaultValue={selectedVehicle.licensePlate}
                        readOnly
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-600"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Vehicle Type</label>
                      <select
                        defaultValue={selectedVehicle.vehicleType}
                        className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-300 focus:border-transparent"
                      >
                        <option value="micro">Micro</option>
                        <option value="mini">Mini</option>
                        <option value="small">Small</option>
                        <option value="midsize">Midsize</option>
                        <option value="large">Large</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Vehicle Model</label>
                      <input
                        type="text"
                        defaultValue={selectedVehicle.model}
                        readOnly
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-600"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Number *</label>
                      <input
                        type="tel"
                        value={selectedVehicle.contactNumber || ''}
                        maxLength={10}
                        inputMode="numeric"
                        placeholder="Enter 10 digit number"
                        className={`w-full p-3 border rounded-xl focus:ring-2 focus:border-transparent transition-all ${
                          formErrors.phoneNumber ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-red-300'
                        }`}
                        onChange={(e) => {
                          const numbersOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setSelectedVehicle({ ...selectedVehicle, contactNumber: numbersOnly });
                          if (formErrors.phoneNumber) setFormErrors({...formErrors, phoneNumber: ''});
                        }}
                        onKeyPress={(e) => { if (!/[0-9]/.test(e.key)) e.preventDefault(); }}
                      />
                      {formErrors.phoneNumber && (
                        <p className="text-red-500 text-sm mt-1 flex items-center">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          {formErrors.phoneNumber}
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Chassis Number</label>
                      <input
                        type="text"
                        defaultValue={selectedVehicle.chassisNumber}
                        readOnly
                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Terms and Conditions */}
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                  <div className="flex items-center mb-4">
                    <Shield className="w-6 h-6 text-red-600 mr-2" />
                    <h3 className="text-xl font-bold text-gray-900">Terms & Conditions</h3>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 mb-4">
                    <p className="text-gray-700 text-sm">
                      By proceeding with this booking, you confirm that all the vehicle details provided are accurate to the best of your knowledge. 
                      You agree to abide by the parking facility rules and understand that any violation may result in penalties or towing at your expense.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowTerms(true)}
                    className="text-red-600 hover:text-red-700 text-sm font-medium mb-4"
                  >
                    View Full Terms and Conditions
                  </button>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="terms"
                      checked={acceptedTerms}
                      onChange={(e) => {
                        setAcceptedTerms(e.target.checked);
                        setFormErrors({...formErrors, terms: ''});
                      }}
                      className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                    />
                    <label htmlFor="terms" className="ml-2 text-sm text-gray-700">
                      I agree to the terms and conditions and confirm all details are correct
                    </label>
                  </div>
                  {formErrors.terms && (
                    <p className="text-red-500 text-sm mt-1 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {formErrors.terms}
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <div className="space-y-2">
                  {incomingTotalAmount != null && (
                    <div className="text-right text-lg font-semibold text-gray-800">
                      Estimated total: ₹{Number(incomingTotalAmount).toFixed(2)}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-4 px-6 rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none disabled:hover:shadow-lg font-bold text-lg"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Processing Booking...
                      </span>
                    ) : (
                      'Confirm Booking'
                    )}
                  </button>

                  {/* Spacer: make sure submit button clears mobile navbar & home bar */}
                  <div className="h-8 sm:h-10" />
                </div>
              </form>
            </div>
          </>
        )}
      </div>

      {/* Global bottom spacer so ANY bottom element (like Add Vehicle) is never hidden by the fixed mobile navbar */}
      <div className="h-20 md:h-0" />

      {/* Terms and Conditions Modal */}
      {showTerms && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6">
              <h2 className="text-2xl font-bold">Terms and Conditions</h2>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4 text-gray-700">
                <p><strong>Last Updated:</strong> {new Date().toLocaleDateString()}</p>
                
                <section>
                  <h3 className="font-semibold text-lg text-gray-900 mb-2">1. Vehicle Information Accuracy</h3>
                  <p>You confirm that all vehicle details provided during booking are accurate and complete to the best of your knowledge. Any discrepancies may result in denied access or additional charges.</p>
                </section>

                <section>
                  <h3 className="font-semibold text-lg text-gray-900 mb-2">2. Parking Rules and Regulations</h3>
                  <p>You agree to abide by all parking facility rules, including but not limited to: designated parking areas, speed limits, and proper use of facilities. Violations may result in penalties or vehicle towing at your expense.</p>
                </section>

                <section>
                  <h3 className="font-semibold text-lg text-gray-900 mb-2">3. Liability and Insurance</h3>
                  <p>While we take reasonable security measures, we are not liable for any damage to vehicles or loss of personal property. Ensure your vehicle is properly insured.</p>
                </section>

                <section>
                  <h3 className="font-semibold text-lg text-gray-900 mb-2">4. Cancellation and Refunds</h3>
                  <p>Cancellations made more than 2 hours before the booking start time will receive a full refund. Late cancellations or no-shows may incur charges.</p>
                </section>

                <section>
                  <h3 className="font-semibold text-lg text-gray-900 mb-2">5. Payment Terms</h3>
                  <p>Payment is required at the time of booking. All prices include applicable taxes. Receipts will be provided electronically.</p>
                </section>
              </div>
            </div>

            <div className="border-t border-gray-200 p-6 flex justify-end">
              <button
                onClick={() => setShowTerms(false)}
                className="bg-red-500 text-white py-2 px-6 rounded-lg hover:bg-red-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
