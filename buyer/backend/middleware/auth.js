// backend/middleware/auth.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return res.status(401).json({ message: 'Not authorized, user not found' });
      req.user = user;
      return next();
    } catch (err) {
      console.error('Auth error:', err);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }
  return res.status(401).json({ message: 'Not authorized, no token' });
};
// backend/middleware/auth.js
export const captainOnly = (req, res, next) => {
  // Two safe approaches:
  // 1) If req.user comes from DB (protect middleware sets req.user), check req.user.isCaptain
  if (req.user && req.user.isCaptain) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied, captain only' });
};


export const adminOnly = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied, admin only' });
};
