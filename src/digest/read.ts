import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, NightCounts, ReadNight, RunStatus } from './types.js';

type RunLine = { at: string; job: string; status: RunStatus; owner: string | null; error: string | null };

const statuses: RunStatus[] = ['ok', 'retry', 'fail'];

function parseLine(line: string): RunLine | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;

  const line_ = value as Record<string, unknown>;
  if (typeof line_.at !== 'string' || typeof line_.job !== 'string') return null;
  if (typeof line_.status !== 'string' || !statuses.includes(line_.status as RunStatus)) return null;

  return {
    at: line_.at,
    job: line_.job,
    status: line_.status as RunStatus,
    owner: typeof line_.owner === 'string' ? line_.owner : null,
    error: typeof line_.error === 'string' ? line_.error : null,
  };
}

function byTime(a: { run: RunLine; at: number }, b: { run: RunLine; at: number }): number {
  return a.run.at === b.run.at ? a.at - b.at : a.run.at < b.run.at ? -1 : 1;
}

function row(job: string, lines: RunLine[]): DigestRow {
  const ordered = lines.map((run, at) => ({ run, at })).sort(byTime).map(({ run }) => run);
  const newest = ordered[ordered.length - 1];

  return {
    job,
    owner: ordered.filter((l) => l.owner !== null).pop()?.owner ?? null,
    runs: ordered.length,
    retries: ordered.filter((l) => l.status === 'retry').length,
    lastStatus: newest.status,
    lastError: ordered.filter((l) => l.error !== null).pop()?.error ?? null,
    first: ordered[0].at,
    last: newest.at,
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }

  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  const byJob = new Map<string, RunLine[]>();
  let badLines = 0;

  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const parsed = parseLine(line);
    if (!parsed) {
      badLines += 1;
      continue;
    }
    counts[parsed.status] += 1;
    const lines = byJob.get(parsed.job);
    if (lines) lines.push(parsed);
    else byJob.set(parsed.job, [parsed]);
  }

  const rows = [...byJob.entries()].map(([job, lines]) => row(job, lines)).sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));

  return { night, rows, counts, badLines };
};
