// controllers/conferenceController.js
import { Conference } from '../models/Conference.js';
import { buildEventQueryOptions } from '../utils/eventFilters.js';
import mongoose from 'mongoose';

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v));

export const getAllConferences = async (req, res) => {
  try {
    const { filter, pagination, sort } = buildEventQueryOptions(req.query);
    filter.eventType = 'conference';
    
    const conferences = await Conference.find(filter)
    .sort(sort)
    .skip(pagination.skip)
    .limit(pagination.limit);
    
    const total = await Conference.countDocuments(filter);
    
    res.status(200).json({
      status: 'success',
      page: pagination.page,
      totalPages: Math.ceil(total / pagination.limit),
      totalConferences: total,
      count: conferences.length,
      data: conferences,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

export const getConferenceById = async (req, res) => {
  try {
    const conference = await Conference.findById(req.params.id);
    
    if (!conference) {
      return res.status(404).json({
        status: 'error',
        message: 'Conference not found.',
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: conference,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

export const createConference = async (req, res) => {
  try {
    if (!req.user?.id || !isObjectId(req.user.id)) {
      return res.status(401).json({ status: 'error', message: 'Authentication required to create a workshop.' });
    }
    const createdBy = req.user?.id;

    const conference = new Conference({
      ...req.body,
      createdBy,
      modifiedBy: createdBy,
    });

    const savedConference = await conference.save();

    res.status(201).json({
      status: 'success',
      message: 'Conference created successfully.',
      data: savedConference,
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

export const updateConference = async (req, res) => {
  try {
    const conference = await Conference.findById(req.params.id);

    if (!conference) {
      return res.status(404).json({
        status: 'error',
        message: 'Conference not found.',
      });
    }

    if (Date.now() >= new Date(conference.startDateTime)) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot update a conference that has already started.',
      });
    }

    const modifiedBy = req.user?.id || 'system';

    const updatedConference = await Conference.findByIdAndUpdate(
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
      message: 'Conference updated successfully.',
      data: updatedConference,
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};