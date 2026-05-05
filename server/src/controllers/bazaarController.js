// controllers/bazaarController.js
import { Bazaar } from '../models/Bazaar.js';
import { buildEventQueryOptions } from '../utils/eventFilters.js';
import mongoose from 'mongoose';

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v));

export const getAllBazaars = async (req, res) => {
  try {
    const { filter, pagination, sort } = buildEventQueryOptions(req.query);
    filter.eventType = 'bazaar';

    const bazaars = await Bazaar.find(filter)
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit);

    const total = await Bazaar.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      page: pagination.page,
      totalPages: Math.ceil(total / pagination.limit),
      totalBazaars: total,
      count: bazaars.length,
      data: bazaars,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

export const getBazaarById = async (req, res) => {
  try {
    const bazaar = await Bazaar.findById(req.params.id);

    if (!bazaar) {
      return res.status(404).json({
        status: 'error',
        message: 'Bazaar not found.',
      });
    }

    res.status(200).json({
      status: 'success',
      data: bazaar,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

export const createBazaar = async (req, res) => {
  try {
    if (!req.user?.id || !isObjectId(req.user.id)) {
      return res.status(401).json({ status: 'error', message: 'Authentication required to create a workshop.' });
    }
    const createdBy = req.user?.id;
    
    req.body.eventType = 'bazaar';

    const bazaar = new Bazaar({
      ...req.body,
      createdBy,
      modifiedBy: createdBy,
    });

    const savedBazaar = await bazaar.save();

    res.status(201).json({
      status: 'success',
      message: 'Bazaar created successfully.',
      data: savedBazaar,
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

export const updateBazaar = async (req, res) => {
  try {
    const bazaar = await Bazaar.findById(req.params.id);

    if (!bazaar) {
      return res.status(404).json({
        status: 'error',
        message: 'Bazaar not found.',
      });
    }

    if (Date.now() >= new Date(bazaar.startDateTime)) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot update a bazaar that has already started.',
      });
    }

    const modifiedBy = req.user?.id || 'system';

    const updatedBazaar = await Bazaar.findByIdAndUpdate(
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
      message: 'Bazaar updated successfully.',
      data: updatedBazaar,
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};
export { getUpcomingBazaars } from './bazaarUpcomingController.js';

