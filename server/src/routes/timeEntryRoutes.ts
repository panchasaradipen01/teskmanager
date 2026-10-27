import { Router } from 'express';
import {
  createTimeEntry,
  listTimeEntries,
  updateTimeEntry,
  deleteTimeEntry,
} from '../controllers/timeEntryController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.post('/', createTimeEntry);
router.get('/', listTimeEntries);
router.patch('/:id', updateTimeEntry);
router.delete('/:id', deleteTimeEntry);

export default router;
