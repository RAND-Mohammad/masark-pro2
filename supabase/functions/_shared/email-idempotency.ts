// Brevo requires a UUID. Derive one from the event digest so retries reuse it.
export function emailIdempotencyKey(digest: Uint8Array): string {
  const bytes = digest.slice(0, 16);
  if (bytes.length !== 16) throw new Error('Expected at least 16 digest bytes');
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
