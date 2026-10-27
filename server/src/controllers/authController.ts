import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User.js';
import { ENV } from '../config/env.js';
import { AUDIT_ACTIONS, USER_STATUS } from '../constants/index.js';
import { logAuditEvent } from '../services/auditService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters long')
    .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'New password must contain at least one number'),
});

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      await logAuditEvent({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        entityType: 'AUTH',
        reason: `Login attempt for non-existent email: ${email}`,
        req,
      });
      sendError(res, 'Invalid email or password.', 401, 'INVALID_CREDENTIALS');
      return;
    }

    if (user.status !== USER_STATUS.ACTIVE) {
      await logAuditEvent({
        actorUserId: user._id as any,
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        entityType: 'AUTH',
        reason: 'Attempted login to deactivated account',
        req,
      });
      sendError(res, 'Your account is currently inactive. Contact your admin.', 403, 'ACCOUNT_INACTIVE');
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await logAuditEvent({
        actorUserId: user._id as any,
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        entityType: 'AUTH',
        reason: 'Incorrect password',
        req,
      });
      sendError(res, 'Invalid email or password.', 401, 'INVALID_CREDENTIALS');
      return;
    }

    // Sign JWT
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        role: user.role,
        email: user.email,
        mustChangePassword: user.mustChangePassword,
      },
      ENV.JWT_SECRET,
      { expiresIn: ENV.JWT_EXPIRES_IN as any }
    );

    // Set secure HTTP-only cookie
    res.cookie(ENV.COOKIE_NAME, token, {
      httpOnly: true,
      secure: ENV.COOKIE_SECURE,
      sameSite: ENV.COOKIE_SAME_SITE,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    await logAuditEvent({
      actorUserId: user._id as any,
      action: AUDIT_ACTIONS.USER_LOGIN,
      entityType: 'AUTH',
      entityId: user._id.toString(),
      req,
    });

    sendSuccess(
      res,
      {
        user: {
          id: user._id,
          employeeId: user.employeeId,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          mustChangePassword: user.mustChangePassword,
        },
        token,
      },
      'Logged in successfully'
    );
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await logAuditEvent({
        actorUserId: req.user._id as any,
        action: AUDIT_ACTIONS.USER_LOGOUT,
        entityType: 'AUTH',
        entityId: req.user._id.toString(),
        req,
      });
    }

    res.clearCookie(ENV.COOKIE_NAME, {
      httpOnly: true,
      secure: ENV.COOKIE_SECURE,
      sameSite: ENV.COOKIE_SAME_SITE,
      path: '/',
    });

    sendSuccess(res, null, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
      return;
    }

    sendSuccess(res, {
      user: {
        id: req.user._id,
        employeeId: req.user.employeeId,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        department: req.user.department,
        mustChangePassword: req.user.mustChangePassword,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED');
      return;
    }

    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await User.findById(req.user._id);
    if (!user) {
      sendError(res, 'User not found', 404, 'USER_NOT_FOUND');
      return;
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      sendError(res, 'Current password is incorrect.', 400, 'INVALID_CURRENT_PASSWORD');
      return;
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    user.mustChangePassword = false;
    await user.save();

    await logAuditEvent({
      actorUserId: user._id as any,
      action: AUDIT_ACTIONS.PASSWORD_CHANGED,
      entityType: 'USER',
      entityId: user._id.toString(),
      req,
    });

    sendSuccess(res, null, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
};
