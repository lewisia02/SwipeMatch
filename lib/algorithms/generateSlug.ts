import { randomBytes } from 'crypto';
import type { CompetitionRepository } from '@/lib/repositories/CompetitionRepository';

const MAX_RETRIES = 5;

/**
 * コンペ専用URL（/c/{slug}）用の、暗号学的乱数による英数字8文字のslugを生成する
 */
export function generateSlug(): string {
  return randomBytes(6).toString('base64url').slice(0, 8);
}

/**
 * 既存slugと衝突しないslugを生成する。衝突時は最大5回までリトライする
 * （コンペ開催は低頻度の管理者操作のため、衝突時の再試行コストは問題にならない）
 */
export async function createUniqueSlug(repository: CompetitionRepository): Promise<string> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    const slug = generateSlug();
    if (!(await repository.findBySlug(slug))) {
      return slug;
    }
  }
  throw new Error('スラッグの生成に失敗しました');
}
