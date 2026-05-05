import Joi from 'joi';

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

export const createWorkshopRequestSchema = Joi.object({
  workshop: Joi.string().pattern(objectIdPattern).required().messages({
    'string.base': 'Workshop id must be a string.',
    'string.empty': 'Workshop id is required.',
    'string.pattern.base': 'Workshop id must be a valid MongoDB ObjectId.',
    'any.required': 'Workshop id is required.',
  }),
  status: Joi.string().valid('accepted', 'rejected', 'pending', 'edit_required').default('pending').messages({
    'string.base': 'Status must be a string.',
    'any.only': 'Status must be one of: accepted, rejected, pending, edit_required.',
  }),
  comment: Joi.string().max(1000).allow('').optional().messages({
    'string.base': 'Comment must be a string.',
    'string.max': 'Comment cannot exceed 1000 characters.',
  }),
  createdBy: Joi.string().pattern(objectIdPattern).required().messages({
    'string.base': 'createdBy must be a string.',
    'string.pattern.base': 'createdBy must be a valid MongoDB ObjectId.',
    'any.required': 'createdBy is required.',
  }),
});

export const updateWorkshopRequestSchema = Joi.object({
  status: Joi.string().valid('accepted', 'rejected', 'pending', 'edit_required').required().messages({
    'string.base': 'Status must be a string.',
    'any.only': 'Status must be one of: accepted, rejected, pending, edit_required.',
    'any.required': 'Status is required.',
  }),
  comment: Joi.string().max(1000).allow('').optional().messages({
    'string.base': 'Comment must be a string.',
    'string.max': 'Comment cannot exceed 1000 characters.',
  }),
  modifiedBy: Joi.string().pattern(objectIdPattern).required().messages({
    'string.base': 'modifiedBy must be a string.',
    'string.pattern.base': 'modifiedBy must be a valid MongoDB ObjectId.',
    'any.required': 'modifiedBy is required.',
  }),
});