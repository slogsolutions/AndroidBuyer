// controllers/parking.js
import mongoose from 'mongoose';
import ParkingSpace from '../models/ParkingSpace.js';
import cloudinary from '../config/cloudinary.js';
import streamifier from 'streamifier';
import fs from 'fs';
import path from 'path';
import BookedSlot from '../models/BookedSlot.js';

/**
 * Helper to make accessible photo URL from multer file object or stored filename.
 * - If file has .path and it's already a web-accessible path, use that.
 * - Otherwise, if filename is provided, construct URL using request host (done in endpoints
 *   where `req` is available) or fallback to '/uploads/<filename>'.
 *
 * Note: For endpoints that only have parkingSpace object (not the original req.files),
 * we normalize existing photo strings into full URLs using server host info when available.
 */
function makePhotoUrlFromFile(req, file) {
  // If multer provided path that is already usable (e.g., '/uploads/xxx' or full path), prefer it.
  if (file.path) {
    // If file.path is absolute filesystem path (contains drive letter or starts with '/mnt' etc),
    // we will prefer file.filename to build a public URL.
    // If file.path already looks like a URL path (starts with '/' or 'http'), use it.
    if (typeof file.path === 'string' && (file.path.startsWith('/') || file.path.startsWith('http'))) {
      // If it is absolute fs path that starts with '/', still better construct using filename below.
      // Heuristic: if path contains 'uploads' and not '/mnt', use it
      if (file.path.includes('/uploads/') && !file.path.startsWith('/mnt')) {
        return (file.path.startsWith('http') ? file.path : `${req.protocol}://${req.get('host')}${file.path}`);
      }
    }
  }

  // If multer provides filename, construct an uploads URL
  if (file.filename) {
    return `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
  }

  // Fallback: if only file.path present but not a nice web path, try to use its basename
  if (file.path) {
    const parts = file.path.split(/[\\/]/);
    const filename = parts[parts.length - 1];
    return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
  }

  // As absolute fallback
  return null;
}

function makePhotoUrlFromString(req, photoStr) {
  if (!photoStr) return photoStr;
  if (photoStr.startsWith('http://') || photoStr.startsWith('https://')) return photoStr;
  if (photoStr.startsWith('/')) {
    // relative path on server
    return `${req.protocol}://${req.get('host')}${photoStr}`;
  }
  // assume filename stored, build from /uploads/
  return `${req.protocol}://${req.get('host')}/uploads/${photoStr}`;
}

/**
 * Upload a Buffer to Cloudinary using upload_stream.
 * Returns result object from Cloudinary (contains secure_url).
 */
