// server/routes/stats.js
import express from 'express';
import { getMyStats } from '../controllers/stats.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// GET /api/stats/me  -> returns aggregated stats for current user
router.get('/me', protect, getMyStats);

export default router;
