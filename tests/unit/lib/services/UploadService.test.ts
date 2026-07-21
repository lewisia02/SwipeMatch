import { describe, expect, it, vi } from 'vitest';
import { PhaseMismatchError, ValidationError } from '@/lib/errors';
import type { CompetitionRepository } from '@/lib/repositories/CompetitionRepository';
import type { LogoRepository } from '@/lib/repositories/LogoRepository';
import type { PhaseService } from '@/lib/services/PhaseService';
import { UploadService } from '@/lib/services/UploadService';
import type { Competition } from '@/lib/types/Competition';

const COMPETITION_ID = 'competition-1';

function createMockLogoRepository() {
  return {
    create: vi.fn().mockResolvedValue({
      id: 'logo-1',
      competitionId: COMPETITION_ID,
      imageUrl: 'https://example.com/logo-1.jpg',
      uploaderName: '山田太郎',
      memo: 'テストメモ',
      createdAt: new Date(),
    }),
    findAllByCompetitionId: vi.fn(),
    delete: vi.fn(),
    createSignedUploadUrl: vi.fn().mockResolvedValue({
      uploadUrl: 'https://example.com/upload',
      storagePath: 'logos/abc.jpg',
    }),
    deleteStorageObject: vi.fn().mockResolvedValue(undefined),
    getPublicUrl: vi.fn().mockReturnValue('https://example.com/logo-1.jpg'),
  } as unknown as LogoRepository;
}

function createMockPhaseService(shouldThrow = false) {
  return {
    assertPhase: shouldThrow
      ? vi.fn().mockRejectedValue(new PhaseMismatchError('submission', 'voting'))
      : vi.fn().mockResolvedValue(undefined),
  } as unknown as PhaseService;
}

function createMockCompetitionRepository(status: Competition['status'] = 'active') {
  return {
    findById: vi.fn().mockResolvedValue({
      id: COMPETITION_ID,
      slug: 'x7k2p9',
      title: 'テストコンペ',
      status,
      currentPhase: 'submission',
      createdAt: new Date(),
      closedAt: status === 'closed' ? new Date() : null,
    } satisfies Competition),
  } as unknown as CompetitionRepository;
}

describe('UploadService', () => {
  describe('createUploadUrl', () => {
    it('submissionフェーズかつactiveなコンペの場合、署名付きURLを発行する', async () => {
      const logoRepository = createMockLogoRepository();
      const phaseService = createMockPhaseService();
      const competitionRepository = createMockCompetitionRepository();
      const service = new UploadService(logoRepository, phaseService, competitionRepository);

      const result = await service.createUploadUrl(COMPETITION_ID, 'image/jpeg');

      expect(result.storagePath).toBe('logos/abc.jpg');
      expect(logoRepository.createSignedUploadUrl).toHaveBeenCalledWith('image/jpeg');
    });

    it('submissionフェーズでない場合、PhaseMismatchErrorをスローする', async () => {
      const logoRepository = createMockLogoRepository();
      const phaseService = createMockPhaseService(true);
      const competitionRepository = createMockCompetitionRepository();
      const service = new UploadService(logoRepository, phaseService, competitionRepository);

      await expect(service.createUploadUrl(COMPETITION_ID, 'image/jpeg')).rejects.toThrow(
        PhaseMismatchError,
      );
      expect(logoRepository.createSignedUploadUrl).not.toHaveBeenCalled();
    });

    it('コンペがclosedの場合、ValidationErrorをスローする', async () => {
      const logoRepository = createMockLogoRepository();
      const phaseService = createMockPhaseService();
      const competitionRepository = createMockCompetitionRepository('closed');
      const service = new UploadService(logoRepository, phaseService, competitionRepository);

      await expect(service.createUploadUrl(COMPETITION_ID, 'image/jpeg')).rejects.toThrow(
        ValidationError,
      );
      expect(logoRepository.createSignedUploadUrl).not.toHaveBeenCalled();
    });
  });

  describe('createLogo', () => {
    it('正常なデータでLogoレコードを作成できる', async () => {
      const logoRepository = createMockLogoRepository();
      const phaseService = createMockPhaseService();
      const competitionRepository = createMockCompetitionRepository();
      const service = new UploadService(logoRepository, phaseService, competitionRepository);

      const result = await service.createLogo(COMPETITION_ID, {
        storagePath: 'logos/abc.jpg',
        uploaderName: '山田太郎',
        memo: 'テストメモ',
      });

      expect(result.id).toBe('logo-1');
      expect(logoRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ competitionId: COMPETITION_ID }),
      );
      expect(logoRepository.deleteStorageObject).not.toHaveBeenCalled();
    });

    it('コンペがclosedの場合、ValidationErrorをスローしDBへ書き込まない', async () => {
      const logoRepository = createMockLogoRepository();
      const phaseService = createMockPhaseService();
      const competitionRepository = createMockCompetitionRepository('closed');
      const service = new UploadService(logoRepository, phaseService, competitionRepository);

      await expect(
        service.createLogo(COMPETITION_ID, {
          storagePath: 'logos/abc.jpg',
          uploaderName: '山田太郎',
          memo: 'テストメモ',
        }),
      ).rejects.toThrow(ValidationError);
      expect(logoRepository.create).not.toHaveBeenCalled();
    });

    it('DB書き込みが失敗した場合、アップロード済みのStorageオブジェクトを削除する', async () => {
      const logoRepository = createMockLogoRepository();
      logoRepository.create = vi.fn().mockRejectedValue(new Error('DB接続エラー'));
      const phaseService = createMockPhaseService();
      const competitionRepository = createMockCompetitionRepository();
      const service = new UploadService(logoRepository, phaseService, competitionRepository);

      await expect(
        service.createLogo(COMPETITION_ID, {
          storagePath: 'logos/abc.jpg',
          uploaderName: '山田太郎',
          memo: 'テストメモ',
        }),
      ).rejects.toThrow('DB接続エラー');

      expect(logoRepository.deleteStorageObject).toHaveBeenCalledWith('logos/abc.jpg');
    });

    it('補償処理（Storage削除）自体が失敗しても、元のDBエラーをスローする', async () => {
      const logoRepository = createMockLogoRepository();
      logoRepository.create = vi.fn().mockRejectedValue(new Error('DB接続エラー'));
      logoRepository.deleteStorageObject = vi.fn().mockRejectedValue(new Error('Storage削除エラー'));
      const phaseService = createMockPhaseService();
      const competitionRepository = createMockCompetitionRepository();
      const service = new UploadService(logoRepository, phaseService, competitionRepository);

      await expect(
        service.createLogo(COMPETITION_ID, {
          storagePath: 'logos/abc.jpg',
          uploaderName: '山田太郎',
          memo: 'テストメモ',
        }),
      ).rejects.toThrow('DB接続エラー');
    });
  });
});