function uploadBufferToCloudinary(buffer, originalName, folder) {
  return new Promise((resolve, reject) => {
    const opts = {
      folder: folder || process.env.CLOUDINARY_UPLOAD_FOLDER || 'aparkfinder/parking',
      public_id: originalName ? originalName.replace(/\.[^/.]+$/, '') + '-' + Date.now() : undefined,
      overwrite: false,
      resource_type: 'image',
      transformation: [{ quality: 'auto' }, { fetch_format: 'auto' }],
    };

    const uploadStream = cloudinary.uploader.upload_stream(opts, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

/**
 * Upload a file by local path to Cloudinary.
 * Returns result object from Cloudinary (contains secure_url).
 */
function uploadFilePathToCloudinary(filePath, originalName, folder) {
  return new Promise((resolve, reject) => {
    const opts = {
      folder: folder || process.env.CLOUDINARY_UPLOAD_FOLDER || 'aparkfinder/parking',
      public_id: originalName ? originalName.replace(/\.[^/.]+$/, '') + '-' + Date.now() : undefined,
      overwrite: false,
      resource_type: 'image',
      transformation: [{ quality: 'auto' }, { fetch_format: 'auto' }],
    };

    cloudinary.uploader.upload(filePath, opts, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
}

export const registerParkingSpace = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  try {
    const {
      title,
      description,
      location,
      address,  // will be stringified JSON from frontend
      pricePerHour,
      priceParking,
      availability,
      totalSpots,
      amenities,
      discount, // <-- may be string (FormData) or number (JSON)
    } = req.body;

    // Parse address if sent as JSON string
    let addressParsed = address;
    if (typeof address === 'string') {
      try {
        addressParsed = JSON.parse(address);
      } catch (err) {
        return res.status(400).json({ message: '"address" is not valid JSON' });
      }
    }

    // Parse availability if string
    let availabilityParsed = availability;
    if (typeof availability === 'string') {
      try {
        availabilityParsed = JSON.parse(availability);
      } catch (err) {
        return res.status(400).json({ message: '"availability" is not valid JSON' });
      }
    }

    // Parse location if string, and add fallback to lat/lng fields
    let locationParsed = location;
    if (typeof location === 'string') {
      try {
        locationParsed = JSON.parse(location);
      } catch {
        // keep as string; we will try lat/lng fallback below
      }
    }

    // Build coordinates from any accepted shape
    let coords;
    if (locationParsed) {
      if (locationParsed.type === 'Point' && Array.isArray(locationParsed.coordinates)) {
        coords = locationParsed.coordinates.map(Number);
      } else if (Array.isArray(locationParsed) && locationParsed.length === 2) {
        coords = locationParsed.map(Number);
      } else if (locationParsed.lng !== undefined && locationParsed.lat !== undefined) {
        coords = [Number(locationParsed.lng), Number(locationParsed.lat)];
      } else if (locationParsed.longitude !== undefined && locationParsed.latitude !== undefined) {
        coords = [Number(locationParsed.longitude), Number(locationParsed.latitude)];
      }
    }

    // Fallback when multipart fields are separate strings: req.body.lat/lng
    if ((!coords || coords.some(Number.isNaN)) && req.body.lat !== undefined && req.body.lng !== undefined) {
      coords = [Number(req.body.lng), Number(req.body.lat)];
    }

    // Log for debugging
    console.log('req.body.lat/lng', req.body.lat, req.body.lng, 'location raw', typeof req.body.location, req.body.location);

    // Strict validation: numeric and in valid ranges
    if (!coords || coords.length !== 2) {
      return res.status(400).json({ message: 'Invalid location coordinates' });
    }
    const [lonNum, latNum] = coords.map(v => Number(v));
    const valid =
      Number.isFinite(lonNum) && Number.isFinite(latNum) &&
      lonNum >= -180 && lonNum <= 180 &&
      latNum >= -90 && latNum <= 90;
    if (!valid) {
      return res.status(400).json({ message: 'Invalid location coordinates' });
    }

    // Process uploaded photos (from multer)
    const photos = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        // If multer provided buffer (memoryStorage), upload to Cloudinary
        if (file.buffer) {
          try {
            const result = await uploadBufferToCloudinary(file.buffer, file.originalname, process.env.CLOUDINARY_UPLOAD_FOLDER);
            if (result && result.secure_url) {
              photos.push(result.secure_url);
              continue;
            } else if (result && result.url) {
              photos.push(result.url);
              continue;
            }
          } catch (err) {
            console.error('Cloudinary upload failed for', file.originalname, err);
            // fall through to try existing heuristics below
          }
        }

        // If multer wrote file to disk (diskStorage), try uploading that path
        if (file.path) {
          try {
            const result = await uploadFilePathToCloudinary(file.path, file.originalname, process.env.CLOUDINARY_UPLOAD_FOLDER);
            if (result && result.secure_url) {
              photos.push(result.secure_url);
              // attempt to remove local file after successful upload (best-effort)
              try {
                fs.unlinkSync(file.path);
              } catch (rmErr) {
                // non-fatal
                console.warn('Failed to remove local temp file', file.path, rmErr);
              }
              continue;
            } else if (result && result.url) {
              photos.push(result.url);
              try {
                fs.unlinkSync(file.path);
              } catch (rmErr) {
                console.warn('Failed to remove local temp file', file.path, rmErr);
              }
              continue;
            }
          } catch (err) {
            console.error('Cloudinary upload from path failed for', file.path, err);
            // fall through to existing heuristics
          }
        }

        // prefer building full URL for frontend using existing heuristics
        const url = makePhotoUrlFromFile(req, file);
        if (url) photos.push(url);
        else if (file.filename) photos.push(`/uploads/${file.filename}`);
        else if (file.path) photos.push(file.path);
      }
    }

    // Normalize amenities: accept JSON string, CSV string, or array
    let amenitiesParsed = amenities;
    if (typeof amenities === 'string') {
      if (amenities.trim().startsWith('[')) {
        try {
          amenitiesParsed = JSON.parse(amenities);
        } catch {
          amenitiesParsed = [];
        }
      } else {
        amenitiesParsed = amenities
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
    if (!Array.isArray(amenitiesParsed)) amenitiesParsed = [];

    // Parse discount safely
    let discountNum = 0;
    if (discount !== undefined && discount !== null) {
      discountNum = Number(discount);
      if (Number.isNaN(discountNum)) discountNum = 0;
      // clamp to [0,100]
      if (discountNum < 0) discountNum = 0;
      if (discountNum > 100) discountNum = 100;
    }

    // Create new ParkingSpace
    const parkingSpace = new ParkingSpace({
      owner: req.user._id,
      title,
      description,
      location: {
        type: 'Point',
        coordinates: [lonNum, latNum],
      },
      address: addressParsed,
      pricePerHour,
      priceParking,
      totalSpots,
      availability: availabilityParsed,
      amenities: amenitiesParsed,
      photos,
      discount: discountNum,
    });

    console.log('registered parking space details', parkingSpace);

    await parkingSpace.save();

    // ensure returned object has full photo URLs (in case model modified them)
    const parkingObj = parkingSpace.toObject();
    if (Array.isArray(parkingObj.photos)) {
      parkingObj.photos = parkingObj.photos.map((p) => {
        if (!p) return p;
        if (p.startsWith('http://') || p.startsWith('https://')) return p;
        if (p.startsWith('/')) return `${req.protocol}://${req.get('host')}${p}`;
        return `${req.protocol}://${req.get('host')}/uploads/${p}`;
      });
    }

    res
      .status(201)
      .json({ message: 'Parking space registered successfully!', data: parkingObj });
  } catch (error) {
    console.error('Error registering parking space:', error.message);
    res
      .status(500)
      .json({ message: 'Failed to register parking space', error: error.message });
  }
};

export const getParkingSpaceAvailability = async (req, res) => {
  const { spaceId } = req.params;

  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  try {
    const parkingSpace = await ParkingSpace.findById(spaceId);

    if (!parkingSpace || parkingSpace.isDeleted) {
      return res.status(404).json({ message: 'Parking space not found' });
    }

    const availability = (parkingSpace.availability || []).map(avail => {
      return (avail.slots || []).map(slot => ({
        startTime: slot.startTime ? slot.startTime.toISOString() : null,
        endTime: slot.endTime ? slot.endTime.toISOString() : null,
        isBooked: !!slot.isBooked,
      }));
    }).flat();

    res.status(200).json({ availability });
  } catch (error) {
    console.error('Error fetching parking space availability:', error.message);
    res.status(500).json({ message: 'Failed to fetch availability', error: error.message });
  }
};

export const updateParkingSpace = async (req, res) => {
  try {
    const parkingSpace = await ParkingSpace.findById(req.params.id);
    if (!parkingSpace) {
      return res.status(404).json({ message: 'Parking space not found' });
    }

    if (parkingSpace.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // If new files uploaded, upload them to Cloudinary and append to existing photos
    if (req.files && req.files.length > 0) {
      const newPhotos = [];
      for (const file of req.files) {
        if (file.buffer) {
          try {
            const result = await uploadBufferToCloudinary(file.buffer, file.originalname, process.env.CLOUDINARY_UPLOAD_FOLDER);
            if (result && result.secure_url) {
              newPhotos.push(result.secure_url);
              continue;
            } else if (result && result.url) {
              newPhotos.push(result.url);
              continue;
            }
          } catch (err) {
            console.error('Cloudinary upload failed for update:', file.originalname, err);
            // fall through to existing heuristics
          }
        }

        if (file.path) {
          try {
            const result = await uploadFilePathToCloudinary(file.path, file.originalname, process.env.CLOUDINARY_UPLOAD_FOLDER);
            if (result && result.secure_url) {
              newPhotos.push(result.secure_url);
              try {
                fs.unlinkSync(file.path);
              } catch (rmErr) {
                console.warn('Failed to remove local temp file', file.path, rmErr);
              }
              continue;
            } else if (result && result.url) {
              newPhotos.push(result.url);
              try {
                fs.unlinkSync(file.path);
              } catch (rmErr) {
                console.warn('Failed to remove local temp file', file.path, rmErr);
              }
              continue;
            }
          } catch (err) {
            console.error('Cloudinary upload from path failed for update:', file.path, err);
            // fall through to heuristics
          }
        }

        const url = makePhotoUrlFromFile(req, file);
        if (url) newPhotos.push(url);
        else if (file.filename) newPhotos.push(`/uploads/${file.filename}`);
        else if (file.path) newPhotos.push(file.path);
      }

      // merge with any existing photos (keeping existing ones)
      const existingPhotos = Array.isArray(parkingSpace.photos) ? parkingSpace.photos : [];
      req.body.photos = [...existingPhotos, ...newPhotos];
    }

    const updatedSpace = await ParkingSpace.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );

    // normalize photo URLs before sending
    const updatedObj = updatedSpace ? updatedSpace.toObject() : null;
    if (updatedObj && Array.isArray(updatedObj.photos)) {
      updatedObj.photos = updatedObj.photos.map((p) => {
        if (!p) return p;
        if (p.startsWith('http://') || p.startsWith('https://')) return p;
        if (p.startsWith('/')) return `${req.protocol}://${req.get('host')}${p}`;
        return `${req.protocol}://${req.get('host')}/uploads/${p}`;
      });
    }

    res.json(updatedObj);
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: 'Failed to update parking space' });
  }
};

export const setOnlineStatus = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized, user missing' });
    }

    const { isOnline } = req.body;
    if (typeof isOnline !== 'boolean') {
      return res.status(400).json({ message: 'isOnline must be boolean' });
    }

    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid parking space id' });
    }

    const parkingSpace = await ParkingSpace.findById(id);

    if (!parkingSpace || parkingSpace.isDeleted) {
      return res.status(404).json({ message: 'Parking space not found', id });
    }

    const ownerId = parkingSpace.owner ? parkingSpace.owner.toString() : null;
    if (!ownerId || ownerId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    parkingSpace.isOnline = isOnline;
    await parkingSpace.save();

    // Normalize photos for response
    const psObj = parkingSpace.toObject();
    if (Array.isArray(psObj.photos)) {
      psObj.photos = psObj.photos.map((p) => {
        if (!p) return p;
        if (p.startsWith('http://') || p.startsWith('https://')) return p;
        if (p.startsWith('/')) return `${req.protocol}://${req.get('host')}${p}`;
        return `${req.protocol}://${req.get('host')}/uploads/${p}`;
      });
    }

    return res.json({ message: 'Status updated', parkingSpace: psObj });
  } catch (error) {
    console.error('Error setting online status', error);
    return res.status(500).json({ message: 'Failed to set online status' });
  }
};

export const deleteParkingSpace = async (req, res) => {
  try {
    const parkingSpace = await ParkingSpace.findById(req.params.id);
    if (!parkingSpace) {
      return res.status(404).json({ message: 'Parking space not found' });
    }

    if (parkingSpace.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    parkingSpace.isDeleted = true;
    parkingSpace.deletedAt = new Date();
    await parkingSpace.save();

    res.json({ message: 'Parking space removed' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Failed to delete parking space' });
  }
};

// ✅ Modified: returns ALL parking spaces if no lat/lng, otherwise nearby
export const getParkingSpaces = async (req, res) => {
  try {
    const { lat, lng, radius, startTime, endTime, onlyAvailable } = req.query;

    const query = { isDeleted: { $ne: true } };

    // optional geo filter
    if (lat && lng) {
      const maxDistance = radius ? parseInt(radius, 10) : 5000; // default 5km if radius not provided
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: maxDistance,
        },
      };
    }

    // fetch raw parking documents (lean() makes them plain objects)
    const parkings = await ParkingSpace.find(query).populate('owner', 'name').lean();

    // If no time window requested, just attach fallback availableSpots = totalSpots or stored availableSpots
    let parsedStart = null;
    let parsedEnd = null;
    if (startTime && endTime) {
      parsedStart = new Date(startTime);
      parsedEnd = new Date(endTime);
      if (isNaN(parsedStart) || isNaN(parsedEnd) || parsedEnd.getTime() <= parsedStart.getTime()) {
        return res.status(400).json({ message: 'Invalid startTime or endTime' });
      }
    }

    // compute availability for each parking (if time window provided)
    const results = await Promise.all(
      parkings.map(async (p) => {
        const out = { ...p };

        // find numeric total spots from likely field names
        const totalSpots =
          Number(p.totalSpots ?? p.total_spots ?? p.slots ?? p.capacity ?? p.total ?? 0) || 0;

        out.totalSpots = totalSpots;

        if (parsedStart && parsedEnd) {
          // overlap condition: existing.startTime < newEnd && existing.endTime > newStart
          const overlapQuery = {
            parkingSpace: p._id,
            startTime: { $lt: parsedEnd },
            endTime: { $gt: parsedStart },
          };

          // Count booked slots which overlap the requested interval
          const overlappingCount = await BookedSlot.countDocuments(overlapQuery);

          const availableSpots = Math.max(0, totalSpots - overlappingCount);
          out.availableSpots = availableSpots;
        } else {
          // If no time window provided, fallback to existing metric (if any), else use totalSpots
          out.availableSpots = Number(p.availableSpots ?? totalSpots);
        }

        // Normalize photos/urls if your app expects full URLs (optional)
        if (Array.isArray(out.photos)) {
          out.photos = out.photos.map((ph) => {
            if (!ph) return ph;
            if (typeof ph === 'string') {
              if (ph.startsWith('http://') || ph.startsWith('https://')) return ph;
              if (ph.startsWith('/')) return `${req.protocol}://${req.get('host')}${ph}`;
              return `${req.protocol}://${req.get('host')}/uploads/${ph}`;
            }
            return ph;
          });
        }

        return out;
      })
    );

    // If caller requested onlyAvailable=true, filter out those with 0 availability (when time window provided)
    let filtered = results;
    if (parsedStart && parsedEnd && String(onlyAvailable).toLowerCase() === 'true') {
      filtered = results.filter((r) => Number(r.availableSpots) > 0);
    }

    // sort by createdAt or any other preference (optional)
    filtered.sort((a, b) => {
      if (a.createdAt && b.createdAt) return new Date(b.createdAt) - new Date(a.createdAt);
      return 0;
    });

    return res.json(filtered);
  } catch (err) {
    console.error('[getParkingSpaces] error:', err);
    return res.status(500).json({ message: 'Failed to fetch parking spaces', error: err.message });
  }
};

export const getParkingSpaceById = async (req, res) => {
  try {
    const parkingSpace = await ParkingSpace.findById(req.params.id).populate(
      'owner',
      'name'
    );
    if (!parkingSpace || parkingSpace.isDeleted) {
      return res.status(404).json({ message: 'Parking space not found' });
    }

    const obj = parkingSpace.toObject();
    if (Array.isArray(obj.photos)) {
      obj.photos = obj.photos.map((p) => {
        if (!p) return p;
        if (p.startsWith('http://') || p.startsWith('https://')) return p;
        if (p.startsWith('/')) return `${req.protocol}://${req.get('host')}${p}`;
        return `${req.protocol}://${req.get('host')}/uploads/${p}`;
      });
    }

    res.json(obj);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get parking space' });
  }
};

export const getMyParkingSpaces = async (req, res) => {
  try {
    const parkingSpaces = await ParkingSpace.find({ owner: req.user._id, isDeleted: { $ne: true } }).sort(
      '-createdAt'
    );

    const normalized = parkingSpaces.map(ps => {
      const obj = ps.toObject();
      if (Array.isArray(obj.photos)) {
        obj.photos = obj.photos.map((p) => {
          if (!p) return p;
          if (p.startsWith('http://') || p.startsWith('https://')) return p;
          if (p.startsWith('/')) return `${req.protocol}://${req.get('host')}${p}`;
          return `${req.protocol}://${req.get('host')}/uploads/${p}`;
        });
      }
      return obj;
    });

    res.json(normalized);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get your parking spaces' });
  }
};
