// seedUsers.js
import mongoose from "mongoose";
import { faker } from "@faker-js/faker";
import dotenv from "dotenv";
import User from "./models/User.js"; // adjust path to your User model

dotenv.config();

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Function to generate a fake user
const generateFakeUser = () => {
  return {
    name: faker.person.fullName(),
    email: faker.internet.email(),
    password: faker.internet.password(), // you can hash later if required
    phone: faker.phone.number(),
    address: faker.location.streetAddress(),
    city: faker.location.city(),
    country: faker.location.country(),
    createdAt: faker.date.past(),
  };
};

// Insert 1000 users
const seedUsers = async () => {
  try {
    const users = [];

    for (let i = 0; i < 1000; i++) {
      users.push(generateFakeUser());
    }

    await User.insertMany(users);
    console.log("✅ 1000 Fake Users Added!");
    mongoose.connection.close();
  } catch (err) {
    console.error("❌ Error seeding users:", err);
    mongoose.connection.close();
  }
};

// seedUsers();
export default seedUsers;