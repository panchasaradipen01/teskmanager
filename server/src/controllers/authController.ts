import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { User, IUser } from '../models/User.js';
import { ENV } from '../config/env.js';
import { AUDIT_ACTIONS, USER_STATUS } from '../constants/index.js';
import { logAuditEvent } from '../services/auditService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters long')
      .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'New password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'New password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'New password must contain at least one special character (!@#$%^&*...)'),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'Your new password cannot be the same as your current/temporary password.',
    path: ['newPassword'],
  });

/**
 * Helper to issue Access & Refresh tokens, hash refresh token in DB, and set secure HTTP-only cookies
 */
const issueTokens = async (
  user: IUser,
  res: Response
): Promise<{ accessToken: string; refreshToken: string }> => {
  const payload = {
    userId: user._id.toString(),
    role: user.role,
    email: user.email,
    employeeId: user.employeeId,
    mustChangePassword: user.mustChangePassword,
  };

  const accessToken = jwt.sign(payload, ENV.ACCESS_TOKEN_SECRET, {
    expiresIn: ENV.ACCESS_TOKEN_EXPIRES_IN as any,
  });

  const refreshToken = jwt.sign(
    { userId: user._id.toString(), jti: crypto.randomUUID() },
    ENV.REFRESH_TOKEN_SECRET,
    { expiresIn: ENV.REFRESH_TOKEN_EXPIRES_IN as any }
  );

  // Store hashed refresh token in DB for validation and revocation
  const refreshHash = await bcrypt.hash(refreshToken, 10);
  user.refreshTokenHash = refreshHash;
  await user.save();

  const cookieOptions = {
    httpOnly: true,
    secure: ENV.COOKIE_SECURE,
    sameSite: ENV.COOKIE_SAME_SITE,
    path: '/',
  };

  // Set Access Token cookie (15 mins default)
  res.cookie(ENV.ACCESS_COOKIE_NAME, accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000,
  });

  // Set Refresh Token cookie (7 days default)
  res.cookie(ENV.REFRESH_COOKIE_NAME, refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  // Set legacy cookie name for backward compatibility
  res.cookie(ENV.COOKIE_NAME, accessToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return { accessToken, refreshToken };
};

/**
 * Clear all authentication cookies
 */
const clearAuthCookies = (res: Response) => {
  const clearOpts = {
    httpOnly: true,
    secure: ENV.COOKIE_SECURE,
    sameSite: ENV.COOKIE_SAME_SITE,
    path: '/',
  };
  res.clearCookie(ENV.ACCESS_COOKIE_NAME, clearOpts);
  res.clearCookie(ENV.REFRESH_COOKIE_NAME, clearOpts);
  res.clearCookie(ENV.COOKIE_NAME, clearOpts);
};

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

    // Issue tokens and cookies
    const { accessToken, refreshToken } = await issueTokens(user, res);

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
        accessToken,
        refreshToken,
        token: accessToken, // backward compatibility
      },
      'Logged in successfully',
      200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * REFRESH ACCESS TOKEN
 * Validates the refresh token, verifies the DB hash, and issues a fresh pair of tokens.
 */
export const refreshAccessToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let refreshToken =
      req.cookies?.[ENV.REFRESH_COOKIE_NAME] ||
      req.body?.refreshToken ||
      (req.headers['x-refresh-token'] as string);

    if (!refreshToken) {
      sendError(res, 'No refresh token provided', 401, 'NO_REFRESH_TOKEN');
      return;
    }

    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, ENV.REFRESH_TOKEN_SECRET);
    } catch {
      clearAuthCookies(res);
      sendError(res, 'Invalid or expired refresh token. Please sign in again.', 401, 'REFRESH_TOKEN_EXPIRED');
      return;
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      clearAuthCookies(res);
      sendError(res, 'User associated with refresh token no longer exists.', 401, 'USER_NOT_FOUND');
      return;
    }

    if (user.status !== USER_STATUS.ACTIVE) {
      clearAuthCookies(res);
      sendError(res, 'Account is deactivated. Contact an administrator.', 403, 'ACCOUNT_INACTIVE');
      return;
    }

    // Verify against hashed refresh token in database (prevent token replay attacks)
    if (!user.refreshTokenHash) {
      clearAuthCookies(res);
      sendError(res, 'Session has been revoked. Please sign in again.', 401, 'SESSION_REVOKED');
      return;
    }

    const isMatch = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!isMatch) {
      clearAuthCookies(res);
      // Possible token reuse attack detected: invalidate stored token
      user.refreshTokenHash = undefined;
      await user.save();
      sendError(res, 'Invalid refresh token. Security breach detected, session terminated.', 401, 'INVALID_REFRESH_TOKEN');
      return;
    }

    // Rotate tokens (generate new access + rotated refresh token)
    const tokens = await issueTokens(user, res);

    sendSuccess(
      res,
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        token: tokens.accessToken,
      },
      'Access token refreshed successfully',
      200
    );
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (userId) {
      await User.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: 1 } });
      await logAuditEvent({
        actorUserId: userId as any,
        action: AUDIT_ACTIONS.USER_LOGOUT,
        entityType: 'AUTH',
        entityId: userId.toString(),
        req,
      });
    }

    clearAuthCookies(res);
    sendSuccess(res, null, 'Logged out successfully', 200);
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

    sendSuccess(
      res,
      {
        user: {
          id: req.user._id,
          employeeId: req.user.employeeId,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          department: req.user.department,
          mustChangePassword: req.user.mustChangePassword,
        },
      },
      undefined,
      200
    );
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

    sendSuccess(res, null, 'Password changed successfully', 200);
  } catch (error) {
    next(error);
  }
};
