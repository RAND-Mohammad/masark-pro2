// Shared by Node analysis and Expo: literal aliases, never nearest-name guesses.
export function normalizeSkillName(name) {
  return String(name).normalize('NFKC').toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[إأآ]/g, 'ا').replace(/[‐‑–—]/g, '-').replace(/\s+/g, ' ').trim();
}

export function createSkillMatcher(dataset) {
  const entries = new Map();
  const validIds = new Set(dataset.skills.map(skill => skill.skill_id));
  const add = (name, id) => {
    if (!validIds.has(id)) throw new Error('Alias refers to an unknown skill');
    const key = normalizeSkillName(name);
    const ids = entries.get(key) ?? new Set();
    ids.add(id);
    entries.set(key, ids);
  };
  for (const skill of dataset.skills) add(skill.name, skill.skill_id);
  for (const alias of dataset.skill_aliases ?? []) add(alias.alias, alias.skill_id);
  return name => {
    const ids = entries.get(normalizeSkillName(name));
    return ids?.size === 1 ? [...ids][0] : null;
  };
}
