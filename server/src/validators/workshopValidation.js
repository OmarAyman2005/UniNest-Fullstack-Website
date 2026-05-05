import Joi from 'joi';
import { baseEventSchema } from './baseEventValidation.js';

export const workshopSchema = baseEventSchema.keys({
    fullAgenda: Joi.string().required().messages({
        'string.base': 'Full agenda must be a string.',
        'string.empty': 'Full agenda is required.',
        'any.required': 'Full agenda is required.',
    }),

    faculty: Joi.string().valid('MET', 'IET', 'EMS', 'MBA', 'MGT', 'LAW').required().messages({
        'string.base': 'Faculty must be a string.',
        'any.only': 'Faculty must be one of: MET, IET, EMS, MBA, MGT, LAW.',
        'any.required': 'Faculty is required.',
    }),

    professors: Joi.array()
        .items(
            Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
                'string.base': 'Professor id must be a string.',
                'string.empty': 'Professor id cannot be empty.',
                'string.pattern.base': 'Professor id must be a valid MongoDB ObjectId.',
                'any.required': 'Professor id is required.',
            })
        )
        .optional()
        .messages({
            'array.base': 'Professors must be an array of user ids.',
        }),

    budget: Joi.number().positive().required().messages({
        'number.base': 'Budget must be a number.',
        'number.positive': 'Budget must be a positive number.',
        'any.required': 'Budget is required.',
    }),

    fundingSource: Joi.string().valid('External', 'GUC').required().messages({
        'string.base': 'Funding source must be a string.',
        'any.only': 'Funding source must be either "External" or "GUC".',
        'any.required': 'Funding source is required.',
    }),

    extraRequiredResources: Joi.array()
        .items(
            Joi.object({
                resourceName: Joi.string().required().messages({
                    'string.base': 'Resource name must be a string.',
                    'string.empty': 'Resource name is required.',
                    'any.required': 'Resource name is required.',
                }),
                quantity: Joi.number().integer().min(1).default(1).messages({
                    'number.base': 'Quantity must be a number.',
                    'number.integer': 'Quantity must be an integer.',
                    'number.min': 'Quantity must be at least 1.',
                }),
            })
        )
        .optional()
        .messages({
            'array.base': 'Extra required resources must be an array.',
        }),

    capacity: Joi.number().integer().min(1).required().messages({
        'number.base': 'Capacity must be a number.',
        'number.integer': 'Capacity must be an integer.',
        'number.min': 'Capacity must be at least 1.',
        'any.required': 'Capacity is required.',
    }),

    location: Joi.string().valid('GUC Cairo', 'GUC Berlin').required().messages({
        'string.base': 'Location must be a string.',
        'any.only': 'Location must be either "GUC Cairo" or "GUC Berlin".',
        'any.required': 'Location is required.',
    }),

    price: Joi.number().min(0).required().messages({
        'number.base': 'Price must be a number.',
        'number.min': 'Price cannot be negative.',
        'any.required': 'Price is required.',
    }),
});