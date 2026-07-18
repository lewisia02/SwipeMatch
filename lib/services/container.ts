import { AppSettingsRepository } from '@/lib/repositories/AppSettingsRepository';
import { LogoRepository } from '@/lib/repositories/LogoRepository';
import { PhaseService } from '@/lib/services/PhaseService';
import { UploadService } from '@/lib/services/UploadService';

export function createUploadService(): UploadService {
  const appSettingsRepository = new AppSettingsRepository();
  const logoRepository = new LogoRepository();
  const phaseService = new PhaseService(appSettingsRepository);
  return new UploadService(logoRepository, phaseService);
}
