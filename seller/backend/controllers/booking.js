import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import ParkingSpace from '../models/ParkingSpace.js';
import ParkFinderSecondUser from '../models/User.js';
import UserToken from '../models/UserToken.js';
import NotificationService from '../service/NotificationService.js';
import BookedSlot from '../models/BookedSlot.js';
// import NotificationService from "../services/NotificationService.js";
// import UserToken from "../models/UserToken.js";
// import Booking from "../models/Booking.js";
// import { releaseParkingSpot } from "../utils/parkingUtils.js";
// Simple notification placeholder
const sendNotification = (email, subject, message) => {
  console.log(`Notification sent to ${email}: ${subject} - ${message}`);
};

const bookingTimers = new Map();

/* -------------------- helpers -------------------- */

const releaseParkingSpot = async (parkingId, booking = null) => {
  try {
    if (!parkingId) return null;

    const parking = await ParkingSpace.findById(parkingId);
    if (!parking) return null;

    const current = typeof parking.availableSpots === 'number' ? parking.availableSpots : 0;
    const total = typeof parking.totalSpots === 'number' && parking.totalSpots >= 0 ? parking.totalSpots : null;
    let newAvailable = current + 1;
    if (total !== null) newAvailable = Math.min(newAvailable, total);
    if (newAvailable === current) return parking;

    parking.availableSpots = newAvailable;
    await parking.save();

    try {
      const io = global.io;
      if (io) {
        io.emit('parking-released', { parkingId: parking._id.toString(), availableSpots: parking.availableSpots });
        if (booking && booking.user) {
          io.to(booking.user.toString()).emit('booking-completed', { bookingId: booking._id.toString() });
        }
      }
    } catch (e) {
      console.warn('[releaseParkingSpot] socket emit error', e);
    }

    return parking;
  } catch (err) {
    console.error('[releaseParkingSpot] error', err);
    return null;
  }
};

const markBookingCompleted = async (bookingId) => {
  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) return;

    if (['completed', 'cancelled', 'rejected'].includes(booking.status)) return;

    booking.status = 'completed';
    booking.completedAt = new Date();

    if (!booking.endedAt) booking.endedAt = booking.sessionEndAt ? booking.sessionEndAt : new Date();
    if (!booking.endTime) booking.endTime = booking.sessionEndAt ? booking.sessionEndAt : booking.endedAt;

    await booking.save();

    if (bookingTimers.has(bookingId.toString())) {
      clearTimeout(bookingTimers.get(bookingId.toString()));
      bookingTimers.delete(bookingId.toString());
    }

    if (booking.parkingSpace) {
      await releaseParkingSpot(booking.parkingSpace, booking);
    }

    try {
      const io = global.io;
      if (io) {
        const populated = await Booking.findById(booking._id).populate('parkingSpace').populate('user', 'name email');
        io.emit('booking-updated', { booking: populated });
        if (booking.user) io.to(booking.user.toString()).emit('booking-completed', { bookingId: booking._id.toString() });
      }
    } catch (emitErr) {
      console.warn('[markBookingCompleted] emit error', emitErr);
    }
  } catch (err) {
    console.error('markBookingCompleted error:', err);
  }
};

/**
 * Periodic cleanup:
 * - For bookings whose sessionEndAt <= now and status in ['confirmed','active'] -> mark as 'overdue'
 * - DO NOT auto-complete or release spot here. Provider must complete after secondOtp verification.
 */
const cleanupOverdueBookings = async () => {
  try {
    const now = new Date();
    const overdue = await Booking.find({
      sessionEndAt: { $lte: now },
      status: { $in: ['confirmed', 'active'] },
    });

    for (const b of overdue) {
      b.status = 'overdue';
      await b.save();

      try {
        if (global.io) {
          const populated = await Booking.findById(b._id).populate('parkingSpace').populate('user', 'name email');
          global.io.emit('booking-updated', { booking: populated });
          if (b.user) global.io.to(b.user.toString()).emit('booking-overdue', { bookingId: b._id.toString() });
        }
      } catch (emitErr) {
        console.warn('[cleanupOverdueBookings] emit error', emitErr);
      }

      console.log(`Cleanup: marked booking ${b._id} overdue`);
    }
  } catch (err) {
    console.error('cleanupOverdueBookings error', err);
  }
};

setInterval(cleanupOverdueBookings, 60 * 1000);
cleanupOverdueBookings().catch((e) => console.error(e));

/* -------------------- controllers -------------------- */

