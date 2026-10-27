import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Task } from '../models/Task.js';
import { TASK_STATUS, TASK_PRIORITY, AUDIT_ACTIONS, ROLES } from '../constants/index.js';
import { logAuditEvent } from '../services/auditService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Detailed description is required'),
  priority: z.enum([
    TASK_PRIORITY.LOW,
    TASK_PRIORITY.MEDIUM,
    TASK_PRIORITY.HIGH,
    TASK_PRIORITY.URGENT,
  ]).default(TASK_PRIORITY.MEDIUM),
  status: z.enum([
    TASK_STATUS.TODO,
    TASK_STATUS.IN_PROGRESS,
    TASK_STATUS.BLOCKED,
    TASK_STATUS.COMPLETED,
  ]).default(TASK_STATUS.TODO),
  assignedUserId: z.string().optional(), // Admin can assign to a user; default to self
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  priority: z.enum([
    TASK_PRIORITY.LOW,
    TASK_PRIORITY.MEDIUM,
    TASK_PRIORITY.HIGH,
    TASK_PRIORITY.URGENT,
  ]).optional(),
  status: z.enum([
    TASK_STATUS.TODO,
    TASK_STATUS.IN_PROGRESS,
    TASK_STATUS.BLOCKED,
    TASK_STATUS.COMPLETED,
  ]).optional(),
});

export const createTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = createTaskSchema.parse(req.body);

    let targetUserId = req.user!._id;
    if (parsed.assignedUserId && req.user?.role === ROLES.ADMIN) {
      if (!mongoose.Types.ObjectId.isValid(parsed.assignedUserId)) {
        sendError(res, 'Invalid assigned user ID', 400, 'INVALID_USER_ID');
        return;
      }
      targetUserId = new mongoose.Types.ObjectId(parsed.assignedUserId);
    }

    const task = await Task.create({
      userId: targetUserId,
      title: parsed.title,
      description: parsed.description,
      priority: parsed.priority,
      status: parsed.status,
      completedAt: parsed.status === TASK_STATUS.COMPLETED ? new Date() : undefined,
    });

    await logAuditEvent({
      actorUserId: req.user!._id as any,
      targetUserId: targetUserId as any,
      action: AUDIT_ACTIONS.TASK_CREATED,
      entityType: 'TASK',
      entityId: task._id.toString(),
      after: { title: task.title, status: task.status, priority: task.priority },
      req,
    });

    sendSuccess(res, task, 'Task created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const listTasks = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 15));
    const search = (req.query.search as string || '').trim();
    const status = req.query.status as string;
    const priority = req.query.priority as string;
    const queryUserId = req.query.userId as string;

    const query: Record<string, any> = {};

    // Authorization: User can only see own tasks, Admin can see all or filter
    if (req.user?.role !== ROLES.ADMIN) {
      query.userId = req.user!._id;
    } else if (queryUserId && mongoose.Types.ObjectId.isValid(queryUserId)) {
      query.userId = queryUserId;
    }

    if (status && Object.values(TASK_STATUS).includes(status as any)) {
      query.status = status;
    }

    if (priority && Object.values(TASK_PRIORITY).includes(priority as any)) {
      query.priority = priority;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Task.countDocuments(query);
    const tasks = await Task.find(query)
      .populate('userId', 'name email employeeId department')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    sendSuccess(res, tasks, 'Tasks retrieved successfully', 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

export const getTaskById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const task = await Task.findById(req.params.id).populate('userId', 'name email employeeId department');
    if (!task) {
      sendError(res, 'Task not found', 404, 'TASK_NOT_FOUND');
      return;
    }

    // Role check
    if (req.user?.role !== ROLES.ADMIN && task.userId._id.toString() !== req.user!._id.toString()) {
      sendError(res, 'Access denied. You cannot view this task.', 403, 'FORBIDDEN');
      return;
    }

    sendSuccess(res, task);
  } catch (error) {
    next(error);
  }
};

export const updateTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = updateTaskSchema.parse(req.body);
    const task = await Task.findById(req.params.id);
    if (!task) {
      sendError(res, 'Task not found', 404, 'TASK_NOT_FOUND');
      return;
    }

    // Role check
    if (req.user?.role !== ROLES.ADMIN && task.userId.toString() !== req.user!._id.toString()) {
      sendError(res, 'Access denied. You cannot edit this task.', 403, 'FORBIDDEN');
      return;
    }

    const before = {
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
    };

    if (parsed.title) task.title = parsed.title;
    if (parsed.description) task.description = parsed.description;
    if (parsed.priority) task.priority = parsed.priority;

    if (parsed.status) {
      if (parsed.status === TASK_STATUS.COMPLETED && task.status !== TASK_STATUS.COMPLETED) {
        task.completedAt = new Date();
      } else if (parsed.status !== TASK_STATUS.COMPLETED) {
        task.completedAt = undefined;
      }
      task.status = parsed.status;
    }

    await task.save();

    await logAuditEvent({
      actorUserId: req.user!._id as any,
      targetUserId: task.userId as any,
      action: AUDIT_ACTIONS.TASK_UPDATED,
      entityType: 'TASK',
      entityId: task._id.toString(),
      before,
      after: {
        title: task.title,
        status: task.status,
        priority: task.priority,
      },
      req,
    });

    sendSuccess(res, task, 'Task updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      sendError(res, 'Task not found', 404, 'TASK_NOT_FOUND');
      return;
    }

    // Role check
    if (req.user?.role !== ROLES.ADMIN && task.userId.toString() !== req.user!._id.toString()) {
      sendError(res, 'Access denied. You cannot delete this task.', 403, 'FORBIDDEN');
      return;
    }

    await Task.findByIdAndDelete(task._id);

    await logAuditEvent({
      actorUserId: req.user!._id as any,
      targetUserId: task.userId as any,
      action: AUDIT_ACTIONS.TASK_DELETED,
      entityType: 'TASK',
      entityId: task._id.toString(),
      before: { title: task.title },
      req,
    });

    sendSuccess(res, null, 'Task deleted successfully');
  } catch (error) {
    next(error);
  }
};
