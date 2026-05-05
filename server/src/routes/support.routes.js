import express from 'express';
import {
  createThread,
  listThreads,
  getThread,
  postMessage,
  updateStatus,
} from '../controllers/support.controller.js';
import { authRequired } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const router = express.Router();

// End users create thread and list own threads
router.post('/', authRequired, createThread);
router.get('/', authRequired, listThreads);
router.get('/:id', authRequired, getThread);
router.post('/:id/messages', authRequired, postMessage);

// Admin/events can update status
router.patch('/:id/status', authRequired, requireRole('admin', 'event_office'), updateStatus);

export default router;
