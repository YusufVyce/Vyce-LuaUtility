import { CodeLanguage, Platform } from "./types";
import { detectPlatform as detectPlatformHint } from "@/lib/error-parser";

const LUA_HINTS = [/\blocal\b/, /task\./, /:Connect\(/, /PlayerAdded/, /game\./];
const CS_HINTS = [/\busing\s+UnityEngine\b/, /MonoBehaviour/, /void\s+Start\(/, /GetComponent<|GetComponent\(/];
const JS_HINTS = [/\bawait\b/, /\basync\b/, /require\(/, /module\.exports/, /import\s+.*from/];
const JAVA_HINTS = [/\bimport\s+org\.bukkit\./, /\bclass\b/, /public\s+void\s+onPlayerInteract\(/, /NullPointerException/];

export function detectCodeLanguage(codeText: string): CodeLanguage {
  const text = codeText.toLowerCase();
  const score = {
    lua: LUA_HINTS.reduce((sum, re) => sum + (re.test(text) ? 1 : 0), 0),
    cs: CS_HINTS.reduce((sum, re) => sum + (re.test(text) ? 1 : 0), 0),
    js: JS_HINTS.reduce((sum, re) => sum + (re.test(text) ? 1 : 0), 0),
    java: JAVA_HINTS.reduce((sum, re) => sum + (re.test(text) ? 1 : 0), 0),
  };

  const winner = Object.entries(score).reduce(
    (best, entry) => (entry[1] > best[1] ? { lang: entry[0] as CodeLanguage, score: entry[1] } : best),
    { lang: "unknown" as CodeLanguage, score: 0 },
  );

  return winner.score > 0 ? winner.lang : "unknown";
}

export function resolvePlatform(
  logText: string,
  codeText: string,
  platformFilter?: Platform | "auto",
): Platform | undefined {
  if (platformFilter && platformFilter !== "auto") {
    return platformFilter;
  }
  return detectPlatformHint(`${logText}\n${codeText}`) ?? undefined;
}
