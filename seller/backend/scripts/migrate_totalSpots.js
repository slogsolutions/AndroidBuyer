// scripts/migrate_totalSpots.js
import mongoose from 'mongoose';
import ParkingSpace from '../models/ParkingSpace.js';

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/yourdb';

(async () => {
  try {
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    const spaces = await ParkingSpace.find({});
    for (const s of spaces) {
      let changed = false;
      if (s.totalSpots === undefined || s.totalSpots === null) {
        s.totalSpots = s.availableSpots || 1;
        changed = true;
      }
      if (s.activeCount === undefined || s.activeCount === null) {
        s.activeCount = 0;
        changed = true;
      }
      if (!Array.isArray(s.pendingReleases)) {
        s.pendingReleases = [];
        changed = true;
      }
      if (changed) {
        await s.save();
        console.log(`Migrated parking space ${s._id}`);
      }
    }
    console.log('Migration finished');
    process.exit(0);
  } catch (err) {
    console.error('Migration error', err);
    process.exit(1);
  }
})();
