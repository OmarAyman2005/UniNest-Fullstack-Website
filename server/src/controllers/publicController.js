import mongoose from 'mongoose';
import User from '../models/User.js';

export const getProfessors = async (req, res) => {
    try {
        const professors = await User.find({ role: 'professor' }).select('_id fullName email');
        res.status(200).json(professors);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching professors', error: error.message });
    }
};

export const getProfessorById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(String(id))) {
            return res.status(400).json({ status: 'error', message: 'Invalid id' });
        }

        const user = await User.findById(id).select('_id fullName email role');
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Professor not found' });
        }

        if (user.role !== 'professor') {
            return res.status(404).json({ status: 'error', message: 'User is not a professor' });
        }

        return res.status(200).json({ status: 'success', data: { _id: user._id, fullName: user.fullName, email: user.email } });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error fetching professor', error: error.message });
    }
};