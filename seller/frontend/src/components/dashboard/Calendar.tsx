import React, { useState } from 'react';
import { 
  CalendarDays,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit2,
  X,
  Save,
  RepeatIcon
} from 'lucide-react';
import { TimeSlot } from '../../types';

interface CalendarProps {
  timeSlots: TimeSlot[];
  onAddSlot: () => void;
  onEditSlot: (slot: TimeSlot) => void;
  onDeleteSlot: (slotId: string) => void;
}

export function Calendar({ timeSlots, onAddSlot, onEditSlot, onDeleteSlot }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week'>('month');
  const [showTimeSlotModal, setShowTimeSlotModal] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);

  const daysInMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  ).getDate();

  const firstDayOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  ).getDay();

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)));
  };

  const handlePrevWeek = () => {
    setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)));
  };

  const handleNextWeek = () => {
    setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)));
  };

  const getWeekDates = () => {
    const dates = [];
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    for (let i = 0; i < 7; i++) {
      dates.push(new Date(startOfWeek));
      startOfWeek.setDate(startOfWeek.getDate() + 1);
    }
    return dates;
  };

  const renderMonthView = () => {
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const weeks = [];
    let week = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      week.push(null);
    }

    days.forEach((day) => {
      week.push(day);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    });

    // Add remaining days
    if (week.length > 0) {
      while (week.length < 7) {
        week.push(null);
      }
      weeks.push(week);
    }

    return (
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-600 dark:text-gray-400">
            {day}
          </div>
        ))}
        {weeks.map((week, weekIndex) => (
          <React.Fragment key={weekIndex}>
            {week.map((day, dayIndex) => (
              <div
                key={`${weekIndex}-${dayIndex}`}
                className={`min-h-[100px] p-2 border dark:border-gray-700 rounded-lg ${
                  day ? 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer' : ''
                }`}
              >
                {day && (
                  <div>
                    <span className={`text-sm ${
                      new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString() === new Date().toDateString()
                        ? 'bg-primary-500 text-white px-2 py-1 rounded-full'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {day}
                    </span>
                    <div className="mt-2 space-y-1">
                      {timeSlots
                        .filter(slot => 
                          new Date(slot.startTime).getDate() === day &&
                          new Date(slot.startTime).getMonth() === currentDate.getMonth()
                        )
                        .map((slot, index) => (
                          <div
                            key={index}
                            className="text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 p-1 rounded"
                          >
                            {new Date(slot.startTime).toLocaleTimeString([], { 
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekDates = getWeekDates();
    
    return (
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-8 gap-1">
            <div className="p-2"></div>
            {weekDates.map((date, index) => (
              <div
                key={index}
                className="p-2 text-center"
              >
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {days[index]}
                </div>
                <div className={`text-sm mt-1 ${
                  date.toDateString() === new Date().toDateString()
                    ? 'bg-primary-500 text-white px-2 py-1 rounded-full inline-block'
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {date.getDate()}
                </div>
              </div>
            ))}
            
            {hours.map((hour) => (
              <React.Fragment key={hour}>
                <div className="p-2 text-right text-sm text-gray-500 dark:text-gray-400 border-t dark:border-gray-700">
                  {hour.toString().padStart(2, '0')}:00
                </div>
                {weekDates.map((date, dayIndex) => (
                  <div
                    key={`${hour}-${dayIndex}`}
                    className="p-2 border dark:border-gray-700 border-t relative min-h-[60px] hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                    onClick={() => {
                      const newDate = new Date(date);
                      newDate.setHours(hour);
                      // Handle cell click
                    }}
                  >
                    {timeSlots
                      .filter(slot => {
                        const slotDate = new Date(slot.startTime);
                        return slotDate.getHours() === hour &&
                               slotDate.getDay() === dayIndex;
                      })
                      .map((slot, index) => (
                        <div
                          key={index}
                          className="absolute inset-x-1 bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded p-1 text-xs"
                          style={{
                            top: '4px',
                            height: 'calc(100% - 8px)'
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span>Available</span>
                            {slot.isRecurring && (
                              <RepeatIcon className="h-3 w-3" />
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <CalendarDays className="h-7 w-7 text-primary-500 mr-3" />
              Availability Calendar
            </h2>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setView('month')}
                  className={`px-3 py-1 rounded-lg transition-colors duration-200 ${
                    view === 'month'
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Month
                </button>
                <button
                  onClick={() => setView('week')}
                  className={`px-3 py-1 rounded-lg transition-colors duration-200 ${
                    view === 'week'
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Week
                </button>
              </div>
              <button
                onClick={() => setShowTimeSlotModal(true)}
                className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors duration-200"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Time Slot
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <button
                onClick={view === 'month' ? handlePrevMonth : handlePrevWeek}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
              >
                <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {currentDate.toLocaleString('default', { 
                  month: 'long',
                  year: 'numeric',
                  ...(view === 'week' && { day: 'numeric' })
                })}
              </h3>
              <button
                onClick={view === 'month' ? handleNextMonth : handleNextWeek}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
              >
                <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          <div className="p-4">
            {view === 'month' ? renderMonthView() : renderWeekView()}
          </div>
        </div>

        {/* Time Slots List */}
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Upcoming Time Slots</h3>
          <div className="space-y-4">
            {timeSlots.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                    <Clock className="h-5 w-5 text-primary-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {new Date(slot.startTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })} - {new Date(slot.endTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {slot.isRecurring && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center mt-1">
                        <RepeatIcon className="h-4 w-4 mr-1" />
                        Recurring weekly
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setEditingSlot(slot);
                      setShowTimeSlotModal(true);
                    }}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200"
                  >
                    <Edit2 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => onDeleteSlot(slot.id)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}