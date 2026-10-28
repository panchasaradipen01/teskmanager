'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { useToast } from '@/context/ToastContext';
import {
  UserPlus,
  Search,
  KeyRound,
  ShieldCheck,
  UserCheck,
  UserX,
  Copy,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { provisionUserSchema, getZodFieldErrors } from '@/lib/validations';

export default function UsersManagementPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Form states for Add User
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState('USER');
  const [department, setDepartment] = useState('Engineering');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [resetErrors, setResetErrors] = useState<Record<string, string>>({});

  // Generated Credentials Display Modal
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    employeeId: string;
    temporaryPassword: string;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/users', {
        page: currentPage,
        limit: 10,
        search,
        role: roleFilter,
        status: statusFilter,
      });
      setUsers(res.data || []);
      if (res.meta) {
        setTotalPages(res.meta.totalPages);
        setTotalRecords(res.meta.total);
      }
    } catch (err: any) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedEmpId = employeeId.trim().toUpperCase();

    // Frontend duplicate validation
    if (users.some((u) => u.email.toLowerCase() === trimmedEmail)) {
      setFormErrors({ email: 'A user with this email address already exists.' });
      return;
    }

    if (users.some((u) => u.employeeId.toUpperCase() === trimmedEmpId)) {
      setFormErrors({ employeeId: 'A user with this Employee ID already exists.' });
      return;
    }

    const validation = provisionUserSchema.safeParse({
      name: name.trim(),
      email: trimmedEmail,
      employeeId: trimmedEmpId,
      role,
      department: department.trim() || 'General',
      temporaryPassword: temporaryPassword || undefined,
    });

    if (!validation.success) {
      setFormErrors(getZodFieldErrors(validation.error));
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await api.post('/users', {
        name: name.trim(),
        email: trimmedEmail,
        employeeId: trimmedEmpId,
        role,
        department: department.trim() || 'General',
        temporaryPassword: temporaryPassword || undefined,
      });

      setCreatedCredentials({
        email: res.data.user.email,
        employeeId: res.data.user.employeeId,
        temporaryPassword: res.data.temporaryPassword,
      });

      toast.success(`User ${name} provisioned successfully!`);
      setIsAddOpen(false);
      setName('');
      setEmail('');
      setEmployeeId('');
      setTemporaryPassword('');
      setFormErrors({});
      await fetchUsers();
    } catch (err: any) {
      if (err.details?.field) {
        setFormErrors({ [err.details.field]: err.message });
      } else if (err.details && Array.isArray(err.details)) {
        const bErrors: Record<string, string> = {};
        err.details.forEach((d: any) => {
          if (d.field) bErrors[d.field] = d.message;
        });
        setFormErrors(bErrors);
      } else {
        toast.error(err.message || 'Failed to create user');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: any) => {
    const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.patch(`/users/${user._id}/status`, { status: newStatus });
      toast.success(`User ${user.name} is now ${newStatus}.`);
      await fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Status update failed');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setResetErrors({});

    if (temporaryPassword && temporaryPassword.length < 8) {
      setResetErrors({ temporaryPassword: 'Temporary password must be at least 8 characters long.' });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await api.post(`/users/${selectedUser._id}/reset-password`, {
        temporaryPassword: temporaryPassword || undefined,
      });

      setCreatedCredentials({
        email: selectedUser.email,
        employeeId: selectedUser.employeeId,
        temporaryPassword: res.data.temporaryPassword,
      });

      toast.success(`Password reset generated for ${selectedUser.name}`);
      setIsResetOpen(false);
      setTemporaryPassword('');
      setResetErrors({});
    } catch (err: any) {
      toast.error(err.message || 'Password reset failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyCredentials = () => {
    if (!createdCredentials) return;
    const text = `TaskPulse Login Credentials:\nEmail: ${createdCredentials.email}\nEmployee ID: ${createdCredentials.employeeId}\nTemporary Password: ${createdCredentials.temporaryPassword}\nLogin Portal: http://localhost:3000/login\n(You will be required to change your password upon first login)`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const columns: Column<any>[] = [
    {
      header: 'Employee Details',
      cell: (row) => (
        <div>
          <strong className="font-semibold text-slate-900 dark:text-slate-100 block">
            {row.name}
          </strong>
          <span className="text-xs text-slate-500 dark:text-slate-400 block">{row.email}</span>
        </div>
      ),
    },
    {
      header: 'Employee ID',
      cell: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
          {row.employeeId}
        </span>
      ),
    },
    {
      header: 'Department',
      accessorKey: 'department',
    },
    {
      header: 'Role',
      cell: (row) => (
        <Badge variant={row.role === 'ADMIN' ? 'primary' : 'default'}>{row.role}</Badge>
      ),
    },
    {
      header: 'Status',
      cell: (row) => (
        <Badge variant={row.status === 'ACTIVE' ? 'success' : 'danger'}>{row.status}</Badge>
      ),
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleToggleStatus(row)}
            icon={row.status === 'ACTIVE' ? <UserX className="w-3.5 h-3.5 text-rose-500" /> : <UserCheck className="w-3.5 h-3.5 text-emerald-500" />}
            className="text-xs py-1"
          >
            {row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedUser(row);
              setTemporaryPassword('');
              setIsResetOpen(true);
            }}
            icon={<KeyRound className="w-3.5 h-3.5 text-indigo-500" />}
            className="text-xs py-1"
          >
            Reset
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              User Directory & Credentials
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Manage accounts, generate secure initial credentials, and enforce access controls.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setName('');
              setEmail('');
              setEmployeeId('');
              setTemporaryPassword('');
              setIsAddOpen(true);
            }}
            icon={<UserPlus className="w-4 h-4" />}
          >
            Add New Employee
          </Button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, or employee ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3.5 py-2 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="USER">User / Employee</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        {/* User Table */}
        <Card>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={users}
              isLoading={isLoading}
              emptyMessage="No users matching the current filters."
            />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalRecords={totalRecords}
              limit={10}
              onPageChange={setCurrentPage}
            />
          </CardContent>
        </Card>
      </div>

      {/* Add User Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add New Employee"
        description="Create an account and generate initial temporary credentials."
      >
        <form onSubmit={handleCreateUser} className="space-y-4" noValidate>
          <Input
            label="Full Name"
            placeholder="Jane Doe"
            value={name}
            error={formErrors.name}
            onChange={(e) => {
              setName(e.target.value);
              if (formErrors.name) setFormErrors((p) => { const n = { ...p }; delete n.name; return n; });
            }}
            required
          />

          <Input
            label="Work Email"
            type="email"
            placeholder="jane.doe@company.com"
            value={email}
            error={formErrors.email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (formErrors.email) setFormErrors((p) => { const n = { ...p }; delete n.email; return n; });
            }}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Employee ID"
              placeholder="EMP-0100"
              value={employeeId}
              error={formErrors.employeeId}
              onChange={(e) => {
                setEmployeeId(e.target.value);
                if (formErrors.employeeId) setFormErrors((p) => { const n = { ...p }; delete n.employeeId; return n; });
              }}
              required
            />
            <Input
              label="Department"
              placeholder="Engineering"
              value={department}
              error={formErrors.department}
              onChange={(e) => {
                setDepartment(e.target.value);
                if (formErrors.department) setFormErrors((p) => { const n = { ...p }; delete n.department; return n; });
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              options={[
                { value: 'USER', label: 'User / Employee' },
                { value: 'ADMIN', label: 'Administrator' },
              ]}
              required
            />
            <Input
              label="Custom Temp Password (Optional)"
              type="text"
              placeholder="Leave blank to auto-generate"
              value={temporaryPassword}
              error={formErrors.temporaryPassword}
              onChange={(e) => {
                setTemporaryPassword(e.target.value);
                if (formErrors.temporaryPassword) setFormErrors((p) => { const n = { ...p }; delete n.temporaryPassword; return n; });
              }}
              minLength={8}
            />
          </div>

          <p className="text-[11px] text-slate-500">
            Note: User will be required to change their temporary password upon their first login.
          </p>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Provision Employee
            </Button>
          </div>
        </form>
      </Modal>

      {/* Admin Reset Password Modal */}
      <Modal
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        title={`Reset Password for ${selectedUser?.name}`}
        description="Generates a new temporary password and flags account for mandatory password update."
      >
        <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
          <Input
            label="Custom Temp Password (Optional)"
            placeholder="Leave blank to auto-generate"
            value={temporaryPassword}
            error={resetErrors.temporaryPassword}
            onChange={(e) => {
              setTemporaryPassword(e.target.value);
              if (resetErrors.temporaryPassword) setResetErrors({});
            }}
            minLength={8}
          />
          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsResetOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" type="submit" isLoading={isSubmitting}>
              Confirm Password Reset
            </Button>
          </div>
        </form>
      </Modal>

      {/* Generated Credentials Success Modal */}
      {createdCredentials && (
        <Modal
          isOpen={!!createdCredentials}
          onClose={() => setCreatedCredentials(null)}
          title="Credentials Generated Successfully"
          description="Provide these temporary credentials securely to the employee."
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2 font-mono text-xs">
              <div>
                <span className="text-slate-400 block">Email:</span>
                <strong className="text-slate-900 dark:text-slate-100">{createdCredentials.email}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Employee ID:</span>
                <strong className="text-slate-900 dark:text-slate-100">{createdCredentials.employeeId}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Temporary Password:</span>
                <strong className="text-indigo-600 dark:text-indigo-400 text-sm">{createdCredentials.temporaryPassword}</strong>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyCredentials}
                icon={copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              >
                {copied ? 'Copied to Clipboard!' : 'Copy Credentials'}
              </Button>
              <Button variant="primary" size="sm" onClick={() => setCreatedCredentials(null)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
