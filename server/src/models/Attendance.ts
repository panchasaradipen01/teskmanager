import mongoose, { Schema, Document } from 'mongoose';
import { ATTENDANCE_STATUS, AttendanceStatus } from '../constants/index.js';

export interface IAttendance extends Document {
  userId: mongoose.Types.ObjectId;
  attendanceDate: string; // YYYY-MM-DD in Asia/Kolkata timezone
  punchInAt: Date;
  punchOutAt?: Date;
  durationMinutes: number;
  status: AttendanceStatus;
  source: 'WEB' | 'CORRECTION' | 'ADMIN_OVERRIDE';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    attendanceDate: {
      type: String,
      required: true,
      index: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    punchInAt: {
      type: Date,
      required: true,
    },
    punchOutAt: {
      type: Date,
    },
    durationMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: Object.values(ATTENDANCE_STATUS),
      default: ATTENDANCE_STATUS.INCOMPLETE,
      index: true,
    },
    source: {
      type: String,
      enum: ['WEB', 'CORRECTION', 'ADMIN_OVERRIDE'],
      default: 'WEB',
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// A user can only have one attendance record per calendar date
AttendanceSchema.index({ userId: 1, attendanceDate: 1 }, { unique: true });
AttendanceSchema.index({ attendanceDate: 1, status: 1 });

export const Attendance = mongoose.model<IAttendance>('Attendance', AttendanceSchema);
