import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const passwordComplexityRegex = {
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  number: /[0-9]/,
  special: /[^A-Za-z0-9]/,
};

export const setPasswordSchema = z
  .object({
    temporaryPassword: z.string().min(1, 'Current temporary password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters long')
      .regex(passwordComplexityRegex.uppercase, 'Must contain at least one uppercase letter')
      .regex(passwordComplexityRegex.lowercase, 'Must contain at least one lowercase letter')
      .regex(passwordComplexityRegex.number, 'Must contain at least one number')
      .regex(passwordComplexityRegex.special, 'Must contain at least one special character (!@#$%^&*...)'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.temporaryPassword !== data.newPassword, {
    message: 'Your new password cannot be the same as your temporary password.',
    path: ['newPassword'],
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const createTaskSchema = z.object({
  title: z.string().min(3, 'Task title must be at least 3 characters long').max(200, 'Title cannot exceed 200 characters'),
  description: z.string().min(1, 'Task description is required'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED']).default('TODO'),
});

export const logTimeSchema = z.object({
  taskId: z.string().min(1, 'Please select a task'),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  durationMinutes: z.number().int().positive('Duration must be greater than 0 minutes'),
  description: z.string().min(3, 'Work description must be at least 3 characters'),
  backdateReason: z.string().optional(),
});

export const attendanceCorrectionSchema = z.object({
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  requestedPunchInAt: z.string().datetime({ message: 'Invalid punch-in time format' }),
  requestedPunchOutAt: z.string().datetime({ message: 'Invalid punch-out time format' }),
  reason: z.string().min(5, 'Mandatory reason must be at least 5 characters long'),
});

export const provisionUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  email: z.string().min(1, 'Email is required').email('Please enter a valid work email address'),
  employeeId: z.string().min(2, 'Employee ID must be at least 2 characters long'),
  role: z.enum(['ADMIN', 'USER']).default('USER'),
  department: z.string().default('General'),
  temporaryPassword: z.string().min(8, 'Temporary password must be at least 8 characters long').optional().or(z.literal('')),
});

export const reviewCorrectionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewComment: z.string().optional(),
});

/**
 * Utility to map a ZodError to an object of field -> message
 */
export function getZodFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0]?.toString() || 'general';
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}
