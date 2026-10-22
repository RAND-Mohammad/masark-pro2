export function normalizeSkillName(name: string): string;
export function createSkillMatcher(dataset: { skills: { skill_id: string; name: string }[]; skill_aliases?: { alias: string; skill_id: string }[] }): (name: string) => string | null;
