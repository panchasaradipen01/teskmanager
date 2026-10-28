import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { TimeEntry } from '../models/TimeEntry.js';
import { Task } from '../models/Task.js';
import { AUDIT_ACTIONS, ROLES } from '../constants/index.js';
import {
  getTodayDateString,
  getYesterdayDateString,
  isFutureDateString,
} from '../utils/dateUtils.js';
import { logAuditEvent } from '../services/auditService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

const createTimeEntrySchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Work date must be in YYYY-MM-DD format'),
  description: z.string().min(1, 'Description of work performed is required'),
  durationMinutes: z.number().int().min(1, 'Duration must be at least 1 minute').max(10080, 'Duration cannot exceed 168 hours'),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  backdateReason: z.string().optional(),
});

const updateTimeEntrySchema = z.object({
  description: z.string().min(1).optional(),
  durationMinutes: z.number().int().min(1).max(10080).optional(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  backdateReason: z.string().optional(),
});

export const createTimeEntry = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!._id;
    const parsed = createTimeEntrySchema.parse(req.body);

    if (!mongoose.Types.ObjectId.isValid(parsed.taskId)) {
      sendError(res, 'Invalid Task ID format', 400, 'INVALID_TASK_ID');
      return;
    }

    // Verify task exists
    const task = await Task.findById(parsed.taskId);
    if (!task) {
      sendError(res, 'The specified task does not exist.', 404, 'TASK_NOT_FOUND');
      return;
    }

    // Regular users can only log time against their own tasks
    if (req.user?.role !== ROLES.ADMIN && task.userId.toString() !== userId.toString()) {
      sendError(res, 'You can only log time against your own tasks.', 403, 'FORBIDDEN');
      return;
    }

    // 1. Future date check
    if (isFutureDateString(parsed.workDate)) {
      sendError(res, 'Cannot record time entries for future dates.', 400, 'FUTURE_DATE_NOT_ALLOWED');
      return;
    }

    const today = getTodayDateString();
    const yesterday = getYesterdayDateString();

    // 2. Previous day check: requires backdate reason
    if (parsed.workDate === yesterday) {
      if (!parsed.backdateReason || parsed.backdateReason.trim().length < 5) {
        sendError(
          res,
          'A mandatory explanation note (at least 5 characters) is required when recording time for yesterday.',
          400,
          'BACKDATE_REASON_REQUIRED'
        );
        return;
      }
    } else if (parsed.workDate < yesterday) {
      // 3. Older than yesterday check: blocked for non-admin
      if (req.user?.role !== ROLES.ADMIN) {
        sendError(
          res,
          'Direct time entry is limited to the current day and previous day. To record time for older dates, please consult your administrator.',
          400,
          'BACKDATE_LIMIT_EXCEEDED'
        );
        return;
      }
    }

    const timeEntry = await TimeEntry.create({
      userId: task.userId, // Logs against task owner
      taskId: task._id,
      workDate: parsed.workDate,
      description: parsed.description,
      durationMinutes: parsed.durationMinutes,
      startTime: parsed.startTime ? new Date(parsed.startTime) : undefined,
      endTime: parsed.endTime ? new Date(parsed.endTime) : undefined,
      backdateReason: parsed.backdateReason,
    });

    await logAuditEvent({
      actorUserId: userId as any,
      targetUserId: task.userId as any,
      action: AUDIT_ACTIONS.TIME_ENTRY_CREATED,
      entityType: 'TIME_ENTRY',
      entityId: timeEntry._id.toString(),
      after: {
        taskId: task._id,
        workDate: parsed.workDate,
        durationMinutes: parsed.durationMinutes,
      },
      req,
    });

    sendSuccess(res, timeEntry, 'Time entry logged successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const listTimeEntries = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 15));
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const taskId = req.query.taskId as string;
    const queryUserId = req.query.userId as string;

    const query: Record<string, any> = { deletedAt: null };

    // Authorization: User can only see own entries
    if (req.user?.role !== ROLES.ADMIN) {
      query.userId = req.user!._id;
    } else if (queryUserId && mongoose.Types.ObjectId.isValid(queryUserId)) {
      query.userId = queryUserId;
    }

    if (taskId && mongoose.Types.ObjectId.isValid(taskId)) {
      query.taskId = taskId;
    }

    if (startDate && endDate) {
      query.workDate = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      query.workDate = { $gte: startDate };
    } else if (endDate) {
      query.workDate = { $lte: endDate };
    }

    const total = await TimeEntry.countDocuments(query);
    const entries = await TimeEntry.find(query)
      .populate('userId', 'name email employeeId department')
      .populate('taskId', 'title status priority')
      .sort({ workDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    sendSuccess(res, entries, 'Time entries retrieved successfully', 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

export const updateTimeEntry = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = updateTimeEntrySchema.parse(req.body);
    const entry = await TimeEntry.findOne({ _id: req.params.id, deletedAt: null });
    if (!entry) {
      sendError(res, 'Time entry not found', 404, 'ENTRY_NOT_FOUND');
      return;
    }

    // Role check
    if (req.user?.role !== ROLES.ADMIN && entry.userId.toString() !== req.user!._id.toString()) {
      sendError(res, 'Access denied. You cannot edit this time entry.', 403, 'FORBIDDEN');
      return;
    }

    const before = {
      description: entry.description,
      durationMinutes: entry.durationMinutes,
      workDate: entry.workDate,
    };

    if (parsed.description) entry.description = parsed.description;
    if (parsed.durationMinutes) entry.durationMinutes = parsed.durationMinutes;
    if (parsed.backdateReason) entry.backdateReason = parsed.backdateReason;

    if (parsed.workDate && parsed.workDate !== entry.workDate) {
      if (isFutureDateString(parsed.workDate)) {
        sendError(res, 'Cannot move time entry to future date.', 400, 'FUTURE_DATE_NOT_ALLOWED');
        return;
      }
      entry.workDate = parsed.workDate;
    }

    await entry.save();

    await logAuditEvent({
      actorUserId: req.user!._id as any,
      targetUserId: entry.userId as any,
      action: AUDIT_ACTIONS.TIME_ENTRY_UPDATED,
      entityType: 'TIME_ENTRY',
      entityId: entry._id.toString(),
      before,
      after: {
        description: entry.description,
        durationMinutes: entry.durationMinutes,
        workDate: entry.workDate,
      },
      req,
    });

    sendSuccess(res, entry, 'Time entry updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteTimeEntry = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const entry = await TimeEntry.findOne({ _id: req.params.id, deletedAt: null });
    if (!entry) {
      sendError(res, 'Time entry not found', 404, 'ENTRY_NOT_FOUND');
      return;
    }

    // Role check
    if (req.user?.role !== ROLES.ADMIN && entry.userId.toString() !== req.user!._id.toString()) {
      sendError(res, 'Access denied. You cannot delete this time entry.', 403, 'FORBIDDEN');
      return;
    }

    // Soft delete to preserve audit trail
    entry.deletedAt = new Date();
    await entry.save();

    await logAuditEvent({
      actorUserId: req.user!._id as any,
      targetUserId: entry.userId as any,
      action: AUDIT_ACTIONS.TIME_ENTRY_DELETED,
      entityType: 'TIME_ENTRY',
      entityId: entry._id.toString(),
      before: { durationMinutes: entry.durationMinutes, workDate: entry.workDate },
      req,
    });

    sendSuccess(res, null, 'Time entry deleted successfully');
  } catch (error) {
    next(error);
  }
};
