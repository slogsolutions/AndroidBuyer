// backend/models/UserToken.js
import mongoose from "mongoose";


const UserTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true },
    deviceInfo: { type: String },
  },
  { timestamps: true }  // adds createdAt & updatedAt automatically
);


export default mongoose.model("UserToken", UserTokenSchema)
//  UserToken;
