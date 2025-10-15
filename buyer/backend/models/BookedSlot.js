// backend/models/BookedSlot.js
import mongoose from 'mongoose';

const bookedSlotSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParkFinderSecondUser',
    required: true,
  },
  parkingSpace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParkfindersecondParkingSpace',
    required: true,
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'parkfindersecondBooking',
    required: true,
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
    required: true,
  },
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// index to help overlap queries for a parking space
bookedSlotSchema.index({ parkingSpace: 1, startTime: 1, endTime: 1 });

export default mongoose.models.parkfindersecondBookedSlot ||
  mongoose.model('parkfindersecondBookedSlot', bookedSlotSchema);
