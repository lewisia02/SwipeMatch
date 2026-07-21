import { createUniqueSlug } from '@/lib/algorithms/generateSlug';
import { NotFoundError } from '@/lib/errors';
import type { CompetitionRepository } from '@/lib/repositories/CompetitionRepository';
import type { Competition } from '@/lib/types/Competition';

export class CompetitionService {
  constructor(private competitionRepository: CompetitionRepository) {}

  // 既存activeコンペを自動クローズしてから新規コンペを作成する。
  // 両者は別々のDB呼び出しだが、status='active'の部分ユニークインデックスにより
  // 常に0件または1件のactiveしか存在し得ないため、途中失敗してもデータ不整合は生じない
  // （closeActiveのみ成功した場合はactiveが0件になるだけで、再度activateすれば復帰できる）
  async activate(title: string): Promise<Competition> {
    const slug = await createUniqueSlug(this.competitionRepository);
    await this.competitionRepository.closeActive();
    return this.competitionRepository.create({ slug, title });
  }

  async findBySlug(slug: string): Promise<Competition> {
    const competition = await this.competitionRepository.findBySlug(slug);
    if (!competition) {
      throw new NotFoundError('指定されたコンペが見つかりません');
    }
    return competition;
  }

  async findById(id: string): Promise<Competition> {
    const competition = await this.competitionRepository.findById(id);
    if (!competition) {
      throw new NotFoundError('指定されたコンペが見つかりません');
    }
    return competition;
  }

  async findActive(): Promise<Competition | null> {
    return this.competitionRepository.findActive();
  }

  async listAll(): Promise<Competition[]> {
    return this.competitionRepository.findAll();
  }
}
