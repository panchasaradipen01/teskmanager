import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { User, IUser } from '../models/User.js';
import { USER_STATUS } from '../constants/index.js';
import { sendError } from '../utils/apiResponse.js';

export interface JwtPayload {
  userId: string;
  role: string;
  email: string;
  mustChangePassword?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // 1. Check HTTP-only cookie
    if (req.cookies && req.cookies[ENV.COOKIE_NAME]) {
      token = req.cookies[ENV.COOKIE_NAME];
    }
    // 2. Fallback to Authorization: Bearer <token>
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      sendError(res, 'Authentication required. No session or token provided.', 401, 'UNAUTHORIZED');
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as JwtPayload;

    // Fetch user from DB
    const user = await User.findById(decoded.userId);
    if (!user) {
      sendError(res, 'User account not found or has been removed.', 401, 'USER_NOT_FOUND');
      return;
    }

    // Check if account is active
    if (user.status !== USER_STATUS.ACTIVE) {
      sendError(
        res,
        'Your account has been deactivated. Please contact an administrator.',
        403,
        'ACCOUNT_INACTIVE'
      );
      return;
    }

    req.user = user;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      sendError(res, 'Your session has expired. Please log in again.', 401, 'TOKEN_EXPIRED');
      return;
    }
    sendError(res, 'Invalid or corrupted authentication token.', 401, 'INVALID_TOKEN');
  }
};
