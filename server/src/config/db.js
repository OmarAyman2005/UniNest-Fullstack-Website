import mongoose from 'mongoose';
import { MONGO_URI } from './env.js';

export const connectDB = async () => {
  if (!MONGO_URI) throw new Error('MONGO_URI missing');
  await mongoose.connect(MONGO_URI);
  console.log('✅ MongoDB connected');
};
