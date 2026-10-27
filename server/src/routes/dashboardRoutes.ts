import { Router } from 'express';
import {
  getAdminDashboard,
  getUserDashboard,
  getCalendarData,
} from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { ROLES } from '../constants/index.js';

const router = Router();

router.use(authenticate);

router.get('/admin', requireRole(ROLES.ADMIN), getAdminDashboard);
router.get('/user', getUserDashboard);
router.get('/calendar', getCalendarData);

export default router;
