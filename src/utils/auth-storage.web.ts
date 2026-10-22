export const authStorage = {
  async getItem(key: string): Promise<string | null> { return typeof window === 'undefined' ? null : window.localStorage.getItem(`masarak-auth.${key}`); },
  async setItem(key: string, value: string): Promise<void> { if (typeof window !== 'undefined') window.localStorage.setItem(`masarak-auth.${key}`, value); },
  async removeItem(key: string): Promise<void> { if (typeof window !== 'undefined') window.localStorage.removeItem(`masarak-auth.${key}`); },
};
