import { Workshop } from '../models/Workshop.js';
import { buildEventQueryOptions } from '../utils/eventFilters.js';
import mongoose from 'mongoose';
import WorkshopRequest from '../models/WorkshopRequests.js';
import { EventRegister } from '../models/EventRegister.js';
import { EventApplication } from '../models/EventApplication.js';

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v));

export const getAllWorkshops = async (req, res) => {
  try {
    const { filter, pagination, sort } = buildEventQueryOptions(req.query);
    filter.eventType = 'workshop';
    
    const workshops = await Workshop.find(filter)
    .sort(sort)
    .skip(pagination.skip)
    .limit(pagination.limit);
    
    const total = await Workshop.countDocuments(filter);
    
    res.status(200).json({
      status: 'success',
      page: pagination.page,
      totalPages: Math.ceil(total / pagination.limit),
      totalWorkshops: total,
      count: workshops.length,
      data: workshops,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

export const getWorkshopById = async (req, res) => {
  try {
    const workshop = await Workshop.findById(req.params.id);
    
    if (!workshop) {
      return res.status(404).json({
        status: 'error',
        message: 'Workshop not found.',
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: workshop,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
};

export const getWorkshopsByProfessor = async (req, res) => {
  try {
    const { professorId } = req.params;
    if (!isObjectId(professorId)) {
      return res.status(400).json({ status: 'error', message: 'Invalid professor id.' });
    }

    const { filter, pagination, sort } = buildEventQueryOptions(req.query);
    filter.eventType = 'workshop';

    filter.$or = [{ professors: professorId }, { createdBy: professorId }];

    const workshops = await Workshop.find(filter)
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit);

    const total = await Workshop.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      page: pagination.page,
      totalPages: Math.ceil(total / pagination.limit),
      totalWorkshops: total,
      count: workshops.length,
      data: workshops,
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const createWorkshop = async (req, res) => {
  try {
    if (!req.user?.id || !isObjectId(req.user.id)) {
      return res.status(401).json({ status: 'error', message: 'Authentication required to create a workshop.' });
    }
    const createdBy = req.user?.id;

    req.body.eventType = 'workshop';
    req.body.status = 'Pending';

    const workshop = new Workshop({
      ...req.body,
      createdBy,
      modifiedBy: createdBy,
    });

    const savedWorkshop = await workshop.save();

    try {
      const wr = new WorkshopRequest({
        workshop: savedWorkshop._id,
        createdBy,
      });
      await wr.save();
    } catch (reqErr) {
      await Workshop.findByIdAndDelete(savedWorkshop._id).catch(() => {});
      throw new Error('Failed to create workshop request: ' + (reqErr.message || reqErr));
    }

    res.status(201).json({
      status: 'success',
      message: 'Workshop created successfully.',
      data: savedWorkshop,
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

export const updateWorkshop = async (req, res) => {
  try {
    const workshop = await Workshop.findById(req.params.id);

    if (!workshop) {
      return res.status(404).json({
        status: 'error',
        message: 'Workshop not found.',
      });
    }

    if (Date.now() >= new Date(workshop.startDateTime)) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot update a workshop that has already started.',
      });
    }

    const updatePayload = { ...req.body, modifiedAt: new Date() };
    if (req.user?.id && isObjectId(req.user.id)) {
      updatePayload.modifiedBy = req.user.id;
    }

    const updatedWorkshop = await Workshop.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      status: 'success',
      message: 'Workshop updated successfully.',
      data: updatedWorkshop,
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
};

// ADDED: change status API for a workshop
export const changeWorkshopStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id || !isObjectId(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid workshop id.' });
    }

    const allowed = ['Accepted', 'Pending'];
    if (!status || !allowed.includes(String(status))) {
      return res.status(400).json({ status: 'error', message: `Invalid status. Allowed: ${allowed.join(', ')}` });
    }

    // authorization: require admin or event office (adjust roles per your app)
    const role = req.user?.role;
    if (!req.user || !role || !['admin', 'event_office'].includes(String(role))) {
      return res.status(403).json({ status: 'error', message: 'Forbidden: insufficient permissions' });
    }

    const workshop = await Workshop.findById(id);
    if (!workshop) {
      return res.status(404).json({ status: 'error', message: 'Workshop not found.' });
    }

    // optional: do not allow changing status after start (adjust as needed)
    if (Date.now() >= new Date(workshop.startDateTime)) {
      return res.status(400).json({ status: 'error', message: 'Cannot change status of a workshop that has already started.' });
    }

    if (String(workshop.status) === String(status)) {
      return res.status(200).json({ status: 'success', message: `Workshop already ${status}`, data: workshop });
    }

    workshop.status = status;
    workshop.modifiedAt = new Date();
    if (req.user?.id && isObjectId(req.user.id)) workshop.modifiedBy = req.user.id;

    const saved = await workshop.save();

    res.status(200).json({ status: 'success', message: `Workshop status updated to ${status}`, data: saved });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message || 'Failed to change workshop status' });
  }
};

// NEW: Get workshop participants and remaining spots
export const getWorkshopParticipants = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !isObjectId(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid workshop id.' });
    }

    // Workshop is a discriminator of Event, so we can query it as an Event
    const workshop = await Workshop.findById(id);
    if (!workshop) {
      return res.status(404).json({ status: 'error', message: 'Workshop not found.' });
    }

    // Check if user is a professor of this workshop or created it
    const userId = req.user?.id || req.user?._id;
    const isProfessor = workshop.professors?.some(profId => String(profId) === String(userId));
    const isCreator = String(workshop.createdBy) === String(userId);
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'event_office';

    if (!isProfessor && !isCreator && !isAdmin) {
      return res.status(403).json({ 
        status: 'error', 
        message: 'You do not have permission to view participants for this workshop.' 
      });
    }

    // Get all registrations for this event/workshop - using the same pattern as getRegistrationsByEvent
    const registrations = await EventRegister.find({ event: id })
      .populate('user')
      .sort({ createdAt: -1 });

    console.log(`Found ${registrations.length} total registrations (EventRegister) for workshop ${id}`);

    // Also check EventApplication model as some participants may be stored there
    // populate user info so we can resolve email / fullName for fallbacks
    const applications = await EventApplication.find({ 
      eventId: id, 
      status: { $in: ['accepted', 'pending'] } 
    }).sort({ createdAt: -1 }).populate('userId', 'email fullName').lean();

    console.log(`Found ${applications.length} applications (EventApplication) for workshop ${id}`);

    // Combine participants from both sources
    const participantsFromRegistrations = registrations
      .filter(reg => {
        // Only include registered status
        const isRegistered = reg.status === 'registered';
        if (!isRegistered) {
          console.log(`Skipping registration ${reg._id} - status: ${reg.status}`);
        }
        return isRegistered;
      })
      .map(reg => {
        const user = reg.user;
        return {
          _id: reg._id,
          userId: user?._id,
          name: reg.name || user?.fullName || user?.name,
          email: reg.email || user?.email,
          studentId: reg.studentId || user?.studentId,
          role: user?.role,
          registeredAt: reg.createdAt,
          checkedIn: reg.checkedIn || false,
          checkInAt: reg.checkInAt,
          amountPaid: reg.amountPaid || 0,
          source: 'EventRegister',
        };
      });

    // Map participants from EventApplication
    const participantsFromApplications = applications.flatMap((app) => {
      // If the application carries explicit participants, map them
      if (Array.isArray(app.participants) && app.participants.length > 0) {
        return app.participants.map((participant, idx) => ({
          _id: `${app._id}_${idx}`,
          userId: null,
          name: participant.name || (app.userId && app.userId.fullName) || app.applicantName || null,
          email: participant.email || (app.userId && app.userId.email) || null,
          role: participant.role || 'student',
          registeredAt: app.createdAt,
          checkedIn: false,
          checkInAt: null,
          amountPaid: 0,
          source: 'EventApplication',
        }));
      }

      // Fallback: some applications store a single applicant at the application level
      // (app.applicantName / app.gucID). Treat that as one participant so it isn't lost.
      const applicantName = app.applicantName || (app.userId && app.userId.fullName) || app.applicant || null;
      if (applicantName) {
        return [
          {
            _id: `${app._id}_applicant`,
            userId: app.userId || null,
            name: String(applicantName),
            email: app.email || (app.userId && app.userId.email) || null,
            role: 'applicant',
            registeredAt: app.createdAt,
            checkedIn: false,
            checkInAt: null,
            amountPaid: (app.payment && app.payment.amount) || 0,
            source: 'EventApplication',
          },
        ];
      }

      return [];
    });

    // Combine both participant lists
    const participants = [...participantsFromRegistrations, ...participantsFromApplications];

    console.log(`Returning ${participants.length} total participants (${participantsFromRegistrations.length} from EventRegister, ${participantsFromApplications.length} from EventApplication)`);

    const capacity = workshop.capacity || 0;
    const registered = participants.length;
    const remainingSpots = Math.max(0, capacity - registered);

    res.status(200).json({
      status: 'success',
      data: {
        workshop: {
          _id: workshop._id,
          name: workshop.name,
          capacity: capacity,
          startDateTime: workshop.startDateTime,
          endDateTime: workshop.endDateTime,
          location: workshop.location,
          status: workshop.status,
        },
        participants,
        stats: {
          totalCapacity: capacity,
          registered,
          remainingSpots,
          percentFull: capacity > 0 ? Math.round((registered / capacity) * 100) : 0,
        },
      },
    });
  } catch (err) {
    console.error('getWorkshopParticipants error:', err);
    res.status(500).json({ status: 'error', message: err.message || 'Failed to get workshop participants' });
  }
};