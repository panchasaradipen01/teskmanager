'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { ShieldCheck, Lock, Mail, AlertCircle, Info } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillAdminCredentials = () => {
    setEmail('admin@taskpulse.com');
    setPassword('Admin@TaskPulse2026!');
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-2xl shadow-lg shadow-indigo-600/30 mb-2">
            TP
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Sign In to TaskPulse
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Task Management, Attendance & Time Tracking
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Enter your credentials</CardTitle>
            <CardDescription className="text-xs">
              Access your workspace using your assigned employee credentials.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />

              <Input
                label="Password"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full py-2.5 font-semibold text-sm shadow-md"
                isLoading={isLoading}
              >
                Sign In
              </Button>
            </form>

            {/* Quick-Fill Seed Admin Helper */}
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex flex-col gap-2 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-indigo-900 dark:text-indigo-200">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Bootstrap Administrator Access</span>
                </div>
                <p className="text-indigo-700/80 dark:text-indigo-300/80 leading-relaxed text-[11px]">
                  Use the provisioned system administrator account to initialize and manage users:
                </p>
                <button
                  type="button"
                  onClick={fillAdminCredentials}
                  className="w-full text-center py-1.5 px-3 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors cursor-pointer text-xs"
                >
                  Autofill Default Admin Credentials
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Footer */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          Secure HTTP-only session cookies &bull; Asia/Kolkata Business Timezone
        </p>
      </div>
    </div>
  );
}
