import { Router } from 'express';
import { listWorkshopRequests, getWorkshopRequestById, createWorkshopRequest, changeWorkshopRequestStatus, editWorkshopRequestComment, deleteWorkshopRequest } from '../controllers/workshopRequestsController.js';

const router = Router();

router.get('/', listWorkshopRequests);
router.get('/:id', getWorkshopRequestById);
router.post('/', createWorkshopRequest);
router.patch('/:id/status', changeWorkshopRequestStatus);
router.patch('/:id/comment', editWorkshopRequestComment);
router.delete('/:id', deleteWorkshopRequest);

export default router;