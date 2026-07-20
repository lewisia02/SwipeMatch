import { redirect } from 'next/navigation';
import { hasValidAdminSession } from '@/lib/api/requireAdminSession';
import { createAdminService } from '@/lib/services/container';
import { AdminResultsClient } from './_components/AdminResultsClient';

export default async function AdminResultsPage() {
  const adminService = createAdminService();
  const authorized = await hasValidAdminSession(adminService);
  if (!authorized) {
    redirect('/admin/login');
  }

  return <AdminResultsClient />;
}