export const createBooking = async (req, res) => {
  try {
    const {
      parkingSpaceId,
      startTime,
      endTime,
      vehicleNumber,
      vehicleType,
      vehicleModel,
      contactNumber,
      chassisNumber,
      // other fields if you accept them
    } = req.body;

    if (!parkingSpaceId) return res.status(400).json({ message: 'parkingSpaceId required' });

    const parkingSpace = await ParkingSpace.findById(parkingSpaceId);
    if (!parkingSpace) return res.status(404).json({ message: 'Parking space not found' });

    // Use the price field your project expects:
    const pricePerHour = parkingSpace.priceParking ?? parkingSpace.pricePerHour;
    if (!startTime || !endTime || !pricePerHour) {
      return res.status(400).json({ message: 'Invalid data: startTime, endTime and price required' });
    }

    const parsedStart = new Date(startTime);
    const parsedEnd = new Date(endTime);
    if (isNaN(parsedStart) || isNaN(parsedEnd)) {
      return res.status(400).json({ message: 'Invalid times' });
    }
    if (parsedEnd.getTime() <= parsedStart.getTime()) {
      return res.status(400).json({ message: 'endTime must be after startTime' });
    }

    // Count overlapping bookings for this parkingSpace from the Booking collection
    // Overlap condition: existing.startTime < newEnd && existing.endTime > newStart
    // Consider only statuses that actually occupy a spot
    const overlappingStatuses = ['pending', 'accepted', 'confirmed', 'active'];
    const overlapQuery = {
      parkingSpace: parkingSpace._id,
      startTime: { $lt: parsedEnd },
      endTime: { $gt: parsedStart },
      status: { $in: overlappingStatuses },
    };

    const overlappingCount = await Booking.countDocuments(overlapQuery);
    const totalSpots = Number(parkingSpace.totalSpots ?? 1);

    if (overlappingCount >= totalSpots) {
      return res.status(400).json({ message: 'No slots available for the selected time interval' });
    }

    // Create booking (you may compute totalPrice here if needed)
    const booking = new Booking({
      user: req.user._id,
      parkingSpace: parkingSpaceId,
      startTime: parsedStart,
      endTime: parsedEnd,
      totalPrice: 0, // compute if you have a pricing helper
      pricePerHour,
      vehicleNumber,
      vehicleType,
      vehicleModel,
      contactNumber,
      chassisNumber,
      providerId: parkingSpace.owner,
      status: 'accepted',
      paymentStatus: 'pending',
    });

    await booking.save();

    // Create the BookedSlot audit record so future checks can rely on it (optional but useful)
    try {
      const bs = new BookedSlot({
        user: req.user._id,
        parkingSpace: parkingSpaceId,
        booking: booking._id,
        startTime: parsedStart,
        endTime: parsedEnd,
      });
      await bs.save();
    } catch (errBs) {
      // do not fail booking if audit creation fails, but log
      console.warn('[createBooking] failed to create BookedSlot', errBs);
    }

    // (Optional) If you had code that tried to mutate parkingSpace.availability,
    // we intentionally do NOT rely on that array because it is brittle.
    // If you still want that array updated, do it here but handle errors gracefully.

    // Emit socket events (if you use global.io)
    try {
      if (global.io) {
        const populated = await Booking.findById(booking._id)
          .populate('parkingSpace')
          .populate('user', 'name email');
        global.io.emit('booking-created', { booking: populated });
      }
    } catch (emitErr) {
      console.warn('[createBooking] emit error', emitErr);
    }

    return res.status(201).json({ message: 'Booking created and auto-accepted; proceed to payment', booking });
  } catch (error) {
    console.error('createBooking error', error);
    return res.status(500).json({ message: 'Failed to create booking', error: error.message });
  }
};



export const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id }).populate('parkingSpace').sort('-createdAt');
    res.json(bookings);
  } catch (err) {
    console.error('getMyBookings error', err);
    res.status(500).json({ message: 'Failed to get bookings', error: err.message });
  }
};

export const getProviderBookings = async (req, res) => {
  try {
    const providerId = req.user._id;
    const parkingSpaces = await ParkingSpace.find({ owner: providerId });
    if (!parkingSpaces.length) return res.status(200).json([]);
    const ids = parkingSpaces.map(s => s._id);
    const bookings = await Booking.find({ parkingSpace: { $in: ids } })
      .populate('user', 'name email contactNumber')
      .populate('parkingSpace', 'name location pricePerHour');
    res.status(200).json(bookings);
  } catch (err) {
    console.error('getProviderBookings error', err);
    res.status(500).json({ message: 'Failed to fetch provider bookings', error: err.message });
  }
};
  //  OLD
// export const updateBookingStatus = async (req, res) => {
//   try {
//     const { status } = req.body;
//     const bookingId = req.params.id;
//     const allowed = ['pending', 'accepted', 'rejected', 'confirmed', 'completed', 'cancelled', 'overdue'];
//     if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });

