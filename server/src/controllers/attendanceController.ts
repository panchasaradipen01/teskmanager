import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Attendance } from '../models/Attendance.js';
import { AttendanceCorrection } from '../models/AttendanceCorrection.js';
import { ATTENDANCE_STATUS, CORRECTION_STATUS, AUDIT_ACTIONS, ROLES } from '../constants/index.js';
import {
  getTodayDateString,
  getYesterdayDateString,
  isFutureDateString,
  calcDurationMinutes,
  nowUtc,
} from '../utils/dateUtils.js';
import { logAuditEvent } from '../services/auditService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

const correctionRequestSchema = z.object({
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  requestedPunchInAt: z.string().datetime(),
  requestedPunchOutAt: z.string().datetime(),
  reason: z.string().min(5, 'A clear reason of at least 5 characters is mandatory'),
});

const reviewCorrectionSchema = z.object({
  status: z.enum([CORRECTION_STATUS.APPROVED, CORRECTION_STATUS.REJECTED]),
  reviewComment: z.string().optional(),
});

/**
 * PUNCH IN
 * Rule: Can only punch in for today in Asia/Kolkata. Must not have an existing open or completed session.
 */
export const punchIn = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!._id;
    const today = getTodayDateString();

    // Check if attendance already exists for today
    const existing = await Attendance.findOne({ userId, attendanceDate: today });
    if (existing) {
      if (!existing.punchOutAt) {
        sendError(
          res,
          'You are already punched in for today.',
          400,
          'ALREADY_PUNCHED_IN',
          { punchInAt: existing.punchInAt }
        );
        return;
      }
      sendError(
        res,
        'You have already completed your attendance session for today.',
        400,
        'SESSION_ALREADY_COMPLETED'
      );
      return;
    }

    const punchInTime = nowUtc();
    const attendance = await Attendance.create({
      userId,
      attendanceDate: today,
      punchInAt: punchInTime,
      status: ATTENDANCE_STATUS.INCOMPLETE,
      source: 'WEB',
    });

    await logAuditEvent({
      actorUserId: userId as any,
      action: AUDIT_ACTIONS.PUNCH_IN,
      entityType: 'ATTENDANCE',
      entityId: attendance._id.toString(),
      after: { attendanceDate: today, punchInAt: punchInTime },
      req,
    });

    sendSuccess(res, attendance, 'Punched in successfully!', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * PUNCH OUT
 * Rule: Must correspond to an active, open session.
 */
export const punchOut = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!._id;
    const today = getTodayDateString();

    const attendance = await Attendance.findOne({
      userId,
      attendanceDate: today,
      punchOutAt: { $exists: false },
    });

    if (!attendance) {
      sendError(
        res,
        'No active punch-in session found for today. You must punch in first.',
        400,
        'NO_ACTIVE_SESSION'
      );
      return;
    }

    const punchOutTime = nowUtc();
    const durationMinutes = calcDurationMinutes(attendance.punchInAt, punchOutTime);

    // Standard business rule: >= 4 hours is half day, >= 8 hours is present
    let status: any = ATTENDANCE_STATUS.PRESENT;
    if (durationMinutes < 240) {
      status = ATTENDANCE_STATUS.HALF_DAY;
    }

    attendance.punchOutAt = punchOutTime;
    attendance.durationMinutes = durationMinutes;
    attendance.status = status;
    await attendance.save();

    await logAuditEvent({
      actorUserId: userId as any,
      action: AUDIT_ACTIONS.PUNCH_OUT,
      entityType: 'ATTENDANCE',
      entityId: attendance._id.toString(),
      after: { punchOutAt: punchOutTime, durationMinutes, status },
      req,
    });

    sendSuccess(
      res,
      attendance,
      `Punched out successfully! Recorded duration: ${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET CURRENT USER'S TODAY STATUS
 */
export const getTodayStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!._id;
    const today = getTodayDateString();

    const attendance = await Attendance.findOne({ userId, attendanceDate: today });
    sendSuccess(res, {
      today,
      attendance: attendance || null,
      isPunchedIn: !!attendance && !attendance.punchOutAt,
      isCompleted: !!attendance && !!attendance.punchOutAt,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * SUBMIT ATTENDANCE CORRECTION REQUEST
 * Rule: For previous calendar day (or missed punches). Mandatory reason required.
 */
export const requestCorrection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!._id;
    const parsed = correctionRequestSchema.parse(req.body);

    // Business Rule: Cannot request correction for future dates
    if (isFutureDateString(parsed.targetDate)) {
      sendError(
        res,
        'Attendance corrections cannot be submitted for future dates.',
        400,
        'FUTURE_DATE_INVALID'
      );
      return;
    }

    // Business Rule: Check if a pending correction request already exists for this date
    const pendingExisting = await AttendanceCorrection.findOne({
      userId,
      targetDate: parsed.targetDate,
      status: CORRECTION_STATUS.PENDING,
    });

    if (pendingExisting) {
      sendError(
        res,
        'A correction request is already pending review for this date.',
        409,
        'CORRECTION_ALREADY_PENDING'
      );
      return;
    }

    const inTime = new Date(parsed.requestedPunchInAt);
    const outTime = new Date(parsed.requestedPunchOutAt);

    if (outTime <= inTime) {
      sendError(
        res,
        'Punch-out time must be after punch-in time.',
        400,
        'INVALID_TIME_SEQUENCE'
      );
      return;
    }

    // Find any existing attendance record for target date
    const existingRecord = await Attendance.findOne({
      userId,
      attendanceDate: parsed.targetDate,
    });

    const correction = await AttendanceCorrection.create({
      userId,
      attendanceId: existingRecord?._id,
      targetDate: parsed.targetDate,
      requestedPunchInAt: inTime,
      requestedPunchOutAt: outTime,
      previousPunchInAt: existingRecord?.punchInAt,
      previousPunchOutAt: existingRecord?.punchOutAt,
      reason: parsed.reason,
      status: CORRECTION_STATUS.PENDING,
    });

    await logAuditEvent({
      actorUserId: userId as any,
      action: AUDIT_ACTIONS.ATTENDANCE_CORRECTION_REQUESTED,
      entityType: 'CORRECTION',
      entityId: correction._id.toString(),
      reason: parsed.reason,
      after: { targetDate: parsed.targetDate },
      req,
    });

    sendSuccess(
      res,
      correction,
      'Correction request submitted successfully. It will be reviewed by an administrator.',
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * LIST CORRECTION REQUESTS (Admin or User)
 */
export const listCorrections = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const status = req.query.status as string;
    const userId = req.query.userId as string;

    const query: Record<string, any> = {};

    // Regular users can only see their own requests
    if (req.user?.role !== ROLES.ADMIN) {
      query.userId = req.user!._id;
    } else if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      query.userId = userId;
    }

    if (status && Object.values(CORRECTION_STATUS).includes(status as any)) {
      query.status = status;
    }

    const total = await AttendanceCorrection.countDocuments(query);
    const corrections = await AttendanceCorrection.find(query)
      .populate('userId', 'name email employeeId department')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    sendSuccess(res, corrections, 'Corrections retrieved', 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * REVIEW CORRECTION REQUEST (Admin Only)
 */
export const reviewCorrection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, reviewComment } = reviewCorrectionSchema.parse(req.body);

    const correction = await AttendanceCorrection.findById(id);
    if (!correction) {
      sendError(res, 'Correction request not found', 404, 'CORRECTION_NOT_FOUND');
      return;
    }

    if (correction.status !== CORRECTION_STATUS.PENDING) {
      sendError(
        res,
        `This request has already been reviewed (${correction.status}).`,
        400,
        'ALREADY_REVIEWED'
      );
      return;
    }

    correction.status = status;
    correction.reviewedBy = req.user!._id as any;
    correction.reviewComment = reviewComment;
    correction.reviewedAt = nowUtc();
    await correction.save();

    // If APPROVED, update or upsert the actual Attendance document
    if (status === CORRECTION_STATUS.APPROVED) {
      const durationMinutes = calcDurationMinutes(
        correction.requestedPunchInAt,
        correction.requestedPunchOutAt
      );

      let attStatus: any = ATTENDANCE_STATUS.PRESENT;
      if (durationMinutes < 240) attStatus = ATTENDANCE_STATUS.HALF_DAY;

      await Attendance.findOneAndUpdate(
        { userId: correction.userId, attendanceDate: correction.targetDate },
        {
          punchInAt: correction.requestedPunchInAt,
          punchOutAt: correction.requestedPunchOutAt,
          durationMinutes,
          status: attStatus,
          source: 'CORRECTION',
          notes: `Approved correction: ${correction.reason}`,
        },
        { upsert: true, new: true }
      );
    }

    await logAuditEvent({
      actorUserId: req.user!._id as any,
      targetUserId: correction.userId as any,
      action: AUDIT_ACTIONS.ATTENDANCE_CORRECTION_REVIEWED,
      entityType: 'CORRECTION',
      entityId: correction._id.toString(),
      after: { status, reviewComment },
      req,
    });

    sendSuccess(
      res,
      correction,
      `Correction request ${status.toLowerCase()} successfully.`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * LIST ATTENDANCE RECORDS (Paginated, filterable by date range and user)
 */
export const listAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 15));
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const status = req.query.status as string;
    const queryUserId = req.query.userId as string;

    const query: Record<string, any> = {};

    // Authorization check: User can only see own records
    if (req.user?.role !== ROLES.ADMIN) {
      query.userId = req.user!._id;
    } else if (queryUserId && mongoose.Types.ObjectId.isValid(queryUserId)) {
      query.userId = queryUserId;
    }

    if (startDate && endDate) {
      query.attendanceDate = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      query.attendanceDate = { $gte: startDate };
    } else if (endDate) {
      query.attendanceDate = { $lte: endDate };
    }

    if (status && Object.values(ATTENDANCE_STATUS).includes(status as any)) {
      query.status = status;
    }

    const total = await Attendance.countDocuments(query);
    const records = await Attendance.find(query)
      .populate('userId', 'name email employeeId department')
      .sort({ attendanceDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    sendSuccess(res, records, 'Attendance records retrieved', 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};
