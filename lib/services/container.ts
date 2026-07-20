import { AppSettingsRepository } from '@/lib/repositories/AppSettingsRepository';
import { LogoRepository } from '@/lib/repositories/LogoRepository';
import { VoteRepository } from '@/lib/repositories/VoteRepository';
import { PhaseService } from '@/lib/services/PhaseService';
import { UploadService } from '@/lib/services/UploadService';
import { VoteService } from '@/lib/services/VoteService';

export function createUploadService(): UploadService {
  const appSettingsRepository = new AppSettingsRepository();
  const logoRepository = new LogoRepository();
  const phaseService = new PhaseService(appSettingsRepository);
  return new UploadService(logoRepository, phaseService);
}

export function createVoteService(): VoteService {
  const appSettingsRepository = new AppSettingsRepository();
  const voteRepository = new VoteRepository();
  const phaseService = new PhaseService(appSettingsRepository);
  return new VoteService(voteRepository, phaseService);
}
