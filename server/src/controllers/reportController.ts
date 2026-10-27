import { Request, Response, NextFunction } from 'express';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import { Attendance } from '../models/Attendance.js';
import { TimeEntry } from '../models/TimeEntry.js';
import { ROLES } from '../constants/index.js';
import { sendError } from '../utils/apiResponse.js';

export const exportAttendanceReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const format = (req.query.format as string) || 'xlsx';
    const queryUserId = req.query.userId as string;

    const query: Record<string, any> = {};
    if (req.user?.role !== ROLES.ADMIN) {
      query.userId = req.user!._id;
    } else if (queryUserId && mongoose.Types.ObjectId.isValid(queryUserId)) {
      query.userId = queryUserId;
    }

    if (startDate && endDate) {
      query.attendanceDate = { $gte: startDate, $lte: endDate };
    }

    const records = await Attendance.find(query)
      .populate('userId', 'name email employeeId department')
      .sort({ attendanceDate: -1 });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TaskPulse';
    const sheet = workbook.addWorksheet('Attendance Report');

    sheet.columns = [
      { header: 'Employee ID', key: 'empId', width: 15 },
      { header: 'Employee Name', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Department', key: 'dept', width: 18 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Punch In (UTC)', key: 'punchIn', width: 22 },
      { header: 'Punch Out (UTC)', key: 'punchOut', width: 22 },
      { header: 'Duration (Minutes)', key: 'durationMin', width: 18 },
      { header: 'Duration (Hours)', key: 'durationHrs', width: 16 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Source', key: 'source', width: 14 },
    ];

    // Style header row
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' }, // Indigo-600
    };

    records.forEach((record: any) => {
      sheet.addRow({
        empId: record.userId?.employeeId || 'N/A',
        name: record.userId?.name || 'N/A',
        email: record.userId?.email || 'N/A',
        dept: record.userId?.department || 'N/A',
        date: record.attendanceDate,
        punchIn: record.punchInAt ? new Date(record.punchInAt).toISOString() : '',
        punchOut: record.punchOutAt ? new Date(record.punchOutAt).toISOString() : '',
        durationMin: record.durationMinutes || 0,
        durationHrs: Number(((record.durationMinutes || 0) / 60).toFixed(2)),
        status: record.status,
        source: record.source,
      });
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="TaskPulse_Attendance_${startDate || 'all'}_to_${endDate || 'all'}.csv"`
      );
      await workbook.csv.write(res);
      res.end();
    } else {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="TaskPulse_Attendance_${startDate || 'all'}_to_${endDate || 'all'}.xlsx"`
      );
      await workbook.xlsx.write(res);
      res.end();
    }
  } catch (error) {
    next(error);
  }
};

export const exportTimeEntriesReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const format = (req.query.format as string) || 'xlsx';
    const queryUserId = req.query.userId as string;

    const query: Record<string, any> = { deletedAt: null };
    if (req.user?.role !== ROLES.ADMIN) {
      query.userId = req.user!._id;
    } else if (queryUserId && mongoose.Types.ObjectId.isValid(queryUserId)) {
      query.userId = queryUserId;
    }

    if (startDate && endDate) {
      query.workDate = { $gte: startDate, $lte: endDate };
    }

    const records = await TimeEntry.find(query)
      .populate('userId', 'name email employeeId department')
      .populate('taskId', 'title status priority')
      .sort({ workDate: -1 });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TaskPulse';
    const sheet = workbook.addWorksheet('Time Entries Report');

    sheet.columns = [
      { header: 'Employee ID', key: 'empId', width: 15 },
      { header: 'Employee Name', key: 'name', width: 25 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Task Title', key: 'task', width: 30 },
      { header: 'Task Status', key: 'taskStatus', width: 15 },
      { header: 'Work Description', key: 'desc', width: 40 },
      { header: 'Duration (Minutes)', key: 'durationMin', width: 18 },
      { header: 'Duration (Hours)', key: 'durationHrs', width: 16 },
      { header: 'Backdate Reason', key: 'reason', width: 25 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' },
    };

    records.forEach((record: any) => {
      sheet.addRow({
        empId: record.userId?.employeeId || 'N/A',
        name: record.userId?.name || 'N/A',
        date: record.workDate,
        task: record.taskId?.title || 'N/A',
        taskStatus: record.taskId?.status || 'N/A',
        desc: record.description,
        durationMin: record.durationMinutes || 0,
        durationHrs: Number(((record.durationMinutes || 0) / 60).toFixed(2)),
        reason: record.backdateReason || '',
      });
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="TaskPulse_TimeEntries_${startDate || 'all'}_to_${endDate || 'all'}.csv"`
      );
      await workbook.csv.write(res);
      res.end();
    } else {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="TaskPulse_TimeEntries_${startDate || 'all'}_to_${endDate || 'all'}.xlsx"`
      );
      await workbook.xlsx.write(res);
      res.end();
    }
  } catch (error) {
    next(error);
  }
};
