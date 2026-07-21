import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { UnauthorizedError } from '@/lib/errors';
import { requireAdminSession } from '@/lib/api/requireAdminSession';
import { createAdminService, createCompetitionService } from '@/lib/services/container';
import type { Competition } from '@/lib/types/Competition';
import { activateCompetitionSchema } from '@/lib/validators/competitionSchema';

function toCompetitionJson(competition: Competition) {
  return {
    id: competition.id,
    slug: competition.slug,
    title: competition.title,
    status: competition.status,
    currentPhase: competition.currentPhase,
    createdAt: competition.createdAt,
    closedAt: competition.closedAt,
  };
}

export async function GET(request: NextRequest) {
  const adminService = createAdminService();
  const competitionService = createCompetitionService();

  try {
    await requireAdminSession(request, adminService);

    const competitions = await competitionService.listAll();
    return NextResponse.json({ competitions: competitions.map(toCompetitionJson) });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json(
      { message: 'エラーが発生しました。時間をおいて再度お試しください' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const adminService = createAdminService();
  const competitionService = createCompetitionService();

  try {
    await requireAdminSession(request, adminService);

    const body = await request.json();
    const { title } = activateCompetitionSchema.parse(body);

    const competition = await competitionService.activate(title);
    return NextResponse.json(toCompetitionJson(competition));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json(
      { message: 'エラーが発生しました。時間をおいて再度お試しください' },
      { status: 500 },
    );
  }
}
