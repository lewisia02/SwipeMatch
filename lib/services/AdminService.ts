import { SignJWT, jwtVerify } from 'jose';
import { rankWithTieDetection } from '@/lib/algorithms/rankWithTieDetection';
import { UnauthorizedError } from '@/lib/errors';
import type { LogoRepository } from '@/lib/repositories/LogoRepository';
import type { VoteRepository } from '@/lib/repositories/VoteRepository';
import type { EventPhase } from '@/lib/types/AppSettings';
import type { RankedLogo } from '@/lib/types/RankedLogo';
import type { PhaseService } from '@/lib/services/PhaseService';

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

  async setPhase(phase: EventPhase): Promise<void> {
    await this.phaseService.transitionTo(phase);
  }

  async getRankedResults(): Promise<RankedLogo[]> {
    await this.phaseService.assertPhase('results');

    const [logos, voteCounts] = await Promise.all([
      this.logoRepository.findAll(),
      this.voteRepository.countByLogoId(),
    ]);

    const logosWithVoteCount = logos.map((logo) => ({
      ...logo,
      voteCount: voteCounts[logo.id] ?? 0,
    }));

    return rankWithTieDetection(logosWithVoteCount);
  }

  async exportResultsCsv(): Promise<string> {
    const results = await this.getRankedResults();

    const header = 'rank,imageUrl,uploaderName,memo,voteCount';
    const rows = results.map((logo) =>
      [logo.rank, logo.imageUrl, logo.uploaderName, logo.memo, logo.voteCount]
        .map(toCsvField)
        .join(','),
    );

    return [header, ...rows].join('\n');
  }
}
