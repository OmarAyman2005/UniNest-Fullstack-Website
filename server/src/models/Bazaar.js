import { Event } from './Event.js';
import mongoose from 'mongoose';

const bazaarSchema = new mongoose.Schema({});

// Create the discriminator model
export const Bazaar = Event.discriminator('bazaar', bazaarSchema);