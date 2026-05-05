// server/src/controllers/eventAccessController.js
import mongoose from "mongoose";
import { Event } from "../models/Event.js";
import { EventAccess } from "../models/EventAccess.js";

const isId = (v) => mongoose.Types.ObjectId.isValid(String(v));

export const getEventAccess = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ status: "error", message: "Invalid event id" });

    const event = await Event.findById(id).select("_id name eventType");
    if (!event) return res.status(404).json({ status: "error", message: "Not found" });

    const access =
      (await EventAccess.findOne({ event: id })) ||
      new EventAccess({ event: id, allowedRoles: [], externalVisitorsEnabled: false });

    return res.status(200).json({
      status: "success",
      data: {
        event: { id: event._id, name: event.name, eventType: event.eventType },
        allowedRoles: access.allowedRoles || [],
        externalVisitorsEnabled: !!access.externalVisitorsEnabled,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message || "Failed to load access" });
  }
};

export const updateEventAccess = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ status: "error", message: "Invalid event id" });

    const event = await Event.findById(id).select("_id");
    if (!event) return res.status(404).json({ status: "error", message: "Not found" });

    const allowedRoles = Array.isArray(req.body?.allowedRoles) ? req.body.allowedRoles : [];
    const externalVisitorsEnabled = !!req.body?.externalVisitorsEnabled;

    const doc = await EventAccess.findOneAndUpdate(
      { event: id },
      {
        $set: {
          allowedRoles,
          externalVisitorsEnabled,
          modifiedBy: req.user?._id || req.user?.id || undefined,
        },
      },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      status: "success",
      data: {
        allowedRoles: doc.allowedRoles || [],
        externalVisitorsEnabled: !!doc.externalVisitorsEnabled,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: "error", message: e.message || "Failed to save access" });
  }
};
