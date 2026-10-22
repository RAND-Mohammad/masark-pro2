import * as SecureStore from 'expo-secure-store';

type Manifest = { generation: string; count: number };
let pending: Promise<unknown> = Promise.resolve();
function serialize<T>(action: () => Promise<T>): Promise<T> {
  const result = pending.then(action);
  pending = result.catch(() => undefined);
  return result;
}
function safeKey(key: string) { return `masarak-auth.${key.replace(/[^a-zA-Z0-9._-]/g, '_')}`; }
async function readManifest(key: string): Promise<Manifest | null> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;
  const manifest: Manifest = JSON.parse(raw);
  if (!manifest || !/^[a-z0-9-]+$/.test(manifest.generation) || !Number.isInteger(manifest.count) || manifest.count < 1 || manifest.count > 500) throw new Error('Invalid saved session');
  return manifest;
}
async function cleanup(key: string, manifest: Manifest | null) {
  if (!manifest) return;
  await Promise.all(Array.from({ length: manifest.count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${manifest.generation}.${i}`).catch(() => {})));
}
export const authStorage = {
  getItem(key: string): Promise<string | null> {
    return serialize(async () => {
      const base = safeKey(key);
      const manifest = await readManifest(base);
      if (!manifest) return null;
      const chunks = await Promise.all(Array.from({ length: manifest.count }, (_, i) => SecureStore.getItemAsync(`${base}.${manifest.generation}.${i}`)));
      if (chunks.some(chunk => chunk === null)) throw new Error('Saved session is incomplete');
      return chunks.join('');
    });
  },
  setItem(key: string, value: string): Promise<void> {
    return serialize(async () => {
      const base = safeKey(key);
      const old = await readManifest(base);
      // Preserve Unicode code points; each chunk is <= 1800 UTF-8 bytes.
      const characters = Array.from(value);
      const chunks: string[] = [];
      for (let i = 0; i < characters.length; i += 450) chunks.push(characters.slice(i, i + 450).join(''));
      if (!chunks.length) chunks.push('');
      if (chunks.length > 500) throw new Error('Session is too large');
      const next = { generation: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, count: chunks.length };
      try {
        for (let i = 0; i < chunks.length; i++) await SecureStore.setItemAsync(`${base}.${next.generation}.${i}`, chunks[i]);
        await SecureStore.setItemAsync(base, JSON.stringify(next));
      } catch (error) { await cleanup(base, next); throw error; }
      await cleanup(base, old);
    });
  },
  removeItem(key: string): Promise<void> {
    return serialize(async () => {
      const base = safeKey(key);
      const old = await readManifest(base);
      await SecureStore.deleteItemAsync(base);
      await cleanup(base, old);
    });
  },
};
