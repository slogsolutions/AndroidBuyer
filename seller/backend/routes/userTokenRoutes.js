import express from "express";
import { protect } from "../middleware/auth.js";
import { saveToken, deleteToken } from "../controllers/userToken.js";

const router = express.Router();

// save token (POST) - user must be authenticated
router.post("/save-token", protect, saveToken);

// delete token (POST) - pass { fcmToken } in body to remove specific token
// or pass { userId } in body (or rely on req.user) to remove all tokens for that user
router.post("/delete-token", protect, deleteToken);

export default router;
