import { Event } from './Event.js';
import mongoose from 'mongoose';

const conferenceSchema = new mongoose.Schema({
    fullAgenda: { type: String, required: true },
    conferenceWebsiteLink: {type: String, required: true },
    budget: { type: Number, required: true },
    fundingSource: { type: String, enum: ['External', 'GUC'], required: true },
    extraRequiredResources: [
        {
            resourceName: { type: String, required: true },
            quantity: { type: Number, default: 1, min: 1 },
        },
    ],
});

// Create the discriminator model
export const Conference = Event.discriminator('conference', conferenceSchema);