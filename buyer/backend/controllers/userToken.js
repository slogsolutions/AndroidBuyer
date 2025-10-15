
// import UserToken from "../models/UserToken.js";

// export const saveToken = async (req, res) => {
//   try {
//     const { userId, fcmToken, deviceInfo } = req.body;

//     if (!userId || !fcmToken) {
//       return res.status(400).json({ message: "Missing userId or fcmToken" });
//     }

//     const policy = process.env.FIREBASE_TOKEN_POLICY || "multiple";

//     if (policy === "single") {
//       // remove all previous tokens for this user
//       await UserToken.deleteMany({ userId });
//       await UserToken.create({ userId, token: fcmToken, deviceInfo });
//     } else {
//       // multiple-device behavior
//       const exists = await UserToken.findOne({ userId, token: fcmToken });
//       if (!exists) {
//         await UserToken.create({ userId, token: fcmToken, deviceInfo });
//       }
//     }

//     return res.json({ message: "Token saved" });
//   } catch (err) {
//     console.error("Error saving token:", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };


// export const removeToken = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const { fcmToken } = req.body;

//     if (!fcmToken) {
//       return res.status(400).json({ message: "Missing fcmToken" });
//     }

//     await UserToken.deleteOne({ userId, token: fcmToken });

//     return res.json({ message: "Token removed" });
//   } catch (err) {
//     console.error("Error removing token:", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

// controllers/userTokenController.js
import UserToken from "../models/UserToken.js";

/**
 * Save / upsert an FCM token.
 * 
 * Behavior:
 * - If token already exists in DB attached to a different user -> reassign it to current user.
 * - If policy === "single" -> remove all previous tokens for this user (so user has only one token).
 * - Otherwise (default) keep multiple tokens per user, but token value itself remains unique across DB.
 */
export const saveToken = async (req, res) => {
  try {
    const { userId, fcmToken, deviceInfo } = req.body;

    if (!userId || !fcmToken) {
      return res.status(400).json({ message: "Missing userId or fcmToken" });
    }

    const policy = process.env.FIREBASE_TOKEN_POLICY || "multiple";
    // ensure token uniqueness across collection is enforced at DB level (see notes below)

    // 1) If token exists in DB but for a different user -> reassign to this user
    const existingByToken = await UserToken.findOne({ token: fcmToken });

    if (existingByToken) {
      if (existingByToken.userId?.toString() !== userId.toString()) {
        // reassign token to current user
        existingByToken.userId = userId;
        existingByToken.deviceInfo = deviceInfo || existingByToken.deviceInfo;
        existingByToken.updatedAt = new Date();
        existingByToken.email = req.user?.email || existingByToken.email; // if available
        await existingByToken.save();

        // If policy === "single", also delete other tokens for this user (so user ends up with just this token)
        if (policy === "single") {
          await UserToken.deleteMany({
            userId,
            _id: { $ne: existingByToken._id },
          });
        }

        return res.json({ message: "Token reassigned to current user" });
      } else {
        // token already attached to same user -> update deviceInfo/updatedAt
        existingByToken.deviceInfo = deviceInfo || existingByToken.deviceInfo;
        existingByToken.updatedAt = new Date();
        await existingByToken.save();
        return res.json({ message: "Token updated" });
      }
    }

    // 2) Token does not exist in DB yet
    if (policy === "single") {
      // remove all previous tokens for this user (user keeps only one token)
      await UserToken.deleteMany({ userId });
      await UserToken.create({
        userId,
        token: fcmToken,
        deviceInfo,
        email: req.user?.email,
      });
      return res.json({ message: "Token saved (single policy)" });
    } else {
      // multiple-device behavior: create new token record
      await UserToken.create({
        userId,
        token: fcmToken,
        deviceInfo,
        email: req.user?.email,
      });
      return res.json({ message: "Token saved (multiple policy)" });
    }
  } catch (err) {
    console.error("Error saving token:", err);

    // handle duplicate key error (just in case)
    if (err.code === 11000 && err.keyPattern && err.keyPattern.token) {
      // token unique constraint violated; try to update existing record
      try {
        await UserToken.findOneAndUpdate(
          { token: req.body.fcmToken },
          { $set: { userId: req.body.userId, deviceInfo: req.body.deviceInfo, updatedAt: new Date() } }
        );
        return res.json({ message: "Token upserted after duplicate key" });
      } catch (e) {
        console.error("Upsert retry failed:", e);
      }
    }

    return res.status(500).json({ message: "Server error" });
  }
};


/**
 * Delete token endpoint for logout.
 * Accepts:
 *  - fcmToken in body -> deletes that token for the current user
 *  - or if no fcmToken provided -> delete all tokens for current user (useful on full logout)
 */
export const deleteToken = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId; // prefer authenticated user
    const { fcmToken } = req.body;

    if (!userId && !fcmToken) {
      return res.status(400).json({ message: "Missing userId or fcmToken" });
    }

    if (fcmToken) {
      // remove specific token for this user (guard so one user can't delete other's token)
      await UserToken.deleteOne({ token: fcmToken, userId });
      return res.json({ message: "Token removed" });
    } else {
      // remove all tokens for this user (logout from all devices)
      await UserToken.deleteMany({ userId });
      return res.json({ message: "All tokens removed for user" });
    }
  } catch (err) {
    console.error("Error removing token:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