//     const booking = await Booking.findById(bookingId);
//     if (!booking) return res.status(404).json({ message: 'Booking not found' });

//     booking.status = status;
//     if (status === 'accepted') booking.providerId = req.user._id;
//     if (status === 'completed') {
//       booking.completedAt = new Date();
//       if (!booking.endedAt) booking.endedAt = booking.completedAt;
//       if (!booking.endTime) booking.endTime = booking.sessionEndAt ?? booking.completedAt;
//       if (booking.parkingSpace) {
//         try { await releaseParkingSpot(booking.parkingSpace, booking); } catch (e) { console.warn('release failed on manual complete', e); }
//       }
//     }

//     await booking.save();

//     try {
//       if (global.io) {
//         const populated = await Booking.findById(booking._id).populate('parkingSpace').populate('user', 'name email');
//         global.io.emit('booking-updated', { booking: populated });
//       }
//     } catch (emitErr) {
//       console.warn('[updateBookingStatus] emit error', emitErr);
//     }

//     const freshBooking = await Booking.findById(booking._id).populate('parkingSpace').populate('user', 'name email');
//     res.status(200).json({ message: 'Booking status updated successfully', booking: freshBooking });
//   } catch (error) {
//     console.error('updateBookingStatus error', error);
//     res.status(500).json({ message: 'Failed to update booking status', error: error.message });
//   }
// };



export const updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const bookingId = req.params.id;

    const allowed = [
      "pending", "accepted", "rejected", "confirmed",
      "completed", "cancelled", "overdue"
    ];
    if (!allowed.includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const booking = await Booking.findById(bookingId).populate("user", "name email");
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    booking.status = status;
    if (status === "accepted") booking.providerId = req.user._id;
    if (status === "completed") {
      booking.completedAt = new Date();
      if (!booking.endedAt) booking.endedAt = booking.completedAt;
      if (!booking.endTime) booking.endTime = booking.sessionEndAt ?? booking.completedAt;
      if (booking.parkingSpace) {
        try {
          // await releaseParkingSpot(booking.parkingSpace, booking);
          console.log("release logic will come here")
        } catch (e) {
          console.warn("release failed on manual complete", e);
        }
      }
    }

    await booking.save();

    // Emit via Socket.IO if needed
    try {
      if (global.io) {
        const populated = await Booking.findById(booking._id)
          .populate("parkingSpace")
          .populate("user", "name email");
        global.io.emit("booking-updated", { booking: populated });
      }
    } catch (emitErr) {
      console.warn("[updateBookingStatus] emit error", emitErr);
    }

    // ✅ Send FCM Notification
    try {
      const userId = booking.user?._id;
      if (userId) {
        // Fetch all device tokens for this user
        const userTokens = await UserToken.find({ userId }).select("token -_id");
        const tokens = userTokens.map(t => t.token);

        if (tokens.length > 0) {
          const title = `Booking ${status}`;
          const body = `Your booking has been ${status}.`;

          if (tokens.length === 1) {
            await NotificationService.sendToDevice(tokens[0], title, body);
          } else {
            await NotificationService.sendToMultiple(tokens, title, body);
          }

          console.log(`[FCM] Sent '${status}' notification to user ${userId}`);
        } else {
          console.warn(`[FCM] No tokens found for user ${userId}`);
        }
      }
    } catch (notifErr) {
      console.error("[updateBookingStatus] Notification error", notifErr);
    }

    const freshBooking = await Booking.findById(booking._id)
      .populate("parkingSpace")
      .populate("user", "name email");

    res.status(200).json({
      message: "Booking status updated successfully",
      booking: freshBooking,
    });
  } catch (error) {
    console.error("updateBookingStatus error", error);
    res
      .status(500)
      .json({ message: "Failed to update booking status", error: error.message });
  }
};



export const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('parkingSpace').populate('user', 'name email');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const parkingSpace = await ParkingSpace.findById(booking.parkingSpace);
    const isOwner = parkingSpace && parkingSpace.owner && parkingSpace.owner.toString() === req.user._id.toString();
    const isBuyer = booking.user && booking.user.toString() === req.user._id.toString();
    if (!isOwner && !isBuyer) return res.status(403).json({ message: 'Not authorized' });

    const bookingData = booking.toObject();
    if (isOwner && !isBuyer) {
      // hide secondOtp for provider UI to avoid leaking; provider should request user-provided code.
      delete bookingData.secondOtp;
      delete bookingData.secondOtpExpires;
    }

    res.json(bookingData);
  } catch (err) {
    console.error('getBookingById error', err);
    res.status(500).json({ message: 'Failed to get booking', error: err.message });
  }
};

