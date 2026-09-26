import type { ZarvisExpression } from "./types";

/** Cosmetic choices only: no model call, tool selection, or response content changes. */
export function answerExpression(question: string): ZarvisExpression {
  const topic = question.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (/privacy|privacidade|security|seguranca|shielded|blindad[oa]|viewing key|private key|seed phrase|chave privada/.test(topic)) return "protecting";
  if (/\bzip\b|documentation|documentacao|tutorial|\bguide\b|\bguia\b|\bdocs\b/.test(topic)) return "reading";
  if (/ecosystem|ecossistema|\bprojects\b|\bprojetos\b|\bwallets\b|\bcarteiras\b/.test(topic)) return "exploring";
  return "explaining";
}

/** Source-checking poses reflect status events actually emitted by the server. */
export function progressExpression(progress: string): ZarvisExpression {
  if (progress === "Checking Zcash sources…") return "exploring";
  if (progress === "Reading public OpenZcash records…") return "reading";
  return "thinking";
}
