import { Event } from './Event.js';
import mongoose from 'mongoose';
import User from './User.js'; // added import

const workshopSchema = new mongoose.Schema({
    fullAgenda: { type: String, required: true },
    faculty: { type: String, enum: ['MET', 'IET', 'EMS', 'MBA', 'MGT', 'LAW'], required: true },
    professors: [
        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
    ],
    budget: { type: Number, required: true },
    fundingSource: { type: String, enum: ['External', 'GUC'], required: true },
    extraRequiredResources: [
        {
            resourceName: { type: String, required: true },
            quantity: { type: Number, default: 1, min: 1 },
        },
    ],
    capacity: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['Accepted', 'Pending'], required: true },
    price: { type: Number, required: true, min: 0 },
});

workshopSchema.pre('save', function (next) {
    const allowedLocations = ['GUC Cairo', 'GUC Berlin'];
    if (!allowedLocations.includes(this.location)) {
        return next(new Error(`Invalid location: ${this.location}. Must be one of ${allowedLocations.join(', ')}`));
    }
    next();
});

workshopSchema.pre('save', async function (next) {
    if (!this.professors || this.professors.length === 0) return next();

    const invalidId = this.professors.some(id => !mongoose.Types.ObjectId.isValid(String(id)));
    if (invalidId) return next(new Error('One or more professor ids are invalid'));

    try {
        const users = await User.find({ _id: { $in: this.professors } }).select('role');
        if (users.length !== this.professors.length) {
            return next(new Error('One or more professors not found'));
        }
        for (const u of users) {
            if (u.role !== 'professor') {
                return next(new Error(`User ${u._id} is not a professor`));
            }
        }
        return next();
    } catch (err) {
        return next(err);
    }
});

// Create the discriminator model
export const Workshop = Event.discriminator('workshop', workshopSchema);