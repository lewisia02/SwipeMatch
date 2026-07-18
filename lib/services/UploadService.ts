import type { LogoRepository } from '@/lib/repositories/LogoRepository';
import type { PhaseService } from '@/lib/services/PhaseService';
import type { Logo } from '@/lib/types/Logo';

export class UploadService {
  constructor(
    private logoRepository: LogoRepository,
    private phaseService: PhaseService,
  ) {}

  async createUploadUrl(contentType: string): Promise<{ uploadUrl: string; storagePath: string }> {
    await this.phaseService.assertPhase('submission');
    return this.logoRepository.createSignedUploadUrl(contentType);
  }

  async createLogo(data: {
    storagePath: string;
    uploaderName: string;
    memo: string;
  }): Promise<Logo> {
    await this.phaseService.assertPhase('submission');

    const imageUrl = this.logoRepository.getPublicUrl(data.storagePath);

    try {
      return await this.logoRepository.create({
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
}
