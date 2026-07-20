import { notFound } from 'next/navigation';
import { CompetitionProvider } from '@/app/c/[slug]/CompetitionContext';
import { NotFoundError } from '@/lib/errors';
import { createCompetitionService } from '@/lib/services/container';

export default async function CompetitionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competitionService = createCompetitionService();

  const competition = await competitionService.findBySlug(slug).catch((error) => {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  });

  if (competition.status === 'closed') {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
        <h1 className="text-h1">🏆 {competition.title}</h1>
        <p className="text-body text-text-muted">このコンペは終了しました</p>
      </main>
    );
  }

  return (
    <CompetitionProvider slug={competition.slug} title={competition.title}>
      {children}
    </CompetitionProvider>
  );
}