/**
 * Cancel booking (previously deleteById)
 * - Frontend uses DELETE /api/booking/:bookingId with body { refundPercent } (optional)
 * - Only booking owner can cancel
 * - Not allowed within 1 hour of startTime
 * - Marks booking.status = 'cancelled', records refund details, unmarks availability slot (best-effort), emits update
 */
// export const deleteById = async (req, res) => {
//   try {
//     const { bookingId } = req.params;
//     const requesterId = req.user._id;

//     if (!mongoose.Types.ObjectId.isValid(bookingId)) return res.status(400).json({ message: 'Invalid booking id' });

//     const booking = await Booking.findById(bookingId);
//     if (!booking) return res.status(404).json({ message: 'Booking not found' });

//     // Only booking owner (buyer) may cancel via this endpoint
//     if (!booking.user || booking.user.toString() !== requesterId.toString()) {
//       return res.status(403).json({ message: 'Not authorized to cancel this booking' });
//     }

//     // Do not allow cancelling completed/active/overdue bookings via this endpoint.
//     if (['completed', 'active', 'overdue', 'cancelled'].includes(booking.status)) {
//       return res.status(400).json({ message: `Cannot cancel booking in status '${booking.status}'` });
//     }

//     // Determine hours until start
//     let hoursUntilStart = Infinity;
//     if (booking.startTime) {
//       const startTs = new Date(booking.startTime).getTime();
//       if (!isNaN(startTs)) {
//         hoursUntilStart = (startTs - Date.now()) / (1000 * 60 * 60);
//       }
//     }

//     // Cancellation not allowed within 1 hour
//     if (hoursUntilStart <= 1) {
//       return res.status(400).json({ message: 'Cancellation not allowed within 1 hour of start time' });
//     }

//     // Compute refundPercent:
//     // frontend rules: >3 => 60, >2 => 40, >1 => 10, <=1 => 0
//     const computeCancelRefundPercent = (hrs) => {
//       if (hrs > 3) return 60;
//       if (hrs > 2) return 40;
//       if (hrs > 1) return 10;
//       return 0;
//     };

//     // If client passed refundPercent, prefer validated value; otherwise compute
//     let requestedPercent = Number.isFinite(Number(req.body?.refundPercent)) ? Number(req.body.refundPercent) : null;
//     let refundPercent = computeCancelRefundPercent(hoursUntilStart);
//     if (requestedPercent !== null && !isNaN(requestedPercent)) {
//       // don't allow arbitrary percent; clamp to computed percent (can't be larger than allowed)
//       // allow smaller percent only if requested and valid (but typically client shouldn't override)
//       requestedPercent = Math.max(0, Math.min(100, requestedPercent));
//       // only accept requested percent if it is <= computed max percent, otherwise ignore
//       if (requestedPercent <= refundPercent) {
//         refundPercent = requestedPercent;
//       }
//     }

//     // Determine paid amount (best-effort)
//     // Prefer booking.totalPrice, otherwise try pricePerHour * duration
//     let paidAmount = Number(booking.totalPrice ?? 0);
//     if (!paidAmount || paidAmount <= 0) {
//       const startTs = booking.startTime ? new Date(booking.startTime).getTime() : null;
//       const endTs = booking.endTime ? new Date(booking.endTime).getTime() : null;
//       let hours = 1;
//       if (startTs && endTs && !isNaN(startTs) && !isNaN(endTs) && endTs > startTs) {
//         hours = Math.max(1, Math.ceil((endTs - startTs) / (1000 * 60 * 60)));
//       }
//       const perHour = Number(booking.pricePerHour ?? booking.priceParking ?? 0) || 0;
//       paidAmount = +(perHour * hours);
//     }

//     const refundAmount = +(paidAmount * (refundPercent / 100));

//     // Mark booking as cancelled and attach refund meta
//     booking.status = 'cancelled';
//     booking.cancelledAt = new Date();
//     booking.refund = {
//       percent: refundPercent,
//       amount: refundAmount,
//     };
//     // Optionally note who cancelled
//     booking.cancelledBy = requesterId;

//     // Try to unmark availability slot (best-effort)
//     try {
//       if (booking.parkingSpace && booking.startTime && booking.endTime) {
//         const startDateMidnight = new Date(booking.startTime);
//         startDateMidnight.setHours(0, 0, 0, 0);
//         await ParkingSpace.findByIdAndUpdate(
//           booking.parkingSpace,
//           { $set: { 'availability.$[dateElem].slots.$[slotElem].isBooked': false } },
//           { arrayFilters: [{ 'dateElem.date': { $eq: startDateMidnight } }, { 'slotElem.startTime': new Date(booking.startTime), 'slotElem.endTime': new Date(booking.endTime) }], new: true }
//         );
//       }
//     } catch (unmarkErr) {
//       console.warn('Warning: failed to unmark availability slot (nonfatal)', unmarkErr);
//     }

