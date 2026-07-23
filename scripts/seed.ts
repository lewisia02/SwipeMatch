// ローカル開発用のテストデータ投入スクリプト。
// 新規コンペを1件作成し、投稿・決選投票（round=1）を投入したうえで
// 「1位が同着」の状態でresultsフェーズまで進める（同着1位＝ランオフ対象）。
// そこから先（ランオフの開始・投票・締切・結果確認）は管理者画面・参加者画面から
// 実際に操作して動作確認できるようにするため、あえて自動投入しない。
//
// 実行方法: npm run seed
import { randomBytes, randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name}環境変数が設定されていません（.env.localを確認してください）`);
  }
  return value;
}

const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'));

function generateSlug(): string {
  return randomBytes(6).toString('base64url').slice(0, 8);
}

const LOGOS = [
  { uploaderName: '山田太郎', memo: 'シンプルさを大切にしました' },
  { uploaderName: '佐藤花子', memo: '会社のカラーを意識しました' },
  { uploaderName: '鈴木一郎', memo: '手書き風のロゴです' },
  { uploaderName: '田中次郎', memo: 'ミニマルなデザインです' },
  { uploaderName: '高橋三郎', memo: 'カラフルに仕上げました' },
];

// 各行が1人の投票者の決選投票（最大3件まで選択可能）。logo_idではなくLOGOSのindexで指定する。
// 集計するとlogo-0とlogo-1が5票ずつで1位同着になる（logo-2は4票で3位、logo-3/4は2票ずつ）
const ROUND1_BALLOTS = [
  [0, 1, 2],
  [0, 1, 3],
  [0, 1, 4],
  [0, 2, 3],
  [1, 2, 4],
  [0, 1, 2],
];

async function updatePhase(competitionId: string, phase: string): Promise<void> {
  const { error } = await supabase
    .from('competitions')
    .update({ current_phase: phase })
    .eq('id', competitionId);
  if (error) {
    throw new Error(`フェーズ更新に失敗しました: ${error.message}`);
  }
}

async function main(): Promise<void> {
  console.log('=== テストデータ投入を開始します ===');

  const { error: closeError } = await supabase
    .from('competitions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('status', 'active');
  if (closeError) {
    throw new Error(`既存コンペのクローズに失敗しました: ${closeError.message}`);
  }

  const slug = generateSlug();
  const title = `テストコンペ ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
  const { data: competition, error: competitionError } = await supabase
    .from('competitions')
    .insert({ slug, title, status: 'active', current_phase: 'submission' })
    .select()
    .single();
  if (competitionError || !competition) {
    throw new Error(`コンペの作成に失敗しました: ${competitionError?.message}`);
  }
  console.log(`コンペを作成しました: ${title}（slug: ${slug}）`);

  const { data: logoRows, error: logoError } = await supabase
    .from('logos')
    .insert(
      LOGOS.map((logo, index) => ({
        competition_id: competition.id,
        // Storageを使わず外部のダミー画像URLを直接設定する（テストデータのため実アップロードは不要）
        image_url: `https://picsum.photos/seed/swipematch-${slug}-${index}/600/400`,
        uploader_name: logo.uploaderName,
        memo: logo.memo,
      })),
    )
    .select();
  if (logoError || !logoRows) {
    throw new Error(`投稿の作成に失敗しました: ${logoError?.message}`);
  }
  console.log(`投稿を${logoRows.length}件作成しました`);

  await updatePhase(competition.id, 'voting');
  console.log('フェーズを voting に切り替えました');

  for (let voterIndex = 0; voterIndex < ROUND1_BALLOTS.length; voterIndex++) {
    const anonId = `seed-voter-${voterIndex + 1}-${randomUUID().slice(0, 8)}`;
    const ballot = ROUND1_BALLOTS[voterIndex].map((logoIndex) => logoRows[logoIndex].id as string);

    const { error: lockError } = await supabase
      .from('vote_locks')
      .insert({ competition_id: competition.id, voter_anon_id: anonId, round: 1 });
    if (lockError) {
      throw new Error(`投票予約の作成に失敗しました: ${lockError.message}`);
    }

    const { error: voteError } = await supabase.from('votes').insert(
      ballot.map((logoId) => ({
        competition_id: competition.id,
        logo_id: logoId,
        voter_anon_id: anonId,
        round: 1,
      })),
    );
    if (voteError) {
      throw new Error(`投票の作成に失敗しました: ${voteError.message}`);
    }
  }
  console.log(`決選投票を${ROUND1_BALLOTS.length}人分投入しました（1位が同着になるよう調整済み）`);

  await updatePhase(competition.id, 'results');
  console.log('フェーズを results に切り替えました（同着1位が発生した状態）');

  console.log('=== 完了 ===');
  console.log(`参加者ページ: http://localhost:3000/c/${slug}`);
  console.log(`管理者ページ: http://localhost:3000/admin/competitions/${competition.id}`);
  console.log('管理者ページで「ランオフを開始」を操作すると、続きを手動で確認できます');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
