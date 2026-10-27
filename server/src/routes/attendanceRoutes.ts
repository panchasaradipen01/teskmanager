import { Router } from 'express';
import {
  punchIn,
  punchOut,
  getTodayStatus,
  requestCorrection,
  listCorrections,
  reviewCorrection,
  listAttendance,
} from '../controllers/attendanceController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { ROLES } from '../constants/index.js';

const router = Router();

router.use(authenticate);

router.get('/today', getTodayStatus);
router.post('/punch-in', punchIn);
router.post('/punch-out', punchOut);
router.get('/', listAttendance);

// Corrections
router.post('/corrections', requestCorrection);
router.get('/corrections', listCorrections);
router.patch('/corrections/:id/review', requireRole(ROLES.ADMIN), reviewCorrection);

export default router;
