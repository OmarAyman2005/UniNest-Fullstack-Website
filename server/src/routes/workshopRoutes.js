import { Router } from 'express';
import { getAllWorkshops, getWorkshopById, createWorkshop, updateWorkshop, getWorkshopsByProfessor, changeWorkshopStatus, getWorkshopParticipants } from '../controllers/workshopController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { workshopSchema } from '../validators/workshopValidation.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.get('/', getAllWorkshops);
router.get('/:id', getWorkshopById);
router.get('/:id/participants', authRequired, getWorkshopParticipants);
router.get('/professor/:professorId', getWorkshopsByProfessor);
router.post('/', validateRequest(workshopSchema), authRequired, createWorkshop);
router.patch('/:id', validateRequest(workshopSchema), authRequired, updateWorkshop);
router.patch('/:id/status', authRequired, changeWorkshopStatus);

export default router;
