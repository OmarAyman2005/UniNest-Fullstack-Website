import SupportThread from '../models/SupportThread.js';
import User from '../models/User.js';
import { pushNotification, pushManyNotifications } from './notifications.controller.js';

/** Create a new support thread (end user -> admin/event_office) */
export async function createThread(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    const { subject, message, to = 'admin' } = req.body;
    if (!subject || !message) return res.status(400).json({ status: 'error', message: 'Missing subject or message' });

    const thread = await SupportThread.create({
      subject,
      user: userId,
      participants: [userId],
      messages: [{ sender: userId, senderRole: req.user?.role, body: message }],
      lastMessageAt: new Date(),
    });

    // Notify admins/event_office depending on 'to' param
    const targetRoles = to === 'event_office' ? ['event_office'] : ['admin', 'event_office'];
    const targets = await User.find({ role: { $in: targetRoles } }).select('_id').lean();
    const userIds = (targets || []).map((t) => t._id).filter(Boolean);
    if (userIds.length) {
      await pushManyNotifications(userIds, {
        title: 'New support request',
        body: `${req.user?.fullName || 'A user'} opened: ${subject}`,
        meta: { kind: 'support', threadId: thread._id.toString() },
      });
    }

    return res.json({ status: 'success', data: thread });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message });
  }
}

/** List threads for current user; admins/event_office can view all (with optional filters) */
export async function listThreads(req, res) {
  try {
    const role = req.user?.role;
    const userId = req.user?.id;
    const { status, q } = req.query;

    const qobj = {};
    if (status) qobj.status = status;
    if (q) qobj.subject = { $regex: q, $options: 'i' };

    let items;
    if (role === 'admin' || role === 'event_office') {
      items = await SupportThread.find(qobj).sort({ lastMessageAt: -1 }).limit(200).lean();
    } else {
      items = await SupportThread.find({ user: userId, ...qobj }).sort({ lastMessageAt: -1 }).limit(200).lean();
    }

    return res.json({ status: 'success', data: items });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message });
  }
}

/** Get thread details (only owner or admin/event_office) */
export async function getThread(req, res) {
  try {
    const { id } = req.params;
    const thread = await SupportThread.findById(id).lean();
    if (!thread) return res.status(404).json({ status: 'error', message: 'Not found' });

    const role = req.user?.role;
    const userId = req.user?.id;
    if (String(thread.user) !== String(userId) && role !== 'admin' && role !== 'event_office') {
      return res.status(403).json({ status: 'error', message: 'Forbidden' });
    }

    return res.json({ status: 'success', data: thread });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message });
  }
}

/** Post a message to an existing thread */
export async function postMessage(req, res) {
  try {
    const { id } = req.params;
    const { body } = req.body;
    if (!body) return res.status(400).json({ status: 'error', message: 'Missing message body' });

    const thread = await SupportThread.findById(id);
    if (!thread) return res.status(404).json({ status: 'error', message: 'Not found' });

    const role = req.user?.role;
    const userId = req.user?.id;
    if (String(thread.user) !== String(userId) && role !== 'admin' && role !== 'event_office') {
      return res.status(403).json({ status: 'error', message: 'Forbidden' });
    }

    const msg = { sender: userId, senderRole: role, body };
    thread.messages.push(msg);
    thread.lastMessageAt = new Date();
    // ensure requester is participant
    if (!thread.participants.find((p) => String(p) === String(userId))) thread.participants.push(userId);

    await thread.save();

    // Send notifications: if admin replied -> notify thread owner; else notify admins/event_office
    if (role === 'admin' || role === 'event_office') {
      await pushNotification({
        user: thread.user,
        title: 'Support reply',
        body: `${req.user?.fullName || 'Admin'} replied to: ${thread.subject}`,
        meta: { kind: 'support', threadId: thread._id.toString() },
      });
    } else {
      const targets = await User.find({ role: { $in: ['admin', 'event_office'] } }).select('_id').lean();
      const userIds = (targets || []).map((t) => t._id).filter(Boolean);
      if (userIds.length) {
        await pushManyNotifications(userIds, {
          title: 'New message on support thread',
          body: `${req.user?.fullName || 'A user'}: ${thread.subject}`,
          meta: { kind: 'support', threadId: thread._id.toString() },
        });
      }
    }

    return res.json({ status: 'success', data: thread });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message });
  }
}

/** Update thread status (admin/event_office only) */
export async function updateStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Invalid status' });
    }
    const thread = await SupportThread.findById(id);
    if (!thread) return res.status(404).json({ status: 'error', message: 'Not found' });

    const role = req.user?.role;
    if (role !== 'admin' && role !== 'event_office') return res.status(403).json({ status: 'error', message: 'Forbidden' });

    thread.status = status;
    await thread.save();

    // Notify owner about status change
    await pushNotification({
      user: thread.user,
      title: 'Support status updated',
      body: `${req.user?.fullName || 'Staff'} set status to ${status} for: ${thread.subject}`,
      meta: { kind: 'support', threadId: thread._id.toString(), status },
    });

    return res.json({ status: 'success', data: thread });
  } catch (e) {
    return res.status(500).json({ status: 'error', message: e.message });
  }
}
