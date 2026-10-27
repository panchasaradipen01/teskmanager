import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const listAuditLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const action = req.query.action as string;
    const actorId = req.query.actorUserId as string;

    const query: Record<string, any> = {};

    if (action) {
      query.action = action;
    }

    if (actorId && mongoose.Types.ObjectId.isValid(actorId)) {
      query.actorUserId = actorId;
    }

    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .populate('actorUserId', 'name email employeeId')
      .populate('targetUserId', 'name email employeeId')
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    sendSuccess(res, logs, 'Audit logs retrieved', 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};
