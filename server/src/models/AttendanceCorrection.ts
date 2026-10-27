import mongoose, { Schema, Document } from 'mongoose';
import { CORRECTION_STATUS, CorrectionStatus } from '../constants/index.js';

export interface IAttendanceCorrection extends Document {
  userId: mongoose.Types.ObjectId;
  attendanceId?: mongoose.Types.ObjectId;
  targetDate: string; // YYYY-MM-DD
  requestedPunchInAt: Date;
  requestedPunchOutAt: Date;
  previousPunchInAt?: Date;
  previousPunchOutAt?: Date;
  reason: string;
  status: CorrectionStatus;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewComment?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceCorrectionSchema = new Schema<IAttendanceCorrection>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    attendanceId: {
      type: Schema.Types.ObjectId,
      ref: 'Attendance',
    },
    targetDate: {
      type: String,
      required: true,
      index: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    requestedPunchInAt: {
      type: Date,
      required: true,
    },
    requestedPunchOutAt: {
      type: Date,
      required: true,
    },
    previousPunchInAt: {
      type: Date,
    },
    previousPunchOutAt: {
      type: Date,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
    },
    status: {
      type: String,
      enum: Object.values(CORRECTION_STATUS),
      default: CORRECTION_STATUS.PENDING,
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewComment: {
      type: String,
      trim: true,
    },
    reviewedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

AttendanceCorrectionSchema.index({ userId: 1, targetDate: 1, status: 1 });
AttendanceCorrectionSchema.index({ status: 1, createdAt: -1 });

export const AttendanceCorrection = mongoose.model<IAttendanceCorrection>(
  'AttendanceCorrection',
  AttendanceCorrectionSchema
);
