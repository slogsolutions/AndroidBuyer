import mongoose from 'mongoose';
import dotenv from 'dotenv';
// import deleteExpiredBookings from "../cronjob.js"; 

dotenv.config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    // deleteExpiredBookings();
    console.log("mongodb here")
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;