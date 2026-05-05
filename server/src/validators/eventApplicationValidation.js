// server/src/validators/eventApplicationValidation.js
import Joi from "joi";

const idFile = Joi.object({
  url: Joi.string().uri({ allowRelative: true }).required(),
  key: Joi.string().allow("", null),
  mime: Joi.string().max(100).allow("", null),
  size: Joi.number().integer().min(0).allow(null),
});

const idDoc = Joi.object({
  file: idFile.required(),
  uploadedAt: Joi.date().optional(),
  verification: Joi.object({
    status: Joi.string().valid("pending", "verified", "rejected").default("pending"),
    by: Joi.string().hex().length(24).allow(null),
    at: Joi.date().allow(null),
    notes: Joi.string().max(500).allow("", null),
  }).default({ status: "pending" }),
});

const attendee = Joi.object({
  name: Joi.string().min(2).max(80).required(),
  email: Joi.string().email().required(),
  idDocs: Joi.array().items(idDoc).max(5).default([]), // only files
});

export const createEventApplicationSchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  eventId: Joi.string().hex().length(24).required(),

  participants: Joi.array().items(attendee).max(5).default([]),

  gucID: Joi.string().max(80).allow("").optional(),

  boothSize: Joi.string().valid("2x2", "4x4").optional(),
  setupDurationWeeks: Joi.number().integer().min(1).max(4).optional(),
  setupLocation: Joi.string().max(120).optional(),
  boothNumber: Joi.string().max(20).optional(),

  status: Joi.string().valid("pending", "accepted", "rejected").optional(),
  notes: Joi.string().max(2000).allow("").optional(),
  createdBy: Joi.string().hex().length(24).optional(),
  modifiedBy: Joi.string().hex().length(24).optional(),
}).messages({
  "string.length": "{#label} must be a valid 24-char ObjectId",
});

export const updateEventApplicationSchema = Joi.object({
  participants: Joi.array().items(attendee).max(5),
  gucID: Joi.string().max(80).allow(""),
  boothSize: Joi.string().valid("2x2", "4x4"),
  setupDurationWeeks: Joi.number().integer().min(1).max(4),
  setupLocation: Joi.string().max(120),
  boothNumber: Joi.string().max(20),
  status: Joi.string().valid("pending", "accepted", "rejected", "cancelled"),
  notes: Joi.string().max(2000).allow(""),
  modifiedBy: Joi.string().hex().length(24),
}).min(1);

export const loyaltyProgramApplicationSchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  eventId: Joi.string().hex().length(24).required(),
  applicationKind: Joi.string().valid("loyaltyProgram").required(),
  loyalty: Joi.object({
    discountRate: Joi.number().min(0).max(100).required(),
    promoCode: Joi.string().max(60).required(),
    terms: Joi.string().max(4000).required(),
  }).required(),
  // applicantName is derived from user when possible
});
