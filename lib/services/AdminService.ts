import { SignJWT, jwtVerify } from 'jose';
import { rankWithTieDetection } from '@/lib/algorithms/rankWithTieDetection';
import { NotFoundError, UnauthorizedError, ValidationError } from '@/lib/errors';
import type { CompetitionRepository } from '@/lib/repositories/CompetitionRepository';
import type { LogoRepository } from '@/lib/repositories/LogoRepository';
import type { RunoffRoundRepository } from '@/lib/repositories/RunoffRoundRepository';
import type { VoteRepository } from '@/lib/repositories/VoteRepository';
import type { EventPhase } from '@/lib/types/Competition';
import type { RankedLogo } from '@/lib/types/RankedLogo';
import { FINAL_VOTE_ROUND } from '@/lib/types/Vote';
import type { PhaseService } from '@/lib/services/PhaseService';

// 対象Logo群の中で最多得票が複数件並ぶ場合、その同着グループのIDを返す（同着が無ければ空配列）
function findTiedTopLogoIds(logoIds: string[], voteCounts: Record<string, number>): string[] {
  const counted = logoIds.map((id) => ({ id, voteCount: voteCounts[id] ?? 0 }));
  const topVoteCount = Math.max(0, ...counted.map((c) => c.voteCount));
  const tied = counted.filter((c) => c.voteCount === topVoteCount);
  return tied.length > 1 ? tied.map((c) => c.id) : [];
}

export interface VoteTimelineEntry {
  logoId: string;
  votedAt: Date;
}

export interface DashboardStats {
  submissionCount: number;
  submissions: Array<{
    id: string;
    imageUrl: string;
    uploaderName: string;
    memo: string;
    createdAt: Date;
  }>;
  voterCount: number;
  totalVotes: number;
}

const JWT_EXPIRATION = '4h';

function getSessionSecret(): Uint8Array {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET環境変数が設定されていません');
  }
  return new TextEncoder().encode(secret);
}

// Excel/Google Sheets等でCSVを開いた際、先頭が=+-@の値が数式として実行される
// 「CSVインジェクション」を防ぐため、該当する場合は先頭にタブを付与し文字列として扱わせる
function sanitizeCsvFormula(value: string): string {
  return /^[=+\-@]/.test(value) ? `\t${value}` : value;
}

