import express from 'express';
import { getAllTrips, getTripById, createTrip, updateTrip } from '../controllers/tripController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { tripSchema } from '../validators/tripValidation.js';
import { authRequired } from '../middleware/auth.js';
const router = express.Router();

router.get('/', getAllTrips);
router.get('/:id', getTripById);
router.post('/', validateRequest(tripSchema), authRequired ,createTrip);
router.put('/:id', validateRequest(tripSchema),  authRequired,updateTrip);

export default router;
