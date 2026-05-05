import Joi from 'joi';

export const validateEventDates = (value, helpers) => {
    const { registrationDeadline, startDateTime, endDateTime } = value;

    if (registrationDeadline >= startDateTime) {
        return helpers.error('any.invalid', {
            message: 'Registration deadline must be before the start date.',
        });
    }
    if (startDateTime >= endDateTime) {
        return helpers.error('any.invalid', {
            message: 'Start date must be before end date.',
        });
    }

    return value;
};

export const baseEventSchema = Joi.object({
    name: Joi.string().min(2).required().messages({
        'string.base': 'Event name must be a string.',
        'string.empty': 'Event name is required.',
        'string.min': 'Event name must be at least 2 characters long.',
        'any.required': 'Event name is required.',
    }),

    startDateTime: Joi.date().required().messages({
        'date.base': 'Start date must be a valid date.',
        'any.required': 'Start date is required.',
    }),

    endDateTime: Joi.date().required().messages({
        'date.base': 'End date must be a valid date.',
        'any.required': 'End date is required.',
    }),

    location: Joi.string().required().messages({
        'string.base': 'Location must be a string.',
        'string.empty': 'Location is required.',
        'any.required': 'Location is required.',
    }),

    description: Joi.string().required().messages({
        'string.base': 'Description must be a string.',
        'string.empty': 'Description is required.',
        'any.required': 'Description is required.',
    }),

    registrationDeadline: Joi.date().required().messages({
        'date.base': 'Registration deadline must be a valid date.',
        'any.required': 'Registration deadline is required.',
    }),

    eventType: Joi.string().valid('workshop', 'trip', 'bazaar', 'booth', 'conference').required().messages({
        'string.base': 'Event type must be a string.',
        'any.only': 'Event type must be one of: workshop, trip, bazaar, booth, or conference.',
        'any.required': 'Event type is required.',
    }),

    createdBy: Joi.string().uuid().optional().messages({
        'string.guid': 'CreatedBy must be a valid ID.',
    }),

    modifiedBy: Joi.string().uuid().optional().messages({
        'string.guid': 'ModifiedBy must be a valid ID.',
    }),
})
    .custom(validateEventDates, 'Date validation');