//     await booking.save();

//     // emit update to sockets
//     try {
//       if (global.io) {
//         const populated = await Booking.findById(booking._id).populate('parkingSpace').populate('user', 'name email');
//         global.io.emit('booking-updated', { booking: populated });
//       }
//     } catch (emitErr) {
//       console.warn('[deleteById] emit error', emitErr);
//     }

//     // NOTE: actual payment gateway refund processing should be triggered here if integrated.
//     // For example, queue a refund job with the payment provider using booking.paymentIntentId or similar.
//     // This implementation only records refund amount on the booking and expects a separate payment/refund job to run.

//     return res.status(200).json({
//       message: 'Booking cancelled successfully',
//       booking: await Booking.findById(booking._id).populate('parkingSpace').populate('user', 'name email'),
//       refundAmount,
//       refundPercent
//     });
//   } catch (err) {
//     console.error('deleteById error:', err);
//     return res.status(500).json({ message: 'Failed to cancel booking', error: err.message });
//   }
// };

export const deleteById = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const requesterId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) return res.status(400).json({ message: 'Invalid booking id' });

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (!booking.user || booking.user.toString() !== requesterId.toString()) {
      return res.status(403).json({ message: 'Not authorized to cancel this booking' });
    }

    if (['completed', 'active', 'overdue', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({ message: `Cannot cancel booking in status '${booking.status}'` });
    }

    let hoursUntilStart = Infinity;
    if (booking.startTime) {
      const startTs = new Date(booking.startTime).getTime();
      if (!isNaN(startTs)) {
        hoursUntilStart = (startTs - Date.now()) / (1000 * 60 * 60);
      }
    }

    if (hoursUntilStart <= 1) {
      return res.status(400).json({ message: 'Cancellation not allowed within 1 hour of start time' });
    }

    const computeCancelRefundPercent = (hrs) => {
      if (hrs > 3) return 60;
      if (hrs > 2) return 40;
      if (hrs > 1) return 10;
      return 0;
    };

    let requestedPercent = Number.isFinite(Number(req.body?.refundPercent)) ? Number(req.body.refundPercent) : null;
    let refundPercent = computeCancelRefundPercent(hoursUntilStart);
    if (requestedPercent !== null && !isNaN(requestedPercent)) {
      requestedPercent = Math.max(0, Math.min(100, requestedPercent));
      if (requestedPercent <= refundPercent) {
        refundPercent = requestedPercent;
      }
    }

    let paidAmount = Number(booking.totalPrice ?? 0);
    if (!paidAmount || paidAmount <= 0) {
      const startTs = booking.startTime ? new Date(booking.startTime).getTime() : null;
      const endTs = booking.endTime ? new Date(booking.endTime).getTime() : null;
      let hours = 1;
      if (startTs && endTs && !isNaN(startTs) && !isNaN(endTs) && endTs > startTs) {
        hours = Math.max(1, Math.ceil((endTs - startTs) / (1000 * 60 * 60)));
      }
      const perHour = Number(booking.pricePerHour ?? booking.priceParking ?? 0) || 0;
      paidAmount = +(perHour * hours);
    }

    const refundAmount = +(paidAmount * (refundPercent / 100));

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.refund = {
      percent: refundPercent,
      amount: refundAmount,
    };
    booking.cancelledBy = requesterId;

    try {
      if (booking.parkingSpace && booking.startTime && booking.endTime) {
        const startDateMidnight = new Date(booking.startTime);
        startDateMidnight.setHours(0, 0, 0, 0);
        await ParkingSpace.findByIdAndUpdate(
          booking.parkingSpace,
          { $set: { 'availability.$[dateElem].slots.$[slotElem].isBooked': false } },
          { arrayFilters: [{ 'dateElem.date': { $eq: startDateMidnight } }, { 'slotElem.startTime': new Date(booking.startTime), 'slotElem.endTime': new Date(booking.endTime) }], new: true }
        );
      }
    } catch (unmarkErr) {
      console.warn('Warning: failed to unmark availability slot (nonfatal)', unmarkErr);
    }

    await booking.save();

    // emit update to sockets
    try {
      if (global.io) {
        const populated = await Booking.findById(booking._id).populate('parkingSpace').populate('user', 'name email');
        global.io.emit('booking-updated', { booking: populated });
      }
    } catch (emitErr) {
      console.warn('[deleteById] emit error', emitErr);
    }

    // === FCM NOTIFICATION: START ===
    // Where I added it: right after saving the cancelled booking and emitting via socket.io
    try {
      const userId = booking.user; // may be ObjectId
      if (userId) {
        // get tokens for the booking owner
        const docs = await UserToken.find({ userId }).select('token -_id');
        const tokens = docs.map(d => d.token).filter(Boolean);

        if (tokens.length > 0) {
          const title = `Booking cancelled`;
          // include refund info in body (keeps message short)
          const body = `Your booking has been cancelled. Refund: ₹${refundAmount.toFixed(2)} (${refundPercent}%).`;

          // NotificationService should handle batching as necessary.
          // If you don't have batching inside NotificationService, we'll split into 500-token chunks here.
          const MAX_BATCH = 500;
          for (let i = 0; i < tokens.length; i += MAX_BATCH) {
            const chunk = tokens.slice(i, i + MAX_BATCH);
            if (chunk.length === 1) {
              await NotificationService.sendToDevice(chunk[0], title, body);
            } else {
              await NotificationService.sendToMultiple(chunk, title, body);
            }
          }

          console.log(`[FCM] Sent cancellation notification to user ${userId} (${tokens.length} tokens)`);
        } else {
          console.warn(`[FCM] No device tokens found for user ${userId}`);
        }
      }
    } catch (notifErr) {
      // log but do not fail the cancellation flow
      console.error('[deleteById] Notification error', notifErr);
      // Optional: collect invalid tokens from NotificationService response and remove them
    }
    // === FCM NOTIFICATION: END ===

    return res.status(200).json({
      message: 'Booking cancelled successfully',
      booking: await Booking.findById(booking._id).populate('parkingSpace').populate('user', 'name email'),
      refundAmount,
      refundPercent
    });
  } catch (err) {
    console.error('deleteById error:', err);
    return res.status(500).json({ message: 'Failed to cancel booking', error: err.message });
  }
};
/**
 * Generate OTP:
 *  - Buyer triggers this after payment
 *  - If booking.status === 'active' OR (status === 'overdue' && paymentStatus === 'paid') -> creates secondOtp (checkout)
 *  - Otherwise -> creates primary OTP (check-in)
 */
