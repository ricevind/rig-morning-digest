export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  first: string;
  last: string;
};

export type NightCounts = { ok: number; retry: number; fail: number };

export type Night = {
  night: string;
  rows: DigestRow[];
  counts: NightCounts;
  badLines: number;
};

export type ReadNight = (runsDir: string, night: string) => Night | null;
