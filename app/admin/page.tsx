import { redirect } from 'next/navigation';
import { hasValidAdminSession } from '@/lib/api/requireAdminSession';
import { createAdminService } from '@/lib/services/container';
import { AdminDashboardClient } from './_components/AdminDashboardClient';

export default async function AdminDashboardPage() {
  const adminService = createAdminService();
  const authorized = await hasValidAdminSession(adminService);
  if (!authorized) {
    redirect('/admin/login');
  }

  return <AdminDashboardClient />;
}
