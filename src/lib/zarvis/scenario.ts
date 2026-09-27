import "server-only";
import { z } from "zod";
import { calculateTreasuryScenario, CYPHERPUNK_DOCUMENTED_BASE_ZEC, CYPHERPUNK_MINED_ZEC, CYPHERPUNK_MINING_REFERENCE_HEIGHT, NETWORK_SNAPSHOT_HEIGHT, NETWORK_SNAPSHOT_DATE } from "@/lib/treasury/calculator";
import { calculateDevFundBudget, type DevFundReportedData } from "@/lib/treasury/dev-fund";
import { mergeScenario, scenarioAssumptionsSchema, type ScenarioAssumptions } from "./scenario-input";
import { boundedRead } from "./timeout";
import type { Evidence } from "./local";

const nullableShape = Object.fromEntries(Object.entries(scenarioAssumptionsSchema.shape).map(([key, schema]) => [key, schema.unwrap().nullable()]));
export const scenarioToolSchema = z.object(nullableShape).strict();
export const scenarioTool = {
  type: "function" as const, name: "calculate_openzcash_treasury", strict: true,
  description: "Run the same company and community calculations as OpenZcash. Includes halvings, constant mining share, a single future purchase and fixed-budget coverage. Pass null to retain a session assumption/default; explicit values change it. priceMultiple replaces futurePriceUsd or vice versa. USD only; never invent an exchange rate. Company baseline and community assets come from dated public data, not memory. Use this for all numeric treasury scenarios. years defaults to 1; supplyBasis defaults to circulating; funding ends at next halving unless continued. The results include a reproducible calculator link and source dates.",
  parameters: z.toJSONSchema(scenarioToolSchema, { target: "draft-7" }),
};
export type ScenarioSnapshot = {
  price: { usd: number; quotedAt: string | null; stale: boolean } | null;
  supply: { zec: number; quotedAt: string | null; stale: boolean } | null;
  chain: { height: number; stale?: boolean } | null;
  funds: DevFundReportedData;
};
export function computeScenario(change: ScenarioAssumptions, previous: ScenarioAssumptions, snapshot: ScenarioSnapshot) {
  const assumptions = mergeScenario(previous, change);
  const currentPriceUsd = assumptions.currentPriceUsd ?? snapshot.price?.usd;
  if (!currentPriceUsd) throw new Error("PRICE_UNAVAILABLE");
  const futurePriceUsd = assumptions.futurePriceUsd ?? currentPriceUsd * (assumptions.priceMultiple ?? 1);
  const supply = snapshot.supply?.zec ?? 16945106;
  const blockHeight = snapshot.chain && !snapshot.chain.stale && snapshot.chain.height >= NETWORK_SNAPSHOT_HEIGHT ? snapshot.chain.height : NETWORK_SNAPSHOT_HEIGHT;
  const zcg = snapshot.funds.zcg, lockbox = snapshot.funds.lockbox;
  const budget = zcg && zcg.zec !== null && zcg.cashUsd !== null && lockbox && (assumptions.annualSpendingUsd !== undefined || zcg.paidMilestonesUsd !== null)
    ? calculateDevFundBudget({
      historicalSpendingUsd: assumptions.annualSpendingUsd ?? zcg.paidMilestonesUsd!,
      historicalYears: assumptions.annualSpendingUsd !== undefined ? 1 : 5,
      treasuryZec: zcg.zec + lockbox.zec, treasuryCashUsd: zcg.cashUsd,
      spendingFromZecSalesPercent: assumptions.spendingFromZecSalesPercent!, currentPriceUsd, futurePriceUsd,
    }) : null;
  const input = {
    holdingsZec: assumptions.holdingsZec ?? CYPHERPUNK_DOCUMENTED_BASE_ZEC,
    circulatingSupplyZec: supply, targetPercent: assumptions.targetPercent!,
    minedPer14DaysZec: assumptions.minedPer14DaysZec ?? CYPHERPUNK_MINED_ZEC,
    miningObservationHeight: assumptions.minedPer14DaysZec === undefined ? CYPHERPUNK_MINING_REFERENCE_HEIGHT : blockHeight,
    blockHeight, months: assumptions.years! * 12, currentPriceUsd, futurePriceUsd,
    supplyBasis: assumptions.supplyBasis!, otherMinerSalePercent: assumptions.otherMinerSalePercent,
    devFundAllocationPercent: assumptions.devFundAllocationPercent,
    continueDevFundAfterHalving: assumptions.continueDevFundAfterHalving,
    annualDevFundZecSalesUsd: budget?.annualZecSaleBudgetUsd ?? 0,
  };
  const company = calculateTreasuryScenario(input);
  if (!company) throw new Error("INCOMPATIBLE_ASSUMPTIONS");
  const params = new URLSearchParams({ zarvis: "1", view: assumptions.view!, years: String(assumptions.years), target: String(input.targetPercent), basis: input.supplyBasis, priceNow: String(currentPriceUsd), futurePrice: String(futurePriceUsd), holdings: String(input.holdingsZec), mining: String(input.minedPer14DaysZec), supply: String(supply), height: String(blockHeight), observation: String(input.miningObservationHeight), fundAllocation: String(input.devFundAllocationPercent), continueFunding: String(Boolean(input.continueDevFundAfterHalving)), minerSales: String(input.otherMinerSalePercent), spendingFromZecSales: String(assumptions.spendingFromZecSalesPercent) });
  if (budget && zcg && lockbox) {
    params.set("annualSpending", String(budget.annualSpendingUsd)); params.set("fundZec", String(zcg.zec! + lockbox.zec)); params.set("fundCash", String(zcg.cashUsd));
  }
  return {
    assumptions, input, company, community: budget,
    calculatorUrl: `https://openzcash.org/zcg/treasury-calculator?${params}`,
    provenance: {
      companyBalanceReportedOn: "2026-08-31", companyCheckedOn: "2026-09-23",
      price: assumptions.currentPriceUsd !== undefined ? { usd: currentPriceUsd, userAssumption: true } : snapshot.price,
      supply: snapshot.supply ?? { zec: supply, snapshotAt: NETWORK_SNAPSHOT_DATE, stale: true },
      chain: { height: blockHeight, snapshotFallback: blockHeight === NETWORK_SNAPSHOT_HEIGHT, snapshotDate: blockHeight === NETWORK_SNAPSHOT_HEIGHT ? NETWORK_SNAPSHOT_DATE : null },
      zcg, lockbox,
    },
    note: "Conditional model, not forecast. Same engine as the calculator. Constant share of miner subsidies; retained mining; halvings included. Purchases are one-off, not annual. No mining expenses, market impact, fees, future funding or spending growth in budget coverage. Separate ZCG and Lockbox restrictions apply. Default annual spending is cumulative milestones / an assumed 5 years, not audited yearly expenditure. Market-flow volume equivalent is not available liquidity or time to execute an order.",
  };
}
export type CalculatedScenario = ReturnType<typeof computeScenario>;

