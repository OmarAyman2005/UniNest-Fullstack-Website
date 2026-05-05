import express from 'express';
import { getAllConferences, getConferenceById, createConference, updateConference } from '../controllers/conferenceController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { conferenceSchema } from '../validators/conferenceValidation.js';
import { authRequired } from '../middleware/auth.js';
const router = express.Router();

router.get('/', getAllConferences);
router.get('/:id', getConferenceById);
router.post('/', validateRequest(conferenceSchema), authRequired ,createConference);
router.put('/:id', validateRequest(conferenceSchema), authRequired ,updateConference);

export default router;
