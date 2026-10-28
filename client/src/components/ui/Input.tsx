import React, { forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, helperText, id, required, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="flex items-center text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
          >
            <span>{label}</span>
            {required && (
              <span className="text-rose-500 font-bold ml-1 text-sm leading-none" title="Required field">
                *
              </span>
            )}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          ref={ref}
          required={required}
          className={cn(
            'flex h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 transition-colors',
            error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500 bg-rose-50/20 dark:bg-rose-950/10',
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1.5 mt-1" role="alert">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
            <span>{error}</span>
          </p>
        )}
        {helperText && !error && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
