import { Request } from 'express';
import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog.js';
import { AuditAction } from '../constants/index.js';

interface LogOptions {
  actorUserId?: mongoose.Types.ObjectId | string;
  targetUserId?: mongoose.Types.ObjectId | string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  reason?: string;
  req?: Request;
}

export const logAuditEvent = async (options: LogOptions): Promise<void> => {
  try {
    const ipAddress = options.req?.ip || options.req?.socket?.remoteAddress;
    const userAgent = options.req?.headers['user-agent'];

    await AuditLog.create({
      actorUserId: options.actorUserId,
      targetUserId: options.targetUserId,
      action: options.action,
      entityType: options.entityType,
      entityId: options.entityId,
      before: options.before,
      after: options.after,
      reason: options.reason,
      ipAddress: typeof ipAddress === 'string' ? ipAddress : undefined,
      userAgent,
      timestamp: new Date(),
    });
  } catch (error) {
    // Non-blocking: log error to console so primary transaction does not fail
    console.error('[AuditService] Failed to record audit log:', error);
  }
};