export const generateOTP = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const userId = req.user._id;

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (booking.user.toString() !== userId.toString()) return res.status(403).json({ message: 'Not authorized to generate OTP for this booking' });
    if (booking.paymentStatus !== 'paid') return res.status(400).json({ message: 'OTP can be generated only for paid bookings' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresInMs = 10 * 60 * 1000;
    const expiresAt = new Date(Date.now() + expiresInMs);

    // Allow second-OTP when booking is active OR when overdue but user already paid the fine
    if (booking.status === 'active' || (booking.status === 'overdue' && booking.paymentStatus === 'paid')) {
      booking.secondOtp = otp;
      booking.secondOtpExpires = expiresAt;
      await booking.save();

      // emit update
      try {
        if (global.io) {
          const populated = await Booking.findById(booking._id).populate('parkingSpace').populate('user', 'name email');
          global.io.emit('booking-updated', { booking: populated });
        }
      } catch (e) { console.warn('generateOTP emit', e); }

      return res.status(200).json({ otp, expiresAt: booking.secondOtpExpires, bookingId: booking._id, type: 'second' });
    } else {
      booking.otp = otp;
      booking.otpExpires = expiresAt;
      booking.otpVerified = false;
      await booking.save();

      try {
        if (global.io) {
          const populated = await Booking.findById(booking._id).populate('parkingSpace').populate('user', 'name email');
          global.io.emit('booking-updated', { booking: populated });
        }
      } catch (e) { console.warn('generateOTP emit', e); }

      return res.status(200).json({ otp, expiresAt: booking.otpExpires, bookingId: booking._id, type: 'primary' });
    }
  } catch (err) {
    console.error('generateOTP error', err);
    return res.status(500).json({ message: 'Failed to generate OTP', error: err.message });
  }
};

/**
 * Decrement parking available spots atomically
 */
export const decrementParkingAvailable = async (parkingId) => {
  if (!parkingId) return null;
  const updated = await ParkingSpace.findOneAndUpdate(
    { _id: parkingId, $expr: { $gt: ['$availableSpots', 0] } },
    { $inc: { availableSpots: -1 } },
    { new: true }
  );
  if (updated && global.io) {
    try {
      global.io.emit('parking-updated', { parkingId: updated._id.toString(), availableSpots: updated.availableSpots });
    } catch (e) {
      console.warn('socket emit error (parking-updated)', e);
    }
  }
  return updated;
};

