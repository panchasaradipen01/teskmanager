import { Router } from 'express';
import { listAuditLogs } from '../controllers/auditController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { ROLES } from '../constants/index.js';

const router = Router();

router.use(authenticate, requireRole(ROLES.ADMIN));

router.get('/', listAuditLogs);

export default router;
