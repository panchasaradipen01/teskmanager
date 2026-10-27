import mongoose, { Schema, Document } from 'mongoose';

export interface ITimeEntry extends Document {
  userId: mongoose.Types.ObjectId;
  taskId: mongoose.Types.ObjectId;
  workDate: string; // YYYY-MM-DD in Asia/Kolkata
  description: string;
  durationMinutes: number;
  startTime?: Date;
  endTime?: Date;
  backdateReason?: string;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TimeEntrySchema = new Schema<ITimeEntry>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
      index: true,
    },
    workDate: {
      type: String,
      required: true,
      index: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 1440, // 24 hours max per entry
    },
    startTime: {
      type: Date,
    },
    endTime: {
      type: Date,
    },
    backdateReason: {
      type: String,
      trim: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

TimeEntrySchema.index({ userId: 1, workDate: 1, deletedAt: 1 });
TimeEntrySchema.index({ taskId: 1, workDate: 1 });

export const TimeEntry = mongoose.model<ITimeEntry>('TimeEntry', TimeEntrySchema);
