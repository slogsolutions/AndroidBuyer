// backend/controllers/captain.js
import ParkingSpace from '../models/ParkingSpace.js';

// GET /captain/parkingspaces?status=pending
export const listParkingSpacesForCaptain = async (req, res) => {
  try {
    // Optionally, filter by captain-managed area if you implement that
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    } else {
      // default: only pending review
      filter.status = 'pending';
    }

    // Optionally: if you want captains to only see spaces in their city/area:
    // if (req.user.captainAreas && req.user.captainAreas.length) {
    //   filter['address.city'] = { $in: req.user.captainAreas };
    // }

    const spaces = await ParkingSpace.find(filter)
      .populate('owner', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ spaces });
  } catch (err) {
    console.error('Captain list spaces error', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// PATCH /captain/parkingspaces/:id/status
export const updateParkingSpaceStatusByCaptain = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // e.g. 'approved' or 'rejected' or 'active'

    if (!['approved','rejected','active','inactive','pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const space = await ParkingSpace.findById(id);
    if (!space) return res.status(404).json({ error: 'Parking space not found' });

    // you might want to record who approved and when:
    space.status = status;
    space.approvedBy = req.user._id; // you'll need to add this field if you want to persist
    space.approvedAt = new Date();

    await space.save();
    return res.json({ message: 'Status updated', space });
  } catch (err) {
    console.error('Captain update space status', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
