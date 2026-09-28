import { describe, expect, it } from "vitest";
import { completionExpression, progressExpression } from "./expression";
describe("Mascot reactions follow the response", () => {
  it.each(["I cannot verify the current activation.", "Não consegui confirmar esse valor.", "Não foi possível obter os saldos necessários."])("does not celebrate an unavailable answer: %s", (answer) => expect(completionExpression("Zcash?", answer)).toBe("uncertain"));
  it("recognizes an actual clarification and a comparative explanation", () => {
    expect(completionExpression("Is it active?", "Which network do you mean?")).toBe("clarifying");
    expect(completionExpression("Analyze this", "Compare the scenarios under the same budget.")).toBe("comparing");
    expect(completionExpression("hello", "Zcash is a digital currency.")).not.toBe("pleased");
    expect(progressExpression("Analyzing the scenario…")).toBe("comparing");
  });
});
