import type { MarketJob } from './jobs-api';
export type JobDigest = Record<string, string>;
export function jobDigest(jobs: MarketJob[]): JobDigest {
  return Object.fromEntries(jobs.slice(0, 250).map(job => {
    const text = `${job.title}\n${job.employer}\n${job.description}\n${job.applyUrl}`;
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    return [job.id, (hash >>> 0).toString(16)];
  }));
}
export function compareJobDigests(before: JobDigest, after: JobDigest) {
  return { added: Object.keys(after).filter(id => !Object.hasOwn(before, id)), changed: Object.keys(after).filter(id => Object.hasOwn(before, id) && before[id] !== after[id]) };
}
