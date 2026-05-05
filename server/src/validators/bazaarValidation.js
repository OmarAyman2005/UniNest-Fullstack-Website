import Joi from 'joi';
import { baseEventSchema } from './baseEventValidation.js';

export const bazaarSchema = baseEventSchema.keys({
  eventType: Joi.string().valid('bazaar').required(),
});