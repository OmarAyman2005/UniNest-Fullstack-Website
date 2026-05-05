import Joi from "joi";

const objectId = () =>
  Joi.string().trim().regex(/^[0-9a-fA-F]{24}$/).message("must be a valid ObjectId");

const attendeeSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  email: Joi.string().trim().email().required(),
});

/**
 * Used by the Booth Platform application creation
 * (NOT the old booth “reserve” endpoints—those were removed).
 */
export const boothReserveSchema = Joi.object({
  userId: objectId().required(),
  eventId: objectId().required(),

  boothNumber: Joi.string().trim().uppercase().max(20).required(),
  boothSize: Joi.string().valid("2x2", "4x4").optional(),

  // IMPORTANT: allow startDate + durationWeeks
  startDate: Joi.alternatives()
    .try(Joi.date().iso(), Joi.string().isoDate())
    .required()
    .messages({
      "date.format": "startDate must be ISO 8601",
      "date.base": "startDate must be a date",
    }),

  durationWeeks: Joi.number().integer().min(1).max(4).required(),

  // optional/extra
  participants: Joi.array().items(attendeeSchema).min(1).max(5).required(),
  notes: Joi.string().allow("").max(2000).optional(),
}).prefs({ abortEarly: false, convert: true, stripUnknown: true });


/** If you still keep these for admin CRUD, keep them minimal (no reservation flags) */
export const boothCreateSchema = Joi.object({
  boothNumber: Joi.string().trim().uppercase().max(20).required(),
}).prefs({ abortEarly: false, stripUnknown: true });

export const boothUpdateSchema = Joi.object({
  boothNumber: Joi.string().trim().uppercase().max(20).optional(),
}).prefs({ abortEarly: false, stripUnknown: true });

export const boothBulkCreateSchema = Joi.object({
  boothNumbers: Joi.array().items(
    Joi.string().trim().uppercase().max(20).required()
  ).min(1).required(),
}).prefs({ abortEarly: false, stripUnknown: true });
