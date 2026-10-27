import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Attendance } from '../models/Attendance.js';
import { AttendanceCorrection } from '../models/AttendanceCorrection.js';
import { Task } from '../models/Task.js';
import { TimeEntry } from '../models/TimeEntry.js';
import {
  ROLES,
  USER_STATUS,
  ATTENDANCE_STATUS,
  CORRECTION_STATUS,
  TASK_STATUS,
} from '../constants/index.js';
import { getTodayDateString, getZonedDateString } from '../utils/dateUtils.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const getAdminDashboard = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const today = getTodayDateString();

    // 1. Summary Cards
    const [
      totalUsers,
      activeUsers,
      punchedInUsersCount,
      todayAttendanceRecords,
      todayTimeEntries,
      taskStatusCounts,
      pendingCorrectionsCount,
      incompleteAttendanceCount,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: USER_STATUS.ACTIVE }),
      Attendance.countDocuments({ attendanceDate: today, punchOutAt: { $exists: false } }),
      Attendance.find({ attendanceDate: today }),
      TimeEntry.find({ workDate: today, deletedAt: null }),
      Task.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      AttendanceCorrection.countDocuments({ status: CORRECTION_STATUS.PENDING }),
      Attendance.countDocuments({ status: ATTENDANCE_STATUS.INCOMPLETE }),
    ]);

    // Calculate today's total attendance hours
    const totalAttendanceMinutesToday = todayAttendanceRecords.reduce(
      (sum, record) => sum + (record.durationMinutes || 0),
      0
    );

    // Calculate today's total task hours
    const totalTaskMinutesToday = todayTimeEntries.reduce(
      (sum, entry) => sum + (entry.durationMinutes || 0),
      0
    );

    // Map task counts
    const taskCounts = {
      TODO: 0,
      IN_PROGRESS: 0,
      BLOCKED: 0,
      COMPLETED: 0,
    };
    taskStatusCounts.forEach((item: any) => {
      if (item._id in taskCounts) {
        taskCounts[item._id as keyof typeof taskCounts] = item.count;
      }
    });

    // 2. Weekly Trend (Last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const startDateStr = getZonedDateString(sevenDaysAgo);

    const weeklyAttendance = await Attendance.aggregate([
      { $match: { attendanceDate: { $gte: startDateStr, $lte: today } } },
      {
        $group: {
          _id: '$attendanceDate',
          totalMinutes: { $sum: '$durationMinutes' },
          count: { $sum: 1 },
        },
      },
    ]);

    const weeklyTaskTime = await TimeEntry.aggregate([
      { $match: { workDate: { $gte: startDateStr, $lte: today }, deletedAt: null } },
      {
        $group: {
          _id: '$workDate',
          totalMinutes: { $sum: '$durationMinutes' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Build unified 7-day array
    const trendMap: Record<string, { date: string; attendanceHours: number; taskHours: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = getZonedDateString(d);
      trendMap[dStr] = { date: dStr, attendanceHours: 0, taskHours: 0 };
    }

    weeklyAttendance.forEach((item: any) => {
      if (trendMap[item._id]) {
        trendMap[item._id].attendanceHours = Number((item.totalMinutes / 60).toFixed(1));
      }
    });

    weeklyTaskTime.forEach((item: any) => {
      if (trendMap[item._id]) {
        trendMap[item._id].taskHours = Number((item.totalMinutes / 60).toFixed(1));
      }
    });

    const weeklyTrends = Object.values(trendMap);

    sendSuccess(res, {
      summary: {
        totalUsers,
        activeUsers,
        currentlyPunchedIn: punchedInUsersCount,
        totalAttendanceHoursToday: Number((totalAttendanceMinutesToday / 60).toFixed(1)),
        totalTaskHoursToday: Number((totalTaskMinutesToday / 60).toFixed(1)),
        pendingCorrections: pendingCorrectionsCount,
        missingPunchOuts: incompleteAttendanceCount,
        tasks: taskCounts,
      },
      weeklyTrends,
    });
  } catch (error) {
    next(error);
  }
};

export const getUserDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!._id;
    const today = getTodayDateString();

    const [todayAttendance, todayEntries, recentEntries, taskCounts] = await Promise.all([
      Attendance.findOne({ userId, attendanceDate: today }),
      TimeEntry.find({ userId, workDate: today, deletedAt: null }),
      TimeEntry.find({ userId, deletedAt: null })
        .populate('taskId', 'title status priority')
        .sort({ createdAt: -1 })
        .limit(5),
      Task.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId.toString()) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const taskMinutesToday = todayEntries.reduce(
      (sum, entry) => sum + (entry.durationMinutes || 0),
      0
    );

    const tasksSummary = {
      TODO: 0,
      IN_PROGRESS: 0,
      BLOCKED: 0,
      COMPLETED: 0,
    };
    taskCounts.forEach((item: any) => {
      if (item._id in tasksSummary) {
        tasksSummary[item._id as keyof typeof tasksSummary] = item.count;
      }
    });

    // 7-day personal trend
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const startDateStr = getZonedDateString(sevenDaysAgo);

    const userAttendanceTrend = await Attendance.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId.toString()),
          attendanceDate: { $gte: startDateStr, $lte: today },
        },
      },
      {
        $group: {
          _id: '$attendanceDate',
          totalMinutes: { $sum: '$durationMinutes' },
        },
      },
    ]);

    const userTaskTrend = await TimeEntry.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId.toString()),
          workDate: { $gte: startDateStr, $lte: today },
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: '$workDate',
          totalMinutes: { $sum: '$durationMinutes' },
        },
      },
    ]);

    const trendMap: Record<string, { date: string; attendanceHours: number; taskHours: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = getZonedDateString(d);
      trendMap[dStr] = { date: dStr, attendanceHours: 0, taskHours: 0 };
    }

    userAttendanceTrend.forEach((item: any) => {
      if (trendMap[item._id]) {
        trendMap[item._id].attendanceHours = Number((item.totalMinutes / 60).toFixed(1));
      }
    });

    userTaskTrend.forEach((item: any) => {
      if (trendMap[item._id]) {
        trendMap[item._id].taskHours = Number((item.totalMinutes / 60).toFixed(1));
      }
    });

    sendSuccess(res, {
      attendance: {
        record: todayAttendance,
        isPunchedIn: !!todayAttendance && !todayAttendance.punchOutAt,
        punchInAt: todayAttendance?.punchInAt,
        punchOutAt: todayAttendance?.punchOutAt,
        durationMinutes: todayAttendance?.durationMinutes || 0,
      },
      taskHoursToday: Number((taskMinutesToday / 60).toFixed(1)),
      taskMinutesToday,
      tasks: tasksSummary,
      recentEntries,
      weeklyTrends: Object.values(trendMap),
    });
  } catch (error) {
    next(error);
  }
};

