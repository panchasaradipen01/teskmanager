import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../constants/index.js';
import { sendError } from '../utils/apiResponse.js';

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Authentication required.', 401, 'UNAUTHORIZED');
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendError(
        res,
        'Access denied. You do not have sufficient permissions to access this resource.',
        403,
        'FORBIDDEN'
      );
      return;
    }

    next();
  };
};
