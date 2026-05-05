import BoothNumber from "../models/BoothNumber.js";
import {
  boothCreateSchema,
  boothBulkCreateSchema,
  boothUpdateSchema,
} from "../validators/boothNumberValidation.js";

/** List all booths */
export async function listBooths(req, res) {
  try {
    const booths = await BoothNumber.find({}).sort({ boothNumber: 1 }).lean();
    return res.json({ status: "success", count: booths.length, data: booths });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
}

/** CRUD (admin) */
export async function createBooth(req, res) {
  const { value, error } = boothCreateSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) return res.status(400).json({ status: "error", message: error.message });

  try {
    const created = await BoothNumber.create({ boothNumber: String(value.boothNumber).trim().toUpperCase() });
    return res.status(201).json({ status: "success", data: created });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        status: "error",
        message: `Booth "${String(value.boothNumber).toUpperCase()}" already exists.`,
      });
    }
    return res.status(500).json({ status: "error", message: err.message });
  }
}

export async function bulkCreateBooths(req, res) {
  const { value, error } = boothBulkCreateSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) return res.status(400).json({ status: "error", message: error.message });

  const { boothNumbers } = value;
  const docs = boothNumbers.map((bn) => ({
    boothNumber: String(bn).trim().toUpperCase(),
  }));

  try {
    const created = await BoothNumber.insertMany(docs, { ordered: false });
    return res.status(201).json({ status: "success", count: created.length, data: created });
  } catch (err) {
    return res.status(207).json({
      status: "partial",
      message: "Some booths already existed; others were inserted.",
      error: err.message,
    });
  }
}

export async function getBoothById(req, res) {
  try {
    const booth = await BoothNumber.findById(req.params.id).lean();
    if (!booth) return res.status(404).json({ status: "error", message: "Booth not found" });
    return res.json({ status: "success", data: booth });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
}

export async function updateBooth(req, res) {
  const { value, error } = boothUpdateSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) return res.status(400).json({ status: "error", message: error.message });

  const update = {};
  if (value.boothNumber) update.boothNumber = String(value.boothNumber).trim().toUpperCase();

  try {
    const updated = await BoothNumber.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).lean();
    if (!updated) return res.status(404).json({ status: "error", message: "Booth not found" });
    return res.json({ status: "success", data: updated });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        status: "error",
        message: `Booth "${String(update.boothNumber).toUpperCase()}" already exists.`,
      });
    }
    return res.status(500).json({ status: "error", message: err.message });
  }
}

export async function deleteBooth(req, res) {
  try {
    const booth = await BoothNumber.findById(req.params.id);
    if (!booth) return res.status(404).json({ status: "error", message: "Booth not found" });
    await booth.deleteOne();
    return res.json({ status: "success", message: "Booth deleted", id: req.params.id });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
}