export const getCalendarData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const month = (req.query.month as string) || getTodayDateString().substring(0, 7); // e.g. "2026-10"
    const queryUserId = req.query.userId as string;

    let targetUserId = req.user!._id;
    if (req.user?.role === ROLES.ADMIN && queryUserId && mongoose.Types.ObjectId.isValid(queryUserId)) {
      targetUserId = new mongoose.Types.ObjectId(queryUserId);
    }

    const regex = new RegExp(`^${month}`);

    const [attendanceRecords, timeEntries, pendingCorrections] = await Promise.all([
      Attendance.find({
        userId: targetUserId,
        attendanceDate: { $regex: regex },
      }),
      TimeEntry.find({
        userId: targetUserId,
        workDate: { $regex: regex },
        deletedAt: null,
      }).populate('taskId', 'title priority status'),
      AttendanceCorrection.find({
        userId: targetUserId,
        targetDate: { $regex: regex },
        status: CORRECTION_STATUS.PENDING,
      }),
    ]);

    // Aggregate by date
    const daysMap: Record<string, any> = {};

    attendanceRecords.forEach((att) => {
      if (!daysMap[att.attendanceDate]) {
        daysMap[att.attendanceDate] = {
          date: att.attendanceDate,
          attendance: null,
          timeEntries: [],
          hasPendingCorrection: false,
          totalTaskMinutes: 0,
        };
      }
      daysMap[att.attendanceDate].attendance = att;
    });

    timeEntries.forEach((entry) => {
      if (!daysMap[entry.workDate]) {
        daysMap[entry.workDate] = {
          date: entry.workDate,
          attendance: null,
          timeEntries: [],
          hasPendingCorrection: false,
          totalTaskMinutes: 0,
        };
      }
      daysMap[entry.workDate].timeEntries.push(entry);
      daysMap[entry.workDate].totalTaskMinutes += entry.durationMinutes;
    });

    pendingCorrections.forEach((corr) => {
      if (!daysMap[corr.targetDate]) {
        daysMap[corr.targetDate] = {
          date: corr.targetDate,
          attendance: null,
          timeEntries: [],
          hasPendingCorrection: false,
          totalTaskMinutes: 0,
        };
      }
      daysMap[corr.targetDate].hasPendingCorrection = true;
    });

    sendSuccess(res, {
      month,
      days: Object.values(daysMap),
    });
  } catch (error) {
    next(error);
  }
};
