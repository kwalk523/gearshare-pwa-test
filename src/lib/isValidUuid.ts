export default function isValidUuid(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  // Basic UUID v4/v1 pattern (36 chars including hyphens)
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
}
