import { Router } from 'express';
import {
  exportAttendanceReport,
  exportTimeEntriesReport,
} from '../controllers/reportController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/attendance', exportAttendanceReport);
router.get('/time-entries', exportTimeEntriesReport);

export default router;
