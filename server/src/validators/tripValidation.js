import Joi from 'joi';
import { baseEventSchema } from './baseEventValidation.js';

export const tripSchema = baseEventSchema.keys({
    eventType: Joi.string().valid('trip').required(),
    price: Joi.number().min(0).required().messages({
        'number.base': 'Price must be a number.',
        'number.min': 'Price cannot be negative.',
        'any.required': 'Price is required.',
    }),
    capacity: Joi.number().integer().min(1).required().messages({
        'number.base': 'Capacity must be a number.',
        'number.integer': 'Capacity must be an integer.',
        'number.min': 'Capacity must be at least 1.',
        'any.required': 'Capacity is required.',
    }),
     location: Joi.string().min(2).max(100).required().messages({
    'string.base': 'Location must be a valid text.',
    'string.empty': 'Location is required.',
    'string.min': 'Location must be at least 2 characters long.',
    'string.max': 'Location cannot exceed 100 characters.',
    'any.required': 'Location is required.',
  })
});