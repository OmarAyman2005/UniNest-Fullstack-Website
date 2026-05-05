import Joi from 'joi';
import { baseEventSchema } from './baseEventValidation.js';

export const conferenceSchema = baseEventSchema.keys({
    fullAgenda: Joi.string().required().messages({
        'string.base': 'Full agenda must be a string.',
        'string.empty': 'Full agenda is required.',
        'any.required': 'Full agenda is required.',
    }),

    conferenceWebsiteLink: Joi.string().uri().required().messages({
        'string.base': 'Conference website link must be a string.',
        'string.empty': 'Conference website link is required.',
        'string.uri': 'Conference website link must be a valid URL.',
        'any.required': 'Conference website link is required.',
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
});