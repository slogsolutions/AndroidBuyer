// server/controllers/stats.js
import Booking from '../models/Booking.js';
import ParkingSpace from '../models/ParkingSpace.js';
import mongoose from 'mongoose';

/**
 * GET /api/stats/me
 * Returns aggregated stats for the authenticated user:
 * - buyerBookingsCount (bookings made by user)
 * - providerBookingsCount (bookings for spaces owned by user)
 * - spacesCount (spaces owned by user)
 * - earnings (sum of payment.amount for provider bookings with status paid/completed)
 * - bookingsByDate (last 7 days aggregated) [optional helpful for charts]
 */
export const getMyStats = async (req, res) => {
  try {
    const uid = req.user._id;
    const userObjectId = new mongoose.Types.ObjectId(uid);

    // buyer bookings count
    const buyerBookingsCount = await Booking.countDocuments({ user: userObjectId });

    // provider: find parking spaces owned by user
    const spacesCount = await ParkingSpace.countDocuments({ owner: userObjectId });

    // provider bookings count: bookings for those parking spaces
    // If there are no spaces, providerBookingsCount = 0
    let providerBookingsCount = 0;
    let earnings = 0;

    if (spacesCount > 0) {
      const spaces = await ParkingSpace.find({ owner: userObjectId }).select('_id');
      const spaceIds = spaces.map((s) => s._id);

      providerBookingsCount = await Booking.countDocuments({ parkingSpace: { $in: spaceIds } });

      // earnings aggregation: sum payment.amount for bookings that are 'paid' or 'completed'
      const earnAgg = await Booking.aggregate([
        { $match: { parkingSpace: { $in: spaceIds }, status: { $in: ['paid', 'completed'] } } },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ['$payment.amount', 0] } },
          },
        },
      ]);

      earnings = (earnAgg[0] && earnAgg[0].total) || 0;
    }

    // optional: bookings by date (last 7 days) for provider (useful for chart)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // include today -> 7 days
    const bookingsByDate = await Booking.aggregate([
      { $match: { providerId: userObjectId, createdAt: { $gte: new Date(sevenDaysAgo.setHours(0, 0, 0, 0)) } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Normalize bookingsByDate to include any missing dates in the 7-day window (optional convenience)
    const dateMap = {};
    bookingsByDate.forEach(b => { dateMap[b._id] = b.count; });
    const normalized = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      normalized.push({ date: key, count: dateMap[key] || 0 });
    }

    return res.json({
      buyerBookingsCount,
      providerBookingsCount,
      spacesCount,
      earnings,
      bookingsByDate: normalized,
    });
  } catch (err) {
    console.error("getMyStats error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
