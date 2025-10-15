// server/index.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';
import kycRoutes from './routes/kyc.js';
import parkingRoutes from './routes/parking.js';
import bookingRoutes from './routes/booking.js';
import paymentRoutes from './routes/payment.js';
import mongoose from 'mongoose';
import ParkfindersecondParkingSpace from './models/ParkingSpace.js';
import ParkFinderSecondUser from './models/User.js';
import multer from 'multer';
import axios from 'axios';
import adminRoutes from "./routes/admin.js";
import { protect } from './middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import { startBookingReminderCron } from './cronjob.js';
import userTokensRouter from "./routes/userTokenRoutes.js"
import captainRoutes from './routes/captain.js';

// Load .env from server/ folder explicitly so running from project root still works
// const envPath = path.resolve(process.cwd(), 'server', '.env');
// const result = dotenv.config({ path: envPath });
// if (result.error) {
//   console.warn(`Warning: could not load env file at ${envPath}. Make sure server/.env exists.`);
// } else {
//   console.log(`Loaded env from: ${envPath}`);
// }

dotenv.config();

// Basic runtime checks (non-sensitive logging)
const hasMongo = !!process.env.MONGODB_URI;
const hasClient = !!process.env.CLIENT_ID;
console.log('ENV check: MONGODB_URI set?', hasMongo, 'CLIENT_ID set?', hasClient);

// If critical env missing, show clear error (helps during dev)
if (!hasMongo) {
  console.error('ERROR: MONGODB_URI is not set. Please add server/.env with MONGODB_URI.');
  // we don't exit here to allow other dev flows, but it's useful to notice in logs
}

const AllowedOrigin = [process.env.FRONTEND_URL,'*','http://localhost:5173',process.env.FRONTEND_DEV_URL, 'https://apark-phi.vercel.app'];  //here

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: AllowedOrigin,
    methods: ['GET', 'POST'],
  },
});
app.set('io', io);           // <<-- add this so routes can do req.app.get('io')
global.io = io; 

// Connect DB
// connectDB should use process.env.MONGODB_URI internally
try {
  connectDB();
} catch (err) {
  console.error('connectDB() threw an error:', err);
}

