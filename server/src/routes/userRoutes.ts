import { Router } from 'express';
import {
  listUsers,
  createUser,
  getUserById,
  updateUser,
  updateUserStatus,
  adminResetPassword,
} from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { ROLES } from '../constants/index.js';

const router = Router();

// All user management routes require ADMIN role
router.use(authenticate, requireRole(ROLES.ADMIN));

router.get('/', listUsers);
router.post('/', createUser);
router.get('/:id', getUserById);
router.patch('/:id', updateUser);
router.patch('/:id/status', updateUserStatus);
router.post('/:id/reset-password', adminResetPassword);

export default router;
