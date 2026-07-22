/** @deprecated Legacy analyzer module retained for compatibility only. Do not import in production runtime. */

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['"`]/g, "")
    .replace(/[()[\]{}]/g, " ")
    .replace(/[:.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}