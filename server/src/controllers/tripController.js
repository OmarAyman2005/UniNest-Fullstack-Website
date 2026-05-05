// controllers/tripController.js
import { Trip } from '../models/Trip.js';
import { buildEventQueryOptions } from '../utils/eventFilters.js';
import mongoose from 'mongoose';

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v));

export const getAllTrips = async (req, res) => {
  try {
    const { filter, pagination, sort } = buildEventQueryOptions(req.query);
    filter.eventType = 'trip';
    
    if (req.query.location) {
      filter.location = { $regex: req.query.location, $options: 'i' }; // case-insensitive search
    }

    
    const trips = await Trip.find(filter)
    .sort(sort)
    .skip(pagination.skip)
    .limit(pagination.limit);
    
    const total = await Trip.countDocuments(filter);
    
    res.status(200).json({
      status: 'success',
      page: pagination.page,
      totalPages: Math.ceil(total / pagination.limit),
      totalTrips: total,
      count: trips.length,
      data: trips,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

export const getTripById = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    
    if (!trip) {
      return res.status(404).json({
        status: 'error',
        message: 'Trip not found.',
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: trip,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

export const createTrip = async (req, res) => {
  try {
   if (!req.user?.id || !isObjectId(req.user.id)) {
      return res.status(401).json({ status: 'error', message: 'Authentication required to create a workshop.' });
    }
    const createdBy = req.user?.id;

    const trip = new Trip({
      ...req.body,
      createdBy,
      modifiedBy: createdBy,
    });

    const savedTrip = await trip.save();

    res.status(201).json({
      status: 'success',
      message: 'Trip created successfully.',
      data: savedTrip,
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

export const updateTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({
        status: 'error',
        message: 'Trip not found.',
      });
    }

    if (Date.now() >= new Date(trip.startDateTime)) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot update a trip that has already started.',
      });
    }

    const modifiedBy = req.user?.id || 'system';

    const updatedTrip = await Trip.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        modifiedBy,
        modifiedAt: new Date(),
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      status: 'success',
      message: 'Trip updated successfully.',
      data: updatedTrip,
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};