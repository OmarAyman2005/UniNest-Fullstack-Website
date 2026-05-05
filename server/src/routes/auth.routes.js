// server/src/routes/auth.routes.js
import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, logout, verifyEmail, me } from '../controllers/auth.controller.js';
import { ROLES } from '../models/User.js';
import { authRequired } from '../middleware/auth.js';  // <-- cookie-based

const r = Router();

r.post('/register', [
  body('fullName').trim().isLength({ min: 2 }),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(ROLES),
  body().custom((all) => {
    const role = all.role;
    if (role === 'student') {
      const v = all.studentId ?? all.studentID ?? all.student_id;
      if (!/^\d{2}-\d{4}$/.test(String(v || ''))) throw new Error('Student ID must match xx-xxxx');
    }
    if (['staff', 'ta', 'professor'].includes(role)) {
      const v = all.staffId ?? all.staffID ?? all.staff_id;
      if (!/^\d{2}-\d{4}$/.test(String(v || ''))) throw new Error('Staff ID must match xx-xxxx');
    }
    return true;
  }),
], register);

r.post('/login', login);
r.post('/logout', logout);
r.get('/verify', verifyEmail);

// NEW: who-am-I (requires the cookie)
r.get('/me', authRequired, me);

export default r;