/**
 * Verify primary OTP (provider verifies check-in)
 * - Enforces provider authorization
 * - Enforces start window: provider can verify at/after (startTime - 15min)
 */
export const verifyOTP = async (req, res) => {
  try {
    const bookingId = req.params.id;
    let { otp } = req.body;
    const providerId = req.user._id;

    if (otp === undefined || otp === null) return res.status(400).json({ message: 'OTP is required' });
    otp = otp.toString().trim();

    const booking = await Booking.findById(bookingId)
      .populate({ path: 'parkingSpace', populate: { path: 'owner', select: '_id name email' } })
      .populate('user', 'name email');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Authorization
    let isAuthorized = false;
    if (booking.providerId) {
      isAuthorized = booking.providerId.toString() === providerId.toString();
    } else if (booking.parkingSpace && booking.parkingSpace.owner) {
      isAuthorized = booking.parkingSpace.owner._id.toString() === providerId.toString();
    }
    if (!isAuthorized) return res.status(403).json({ message: 'Not authorized' });

    // Ensure OTP exists
    if (!booking.otp || !booking.otpExpires) return res.status(400).json({ message: 'OTP not generated for this booking' });
    if (new Date(booking.otpExpires) < new Date()) return res.status(400).json({ message: 'OTP expired' });
    if (booking.otp.toString().trim() !== otp) return res.status(400).json({ message: 'Invalid OTP' });

    // Enforce start window (15 minutes before startTime)
    if (booking.startTime) {
      const startTs = new Date(booking.startTime).getTime();
      const earliest = startTs - 15 * 60 * 1000;
      if (Date.now() < earliest) {
        return res.status(400).json({ message: 'Too early to verify OTP. Verification opens 15 minutes before start time.' });
      }
    }

    if (['accepted', 'confirmed'].includes(booking.status)) {
      booking.status = 'active';
      booking.otpVerified = true;
      booking.startedAt = new Date();

      let sessionMs = 60 * 60 * 1000;
      if (booking.startTime && booking.endTime) {
        const delta = new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime();
        sessionMs = delta > 0 ? delta : sessionMs;
      }

      booking.sessionEndAt = new Date(booking.startedAt.getTime() + sessionMs);

      booking.otp = null;
      booking.otpExpires = null;

      try { await decrementParkingAvailable(booking.parkingSpace); } catch (e) { console.warn('decrementParkingAvailable failed', e); }

      await booking.save();

      // schedule to mark overdue later (best-effort)
      const msUntilEnd = booking.sessionEndAt.getTime() - Date.now();
      if (msUntilEnd > 0) {
        if (bookingTimers.has(booking._id.toString())) {
          clearTimeout(bookingTimers.get(booking._id.toString()));
          bookingTimers.delete(booking._id.toString());
        }
        const t = setTimeout(() => cleanupOverdueBookings().catch(console.error), msUntilEnd);
        bookingTimers.set(booking._id.toString(), t);
      } else {
        booking.status = 'overdue';
        await booking.save();
      }

      try {
        if (global.io) {
          const populated = await Booking.findById(booking._id).populate('parkingSpace').populate('user', 'name email');
          global.io.emit('booking-updated', { booking: populated });
        }
      } catch (emitErr) {
        console.warn('[verifyOTP] emit error', emitErr);
      }

      const populated = await Booking.findById(booking._id).populate('parkingSpace').populate('user', 'name email');
      return res.status(200).json({ message: 'OTP verified and session started', booking: populated });
    }

    // Backwards-compat: if active and primary OTP used to finish in old flow
    if (booking.status === 'active') {
      booking.status = 'completed';
      booking.completedAt = new Date();
      booking.sessionEndAt = booking.sessionEndAt && new Date(booking.sessionEndAt) > new Date() ? booking.sessionEndAt : new Date();
      booking.otp = null;
      booking.otpExpires = null;
      booking.otpVerified = true;
      await booking.save();

      if (bookingTimers.has(booking._id.toString())) {
        clearTimeout(bookingTimers.get(booking._id.toString()));
        bookingTimers.delete(booking._id.toString());
      }

      if (booking.parkingSpace) await releaseParkingSpot(booking.parkingSpace, booking);

      try {
        if (global.io) {
          const populated = await Booking.findById(booking._id).populate('parkingSpace').populate('user', 'name email');
          global.io.emit('booking-updated', { booking: populated });
        }
      } catch (emitErr) {
        console.warn('[verifyOTP-complete] emit error', emitErr);
      }

      const populated = await Booking.findById(booking._id).populate('parkingSpace').populate('user', 'name email');
      return res.status(200).json({ message: 'OTP verified — booking completed', booking: populated });
    }

    return res.status(400).json({ message: 'Booking must be accepted, confirmed or active to verify OTP' });
  } catch (err) {
    console.error('verifyOTP error:', err);
    return res.status(500).json({ message: 'Failed to verify OTP', error: err.message });
  }
};

