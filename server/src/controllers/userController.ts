import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User.js';
import { ROLES, USER_STATUS, AUDIT_ACTIONS } from '../constants/index.js';
import { logAuditEvent } from '../services/auditService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  employeeId: z.string().min(2, 'Employee ID is required'),
  role: z.enum([ROLES.ADMIN, ROLES.USER]).default(ROLES.USER),
  department: z.string().optional().default('General'),
  temporaryPassword: z.string().min(8, 'Temporary password must be at least 8 characters').optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  department: z.string().optional(),
  role: z.enum([ROLES.ADMIN, ROLES.USER]).optional(),
});

export const listUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const search = (req.query.search as string || '').trim();
    const role = req.query.role as string;
    const status = req.query.status as string;

    const query: Record<string, any> = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
      ];
    }

    if (role && Object.values(ROLES).includes(role as any)) {
      query.role = role;
    }

    if (status && Object.values(USER_STATUS).includes(status as any)) {
      query.status = status;
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    sendSuccess(res, users, 'Users retrieved successfully', 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = createUserSchema.parse(req.body);

    const existingEmail = await User.findOne({ email: parsed.email.toLowerCase() });
    if (existingEmail) {
      sendError(res, 'A user with this email address already exists.', 409, 'DUPLICATE_EMAIL');
      return;
    }

    const existingEmpId = await User.findOne({ employeeId: parsed.employeeId.toUpperCase() });
    if (existingEmpId) {
      sendError(res, 'A user with this Employee ID already exists.', 409, 'DUPLICATE_EMPLOYEE_ID');
      return;
    }

    // Generate or use temporary password
    const tempPassword = parsed.temporaryPassword || `Temp@${Math.floor(100000 + Math.random() * 900000)}`;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    const newUser = await User.create({
      name: parsed.name,
      email: parsed.email.toLowerCase(),
      employeeId: parsed.employeeId.toUpperCase(),
      role: parsed.role,
      department: parsed.department,
      passwordHash,
      mustChangePassword: true,
      status: USER_STATUS.ACTIVE,
      createdBy: req.user?._id,
    });

    await logAuditEvent({
      actorUserId: req.user?._id as any,
      targetUserId: newUser._id as any,
      action: AUDIT_ACTIONS.USER_CREATED,
      entityType: 'USER',
      entityId: newUser._id.toString(),
      after: { email: newUser.email, role: newUser.role, employeeId: newUser.employeeId },
      req,
    });

    sendSuccess(
      res,
      {
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          employeeId: newUser.employeeId,
          role: newUser.role,
          department: newUser.department,
          status: newUser.status,
          mustChangePassword: newUser.mustChangePassword,
          createdAt: newUser.createdAt,
        },
        temporaryPassword: tempPassword,
      },
      'User created successfully. Provide the temporary credentials to the employee.',
      201
    );
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) {
      sendError(res, 'User not found', 404, 'USER_NOT_FOUND');
      return;
    }

    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = updateUserSchema.parse(req.body);
    const user = await User.findById(req.params.id);
    if (!user) {
      sendError(res, 'User not found', 404, 'USER_NOT_FOUND');
      return;
    }

    const before = { name: user.name, department: user.department, role: user.role };

    if (parsed.name) user.name = parsed.name;
    if (parsed.department) user.department = parsed.department;
    if (parsed.role) user.role = parsed.role;

    await user.save();

    await logAuditEvent({
      actorUserId: req.user?._id as any,
      targetUserId: user._id as any,
      action: AUDIT_ACTIONS.USER_UPDATED,
      entityType: 'USER',
      entityId: user._id.toString(),
      before,
      after: { name: user.name, department: user.department, role: user.role },
      req,
    });

    sendSuccess(res, user, 'User updated successfully');
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status } = req.body;
    if (!Object.values(USER_STATUS).includes(status)) {
      sendError(res, 'Invalid user status', 400, 'INVALID_STATUS');
      return;
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      sendError(res, 'User not found', 404, 'USER_NOT_FOUND');
      return;
    }

    // Prevent deactivating own account
    if (req.user && req.user._id.toString() === user._id.toString()) {
      sendError(res, 'You cannot deactivate your own account.', 400, 'CANNOT_DEACTIVATE_SELF');
      return;
    }

    const previousStatus = user.status;
    user.status = status;
    await user.save();

    await logAuditEvent({
      actorUserId: req.user?._id as any,
      targetUserId: user._id as any,
      action: AUDIT_ACTIONS.USER_STATUS_CHANGED,
      entityType: 'USER',
      entityId: user._id.toString(),
      before: { status: previousStatus },
      after: { status: user.status },
      req,
    });

    sendSuccess(res, user, `User status updated to ${status}`);
  } catch (error) {
    next(error);
  }
};

const adminResetPasswordSchema = z.object({
  temporaryPassword: z.string().min(8, 'Temporary password must be at least 8 characters long').optional(),
});

export const adminResetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = adminResetPasswordSchema.parse(req.body);

    const user = await User.findById(req.params.id);
    if (!user) {
      sendError(res, 'User not found', 404, 'USER_NOT_FOUND');
      return;
    }

    const newTempPassword = parsed.temporaryPassword || `Reset@${Math.floor(100000 + Math.random() * 900000)}`;
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newTempPassword, salt);
    user.mustChangePassword = true;
    await user.save();

    await logAuditEvent({
      actorUserId: req.user?._id as any,
      targetUserId: user._id as any,
      action: AUDIT_ACTIONS.PASSWORD_RESET,
      entityType: 'USER',
      entityId: user._id.toString(),
      req,
    });

    sendSuccess(
      res,
      { temporaryPassword: newTempPassword },
      'Password reset successfully. The user will be required to change it upon next login.'
    );
  } catch (error) {
    next(error);
  }
};
