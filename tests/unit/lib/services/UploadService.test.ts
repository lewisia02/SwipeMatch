import { describe, expect, it, vi } from 'vitest';
import { PhaseMismatchError } from '@/lib/errors';
import type { LogoRepository } from '@/lib/repositories/LogoRepository';
import type { PhaseService } from '@/lib/services/PhaseService';
import { UploadService } from '@/lib/services/UploadService';

function createMockLogoRepository() {
  return {
    create: vi.fn().mockResolvedValue({
      id: 'logo-1',
      imageUrl: 'https://example.com/logo-1.jpg',
      uploaderName: '山田太郎',
      memo: 'テストメモ',
      createdAt: new Date(),
    }),
    findAll: vi.fn(),
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

describe('UploadService', () => {
  describe('createUploadUrl', () => {
    it('submissionフェーズの場合、署名付きURLを発行する', async () => {
      const logoRepository = createMockLogoRepository();
      const phaseService = createMockPhaseService();
      const service = new UploadService(logoRepository, phaseService);

      const result = await service.createUploadUrl('image/jpeg');

      expect(result.storagePath).toBe('logos/abc.jpg');
      expect(logoRepository.createSignedUploadUrl).toHaveBeenCalledWith('image/jpeg');
    });

    it('submissionフェーズでない場合、PhaseMismatchErrorをスローする', async () => {
      const logoRepository = createMockLogoRepository();
      const phaseService = createMockPhaseService(true);
      const service = new UploadService(logoRepository, phaseService);

      await expect(service.createUploadUrl('image/jpeg')).rejects.toThrow(PhaseMismatchError);
      expect(logoRepository.createSignedUploadUrl).not.toHaveBeenCalled();
    });
  });

  describe('createLogo', () => {
    it('正常なデータでLogoレコードを作成できる', async () => {
      const logoRepository = createMockLogoRepository();
      const phaseService = createMockPhaseService();
      const service = new UploadService(logoRepository, phaseService);

      const result = await service.createLogo({
        storagePath: 'logos/abc.jpg',
        uploaderName: '山田太郎',
        memo: 'テストメモ',
      });

      expect(result.id).toBe('logo-1');
      expect(logoRepository.deleteStorageObject).not.toHaveBeenCalled();
    });

    it('DB書き込みが失敗した場合、アップロード済みのStorageオブジェクトを削除する', async () => {
      const logoRepository = createMockLogoRepository();
      logoRepository.create = vi.fn().mockRejectedValue(new Error('DB接続エラー'));
      const phaseService = createMockPhaseService();
      const service = new UploadService(logoRepository, phaseService);

      await expect(
        service.createLogo({
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
      const service = new UploadService(logoRepository, phaseService);

      await expect(
        service.createLogo({
          storagePath: 'logos/abc.jpg',
          uploaderName: '山田太郎',
          memo: 'テストメモ',
        }),
      ).rejects.toThrow('DB接続エラー');
    });
  });
});
