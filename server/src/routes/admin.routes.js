// server/src/routes/admin.routes.js
import { Router } from 'express';
import { body } from 'express-validator';
import { authRequired } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import {
  listUsers,
  setRole,
  setStatus,
  createPrivileged,
  removeUser,
  approveUser,
  rejectUser,
  resendVerification,
  getUserById,
} from '../controllers/admin.controller.js';

const r = Router();

// All admin routes require an authenticated admin
r.use(authRequired, requireRole('admin', 'event_office'));

// List users (supports ?q=&role=&approval=&status=&page=&limit=)
r.get('/users', listUsers);

// Get user by id
r.get('/users/:userId', getUserById);

// Update role
r.patch(
  '/users/:userId/role',
  [body('role').isString()],
  setRole
);

// NEW: Update account status (active | blocked)
r.patch(
  '/users/:userId/status',
  [body('status').isIn(['active', 'blocked'])],
  setStatus
);

// Create admin / event_office
r.post(
  '/users',
  [
    body('fullName').isLength({ min: 2 }),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('role').isIn(['admin', 'event_office']),
  ],
  createPrivileged
);

// Delete user
r.delete('/users/:userId', removeUser);

// Approval flow
r.patch('/users/:userId/approve', approveUser);
r.patch('/users/:userId/reject', rejectUser);

// Resend verification (approved but not yet verified)
r.post('/users/:userId/resend-verification', resendVerification);

export default r;
