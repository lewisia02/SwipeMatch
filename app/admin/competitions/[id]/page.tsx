import { notFound, redirect } from 'next/navigation';
import { hasValidAdminSession } from '@/lib/api/requireAdminSession';
import { NotFoundError } from '@/lib/errors';
import { createAdminService, createCompetitionService } from '@/lib/services/container';
import { AdminCompetitionClient } from './_components/AdminCompetitionClient';

export default async function AdminCompetitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const adminService = createAdminService();
  const authorized = await hasValidAdminSession(adminService);
  if (!authorized) {
    redirect('/admin/login');
  }

  const { id } = await params;
  const competitionService = createCompetitionService();
  const competition = await competitionService.findById(id).catch((error) => {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  });

  return (
    <AdminCompetitionClient
      id={competition.id}
      slug={competition.slug}
      title={competition.title}
      initialPhase={competition.currentPhase}
    />
  );
}
