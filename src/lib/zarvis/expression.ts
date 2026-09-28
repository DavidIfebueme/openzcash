import type { ZarvisExpression } from "./types";

/** Cosmetic choices only: no model call, tool selection, or response content changes. */
export function answerExpression(question: string): ZarvisExpression {
  const topic = question.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (/compar|versus|trade.?off|sensitivity|sensibilidade|scenario|cenario/.test(topic)) return "comparing";
  if (/privacy|privacidade|security|seguranca|shielded|blindad[oa]|viewing key|private key|seed phrase|chave privada/.test(topic)) return "protecting";
  if (/\bzip\b|documentation|documentacao|tutorial|\bguide\b|\bguia\b|\bdocs\b/.test(topic)) return "reading";
  if (/ecosystem|ecossistema|\bprojects\b|\bprojetos\b|\bwallets\b|\bcarteiras\b/.test(topic)) return "exploring";
  return "explaining";
}

/** Source-checking poses reflect status events actually emitted by the server. */
export function progressExpression(progress: string): ZarvisExpression {
  if (progress === "Checking Zcash sources…") return "exploring";
  if (progress === "Reading public OpenZcash records…") return "reading";
  if (progress === "Writing and checking the answer…") return "explaining";
  if (progress === "Analyzing the scenario…") return "comparing";
  return "thinking";
}

/** The finished text can be limited or ask for clarification; completion is never a celebration. */
export function completionExpression(question: string, answer: string): ZarvisExpression {
  const text = answer.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (/could not|cannot (?:verify|confirm|establish|validate)|unable to|not enough (?:data|evidence)|insufficient evidence|nao (?:consegui|posso) (?:verificar|confirmar|validar|estabelecer)|dados (?:indisponiveis|insuficientes)|nao foi possivel/.test(text)) return "uncertain";
  if (/(?:could you|can you|please) (?:clarify|specify)|which (?:network|period|year) do you mean|pode (?:esclarecer|especificar)|qual (?:rede|periodo|ano) voce/.test(text)) return "clarifying";
  return answerExpression(`${question} ${answer}`);
}
