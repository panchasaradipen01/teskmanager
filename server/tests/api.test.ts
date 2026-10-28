import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Task } from '../src/models/Task.js';
import { Attendance } from '../src/models/Attendance.js';
import { ROLES, USER_STATUS, CORRECTION_STATUS } from '../src/constants/index.js';
import { getTodayDateString, getYesterdayDateString } from '../src/utils/dateUtils.js';

let mongoServer: MongoMemoryServer;
const app = createApp();

let adminToken: string;
let employeeToken: string;
let adminCookie: string;
let employeeCookie: string;
let employeeUser: any;
let adminUser: any;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Create Admin
  const adminSalt = await bcrypt.genSalt(10);
  adminUser = await User.create({
    name: 'Admin Test',
    email: 'admin@test.com',
    employeeId: 'ADM-001',
    role: ROLES.ADMIN,
    status: USER_STATUS.ACTIVE,
    passwordHash: await bcrypt.hash('AdminPassword123!', adminSalt),
    mustChangePassword: false,
  });

  // Create Employee
  const empSalt = await bcrypt.genSalt(10);
  employeeUser = await User.create({
    name: 'Employee Test',
    email: 'employee@test.com',
    employeeId: 'EMP-001',
    role: ROLES.USER,
    status: USER_STATUS.ACTIVE,
    passwordHash: await bcrypt.hash('EmployeePass123!', empSalt),
    mustChangePassword: false,
  });

  // Login Admin
  const adminRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@test.com', password: 'AdminPassword123!' });
  adminToken = adminRes.body.data.token;
  adminCookie = adminRes.headers['set-cookie'][0];

  // Login Employee
  const empRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'employee@test.com', password: 'EmployeePass123!' });
  employeeToken = empRes.body.data.token;
  employeeCookie = empRes.headers['set-cookie'][0];
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('1. Authentication & Security Tests', () => {
  it('should reject invalid credentials with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'WrongPassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should return user info from /api/auth/me using cookie', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', employeeCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('employee@test.com');
  });

  it('should prevent regular employees from accessing /api/users (Admin only)', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Cookie', employeeCookie);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should allow Admin to list users', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });
});

describe('2. Attendance & Punch Rules Tests', () => {
  it('should allow employee to punch in for today', async () => {
    const res = await request(app)
      .post('/api/attendance/punch-in')
      .set('Cookie', employeeCookie);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.attendanceDate).toBe(getTodayDateString());
  });

  it('should reject duplicate punch-in on the same day', async () => {
    const res = await request(app)
      .post('/api/attendance/punch-in')
      .set('Cookie', employeeCookie);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_PUNCHED_IN');
  });

  it('should allow employee to punch out and record duration', async () => {
    const res = await request(app)
      .post('/api/attendance/punch-out')
      .set('Cookie', employeeCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.punchOutAt).toBeDefined();
  });

  it('should reject punch out when no open session exists', async () => {
    const res = await request(app)
      .post('/api/attendance/punch-out')
      .set('Cookie', employeeCookie);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_ACTIVE_SESSION');
  });
});

describe('3. Attendance Correction Workflow Tests', () => {
  let correctionId: string;
  const yesterday = getYesterdayDateString();

  it('should reject correction for future dates', async () => {
    const futureDate = '2099-01-01';
    const res = await request(app)
      .post('/api/attendance/corrections')
      .set('Cookie', employeeCookie)
      .send({
        targetDate: futureDate,
        requestedPunchInAt: `${futureDate}T09:00:00.000Z`,
        requestedPunchOutAt: `${futureDate}T18:00:00.000Z`,
        reason: 'Future date test',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FUTURE_DATE_INVALID');
  });

  it('should allow employee to submit correction for yesterday with mandatory reason', async () => {
    const res = await request(app)
      .post('/api/attendance/corrections')
      .set('Cookie', employeeCookie)
      .send({
        targetDate: yesterday,
        requestedPunchInAt: `${yesterday}T09:00:00.000Z`,
        requestedPunchOutAt: `${yesterday}T17:30:00.000Z`,
        reason: 'Forgot to punch in while working remotely yesterday',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(CORRECTION_STATUS.PENDING);
    correctionId = res.body.data._id;
  });

  it('should allow Admin to review and approve the correction request', async () => {
    const res = await request(app)
      .patch(`/api/attendance/corrections/${correctionId}/review`)
      .set('Cookie', adminCookie)
      .send({
        status: CORRECTION_STATUS.APPROVED,
        reviewComment: 'Verified with manager and approved',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify Attendance was created / updated
    const att = await Attendance.findOne({
      userId: employeeUser._id,
      attendanceDate: yesterday,
    });
    expect(att).toBeDefined();
    expect(att?.source).toBe('CORRECTION');
    expect(att?.durationMinutes).toBe(510); // 8.5 hours
  });
});

describe('4. Tasks and Time Entry Rules Tests', () => {
  let taskId: string;
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

  it('should allow employee to create a task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', employeeCookie)
      .send({
        title: 'Build Authentication Module',
        description: 'Implement JWT cookies and password hashing',
        priority: 'HIGH',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    taskId = res.body.data._id;
  });

  it('should allow logging time for today without backdate reason', async () => {
    const res = await request(app)
      .post('/api/time-entries')
      .set('Cookie', employeeCookie)
      .send({
        taskId,
        workDate: today,
        description: 'Engineered backend controllers and routes',
        durationMinutes: 120,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.durationMinutes).toBe(120);
  });

  it('should reject logging time for yesterday WITHOUT explanation reason', async () => {
    const res = await request(app)
      .post('/api/time-entries')
      .set('Cookie', employeeCookie)
      .send({
        taskId,
        workDate: yesterday,
        description: 'Worked on schema design',
        durationMinutes: 60,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BACKDATE_REASON_REQUIRED');
  });

  it('should allow logging time for yesterday WITH explanation reason', async () => {
    const res = await request(app)
      .post('/api/time-entries')
      .set('Cookie', employeeCookie)
      .send({
        taskId,
        workDate: yesterday,
        description: 'Worked on schema design',
        durationMinutes: 60,
        backdateReason: 'Was in offsite client meeting yesterday afternoon',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.backdateReason).toBe('Was in offsite client meeting yesterday afternoon');
  });

  it('should block logging time older than yesterday for regular employees', async () => {
    const oldDate = '2026-01-01';
    const res = await request(app)
      .post('/api/time-entries')
      .set('Cookie', employeeCookie)
      .send({
        taskId,
        workDate: oldDate,
        description: 'Ancient work',
        durationMinutes: 60,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BACKDATE_LIMIT_EXCEEDED');
  });
});

describe('5. Access Token, Refresh Token & Zod Validation Tests', () => {
  it('should issue both accessToken and refreshToken on login with status 200', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'employee@test.com', password: 'EmployeePass123!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('should refresh access token using valid refresh token', async () => {
    // 1. Login to get fresh tokens
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'employee@test.com', password: 'EmployeePass123!' });

    const refreshToken = loginRes.body.data.refreshToken;
    const cookies = loginRes.headers['set-cookie'];

    // 2. Call /api/auth/refresh with cookie
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookies)
      .send({});

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.data.accessToken).toBeDefined();
  });

  it('should reject refresh when no refresh token is provided with 401', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({});

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NO_REFRESH_TOKEN');
  });

  it('should return 400 Bad Request and validation details when input fails Zod schema', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'invalid-email-format', password: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details.some((d: any) => d.field === 'email')).toBe(true);
  });
});
