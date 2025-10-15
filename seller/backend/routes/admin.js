import express from "express";
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });
import UserToken from "../models/UserToken.js";
import { protect, adminOnly } from "../middleware/auth.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import ParkingSpace from "../models/ParkingSpace.js";
import seeder from "../seeder.js";
import NotificationService from "../service/NotificationService.js";
import DeviceToken from '../models/DeviceToken.js';

const router = express.Router();

router.post("/firebase", async (req, res) => {
  try {
    const {
      title,
      body,
      userId,
      username,
      fullName,
      email,
      userIds,
      deviceToken,
      allUsers
    } = req.body;

    if (!title || !body) {
      return res.status(400).json({ message: "Missing title or body" });
    }

    let tokens = [];

    const getTokensByUserId = async (id) => {
      const docs = await UserToken.find({ userId: id }).select("token -_id");
      return docs.map(d => d.token);
    };

    if (allUsers) {
      const docs = await UserToken.find({}).select("token -_id");
      tokens = docs.map(d => d.token);
    } else if (deviceToken) {
      tokens = [deviceToken];
    } else if (userId) {
      tokens = await getTokensByUserId(userId);
    } else if (username) {
      const user = await User.findOne({ name: username });
      if (!user) return res.status(404).json({ message: "User not found" });
      tokens = await getTokensByUserId(user._id);
    } else if (fullName) {
      const user = await User.findOne({ "kycData.fullName": fullName });
      if (!user) return res.status(404).json({ message: "User not found" });
      tokens = await getTokensByUserId(user._id);
    } else if (email) {
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ message: "User not found" });
      tokens = await getTokensByUserId(user._id);
    } else if (Array.isArray(userIds) && userIds.length > 0) {
      const docs = await UserToken.find({ userId: { $in: userIds } }).select("token -_id");
      tokens = docs.map(d => d.token);
    } else {
      return res.status(400).json({ message: "No target specified" });
    }

    if (tokens.length === 0) {
      return res.status(404).json({ message: "No tokens found for target" });
    }

    let response;
    if (tokens.length === 1) {
      response = await NotificationService.sendToDevice(tokens[0], title, body);
    } else {
      response = await NotificationService.sendToMultiple(tokens, title, body);
    }

    return res.json({
      success: true,
      tokensSent: tokens.length,
      response
    });
  } catch (err) {
    console.error("Notification error:", err);
    return res.status(500).json({ message: "Failed to send notification", error: err.message });
  }
});

router.post('/save-token-basic', async (req, res) => {
  try {
    const { fcmToken, userId, deviceInfo } = req.body || {};

    console.log('[save-token-basic] payload:', {
      hasFcmToken: !!fcmToken,
      userId: userId ?? null,
      deviceInfo,
      ip: req.ip,
      ts: new Date().toISOString(),
    });

    if (!fcmToken) {
      return res.status(400).json({ success: false, message: 'fcmToken is required' });
    }

    const update = {
      $set: {
        lastSeen: new Date(),
        deviceInfo: deviceInfo ?? null,
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    };

    if (userId) {
      update.$set.userId = userId;
    }

    const opts = { upsert: true, new: true, setDefaultsOnInsert: true };
    const doc = await DeviceToken.findOneAndUpdate({ token: fcmToken }, update, opts).exec();

    return res.json({
      success: true,
      message: 'Token saved (basic)',
      token: { id: doc._id, userId: doc.userId ?? null, token: doc.token },
    });
  } catch (err) {
    console.error('[save-token-basic] error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/android-basic-save', async (req, res) => {
  try {
    const { fcmToken, deviceInfo } = req.body || {};

    console.log('[android-basic-save] payload:', {
      hasFcmToken: !!fcmToken,
      deviceInfo,
      ip: req.ip,
      ts: new Date().toISOString(),
    });

    if (!fcmToken) {
      return res.status(400).json({ success: false, message: 'fcmToken is required' });
    }

    const filter = { token: fcmToken };
    const update = {
      $set: { lastSeen: new Date(), deviceInfo: deviceInfo ?? null },
      $setOnInsert: { createdAt: new Date(), userId: null },
    };
    const opts = { upsert: true, new: true, setDefaultsOnInsert: true };

    const doc = await DeviceToken.findOneAndUpdate(filter, update, opts).exec();

    return res.json({
      success: true,
      message: 'Token recorded (android-basic-save)',
      token: { id: doc._id, userId: doc.userId ?? null, token: doc.token },
    });
  } catch (err) {
    console.error('[android-basic-save] error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/debug/tokens', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '200', 10), 2000);
    const docs = await DeviceToken.find({}, { userId: 1, token: 1, deviceInfo: 1, lastSeen: 1 })
      .sort({ lastSeen: -1 })
      .limit(limit)
      .lean()
      .exec();
    return res.json({ success: true, count: docs.length, tokens: docs });
  } catch (err) {
    console.error('[debug/tokens] error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post("/seed", async(req,res) => {
  try{
    console.log("Seeding started...");
    await seeder();
    res.status(200).json({message: "Seeded Successfully"});
  }
  catch(err){
    console.error("Error seeding data:", err);
    res.status(500).json({ error: err.message });
  }
});

// Users routes
router.get("/users", protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find();
    res.json({ users });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/users/:id", protect, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const user = await User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: err.message });
  }
});

router.patch("/users/:id/verify", protect, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { isVerified, kycStatus } = req.body;
    const updateData = {};
    if (isVerified !== undefined) updateData.isVerified = isVerified;
    if (kycStatus) updateData.kycStatus = kycStatus;

    const user = await User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    console.error("Error verifying user:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/users/:id", protect, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ error: err.message });
  }
});

