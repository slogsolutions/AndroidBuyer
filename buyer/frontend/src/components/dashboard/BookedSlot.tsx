import React from 'react';

interface Booking {
  startTime: string;
  endTime: string;
}

interface BookedSlotsProps {
  bookings: Booking[];
}

const BookedSlots: React.FC<BookedSlotsProps> = ({ bookings }) => {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Booked Slots</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {bookings.map((booking, index) => {
          const startTime = new Date(booking.startTime).toLocaleTimeString();
          const endTime = new Date(booking.endTime).toLocaleTimeString();

          return (
            <div 
              key={index} 
              className="p-4 rounded-xl text-white font-medium text-center shadow-md"
              style={{ backgroundColor: 'red' }}
            >
              <p>{startTime} - {endTime}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BookedSlots;
