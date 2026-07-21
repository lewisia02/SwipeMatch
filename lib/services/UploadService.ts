import { ValidationError } from '@/lib/errors';
import type { CompetitionRepository } from '@/lib/repositories/CompetitionRepository';
import type { LogoRepository } from '@/lib/repositories/LogoRepository';
import type { PhaseService } from '@/lib/services/PhaseService';
import type { Logo } from '@/lib/types/Logo';

export class UploadService {
  constructor(
    private logoRepository: LogoRepository,
    private phaseService: PhaseService,
    private competitionRepository: CompetitionRepository,
  ) {}

  async createUploadUrl(
    competitionId: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; storagePath: string }> {
    await this.assertActive(competitionId);
    await this.phaseService.assertPhase(competitionId, 'submission');
    return this.logoRepository.createSignedUploadUrl(contentType);
  }

  async createLogo(
    competitionId: string,
    data: {
      storagePath: string;
      uploaderName: string;
      memo: string;
    },
  ): Promise<Logo> {
    await this.assertActive(competitionId);
    await this.phaseService.assertPhase(competitionId, 'submission');

    const imageUrl = this.logoRepository.getPublicUrl(data.storagePath);

    try {
      return await this.logoRepository.create({
        competitionId,
        imageUrl,
        uploaderName: data.uploaderName,
        memo: data.memo,
      });
    } catch (error) {
      // DB書き込み失敗時、アップロード済みのStorageオブジェクトを削除する補償処理。
      // 補償処理自体が失敗しても、元のDBエラーを握りつぶさずログに残した上でスローする
      try {
        await this.logoRepository.deleteStorageObject(data.storagePath);
      } catch (cleanupError) {
        console.error('補償処理（Storageオブジェクトの削除）に失敗しました', cleanupError);
      }
      throw error;
    }
  }

  private async assertActive(competitionId: string): Promise<void> {
    const competition = await this.competitionRepository.findById(competitionId);
    if (!competition || competition.status !== 'active') {
      throw new ValidationError('このコンペは終了しました', 'competitionId');
    }
  }
}
