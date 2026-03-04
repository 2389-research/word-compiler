export function hashFingerprint(category: string, focus: string): string {
  const input = `${category}:${focus.slice(0, 50)}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}