// NEW: Bulk delete users
router.post("/users/bulk-delete", protect, adminOnly, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Please provide an array of user IDs" });
    }
    const result = await User.deleteMany({ _id: { $in: ids } });
    res.json({ 
      message: `${result.deletedCount} user(s) deleted successfully`,
      deletedCount: result.deletedCount 
    });
  } catch (err) {
    console.error("Error bulk deleting users:", err);
    res.status(500).json({ error: err.message });
  }
});

// Bookings routes
router.get("/bookings", protect, adminOnly, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("user", "name email")
      .populate("parkingSpace", "title address location pricePerHour");
    res.json({ bookings });
  } catch (err) {
    console.error("Error fetching bookings:", err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/bookings/:id", protect, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const booking = await Booking.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    res.json({ booking });
  } catch (err) {
    console.error("Error updating booking:", err);
    res.status(500).json({ error: err.message });
  }
});

router.patch("/bookings/:id/status", protect, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const booking = await Booking.findByIdAndUpdate(id, { status }, { new: true, runValidators: true });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    res.json({ booking });
  } catch (err) {
    console.error("Error updating booking status:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/bookings/:id", protect, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findByIdAndDelete(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    res.json({ message: "Booking deleted successfully" });
  } catch (err) {
    console.error("Error deleting booking:", err);
    res.status(500).json({ error: err.message });
  }
});

// NEW: Bulk delete bookings
router.post("/bookings/bulk-delete", protect, adminOnly, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Please provide an array of booking IDs" });
    }
    const result = await Booking.deleteMany({ _id: { $in: ids } });
    res.json({ 
      message: `${result.deletedCount} booking(s) deleted successfully`,
      deletedCount: result.deletedCount 
    });
  } catch (err) {
    console.error("Error bulk deleting bookings:", err);
    res.status(500).json({ error: err.message });
  }
});

// Parking spaces routes
router.get("/parkingspaces", protect, adminOnly, async (req, res) => {
  try {
    const spaces = await ParkingSpace.find()
      .populate("owner", "name email")
      .lean();
    res.json({ spaces });
  } catch (err) {
    console.error("Error fetching parking spaces:", err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/parkingspaces/:id", protect, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const space = await ParkingSpace.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!space) return res.status(404).json({ error: "Parking space not found" });
    res.json({ space });
  } catch (err) {
    console.error("Error updating parking space:", err);
    res.status(500).json({ error: err.message });
  }
});

router.patch("/parkingspaces/:id/status", protect, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const space = await ParkingSpace.findByIdAndUpdate(id, { status }, { new: true, runValidators: true });
    if (!space) return res.status(404).json({ error: "Parking space not found" });
    res.json({ space });
  } catch (err) {
    console.error("Error updating parking space status:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/parkingspaces/:id", protect, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const space = await ParkingSpace.findByIdAndDelete(id);
    if (!space) return res.status(404).json({ error: "Parking space not found" });
    res.json({ message: "Parking space deleted successfully" });
  } catch (err) {
    console.error("Error deleting parking space:", err);
    res.status(500).json({ error: err.message });
  }
});

// NEW: Bulk delete parking spaces
router.post("/parkingspaces/bulk-delete", protect, adminOnly, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Please provide an array of parking space IDs" });
    }
    const result = await ParkingSpace.deleteMany({ _id: { $in: ids } });
    res.json({ 
      message: `${result.deletedCount} parking space(s) deleted successfully`,
      deletedCount: result.deletedCount 
    });
  } catch (err) {
    console.error("Error bulk deleting parking spaces:", err);
    res.status(500).json({ error: err.message });
  }
});

// Debug route
router.get("/debug", protect, adminOnly, async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const bookingCount = await Booking.countDocuments();
    const spaceCount = await ParkingSpace.countDocuments();
    res.json({
      users: userCount,
      bookings: bookingCount,
      parkingSpaces: spaceCount,
      models: {
        User: User.modelName,
        Booking: Booking.modelName,
        ParkingSpace: ParkingSpace.modelName
      }
    });
  } catch (err) {
    console.error("Debug error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;