// Middleware
// Allow the specific local frontend in dev (if provided), otherwise allow all
app.use(
  cors({
    origin: AllowedOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS',"PATCH"],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Use JSON parser for application/json bodies
app.use(express.json());
const uploadsPath = path.join(process.cwd(), 'uploads');
// ensure uploads are accessible at http(s)://<HOST>/uploads/<filename>
app.use('/uploads', express.static(uploadsPath));
app.use("/api/users", userTokensRouter);
app.use('/api/auth', authRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/parking', parkingRoutes);
// Keep the original mount for backwards-compatibility
app.use('/api/booking', bookingRoutes);
// ALSO mount with plural to match examples / frontend that may call /api/bookings
app.use('/api/bookings', bookingRoutes);
app.use('/api/payment', paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use('/api/captain', captainRoutes);
// Only initialize multer for routes that need multipart/form-data
const upload = multer();

// Routes
app.get('/test', (req, res) => {
  res.send({ test: 'done' });
});

/**
 * Optional helper: server-generated reference_id (UUID)
 */
app.get('/proxy/new-reference', (req, res) => {
  res.json({ reference_id: uuidv4() });
});

/**
 * Proxy: Send OTP (Generate)
 */
app.post('/proxy/send-otp', async (req, res) => {
  try {
    // Basic validation
    if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET || !process.env.MODULE_SECRET) {
      console.error('Decentro credentials missing in environment');
      return res.status(500).json({ message: 'Server misconfiguration: Decentro credentials missing' });
    }

    // Log non-sensitive info for debugging
    console.log('[proxy/send-otp] Decentro headers - client_id:', process.env.CLIENT_ID, 'module_secret_present:', !!process.env.MODULE_SECRET);
    console.log('[proxy/send-otp] payload sample:', JSON.stringify(req.body).slice(0, 800));

    const response = await axios.post('https://in.staging.decentro.tech/v2/kyc/aadhaar/otp', req.body, {
      headers: {
        'Content-Type': 'application/json',
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        module_secret: process.env.MODULE_SECRET,
      },
      timeout: 30000,
    });

    console.log('[proxy/send-otp] Decentro success:', response.data);
    return res.status(response.status).send(response.data);
  } catch (error) {
    // Detailed error handling
    const remoteData = error.response?.data;
    const remoteStatus = error.response?.status;
    console.error('[proxy/send-otp] error:', error.message);
    if (remoteData || remoteStatus) {
      console.error('[proxy/send-otp] remote response:', remoteStatus, remoteData);
      return res.status(remoteStatus || 500).send(remoteData || { message: 'Decentro error' });
    }
    return res.status(500).send({ message: 'Unexpected server error' });
  }
});

/**
 * Proxy: Validate OTP
 */
app.post('/proxy/validate-otp', async (req, res) => {
  try {
    if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET || !process.env.MODULE_SECRET) {
      console.error('Decentro credentials missing in environment');
      return res.status(500).json({ message: 'Server misconfiguration: Decentro credentials missing' });
    }

    // Normalize initiation transaction id from multiple possible fields
    const initiation_transaction_id =
      req.body.initiation_transaction_id ||
      req.body.initiationTransactionId ||
      req.body.initiation_txn_id ||
      req.body.decentroTxnId ||
      req.body.decentro_txn_id ||
      req.body.txn_id ||
      req.body.reference_id;

    const payload = {
      reference_id: req.body.reference_id,
      consent: req.body.consent,
      purpose: req.body.purpose,
      initiation_transaction_id,
      otp: req.body.otp,
      generate_pdf: req.body.generate_pdf,
      generate_xml: req.body.generate_xml,
      share_code: req.body.share_code,
    };

    console.log('[proxy/validate-otp] payload sample:', JSON.stringify(payload).slice(0, 800));

    const response = await axios.post('https://in.staging.decentro.tech/v2/kyc/aadhaar/otp/validate', payload, {
      headers: {
        'Content-Type': 'application/json',
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        module_secret: process.env.MODULE_SECRET,
      },
      timeout: 30000,
    });

    console.log('[proxy/validate-otp] Decentro success:', response.data);
    return res.status(response.status).send(response.data);
  } catch (error) {
    const remoteData = error.response?.data;
    const remoteStatus = error.response?.status;
    console.error('[proxy/validate-otp] error:', error.message);
    if (remoteData || remoteStatus) {
      console.error('[proxy/validate-otp] remote response:', remoteStatus, remoteData);
      return res.status(remoteStatus || 500).send(remoteData || { message: 'Decentro error' });
    }
    return res.status(500).send({ message: 'Unexpected server error' });
  }
});

/**
 * Proxy: Validate RC (public registry)
 */
app.post('/proxy/validate-RC', async (req, res) => {
  try {
    if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
      console.error('Decentro credentials missing in environment');
      return res.status(500).json({ message: 'Decentro credentials missing' });
    }

    const payload = {
      document_type: req.body.document_type,
      reference_id: req.body.reference_id,
      consent_purpose: req.body.consent_purpose,
      id_number: req.body.id_number,
      consent: req.body.consent,
    };

    console.log('[proxy/validate-RC] payload sample:', JSON.stringify(payload).slice(0, 800));

    const response = await axios.post('https://in.staging.decentro.tech/kyc/public_registry/validate', payload, {
      headers: {
        'Content-Type': 'application/json',
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
      },
      timeout: 30000,
    });

    console.log('[proxy/validate-RC] Decentro success:', response.data);
    return res.status(response.status).send(response.data);
  } catch (error) {
    const remoteData = error.response?.data;
    const remoteStatus = error.response?.status;
    console.error('[proxy/validate-RC] error:', error.message);
    if (remoteData || remoteStatus) {
      console.error('[proxy/validate-RC] remote response:', remoteStatus, remoteData);
      return res.status(remoteStatus || 500).send(remoteData || { message: 'Decentro error' });
    }
    return res.status(500).send({ message: 'Unexpected server error' });
  }
});

// Socket.IO logic (unchanged)
const connectedProviders = {};

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  socket.on('register-provider', async (data) => {
    try {
      console.log('Registering provider:', data.userId);
      const provider = await ParkFinderSecondUser.findById(data.userId);

      if (!provider) {
        console.log('Provider not found:', data.userId);
        return;
      }

      connectedProviders[data.userId] = socket.id;
      console.log('Connected Providers:', connectedProviders);
    } catch (error) {
      console.error('Error registering provider:', error);
    }
  });

  socket.on('notify-nearby-providers', async (data) => {
    try {
      console.log('Received location data:', data);
      const { userLat, userLng, userId } = data;

      const nearbySpaces = await ParkfindersecondParkingSpace.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [userLng, userLat] },
            distanceField: 'distance',
            maxDistance: 200000,
            spherical: true,
          },
        },
        { $project: { owner: 1, distance: 1, _id: 1 } },
      ]);

      console.log('Nearby spaces found:', nearbySpaces);

      if (nearbySpaces.length === 0) {
        console.log('No nearby parking spaces found.');
        return;
      }

      const providerIds = [...new Set(nearbySpaces.map((space) => space.owner.toString()))];
      console.log(`Found ${providerIds.length} nearby providers.`);

      providerIds.forEach((providerId) => {
        const providerSocketId = connectedProviders[providerId];
        if (providerSocketId) {
          const nearestParkingSpace = nearbySpaces.find((space) => space.owner.toString() === providerId);

          io.to(providerSocketId).emit('new-parking-request', {
            id: userId,
            location: { latitude: userLat, longitude: userLng },
            parkingSpaceId: nearestParkingSpace._id,
            distance: nearestParkingSpace.distance,
          });
        }
      });
    } catch (error) {
      console.error('Error notifying nearby providers:', error);
    }
  });

  socket.on('accept-parking-request', (requestData) => {
    console.log('Provider accepted request:', requestData);

    io.to(`user-${requestData.providerId}`).emit('provider-accepted', {
      providerId: requestData.providerId,
      name: requestData.parkingSpaceId,
      location: requestData.providerLocation,
    });
  });

  socket.on('disconnect', () => {
    Object.keys(connectedProviders).forEach((providerId) => {
      if (connectedProviders[providerId] === socket.id) {
        delete connectedProviders[providerId];
        console.log('Provider disconnected:', providerId);
      }
    });
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// IMPORTANT: Start the cron job here - OUTSIDE the socket handlers
startBookingReminderCron()
