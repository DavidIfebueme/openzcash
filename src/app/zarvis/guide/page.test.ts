import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/zarvis/config", () => ({ zarvisConfig: () => ({
  apiKey: "xai-secret-sentinel-value", provider: "xai", providerLabel: "xAI (Grok)", enabled: true, model: "grok-4.7", webSearch: true,
  networkWindowLimit: 60, networkDailyLimit: 600, dailyUsdCap: 100, quotaPause: { active: false, until: null },
  dailyLimit: 1000, hourlyLimit: 100, canaryModel: false, unlimitedLocalTesting: false,
}) }));
import Page from "./page";
import AboutPage from "../about/page";
import { CANARY_CASES, CANARY_MODEL_CASE } from "@/lib/zarvis/canary";
import { answerPlan } from "@/lib/zarvis/depth";
import { GUIDE_QUESTIONS } from "@/lib/zarvis/guide";

const html = () => renderToStaticMarkup(Page());

describe("Zarvis guide page", () => {
  it("shows live badge samples with the configured model, exactly as the chat renders them", () => {
    const output = html();
    expect(output).toContain("zarvis-provenance-badge zarvis-provenance-local");
    expect(output).toContain("Direct from OpenZcash data · no AI");
    expect(output).toContain("Grok 4.7 · 3 sources · check them");
    expect(output).toContain("Grok 4.7 · 2 sources · check them");
  });
  it("offers curated questions as prefillable links that never send by themselves", () => {
    const output = html();
    for (const item of GUIDE_QUESTIONS) {
      expect(output).toContain(item.question);
      expect(output).toContain(`href="/zarvis?q=${encodeURIComponent(item.question)}"`);
    }
    expect(output).toContain("fills the composer");
    expect(output).toContain("nothing is sent until you press send");
  });
  it("annotates a sample answer with the badge, sources, withheld-figure notice and share actions", () => {
    const output = html();
    expect(output).toContain("1 figure could not be verified and was left out.");
    expect(output).toContain("2 sources consulted");
    expect(output).toContain("Copy answer");
    expect(output).toContain("Copy with sources");
    expect(output).toContain("Copy question link");
    expect(output).toContain("Retrieved ");
  });
  it("states the depth budgets the deployed planner actually uses", () => {
    const output = html();
    const quick = answerPlan([], "quick"), deep = answerPlan([], "deep");
    expect(output).toContain(`${quick.timeoutMs / 1000} seconds`);
    expect(output).toContain(`${deep.timeoutMs / 1000} seconds`);
    expect(output).toContain("Auto, the default");
  });
  it("links the chat, the About page and the repository guide, and keeps quotas on About only", () => {
    const output = html();
    expect(output).toContain('href="/zarvis"');
    expect(output).toContain("/zarvis/about");
    expect(output).toContain("docs/using-zarvis.md");
    expect(output).not.toContain("questions per 10 minutes");
    expect(output).not.toContain("per day from one network address");
  });
  it("never leaks configuration", () => {
    expect(html()).not.toContain("xai-secret-sentinel-value");
  });
});

describe("Zarvis guide stays in sync with its sources", () => {
  it("claims only canary-proven routes for its curated questions", () => {
    const canaryQuestions = CANARY_CASES.map((entry) => entry.question);
    const guideDirect = GUIDE_QUESTIONS.filter((item) => item.route === "direct").map((item) => item.question);
    const guideModel = GUIDE_QUESTIONS.filter((item) => item.route === "model").map((item) => item.question);
    expect(guideDirect.length).toBeGreaterThan(0);
    expect(guideModel.length).toBeGreaterThan(0);
    for (const question of guideDirect) expect(canaryQuestions).toContain(question);
    expect(guideModel).toContain(CANARY_MODEL_CASE.question);
    expect(new Set(GUIDE_QUESTIONS.map((item) => item.question)).size).toBe(GUIDE_QUESTIONS.length);
  });
  it("renders the same badge strings as the About page", () => {
    const about = renderToStaticMarkup(AboutPage());
    for (const shared of ["Direct from OpenZcash data · no AI", "3 sources · check them", "check them"]) {
      expect(html()).toContain(shared);
      expect(about).toContain(shared);
    }
  });
  it("keeps the labels it teaches identical to the chat component", () => {
    const chat = readFileSync("src/components/zarvis/zarvis-chat.tsx", "utf8");
    // The chat renders its badges with the same function the guide samples use.
    expect(chat).toContain("provenanceLabel");
    for (const label of ["Copy answer", "Copy with sources", "Copy question link"]) {
      expect(chat).toContain(label);
      expect(html()).toContain(label);
    }
    expect(chat).toContain("consulted");
    expect(html()).toContain(" sources consulted");
  });
  it("crosslinks the repository guide, which keeps the same depth budgets", () => {
    const doc = readFileSync("docs/using-zarvis.md", "utf8");
    expect(doc).toContain("/zarvis/guide");
    expect(doc).toMatch(/55 seconds/);
    expect(doc).toMatch(/110/);
  });
});