export async function readScenarioSnapshot(): Promise<ScenarioSnapshot> {
  const [{ currentZecUsdQuote }, { currentZecCirculatingSupply }, { reportedDevFundData }, { GET }] = await Promise.all([
    import("@/lib/pricing/live-price"), import("@/lib/pricing/circulating-supply"), import("@/lib/treasury/dev-fund-data"), import("@/app/api/chain-tip/route"),
  ]);
  const [price, supply, funds, chain] = await Promise.all([currentZecUsdQuote(), currentZecCirculatingSupply(), reportedDevFundData(), GET().then(async (r) => r.ok ? r.json() : null).catch(() => null)]);
  return { price: price ? { usd: price.cents / 100, quotedAt: price.quotedAt, stale: price.stale } : null, supply, funds, chain };
}
export async function lookupScenario(raw: unknown, previous: ScenarioAssumptions, signal: AbortSignal): Promise<Evidence & { scenario?: CalculatedScenario }> {
  try {
    const parsed = scenarioToolSchema.parse(raw);
    const change = scenarioAssumptionsSchema.parse(Object.fromEntries(Object.entries(parsed).filter(([, value]) => value !== null)));
    const snapshot = await boundedRead(readScenarioSnapshot, signal, 10000);
    signal.throwIfAborted();
    const scenario = computeScenario(change, previous, snapshot);
    const source = { title: "OpenZcash · Treasury scenario", url: scenario.calculatorUrl, retrievedAt: new Date().toISOString() };
    return { content: JSON.stringify({ sourceUrl: source.url, retrievedAt: source.retrievedAt, data: scenario }), source, scenario };
  } catch { signal.throwIfAborted(); return { content: JSON.stringify({ error: "Could not calculate this scenario. Check the inputs or try later; do not substitute invented outputs." }) }; }
}
const fmt = (n: number, pt: boolean, maximumFractionDigits = 2) => new Intl.NumberFormat(pt ? "pt-BR" : "en-US", { maximumFractionDigits }).format(n);
export function scenarioAnswer(s: CalculatedScenario, pt: boolean): string {
  const n = (value: number, places = 2) => fmt(value, pt, places);
  const money = (value: number) => new Intl.NumberFormat(pt ? "pt-BR" : "en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  const quote = (value: number) => new Intl.NumberFormat(pt ? "pt-BR" : "en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
  const a = s.assumptions, c = s.company, b = s.community;
  const basis = a.supplyBasis === "maximum" ? (pt ? "oferta máxima de 21 milhões" : "21 million maximum supply") : (pt ? "oferta circulante projetada" : "projected circulating supply");
  if (a.view === "both") {
    return `**${pt ? "Empresa" : "Company"}**\n\n${scenarioAnswer({ ...s, assumptions: { ...a, view: "company" } }, pt)}\n\n**${pt ? "Comunidade" : "Community"}**\n\n${scenarioAnswer({ ...s, assumptions: { ...a, view: "community" } }, pt)}`;
  }
  let answer: string;
  if (a.view === "community") {
    answer = !b ? (pt ? "Não foi possível obter os saldos necessários para calcular a cobertura dos fundos." : "The required fund balances are unavailable, so coverage could not be calculated.")
      : pt ? `A **${quote(s.input.futurePriceUsd)} por ZEC**, os saldos informados de ZCG + Lockbox equivalem a **${money(b.futureTreasuryUsd)}**. Com orçamento fixo de **${money(b.annualSpendingUsd)} por ano**, isso representa **${b.coverageYearsFuture === null ? "cobertura indefinida (orçamento zero)" : n(b.coverageYearsFuture) + " anos"}**.\n\n${a.annualSpendingUsd === undefined ? "O orçamento padrão divide os marcos pagos acumulados por 5 anos assumidos. " : "Orçamento definido por você. "}Os fundos têm restrições separadas. A conta não inclui novos aportes, inflação nem crescimento de despesas.`
      : `At **${quote(s.input.futurePriceUsd)} per ZEC**, reported ZCG + Lockbox assets represent **${money(b.futureTreasuryUsd)}**. A fixed **${money(b.annualSpendingUsd)} annual budget** gives **${b.coverageYearsFuture === null ? "undefined coverage (zero budget)" : n(b.coverageYearsFuture) + " years of coverage"}**.\n\n${a.annualSpendingUsd === undefined ? "The default budget divides cumulative paid milestones by an assumed 5 years. " : "This is your assumed budget. "}The funds have separate spending restrictions. Future funding, inflation and spending growth are excluded.`;
  } else {
    answer = pt ? `Após **${n(a.years!)} anos** de mineração, a participação seria **${n(c.futureSharePercent)}%** da ${basis}. Para atingir **${n(a.targetPercent!)}%**, faltariam **${n(c.futureGapZec)} ZEC**, custando **${money(c.futurePurchaseUsd)}** a **${quote(s.input.futurePriceUsd)} por ZEC** — uma compra única ao final do período.\n\nHalvings incluídos; participação na mineração constante e moedas mineradas retidas. Dev Fund: **${n(a.devFundAllocationPercent!)}%**, ${a.continueDevFundAfterHalving ? "continuando após o próximo halving" : "encerrando no próximo halving"}. ${c.yearsToTarget === null ? `Somente com mineração, a meta não é atingida sob essas premissas; participação final estimada: **${n(c.terminalSharePercent)}%**.` : `A meta seria alcançada só com mineração em **${n(c.yearsToTarget)} anos**, sob essas premissas.`} Custos de mineração e impacto no mercado não estão incluídos.`
      : `After **${n(a.years!)} years** of mining, ownership would be **${n(c.futureSharePercent)}%** of ${basis}. Reaching **${n(a.targetPercent!)}%** would require **${n(c.futureGapZec)} ZEC**, costing **${money(c.futurePurchaseUsd)}** at **${quote(s.input.futurePriceUsd)} per ZEC** — one purchase at the end of the period.\n\nHalvings included; mining share held constant and mined coins retained. Dev Fund: **${n(a.devFundAllocationPercent!)}%**, ${a.continueDevFundAfterHalving ? "continuing after the next halving" : "ending at the next halving"}. ${c.yearsToTarget === null ? `Mining alone does not reach the target under these assumptions; estimated eventual ownership: **${n(c.terminalSharePercent)}%**.` : `Mining alone reaches the target in **${n(c.yearsToTarget)} years** under these assumptions.`} Mining costs and market impact are excluded.`;
  }
  const dates = [];
  if (a.view === "company" && a.holdingsZec === undefined) dates.push(pt ? "Saldo da empresa informado em 31 ago. 2026." : "Company balance reported August 31, 2026.");
  if (a.view === "community" && s.provenance.zcg) dates.push(`${pt ? "ZCG: data do relatório" : "ZCG report date"} ${s.provenance.zcg.snapshotAt.slice(0,10)}${s.provenance.zcg.updatesRequired ? (pt ? " (fonte marcada para atualização)" : " (source marked updates required)") : ""}.`);
  if (a.view === "community" && s.provenance.lockbox) dates.push(`${pt ? "Lockbox: estimativa até o bloco" : "Lockbox: estimate through block"} ${n(s.provenance.lockbox.height, 0)}.`);
  if (s.provenance.price && "stale" in s.provenance.price && s.provenance.price.stale) dates.push(pt ? "Preço-base em cache; não é uma cotação atual." : "The base price is cached, not a current quote.");
  if (s.provenance.price && "quotedAt" in s.provenance.price && s.provenance.price.quotedAt) dates.push(`${pt ? "Cotação-base" : "Base quote"}: ${s.provenance.price.quotedAt.replace("T", " ").replace(/\.\d+Z$/, " UTC")}.`);
  if (s.provenance.supply.stale || s.provenance.chain.snapshotFallback) dates.push(pt ? "Oferta/altura usam dados em cache ou o snapshot datado da calculadora." : "Supply/height use cached data or the calculator's dated snapshot.");
  return `${answer}\n\n${dates.join(" ")} [${pt ? "Abrir estas premissas na calculadora" : "Open these assumptions in the calculator"}](${s.calculatorUrl}).`;
}
