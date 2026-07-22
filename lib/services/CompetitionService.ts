import { createUniqueSlug } from '@/lib/algorithms/generateSlug';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type { CompetitionRepository } from '@/lib/repositories/CompetitionRepository';
import type { LogoRepository } from '@/lib/repositories/LogoRepository';
import type { VoteRepository } from '@/lib/repositories/VoteRepository';
import type { Competition } from '@/lib/types/Competition';

export class CompetitionService {
  constructor(
    private competitionRepository: CompetitionRepository,
    private logoRepository: LogoRepository,
    private voteRepository: VoteRepository,
  ) {}

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

  // active（開催中）なコンペは削除できない。closedなコンペのみ、
  // 紐づくStorage画像・logos・votes（logos削除にCASCADE）・vote_locks・
  // competitions行を完全に削除する
  async remove(id: string): Promise<void> {
    const competition = await this.findById(id);
    if (competition.status === 'active') {
      throw new ValidationError('開催中のコンペは削除できません', 'status');
    }

    const logos = await this.logoRepository.findAllByCompetitionId(id);
    await Promise.all(
      logos.map((logo) => this.logoRepository.deleteStorageObject(logo.imageUrl.split('/').pop()!)),
    );
    await this.logoRepository.deleteAllByCompetitionId(id);
    await this.voteRepository.deleteLocksByCompetitionId(id);
    await this.competitionRepository.delete(id);
  }
}
