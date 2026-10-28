'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Lock, Check, X, AlertCircle } from 'lucide-react';
import { setPasswordSchema, getZodFieldErrors } from '@/lib/validations';

export default function SetPasswordPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const hasLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const isDifferent = newPassword !== '' && currentPassword !== '' && newPassword !== currentPassword;
  const isMatch = newPassword !== '' && newPassword === confirmPassword;

  const isFormValid =
    hasLength && hasUpper && hasLower && hasNumber && hasSpecial && isDifferent && isMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);
    setFieldErrors({});

    const validation = setPasswordSchema.safeParse({
      temporaryPassword: currentPassword,
      newPassword,
      confirmPassword,
    });

    if (!validation.success) {
      const errors = getZodFieldErrors(validation.error);
      setFieldErrors(errors);
      return;
    }

    if (!isFormValid) {
      setGlobalError('Please fulfill all password security requirements listed below.');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });

      await refreshUser();

      if (user?.role === 'ADMIN') {
        router.push('/admin/dashboard');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      if (err.details && Array.isArray(err.details)) {
        const backendErrors: Record<string, string> = {};
        err.details.forEach((d: any) => {
          if (d.field) backendErrors[d.field] = d.message;
        });
        setFieldErrors(backendErrors);
      }
      setGlobalError(err.message || 'Failed to update password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-2xl shadow-lg shadow-indigo-600/20 mb-2">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Set Your Permanent Password
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            For security reasons, your temporary password must be replaced with a strong personal password.
          </p>
        </div>

        <Card className="border-slate-200 dark:border-slate-800 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Password Security Requirements</CardTitle>
            <CardDescription className="text-xs">
              Ensure your new password meets the security criteria below.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {globalError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{globalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <Input
                label="Temporary Password"
                type="password"
                placeholder="Enter the password provided by your admin"
                value={currentPassword}
                error={fieldErrors.temporaryPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (fieldErrors.temporaryPassword) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.temporaryPassword;
                      return next;
                    });
                  }
                }}
                required
              />

              <Input
                label="New Permanent Password"
                type="password"
                placeholder="Choose a strong new password"
                value={newPassword}
                error={fieldErrors.newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (fieldErrors.newPassword) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.newPassword;
                      return next;
                    });
                  }
                }}
                required
              />

              {/* Requirement Checklist */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 text-[11px] space-y-1.5">
                <div className={`flex items-center gap-1.5 ${hasLength ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                  {hasLength ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-slate-400" />}
                  <span>At least 8 characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasUpper ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                  {hasUpper ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-slate-400" />}
                  <span>At least one uppercase letter (A-Z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasLower ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                  {hasLower ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-slate-400" />}
                  <span>At least one lowercase letter (a-z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                  {hasNumber ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-slate-400" />}
                  <span>At least one number (0-9)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                  {hasSpecial ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 text-slate-400" />}
                  <span>At least one special character (!@#$%^&*...)</span>
                </div>
                {currentPassword && newPassword && (
                  <div className={`flex items-center gap-1.5 ${isDifferent ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400 font-semibold'}`}>
                    {isDifferent ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    <span>Different from temporary password</span>
                  </div>
                )}
              </div>

              <Input
                label="Confirm New Password"
                type="password"
                placeholder="Re-type your new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (fieldErrors.confirmPassword) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.confirmPassword;
                      return next;
                    });
                  }
                }}
                error={
                  fieldErrors.confirmPassword ||
                  (confirmPassword && !isMatch ? 'Passwords do not match' : undefined)
                }
                required
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full py-2.5 font-semibold text-sm shadow-md"
                isLoading={isLoading}
                disabled={!isFormValid}
              >
                Save Password & Proceed to Workspace
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
