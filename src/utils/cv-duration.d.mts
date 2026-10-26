export function experienceDuration(dates: string, analyzedAt?: string): { months: number; years: number; remainderMonths: number; approximate: boolean; ongoing: boolean; asOf: string } | null;
export function describeExperienceDuration(dates: string, analyzedAt?: string): string;
export function experienceInterval(dates: string, analyzedAt?: string): { startMonth: number; endMonth: number; approximate: boolean; ongoing: boolean; asOf: string } | null;