function toCsvField(value: string | number): string {
  const stringValue = sanitizeCsvFormula(String(value));
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export class AdminService {
  constructor(
    private logoRepository: LogoRepository,
    private voteRepository: VoteRepository,
    private phaseService: PhaseService,
    private competitionRepository: CompetitionRepository,
    private runoffRoundRepository: RunoffRoundRepository,
  ) {}

  async login(password: string): Promise<{ token: string }> {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || password !== adminPassword) {
      throw new UnauthorizedError();
    }

    const token = await new SignJWT({ role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(JWT_EXPIRATION)
      .sign(getSessionSecret());

    return { token };
  }

  async verifySession(token: string | undefined): Promise<void> {
    if (!token) {
      throw new UnauthorizedError();
    }

    try {
      await jwtVerify(token, getSessionSecret());
    } catch {
      throw new UnauthorizedError();
    }
  }

  async setPhase(competitionId: string, phase: EventPhase): Promise<void> {
    await this.phaseService.transitionTo(competitionId, phase);
  }

  async getRankedResults(competitionId: string): Promise<RankedLogo[]> {
    await this.phaseService.assertPhaseAtLeast(competitionId, 'results');

    const [logos, voteCounts, runoffRounds] = await Promise.all([
      this.logoRepository.findAllByCompetitionId(competitionId),
      this.voteRepository.countByLogoId(competitionId, FINAL_VOTE_ROUND),
      this.runoffRoundRepository.findAllByCompetitionId(competitionId),
    ]);

    const logosWithVoteCount = logos.map((logo) => ({
      ...logo,
      voteCount: voteCounts[logo.id] ?? 0,
    }));

    // round1の得票数を基本順位とし、ランオフ各ラウンドの結果で同着グループの内部順序のみを
    // 上書きしていく（ラウンドの対象外Logoの順位には影響しない）
    let ordered: RankedLogo[] = rankWithTieDetection(logosWithVoteCount).sort(
      (a, b) => a.rank - b.rank,
    );

    for (const round of runoffRounds) {
      if (round.resolution === 'joint_winner') {
        ordered = ordered.map((logo) =>
          round.logoIds.includes(logo.id)
            ? { ...logo, isJointWinner: true, isTiedForRunoff: false }
            : logo,
        );
        break;
      }

      const roundVoteCounts = await this.voteRepository.countByLogoId(competitionId, round.round);
      const targetIds = new Set(round.logoIds);
      const targetOrder = round.logoIds
        .map((id) => ({ id, voteCount: roundVoteCounts[id] ?? 0 }))
        .sort((a, b) => b.voteCount - a.voteCount);
      const stillTied =
        targetOrder.length > 1 && targetOrder[0].voteCount === targetOrder[1].voteCount;
      const targetRankIndex = new Map(targetOrder.map((entry, index) => [entry.id, index]));

      const reorderedTargets = ordered
        .filter((logo) => targetIds.has(logo.id))
        .sort((a, b) => (targetRankIndex.get(a.id) ?? 0) - (targetRankIndex.get(b.id) ?? 0))
        .map((logo, index) => ({ ...logo, isTiedForRunoff: index === 0 && stillTied }));

      let cursor = 0;
      ordered = ordered.map((logo) => (targetIds.has(logo.id) ? reorderedTargets[cursor++] : logo));
    }

    return ordered.map((logo, index) => ({ ...logo, rank: index + 1 }));
  }

  // resultsフェーズで同着が検出された場合、または直近のランオフラウンドが締切済みで
  // まだ同着が続いている場合に、新しいランオフラウンドを開始する
  async startRunoff(competitionId: string): Promise<void> {
    const competition = await this.competitionRepository.findById(competitionId);
    if (!competition) {
      throw new NotFoundError('指定されたコンペが見つかりません');
    }

    if (competition.currentPhase === 'results') {
      const results = await this.getRankedResults(competitionId);
      const tiedLogoIds = results.filter((logo) => logo.isTiedForRunoff).map((logo) => logo.id);
      if (tiedLogoIds.length === 0) {
        throw new ValidationError('同着が無いため、ランオフを開始できません', 'phase');
      }

      await this.phaseService.transitionTo(competitionId, 'runoff');
      const nextRound = 2;
      await this.runoffRoundRepository.createRound(competitionId, nextRound, tiedLogoIds);
      await this.competitionRepository.updateRunoffRound(competitionId, nextRound);
      return;
    }

    if (competition.currentPhase === 'runoff' && competition.runoffRound === null) {
      const latestRound = await this.runoffRoundRepository.findLatestRound(competitionId);
      if (!latestRound || latestRound.resolution !== null) {
        throw new ValidationError('再投票を開始できる状態ではありません', 'phase');
      }

      const voteCounts = await this.voteRepository.countByLogoId(competitionId, latestRound.round);
      const stillTiedLogoIds = findTiedTopLogoIds(latestRound.logoIds, voteCounts);
      if (stillTiedLogoIds.length === 0) {
        throw new ValidationError('同着が解消しているため、再投票を開始できません', 'phase');
      }

      const nextRound = latestRound.round + 1;
      await this.runoffRoundRepository.createRound(competitionId, nextRound, stillTiedLogoIds);
      await this.competitionRepository.updateRunoffRound(competitionId, nextRound);
      return;
    }

    throw new ValidationError('ランオフを開始できる状態ではありません', 'phase');
  }

  // 現在受付中のランオフラウンドの投票を締め切り、同着が解消したかどうかを返す
  async closeRunoff(competitionId: string): Promise<{ resolved: boolean }> {
    const competition = await this.competitionRepository.findById(competitionId);
    if (!competition) {
      throw new NotFoundError('指定されたコンペが見つかりません');
    }
    if (competition.currentPhase !== 'runoff' || competition.runoffRound === null) {
      throw new ValidationError('締め切れるランオフ投票がありません', 'phase');
    }

    const round = competition.runoffRound;
    const latestRound = await this.runoffRoundRepository.findLatestRound(competitionId);
    await this.competitionRepository.updateRunoffRound(competitionId, null);

    if (!latestRound || latestRound.round !== round) {
      return { resolved: true };
    }

    const voteCounts = await this.voteRepository.countByLogoId(competitionId, round);
    const stillTiedLogoIds = findTiedTopLogoIds(latestRound.logoIds, voteCounts);
    return { resolved: stillTiedLogoIds.length === 0 };
  }

  // ランオフでも同着が解消しない場合に、運営が対象を同順位のまま確定させる
  async resolveRunoffAsJointWinner(competitionId: string): Promise<void> {
    const competition = await this.competitionRepository.findById(competitionId);
    if (!competition) {
      throw new NotFoundError('指定されたコンペが見つかりません');
    }
    if (competition.currentPhase !== 'runoff' || competition.runoffRound !== null) {
      throw new ValidationError('同率優勝を確定できる状態ではありません', 'phase');
    }

    const latestRound = await this.runoffRoundRepository.findLatestRound(competitionId);
    if (!latestRound) {
      throw new ValidationError('対象のランオフラウンドが見つかりません', 'phase');
    }

    await this.runoffRoundRepository.resolveAsJointWinner(competitionId, latestRound.round);
  }

  async getDashboardStats(competitionId: string): Promise<DashboardStats> {
    const [logos, voterCount, totalVotes] = await Promise.all([
      this.logoRepository.findAllByCompetitionId(competitionId),
      this.voteRepository.countVoters(competitionId),
      this.voteRepository.countTotal(competitionId),
    ]);

    return {
      submissionCount: logos.length,
      submissions: logos.map((logo) => ({
        id: logo.id,
        imageUrl: logo.imageUrl,
        uploaderName: logo.uploaderName,
        memo: logo.memo,
        createdAt: logo.createdAt,
      })),
      voterCount,
      totalVotes,
    };
  }

  async getVoteTimeline(competitionId: string): Promise<VoteTimelineEntry[]> {
    await this.phaseService.assertPhaseAtLeast(competitionId, 'results');

    const votes = await this.voteRepository.findAllByCompetitionId(competitionId);
    return votes.map((vote) => ({ logoId: vote.logoId, votedAt: vote.createdAt }));
  }

  async exportResultsCsv(competitionId: string): Promise<string> {
    const results = await this.getRankedResults(competitionId);

    const header = 'rank,imageUrl,uploaderName,memo,voteCount';
    const rows = results.map((logo) =>
      [logo.rank, logo.imageUrl, logo.uploaderName, logo.memo, logo.voteCount]
        .map(toCsvField)
        .join(','),
    );

    return [header, ...rows].join('\n');
  }
}