/**
 * Verify second OTP (provider verifies checkout)
 * - Only provider (owner) or assigned providerId can verify
 * - Booking must be active or overdue (we allow both)
 * - On success: mark completed, clear secondOtp, release spot, emit updates
 */
export const verifySecondOtp = async (req, res) => {
  try {
    const bookingId = req.params.id;
    let { otp } = req.body;
    const providerId = req.user._id;

    if (otp === undefined || otp === null) return res.status(400).json({ message: 'OTP is required' });
    otp = otp.toString().trim();

    const booking = await Booking.findById(bookingId)
      .populate({ path: 'parkingSpace', populate: { path: 'owner', select: '_id name email' } })
      .populate('user', 'name email');

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    let isAuthorized = false;
    if (booking.providerId) {
      isAuthorized = booking.providerId.toString() === providerId.toString();
    } else if (booking.parkingSpace && booking.parkingSpace.owner) {
      isAuthorized = booking.parkingSpace.owner._id.toString() === providerId.toString();
    }
    if (!isAuthorized) return res.status(403).json({ message: 'Not authorized to verify OTP for this booking' });

    if (!['active', 'overdue'].includes(booking.status)) return res.status(400).json({ message: 'Booking must be active or overdue to verify second OTP' });

    if (!booking.secondOtp || !booking.secondOtpExpires) return res.status(400).json({ message: 'Second OTP not generated for this booking' });
    if (new Date(booking.secondOtpExpires) < new Date()) return res.status(400).json({ message: 'Second OTP expired' });
    if (booking.secondOtp.toString().trim() !== otp) return res.status(400).json({ message: 'Invalid OTP' });

    booking.status = 'completed';
    booking.completedAt = new Date();

    if (!booking.endedAt) booking.endedAt = booking.sessionEndAt ? booking.sessionEndAt : booking.completedAt;
    if (!booking.endTime) booking.endTime = booking.sessionEndAt ? booking.sessionEndAt : booking.completedAt;

    booking.secondOtp = null;
    booking.secondOtpExpires = null;
    booking.otpVerified = true;

    await booking.save();

    try {
      if (bookingTimers && bookingTimers.has(booking._id.toString())) {
        clearTimeout(bookingTimers.get(booking._id.toString()));
        bookingTimers.delete(booking._id.toString());
      }
    } catch (e) {
      console.warn('Failed to clear booking timer after completion', e);
    }

    if (booking.parkingSpace) await releaseParkingSpot(booking.parkingSpace, booking);

    try {
      if (global.io) {
        const populated = await Booking.findById(booking._id).populate('parkingSpace').populate('user', 'name email');
        global.io.emit('booking-updated', { booking: populated });
        if (booking.user) global.io.to(booking.user.toString()).emit('booking-completed', { bookingId: booking._id.toString() });
      }
    } catch (emitErr) {
      console.warn('verifySecondOtp emit/release error', emitErr);
    }

    const populated = await Booking.findById(booking._id).populate('parkingSpace').populate('user', 'name email');
    return res.status(200).json({ message: 'Second OTP verified and booking completed', booking: populated });
  } catch (err) {
    console.error('verifySecondOtp error:', err);
    return res.status(500).json({ message: 'Failed to verify second OTP', error: err.message });
  }
};

/**
 * Extend booking by hours (simple endpoint; payment flow should call verify-payment with extend:true which also performs extension)
 */
export const extendBooking = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const hoursToAdd = Number(req.body.hours ?? 1);
    if (!mongoose.Types.ObjectId.isValid(bookingId)) return res.status(400).json({ message: 'Invalid booking id' });

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const currentEnd = booking.endTime ? new Date(booking.endTime) : new Date();
    const newEnd = new Date(currentEnd.getTime() + hoursToAdd * 60 * 60 * 1000);

    // set endTime as ISO string for consistency
    booking.endTime = newEnd.toISOString();
    if (booking.status === 'active') {
      // keep sessionEndAt as Date object for timer calculations
      booking.sessionEndAt = newEnd;
    }

    await booking.save();

    try {
      if (global.io) {
        const populated = await Booking.findById(booking._id).populate('parkingSpace').populate('user', 'name email');
        global.io.emit('booking-updated', { booking: populated });
      }
    } catch (emitErr) {
      console.warn('[extendBooking] emit error', emitErr);
    }

    return res.status(200).json(booking);
  } catch (error) {
    console.error('extendBooking error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};
