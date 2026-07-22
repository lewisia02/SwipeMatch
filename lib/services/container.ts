import { CompetitionRepository } from '@/lib/repositories/CompetitionRepository';
import { LogoRepository } from '@/lib/repositories/LogoRepository';
import { VoteRepository } from '@/lib/repositories/VoteRepository';
import { AdminService } from '@/lib/services/AdminService';
import { CompetitionService } from '@/lib/services/CompetitionService';
import { PhaseService } from '@/lib/services/PhaseService';
import { UploadService } from '@/lib/services/UploadService';
import { VoteService } from '@/lib/services/VoteService';

export function createCompetitionService(): CompetitionService {
  const competitionRepository = new CompetitionRepository();
  const logoRepository = new LogoRepository();
  const voteRepository = new VoteRepository();
  return new CompetitionService(competitionRepository, logoRepository, voteRepository);
}

export function createUploadService(): UploadService {
  const competitionRepository = new CompetitionRepository();
  const logoRepository = new LogoRepository();
  const phaseService = new PhaseService(competitionRepository);
  return new UploadService(logoRepository, phaseService, competitionRepository);
}

export function createVoteService(): VoteService {
  const competitionRepository = new CompetitionRepository();
  const voteRepository = new VoteRepository();
  const phaseService = new PhaseService(competitionRepository);
  return new VoteService(voteRepository, phaseService);
}

export function createAdminService(): AdminService {
  const competitionRepository = new CompetitionRepository();
  const logoRepository = new LogoRepository();
  const voteRepository = new VoteRepository();
  const phaseService = new PhaseService(competitionRepository);
  return new AdminService(logoRepository, voteRepository, phaseService);
}
