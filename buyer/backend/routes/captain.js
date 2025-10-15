import express from 'express';
import { protect } from '../middleware/auth.js';
import { captainOnly } from '../middleware/roles.js';
import ParkingSpace from '../models/ParkingSpace.js';
import mongoose from 'mongoose';

const router = express.Router();

// Simple helper to pull owner id from different possible fields
const getOwnerId = (space) => {
  const candidates = ['owner', 'user', 'provider', 'createdBy'];
  for (const k of candidates) {
    if (space[k]) {
      const v = space[k];
      if (typeof v === 'object' && v._id) return String(v._id);
      return String(v);
    }
  }
  return null;
};

/**
 * GET /api/captain/parkingspaces?status=pending
 * List parking spaces for captains:
 *  - If the requesting user is a captain and has a `region`, only spaces with that region are returned.
 *  - Otherwise (admins or captains without region) return spaces matching optional status.
 */
router.get('/parkingspaces', protect, captainOnly, async (req, res) => {
  try {
    const rawStatus = req.query.status;
    const statusFilter = rawStatus ? { status: String(rawStatus).toLowerCase() } : {};

    const query = {
      ... (rawStatus ? statusFilter : {}),
    };

    // If the authenticated user is a captain and has a region, enforce region filter
    if (req.user && req.user.isCaptain && req.user.region) {
      query.region = req.user.region.toLowerCase();
    } else if (req.query.region) {
      // optional: allow passing ?region= for admins or other callers (kept permissive)
      query.region = String(req.query.region).toLowerCase();
    }

    // Exclude soft-deleted spaces if your app uses isDeleted
    query.isDeleted = { $ne: true };

    const spaces = await ParkingSpace.find(query)
      .populate('owner', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ spaces });
  } catch (err) {
    console.error('Error fetching captain parkingspaces:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * PATCH /api/captain/parkingspaces/:id/status
 * Body: { action: "approve" | "reject" }  OR { status: "submitted" | "rejected" }  (also accepts "approved"/"approve" as synonyms)
 *
 * Behavior changes:
 *  - Removed the owner-equals-requesting-user restriction.
 *  - Enforces that a captain (with region set) can only review spaces in their region.
 *  - Admins or users without region are not restricted by region here.
 */
router.patch('/parkingspaces/:id/status', protect, captainOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const actionRaw = req.body.action || req.body.status;
    if (!actionRaw) return res.status(400).json({ message: 'action or status required (submit/reject)' });

    const action = String(actionRaw).toLowerCase().trim();
    // treat approve/approved as synonyms for submit/submitted for incoming requests,
    // but canonical stored status will be "submitted"
    const isApprove = action === 'approve' || action === 'approved' || action === 'submit' || action === 'submitted';
    const isReject = action === 'reject' || action === 'rejected';

    if (!isApprove && !isReject) {
      return res.status(400).json({ message: 'Invalid action. Use "submit"/"approve" or "reject".' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid parking space id' });
    }

    const space = await ParkingSpace.findById(id).lean();
    if (!space) return res.status(404).json({ message: 'Parking space not found' });

    // debug logging to help you trace the failure
    const ownerId = getOwnerId(space);
    const reqUserId = req.user && req.user._id ? String(req.user._id) : null;
    console.log('[captain/status] action=', action, 'spaceId=', id, 'ownerId=', ownerId, 'reqUser=', reqUserId, 'currentStatus=', space.status);

    if (!reqUserId) return res.status(401).json({ message: 'Authenticated user required' });

    // NEW: Enforce region-based authorization for captains.
    // If the requesting user is a captain and has a region set, they may only review spaces in that region.
    if (req.user && req.user.isCaptain && req.user.region) {
      const spaceRegion = (space.region || '').toLowerCase();
      const userRegion = (req.user.region || '').toLowerCase();
      if (!spaceRegion) {
        // If a space has no region assigned, disallow captain from editing it (safer).
        return res.status(403).json({ message: 'This parking space has no region assigned; contact admin' });
      }
      if (spaceRegion !== userRegion) {
        return res.status(403).json({ message: 'You are not authorized to review spaces outside your region' });
      }
    }

    // map to schema-safe status values: use "submitted" as canonical label now
    const newStatus = isApprove ? 'submitted' : 'rejected';

    // build update using $set / $unset to avoid setting undefined
    const update = { $set: { status: newStatus } };
    if (isApprove) {
      update.$set.approvedBy = req.user._id;
      update.$set.approvedAt = new Date();
      // ensure any rejected-only fields are removed
      update.$unset = update.$unset || {};
      // example: update.$unset.rejectionReason = "";
    } else {
      // reject: remove approval metadata cleanly
      update.$unset = { approvedBy: "", approvedAt: "" };
    }

    const updated = await ParkingSpace.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();

    if (!updated) return res.status(404).json({ message: 'Parking space not found after update' });

    // socket emit (optional)
    try {
      req.app.get('io')?.emit('parking-space-updated', { id: updated._id, status: updated.status });
    } catch (e) {
      console.warn('Socket emit failed:', e);
    }

    return res.json({ message: isApprove ? 'Space submitted' : 'Space rejected', space: updated });
  } catch (err) {
    console.error('Captain route error (parkingspace status):', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

export default router;
