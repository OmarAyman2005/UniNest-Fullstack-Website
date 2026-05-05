import { Event } from './Event.js';
import mongoose from 'mongoose';

const tripSchema = new mongoose.Schema({
    price: { type: Number, required: true },
    capacity: { type: Number, required: true },
    location: { type: String, required: true },
});

// Create the discriminator model
export const Trip = Event.discriminator('trip', tripSchema);