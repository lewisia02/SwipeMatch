'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CORRECTION_PHRASES = [
  '違います',
  'そうではなく',
  '前にも言いました',
  '勝手に変更しないでください',
  'まだできていません',
  'これも必要です',
  '元に戻してください',
  '意図と違います',
];

function containsCorrectionPhrase(text) {
  return CORRECTION_PHRASES.some((phrase) => text.includes(phrase));
}

function createEmptyRecord(sessionId) {
  return {
    session_id: sessionId || null,
    recorded_at: new Date().toISOString(),
    skills_used: [],
    tokens: { input: 0, output: 0, cache_creation: 0, cache_read: 0, total: 0 },
    tool_calls: { total: 0, by_name: {} },
    tool_errors: 0,
    user_correction_suspected: false,
  };
}

function applyAssistantLine(record, line) {
  const content = line.message && line.message.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block && block.type === 'tool_use') {
        record.tool_calls.total += 1;
        const name = block.name || 'unknown';
        record.tool_calls.by_name[name] = (record.tool_calls.by_name[name] || 0) + 1;
        if (name === 'Skill' && block.input && typeof block.input.skill === 'string') {
          if (!record.skills_used.includes(block.input.skill)) {
            record.skills_used.push(block.input.skill);
          }
        }
      }
    }
  }
  const usage = line.message && line.message.usage;
  if (usage) {
    record.tokens.input += usage.input_tokens || 0;
    record.tokens.output += usage.output_tokens || 0;
    record.tokens.cache_creation += usage.cache_creation_input_tokens || 0;
    record.tokens.cache_read += usage.cache_read_input_tokens || 0;
  }
}

function applyUserLine(record, line) {
  const content = line.message && line.message.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (!block) continue;
      if (block.type === 'tool_result' && block.is_error) {
        record.tool_errors += 1;
      }
      if (block.type === 'text' && typeof block.text === 'string') {
        if (containsCorrectionPhrase(block.text)) {
          record.user_correction_suspected = true;
        }
      }
    }
  } else if (typeof content === 'string') {
    if (containsCorrectionPhrase(content)) {
      record.user_correction_suspected = true;
    }
  }
}

function finalizeRecord(record) {
  record.tokens.total =
    record.tokens.input + record.tokens.output + record.tokens.cache_creation + record.tokens.cache_read;
  return record;
}

function analyzeTranscript(transcriptPath, sessionId, onDone) {
  const record = createEmptyRecord(sessionId);
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    onDone(finalizeRecord(record));
    return;
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(transcriptPath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  rl.on('line', (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    let line;
    try {
      line = JSON.parse(trimmed);
    } catch (err) {
      return; // 壊れた行はスキップし、集計を継続する
    }
    if (line.type === 'assistant') {
      applyAssistantLine(record, line);
    } else if (line.type === 'user') {
      applyUserLine(record, line);
    }
  });

  rl.on('close', () => onDone(finalizeRecord(record)));
  rl.on('error', () => onDone(finalizeRecord(record)));
}

function appendRecord(record) {
  const logPath = path.join(__dirname, '..', 'skill-usage.jsonl');
  fs.appendFileSync(logPath, JSON.stringify(record) + '\n', 'utf-8');
}

function run(transcriptPath, sessionId) {
  analyzeTranscript(transcriptPath, sessionId, (record) => {
    try {
      appendRecord(record);
    } catch (err) {
      process.stderr.write('record-skill-usage: failed to write log: ' + err.message + '\n');
    }
  });
}

function main() {
  // CLI引数でtranscriptパスが直接指定された場合は手動検証モードとして扱う
  const argPath = process.argv[2];
  if (argPath) {
    const sessionId = process.argv[3] || path.basename(argPath, path.extname(argPath));
    run(argPath, sessionId);
    return;
  }

  // Hookモード: Claude CodeがStdin経由で渡すJSONペイロードを受け取る
  let input = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk) => {
    input += chunk;
  });
  process.stdin.on('end', () => {
    try {
      const payload = input.trim() ? JSON.parse(input) : {};
      const transcriptPath = payload.transcript_path;
      const sessionId = payload.session_id || null;
      if (!transcriptPath) return;
      run(transcriptPath, sessionId);
    } catch (err) {
      process.stderr.write('record-skill-usage: failed to parse hook payload: ' + err.message + '\n');
    }
  });
  process.stdin.on('error', () => {
    // stdinが利用できない場合は何もせず終了する
  });
}

process.on('uncaughtException', (err) => {
  process.stderr.write('record-skill-usage: uncaught exception: ' + err.message + '\n');
  process.exit(0);
});

main();
