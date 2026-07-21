import { redirect } from 'next/navigation';
import { hasValidAdminSession } from '@/lib/api/requireAdminSession';
import { createAdminService } from '@/lib/services/container';
import { AdminCompetitionListClient } from './_components/AdminCompetitionListClient';

export default async function AdminCompetitionListPage() {
  const adminService = createAdminService();
  const authorized = await hasValidAdminSession(adminService);
  if (!authorized) {
    redirect('/admin/login');
  }

  return <AdminCompetitionListClient />;
}
