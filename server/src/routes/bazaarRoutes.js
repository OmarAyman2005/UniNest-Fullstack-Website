import express from 'express';
import { getAllBazaars, getBazaarById, createBazaar, updateBazaar, getUpcomingBazaars } from '../controllers/bazaarController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { bazaarSchema } from '../validators/bazaarValidation.js';
import { authRequired } from '../middleware/auth.js';
const router = express.Router();

router.get('/upcoming', getUpcomingBazaars);
router.get('/', getAllBazaars);
router.get('/:id', getBazaarById);
router.post('/', validateRequest(bazaarSchema), authRequired ,createBazaar);
router.put('/:id', validateRequest(bazaarSchema), authRequired ,updateBazaar);

export default router;
