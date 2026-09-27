"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconChart, IconWallet } from "@/components/icons";
import { readScenarioLink } from "@/lib/treasury/scenario-link";
import styles from "./treasury-calculator.module.css";
import { PageHeader } from "@/components/ui";
import { calculateDevFundBudget, valueReportedDevFund, type DevFundReportedData } from "@/lib/treasury/dev-fund";
import {
  calculateTreasuryScenario,
  CYPHERPUNK_DOCUMENTED_BASE_ZEC,
  CYPHERPUNK_MINED_ZEC,
  CYPHERPUNK_MINING_REFERENCE_HEIGHT,
  MAX_ZEC_SUPPLY,
  NETWORK_SNAPSHOT_DATE,
  NETWORK_SNAPSHOT_HEIGHT,
  type SupplyBasis,
} from "@/lib/treasury/calculator";

type Props = {
  devFundData: DevFundReportedData;
  initialPriceUsd: number | null;
  priceQuotedAt: string | null;
  priceStale: boolean;
  initialCirculatingSupplyZec: number;
  supplyQuotedAt: string | null;
  supplyStale: boolean;
  supplyFallbackDate: string | null;
};

type Editable = {
  company: string;
  holdings: string;
  supply: string;
  target: string;
  mining: string;
  years: string;
  priceNow: string;
  customFuturePrice: string;
  minerSales: string;
  fundAllocation: string;
  historicalSpend: string;
  historicalYears: string;
  fundZec: string;
  fundCash: string;
  spendingFromZecSales: string;
};

type CalculatorView = "company" | "community";
const CALCULATOR_VIEWS = [
  { id: "community", label: "Community", description: "ZCG + Lockbox", Icon: IconWallet },
  { id: "company", label: "Company", description: "Ownership & purchases", Icon: IconChart },
] as const;
/** Scenarios start at the current market price; the 1×–10× buttons scale it. */
const DEFAULT_PRICE_MULTIPLE = 1;

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compactMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 });
const price = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const SOURCES = {
  company: "https://www.cypherpunk.com/#dashboard",
  mining: "https://www.cypherpunk.com/investors/releases/cypherpunk-technologies-appoints-amanda-fabiano-board-directors",
  goal: "https://www.sec.gov/Archives/edgar/data/1509745/000110465926051498/tm261086d3_ars.pdf#page=9",
  economics: "https://z.cash/learn/what-are-the-economics-of-zcash/",
  schedule: "https://zips.z.cash/zip-0208",
  funding: "https://zips.z.cash/zip-0214",
  market: "https://www.coingecko.com/en/coins/zcash",
  zcg: "https://docs.google.com/spreadsheets/d/1FQ28rDCyRW0TiNxrm3rgD8ai2KGUsXAjPieQmI1kKKg/edit?usp=sharing",
};

function toNumber(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

function quoteTime(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "time unavailable";
  return `${new Date(value).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC",
  })} UTC`;
}

function reportDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="underline decoration-stone-300 underline-offset-4 transition hover:text-[var(--accent-ink)] hover:decoration-[var(--accent)]">{children}</a>;
}

function Field({ label, value, onChange, unit, min = 0, max, showStepper = false }: {
  label: string; value: string; onChange: (value: string) => void; unit?: string; min?: number; max?: number; showStepper?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-xs font-medium text-stone-600">{label}</span>
      <span className="ws-field">
        <input type="number" inputMode="decimal" min={min} max={max} step={showStepper ? 1 : "any"} value={value} data-stepper={showStepper || undefined}
          onChange={(event) => onChange(event.target.value)}
          className={`${styles.numberInput} tnum h-full min-w-0 w-full border-0 bg-transparent px-3.5 text-base font-semibold text-stone-900 outline-none`} />
        {unit && <span className="flex min-w-12 items-center justify-center border-l border-stone-200/80 bg-[var(--surface2)] px-3 text-xs font-medium text-stone-500">{unit}</span>}
      </span>
    </label>
  );
}

export function TreasuryCalculator({
  initialPriceUsd, priceQuotedAt, priceStale, initialCirculatingSupplyZec,
  supplyQuotedAt, supplyStale, supplyFallbackDate, devFundData,
}: Props) {
  const reportedFundZec = devFundData.zcg?.zec != null && devFundData.lockbox
    ? Number((devFundData.zcg.zec + devFundData.lockbox.zec).toFixed(8)) : null;
  const reportedFundCash = devFundData.zcg?.cashUsd ?? null;
  const defaults: Editable = {
    company: "Cypherpunk", holdings: String(CYPHERPUNK_DOCUMENTED_BASE_ZEC),
    supply: String(initialCirculatingSupplyZec), target: "5", mining: String(CYPHERPUNK_MINED_ZEC),
    years: "1", priceNow: initialPriceUsd === null ? "" : String(initialPriceUsd), customFuturePrice: "",
    minerSales: "100", fundAllocation: "20",
    historicalSpend: devFundData.zcg?.paidMilestonesUsd == null ? "" : String(devFundData.zcg.paidMilestonesUsd),
    historicalYears: "5", fundZec: reportedFundZec === null ? "" : String(reportedFundZec),
    fundCash: reportedFundCash === null ? "" : String(reportedFundCash), spendingFromZecSales: "100",
  };
  const [values, setValues] = useState<Editable>(defaults);
  const [preset, setPreset] = useState("cypherpunk");
  const [basis, setBasis] = useState<SupplyBasis>("circulating");
  const [multiple, setMultiple] = useState<number | null>(DEFAULT_PRICE_MULTIPLE);
  const [continueDevFund, setContinueDevFund] = useState(false);
  const [useReportedTreasury, setUseReportedTreasury] = useState(true);
  const [network, setNetwork] = useState<{ height: number; snapshot: boolean; shared?: boolean }>({ height: NETWORK_SNAPSHOT_HEIGHT, snapshot: true });
  const [sharedObservation, setSharedObservation] = useState<number | undefined>();
  const [activeView, setActiveView] = useState<CalculatorView>("community");
  const calculatorTop = useRef<HTMLDivElement>(null);
  const viewTabs = useRef<Partial<Record<CalculatorView, HTMLButtonElement | null>>>({});

  function selectView(view: CalculatorView, focus = false) {
    setActiveView(view);
    if (focus) viewTabs.current[view]?.focus({ preventScroll: true });
    calculatorTop.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }

  useEffect(() => {
    const linked = readScenarioLink(new URLSearchParams(window.location.search));
    if (linked) {
      // Hydrate only validated, explicitly linked assumptions; keep the saved network height.
      queueMicrotask(() => {
        setValues((current) => ({ ...current, years: String(linked.years), target: String(linked.target), priceNow: String(linked.priceNow), customFuturePrice: String(linked.futurePrice), holdings: String(linked.holdings), mining: String(linked.mining), supply: String(linked.supply), fundAllocation: String(linked.fundAllocation), minerSales: String(linked.minerSales), spendingFromZecSales: String(linked.spendingFromZecSales),
          ...(linked.annualSpending !== undefined ? { historicalSpend: String(linked.annualSpending), historicalYears: "1", fundZec: String(linked.fundZec), fundCash: String(linked.fundCash) } : {}),
        }));
        setBasis(linked.basis); setMultiple(null); setActiveView(linked.view === "both" ? "company" : linked.view);
        setContinueDevFund(linked.continueFunding === "true");
        setNetwork({ height: linked.height, snapshot: false, shared: true }); setSharedObservation(linked.observation);
        if (linked.annualSpending !== undefined) setUseReportedTreasury(false);
      });
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9_000);
    fetch("/api/chain-tip", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { height?: number; stale?: boolean } | null) => {
        if (!controller.signal.aborted && data && Number.isSafeInteger(data.height) && data.height! >= NETWORK_SNAPSHOT_HEIGHT && !data.stale) {
          setNetwork({ height: data.height!, snapshot: false });
        }
      })
      .catch(() => { /* Keep the explicitly dated network snapshot. */ })
      .finally(() => clearTimeout(timeout));
    return () => { controller.abort(); clearTimeout(timeout); };
  }, []);

  function edit(field: keyof Editable, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }
  function choosePreset(value: string) {
    setPreset(value);
    setSharedObservation(undefined);
    setValues(value === "cypherpunk" ? defaults : { ...defaults, company: "Custom treasury", holdings: "0", mining: "0" });
    setBasis("circulating");
    setMultiple(DEFAULT_PRICE_MULTIPLE);
    setContinueDevFund(false);
    setUseReportedTreasury(true);
  }

  function restoreReportedFunds() {
    setValues((current) => ({ ...current, historicalSpend: defaults.historicalSpend, fundZec: defaults.fundZec, fundCash: defaults.fundCash }));
    setUseReportedTreasury(true);
  }

  function editFundBalance(field: "fundZec" | "fundCash", value: string) {
    setValues((current) => ({
      ...current,
      fundZec: useReportedTreasury ? defaults.fundZec : current.fundZec,
      fundCash: useReportedTreasury ? defaults.fundCash : current.fundCash,
      [field]: value,
    }));
    setUseReportedTreasury(false);
  }

  const currentPrice = toNumber(values.priceNow);
  const fundZec = useReportedTreasury ? reportedFundZec ?? Number.NaN : toNumber(values.fundZec);
  const fundCash = useReportedTreasury ? reportedFundCash ?? Number.NaN : toNumber(values.fundCash);
  const fundValue = useReportedTreasury ? valueReportedDevFund(devFundData, currentPrice) : fundZec * currentPrice + fundCash;
  const spendingEdited = values.historicalSpend !== defaults.historicalSpend;
  const reportedFundsEdited = spendingEdited || !useReportedTreasury;
  const futurePrice = multiple === null ? toNumber(values.customFuturePrice) : currentPrice * multiple;
  const futurePriceDisplay = multiple === null ? values.customFuturePrice : Number.isFinite(futurePrice) ? String(Number(futurePrice.toFixed(2))) : "";
  const years = toNumber(values.years);
  const horizon = Number.isFinite(years) ? `${number.format(years)} ${years === 1 ? "year" : "years"}` : "selected period";
  const fundBudget = calculateDevFundBudget({
    historicalSpendingUsd: toNumber(values.historicalSpend),
    historicalYears: toNumber(values.historicalYears),
    treasuryZec: fundZec, treasuryCashUsd: fundCash,
    spendingFromZecSalesPercent: toNumber(values.spendingFromZecSales),
    currentPriceUsd: currentPrice, futurePriceUsd: futurePrice,
  });
  const scenario = calculateTreasuryScenario({
    holdingsZec: toNumber(values.holdings), circulatingSupplyZec: toNumber(values.supply),
    targetPercent: toNumber(values.target), minedPer14DaysZec: toNumber(values.mining),
    miningObservationHeight: sharedObservation ?? (preset === "cypherpunk" && toNumber(values.mining) === CYPHERPUNK_MINED_ZEC ? CYPHERPUNK_MINING_REFERENCE_HEIGHT : network.height),
    blockHeight: network.height, months: years * 12, currentPriceUsd: currentPrice,
    futurePriceUsd: futurePrice, supplyBasis: basis,
    otherMinerSalePercent: toNumber(values.minerSales),
    devFundAllocationPercent: toNumber(values.fundAllocation),
    continueDevFundAfterHalving: continueDevFund,
    // Purchase/mining calculations remain usable if funding data is missing.
    // The market-flow estimate below is only shown with a valid fund budget.
    annualDevFundZecSalesUsd: fundBudget?.annualZecSaleBudgetUsd ?? 0,
  });
  const company = values.company.trim() || "Custom treasury";
  const share = scenario ? `${scenario.currentSharePercent.toFixed(2)}%` : "—";
  const target = Number.isFinite(toNumber(values.target)) ? `${number.format(toNumber(values.target))}%` : "target";
  const basisLabel = basis === "circulating" ? "circulating supply" : "21M maximum supply";
  const holdingsChanged = toNumber(values.holdings) !== CYPHERPUNK_DOCUMENTED_BASE_ZEC || toNumber(values.mining) !== CYPHERPUNK_MINED_ZEC;
  const priceEdited = currentPrice !== initialPriceUsd;
  const supplyEdited = toNumber(values.supply) !== initialCirculatingSupplyZec;
  const costDifference = scenario ? scenario.futurePurchaseUsd - scenario.todayPurchaseUsd : 0;
  const heldWidth = scenario ? Math.min(100, toNumber(values.holdings) / scenario.futureTargetZec * 100) : 0;
  const minedWidth = scenario ? Math.min(100 - heldWidth, scenario.projectedMinedZec / scenario.futureTargetZec * 100) : 0;
  const otherMinerOffersPerDay = scenario ? scenario.otherMinersPerDayZec * toNumber(values.minerSales) / 100 : null;

  return (
    <div ref={calculatorTop} className="mx-auto max-w-[1280px] scroll-mt-20 text-stone-900">
      {network.shared && <p className="mb-3 text-xs text-stone-500" role="status">Saved Zarvis scenario · Prices, balances and network height use the assumptions in this link.</p>}
      <PageHeader
        title="Treasury calculator"
        subtitle="Compare community funding and company ownership using public Zcash data."
        actions={activeView === "company" ? <label>
          <span className="sr-only">Treasury preset</span>
          <select value={preset} onChange={(event) => choosePreset(event.target.value)}>
            <option value="cypherpunk">Cypherpunk</option>
            <option value="custom">Custom treasury</option>
          </select>
        </label> : undefined}
      />

      <div className="sticky top-14 z-10 -mx-1 mb-4 rounded-2xl bg-[var(--bg)]/95 px-1 py-2 backdrop-blur-xl">
        <div role="tablist" aria-label="Choose a treasury analysis" className="grid grid-cols-2 gap-1 rounded-2xl border border-stone-200 bg-[var(--surface2)] p-1">
          {CALCULATOR_VIEWS.map(({ id, label, description, Icon }) => <button
            key={id} ref={(element) => { viewTabs.current[id] = element; }} type="button" role="tab"
            id={`treasury-${id}-tab`} aria-controls={`treasury-${id}-panel`} aria-selected={activeView === id}
            tabIndex={activeView === id ? 0 : -1} onClick={() => selectView(id)}
            onKeyDown={(event) => {
              let next: CalculatorView;
              if (event.key === "Home") next = CALCULATOR_VIEWS[0].id;
              else if (event.key === "End") next = CALCULATOR_VIEWS[CALCULATOR_VIEWS.length - 1].id;
              else if (event.key === "ArrowLeft" || event.key === "ArrowRight") next = id === "company" ? "community" : "company";
              else return;
              event.preventDefault();
              selectView(next, true);
            }}
            className={`flex min-w-0 items-center justify-start gap-3 rounded-xl px-3 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:px-4 ${activeView === id ? "bg-white text-stone-900 shadow-sm ring-1 ring-[var(--line)]" : "text-stone-500 hover:bg-[var(--surface)] hover:text-[var(--ink)]"}`}
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${activeView === id ? "bg-amber-50 text-amber-800" : "bg-[var(--surface2)] text-stone-400"}`}><Icon className="h-[18px] w-[18px]" /></span>
            <span className="min-w-0"><span className="block text-sm font-semibold">{label}</span><span className="mt-0.5 block text-[11px] leading-snug text-stone-500">{description}</span></span>
          </button>)}
        </div>
      </div>

      <section id="treasury-company-panel" role="tabpanel" aria-labelledby="treasury-company-tab" tabIndex={0} hidden={activeView !== "company"} className="overflow-hidden rounded-[20px] border border-stone-200 bg-white shadow-[0_8px_32px_-20px_rgba(60,45,20,0.22)]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-stone-200/80 bg-[var(--surface2)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-stone-500">{company}{preset === "cypherpunk" ? holdingsChanged ? " · edited scenario" : " · latest reported balance" : " · your scenario"}</p>
            <p className="tnum mt-1 text-base font-semibold tracking-tight sm:text-lg">{Number.isFinite(toNumber(values.holdings)) ? number.format(toNumber(values.holdings)) : "—"} <span className="text-[11px] font-medium text-stone-500 sm:text-xs">ZEC held</span></p>
            {preset === "cypherpunk" && !holdingsChanged && <p className="mt-1 text-[11px] text-stone-500">Latest entry: Aug 31, 2026. Later unreported mining is excluded.</p>}
          </div>
          <div className="text-right">
            <p className="tnum text-xl font-semibold tracking-tight">{share} <span className="mx-1 text-stone-300" aria-hidden="true">→</span> <span className="text-amber-700">{target}</span></p>
            <p className="mt-1 text-xs text-stone-500">Starting share → goal</p>
          </div>
        </div>

        <div className="border-b border-stone-200/80 bg-[var(--surface2)] px-5 py-3.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-xs font-medium text-stone-600" id="target-basis-label">Calculate ownership using</span>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-stone-200/80 bg-[var(--surface2)] p-1" role="group" aria-labelledby="target-basis-label">
              {([
                ["circulating", "Circulating supply"],
                ["maximum", "21M lifetime limit"],
              ] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={basis === value} onClick={() => setBasis(value)}
                className={`rounded-lg px-3 py-2 text-[11px] font-medium transition ${basis === value ? "bg-white text-amber-900 shadow-sm ring-1 ring-[var(--line)]" : "text-stone-500 hover:bg-[var(--surface)] hover:text-[var(--ink)]"}`}>{label}</button>)}
            </div>
          </div>
          {scenario && <p className="tnum mt-2 text-xs text-stone-500">
            {basis === "maximum" ? "Fixed target" : "Today’s target"}: {target} × {number.format(scenario.todaySupplyZec)} ZEC = <strong className="font-medium text-stone-700">{number.format(scenario.todayTargetZec)} ZEC</strong>.
            {basis === "circulating" ? " The amount needed grows as new ZEC enters circulation." : " This ZEC target stays fixed."}
          </p>}
          <p className="mt-1 text-[11px] leading-relaxed text-stone-500">{basis === "circulating" ? `${preset === "cypherpunk" ? "Cypherpunk’s stated goal uses circulating supply: " : "Circulating supply means "}ZEC already in circulation.` : "The lifetime limit includes all ZEC that can ever be created."}</p>
        </div>

        <div className="grid gap-px bg-[var(--line)] sm:grid-cols-3">
          <div className="min-w-0 bg-white px-5 py-4 sm:px-6">
            <Field label="Ownership target" value={values.target} onChange={(value) => edit("target", value)} min={0.01} max={100} unit="%" />
            <p className="mt-2.5 flex min-h-7 items-center text-[11px] text-stone-500">Share of {basisLabel}</p>
          </div>
          <div className="min-w-0 bg-white px-5 py-4 sm:px-6">
            <Field label="Future ZEC price (your estimate)" value={futurePriceDisplay} onChange={(value) => { setMultiple(null); edit("customFuturePrice", value); }} min={0.01} unit="USD" />
            <div className="mt-2.5 grid grid-cols-5 gap-1.5 sm:grid-cols-4 lg:grid-cols-5" role="group" aria-label="Price multipliers">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => <button key={value} type="button" onClick={() => setMultiple(value)} aria-pressed={multiple === value}
                className={`min-h-8 min-w-0 rounded-md border px-1 py-1 text-[11px] font-semibold transition ${multiple === value ? "border-transparent bg-stone-900 text-white" : "border-stone-200/80 bg-white text-stone-500 hover:border-[var(--line-strong)] hover:bg-[var(--surface2)]"}`}>{value}×</button>)}
            </div>
            <p className="tnum mt-2 text-[11px] text-stone-500">{Number.isFinite(currentPrice) ? `1× = today’s price of ${price.format(currentPrice)} / ZEC` : "Multipliers use the current ZEC price you enter."}</p>
          </div>
          <div className="min-w-0 bg-white px-5 py-4 sm:px-6">
            <Field label="Years before purchase" value={values.years} onChange={(value) => edit("years", value)} max={100} unit="years" showStepper />
            <p className="mt-2.5 flex min-h-7 items-center text-[11px] leading-relaxed text-stone-500">{years === 0 ? "Buy immediately at your chosen price." : "Keep mined ZEC, then make one purchase at the end. 0 = buy immediately."}</p>
          </div>
        </div>

        {!scenario ? (
          <div role="alert" className="mx-5 mb-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
            {initialPriceUsd === null && !values.priceNow ? "Price unavailable. Enter the current ZEC price in Edit company assumptions below." : "Check your inputs. Use positive prices, percentages from 0 to 100%, and mining output within the network reward budget."}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-px border-y border-stone-200 bg-stone-200 md:grid-cols-3" aria-live="polite" aria-atomic="true">
              <div className="bg-white px-4 py-5 sm:px-6">
                <p className="text-xs font-medium text-stone-500">Buy remaining ZEC today</p>
                <p className="tnum mt-2 flex flex-wrap items-baseline gap-x-2 text-[27px] font-semibold leading-tight tracking-[-0.05em] sm:text-[32px]" title={money.format(scenario.todayPurchaseUsd)}>{compactMoney.format(scenario.todayPurchaseUsd)} <span className="text-[11px] font-medium tracking-normal text-stone-500">USD total</span></p>
                <p className="tnum mt-1 text-xs text-stone-500">{number.format(scenario.todayGapZec)} ZEC to reach {target}</p>
                <p className="mt-4 text-xs text-stone-500">One purchase today at {price.format(currentPrice)} / ZEC</p>
              </div>
              <div className="bg-[var(--accent-soft)] px-4 py-5 sm:px-6">
                <p className="text-xs font-medium text-[var(--accent-ink)]">{years === 0 ? "Buy now at your chosen price" : `Buy after ${horizon} of mining`}</p>
                <p className="tnum mt-2 flex flex-wrap items-baseline gap-x-2 text-[27px] font-semibold leading-tight tracking-[-0.05em] text-[var(--accent-ink)] sm:text-[32px]" title={money.format(scenario.futurePurchaseUsd)}>{compactMoney.format(scenario.futurePurchaseUsd)} <span className="text-[11px] font-medium tracking-normal text-[var(--accent-ink)]">USD total</span></p>
                <p className="tnum mt-1 text-xs text-[var(--accent-ink)]">{number.format(scenario.futureGapZec)} ZEC still to buy</p>
                <p className="mt-4 text-xs text-[var(--accent-ink)]">{years === 0 ? "One purchase now" : "One purchase at the end"}, at {price.format(futurePrice)} / ZEC</p>
                <p className="mt-1.5 text-xs font-medium text-amber-900">{costDifference === 0 ? "Same total purchase cost as today" : `${compactMoney.format(Math.abs(costDifference))} ${costDifference > 0 ? "more" : "less"} than buying today`}</p>
              </div>
              <div className="col-span-2 bg-white px-5 py-5 sm:px-6 md:col-span-1">
                <p className="text-xs font-medium text-stone-500">Time to {target} with mining only</p>
                <p className={`tnum mt-2 font-semibold leading-tight tracking-[-0.04em] ${scenario.yearsToTarget === null ? "text-[26px]" : "text-[32px]"}`}>
                  {scenario.yearsToTarget === null ? "Below goal" : scenario.yearsToTarget === 0 ? "Already reached" : `${number.format(scenario.yearsToTarget)} years`}
                </p>
                <p className="mt-1 text-xs text-stone-500">{scenario.yearsToTarget === null ? `With these inputs, reaching ${target} needs purchases or a larger mining share.` : "Estimate under your mining assumptions."}</p>
                <p className="mt-4 text-xs text-stone-600">Estimated final ownership: <strong className="tnum font-semibold">{scenario.terminalSharePercent.toFixed(2)}%</strong></p>
                <p className="mt-1 text-[11px] text-stone-500">After all future ZEC has been created.</p>
                <details className="group/mining mt-3">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-medium text-stone-600">How mining is estimated <span aria-hidden="true" className="text-stone-400 transition-transform group-open/mining:rotate-180">⌄</span></summary>
                  <p className="mt-2 text-[11px] leading-relaxed text-stone-500">Starting holdings plus projected new mining rewards. The company keeps all mined coins and the same share of mining rewards. A halving cuts new ZEC rewards in half; the model includes each future halving and your dev fund settings. Future transaction-fee income, mining luck and changes in network competition are not projected.</p>
                </details>
              </div>
            </div>

            <div className="px-5 py-4 sm:px-6">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2" aria-live="polite" aria-atomic="true">
                <div>
                  <p className="text-xs font-medium text-stone-700">{years === 0 ? "Ownership before buying" : `Ownership after ${horizon} of mining`}</p>
                  <p className="tnum mt-1 text-[11px] text-stone-500">{number.format(scenario.futureHoldingsZec)} ZEC · before market purchases</p>
                </div>
                <div>
                  <p className="tnum text-2xl font-semibold tracking-tight text-amber-900 sm:text-right">{scenario.futureSharePercent.toFixed(2)}%</p>
                  <p className="mt-0.5 text-[11px] text-stone-500">of {basis === "maximum" ? "21M maximum supply" : "projected circulating supply"}</p>
                </div>
              </div>
              <div role="progressbar" aria-label={`${company} projected ownership after ${horizon}`}
                aria-valuemin={0} aria-valuemax={toNumber(values.target)} aria-valuenow={Math.min(scenario.futureSharePercent, toNumber(values.target))}
                aria-valuetext={`${scenario.futureSharePercent.toFixed(2)}% of ${basis === "maximum" ? "21M maximum supply" : "projected circulating supply"}, before market purchases. Target: ${target}.`}
                className="flex h-2.5 overflow-hidden rounded-full bg-stone-100">
                <div className="bg-[var(--ink)] transition-[width] duration-300" style={{ width: `${heldWidth}%` }} />
                <div className="bg-amber-400 transition-[width] duration-300" style={{ width: `${minedWidth}%` }} />
              </div>
              <div className="tnum mt-1.5 flex justify-between text-[10px] text-stone-500"><span>0%</span><span>{target} target</span></div>
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-500">
                <span className="tnum flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-[var(--ink)]" />Starting balance: {number.format(toNumber(values.holdings))} ZEC</span>
                <span className="tnum flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-amber-400" />Mined in this period: +{number.format(scenario.projectedMinedZec)} ZEC</span>
                <span className="tnum flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-stone-200" />Left to buy: {number.format(scenario.futureGapZec)} ZEC</span>
              </div>
              <p className="tnum mt-3 text-xs leading-relaxed text-stone-500">
                {basis === "maximum" ? "Fixed target" : `Target after ${horizon}`}: {target} × {number.format(scenario.futureSupplyZec)} {basis === "maximum" ? "maximum" : "projected circulating"} ZEC = <strong className="font-medium text-stone-700">{number.format(scenario.futureTargetZec)} ZEC</strong>.
                {basis === "circulating" && scenario.futureTargetZec > scenario.todayTargetZec ? ` New coins increase the target by ${number.format(scenario.futureTargetZec - scenario.todayTargetZec)} ZEC.` : ""}
              </p>
            </div>

          </>
        )}

        <details key={preset} open={preset === "custom" || initialPriceUsd === null ? true : undefined} className="group border-t border-stone-200/80">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 text-xs font-medium text-stone-600 hover:bg-[var(--surface2)] sm:px-6">
            Edit company assumptions <span aria-hidden="true" className="text-lg leading-none text-stone-400 transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
            <label className="block text-xs font-medium text-stone-600">Company name
              <input type="text" value={values.company} onChange={(event) => edit("company", event.target.value)} maxLength={70} className="mt-1.5 block w-full rounded-lg border border-stone-200 px-3 py-2.5 text-base text-stone-900 outline-none focus:border-[var(--accent)]" />
            </label>
            <Field label="ZEC held" value={values.holdings} onChange={(value) => edit("holdings", value)} max={MAX_ZEC_SUPPLY} unit="ZEC" />
            <Field label="Mining output over 14 days" value={values.mining} onChange={(value) => edit("mining", value)} unit="ZEC" />
            <Field label="Current ZEC price" value={values.priceNow} onChange={(value) => edit("priceNow", value)} min={0.01} unit="USD" />
            <Field label="Circulating supply" value={values.supply} onChange={(value) => edit("supply", value)} min={1} max={MAX_ZEC_SUPPLY} unit="ZEC" />
            <div>
              <Field label="Other miners’ rewards for sale (assumed)" value={values.minerSales} onChange={(value) => edit("minerSales", value)} max={100} unit="%" />
              <p className="mt-1.5 text-[11px] leading-relaxed text-stone-500">100% assumes all their new rewards are offered for sale.</p>
            </div>
            {scenario && otherMinerOffersPerDay !== null && <div className="rounded-xl border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-4 py-3 sm:col-span-2 lg:col-span-3" aria-live="polite" aria-atomic="true">
              <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
                <div>
                  <p className="text-xs font-medium text-[var(--accent-ink)]">Estimated offers from other miners · today</p>
                  <p className="tnum mt-1 text-xl font-semibold tracking-tight text-[var(--accent-ink)]">{number.format(otherMinerOffersPerDay)} <span className="text-xs font-medium tracking-normal text-[var(--accent-ink)]">ZEC / day</span></p>
                </div>
                <p className="tnum text-xs text-[var(--accent-ink)]">{number.format(scenario.otherMinersPerDayZec)} ZEC / day × {number.format(toNumber(values.minerSales))}% offered</p>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--accent-ink)]">This changes estimated market supply. Purchase costs use the price you enter; the company’s ownership uses its own holdings and mining.</p>
            </div>}
          </div>
        </details>
      </section>

      <section id="treasury-community-panel" role="tabpanel" aria-labelledby="treasury-community-tab" tabIndex={0} hidden={activeView !== "community"} className="overflow-hidden rounded-[20px] border border-stone-200 bg-white shadow-[0_8px_32px_-20px_rgba(60,45,20,0.22)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/80 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-[var(--surface2)] text-stone-600"><IconWallet className="h-5 w-5" /></span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">Community treasury</p>
              <h2 id="community-treasury-title" className="mt-0.5 text-lg font-semibold tracking-tight">ZCG + Lockbox</h2>
            </div>
          </div>
          <p className="max-w-64 text-xs leading-relaxed text-stone-500">How does ZEC’s price change the value and spending coverage of these funds?</p>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="border-b border-stone-200/80 bg-[var(--surface2)] px-5 py-5 sm:px-6 lg:border-r lg:border-b-0">
            <div className="flex items-center gap-2 text-amber-900">
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m12.5 3.5 4 4M3 17l4.5-1 9-9a2.83 2.83 0 0 0-4-4l-9 9L3 17Z" /></svg>
              <h3 className="text-sm font-semibold">Edit your assumptions</h3>
            </div>
            <p className="mt-1 text-xs text-stone-500">Change any field below. Results update instantly.</p>

            <div className="mt-4">
              <Field label="Scenario ZEC price" value={futurePriceDisplay} onChange={(value) => { setMultiple(null); edit("customFuturePrice", value); }} min={0.01} unit="USD" />
              <p className="mt-1.5 text-[11px] text-stone-500">Shared with the Company tab. Your inputs are kept when switching tabs.</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Years used for average" value={values.historicalYears} onChange={(value) => edit("historicalYears", value)} unit="years" showStepper />
              <Field label="Budget via ZEC sales" value={values.spendingFromZecSales} onChange={(value) => edit("spendingFromZecSales", value)} max={100} unit="%" />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-stone-500">The years divide total past grant payments to estimate an annual budget. The default 5 years is an assumption, not a verified reporting period.</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-stone-500">The percentage changes assumed ZEC sales; total spending stays fixed. 100% means the full budget is funded by ZEC sales. Actual sales by funds or recipients are unknown.</p>

            <div className="mt-4 border-t border-stone-200 pt-4">
              <div className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-stone-700">Funding & mining</h4>
                  <p className="mt-1 text-[11px] leading-relaxed text-stone-500">Share of newly created ZEC sent to community funding. The rest goes to miners.</p>
                </div>
                <Field label="Dev fund allocation" value={values.fundAllocation} onChange={(value) => edit("fundAllocation", value)} max={100} unit="%" />
              </div>
              <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-stone-600">
                <input type="checkbox" checked={continueDevFund} onChange={(event) => setContinueDevFund(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]" />
                <span>Keep funding after the next halving <span className="block text-[11px] text-stone-500">Optional scenario. The current schedule ends funding at that halving.</span></span>
              </label>
              <p className="mt-2 text-[11px] leading-relaxed text-stone-500">These settings also change mining results in the Company tab.</p>
            </div>
          </div>

          <div className="min-w-0 px-5 py-5 sm:px-6" aria-live="polite" aria-atomic="true">
            {fundBudget ? <>
              <div className="rounded-xl border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-4 py-4 sm:px-5">
                <p className="text-xs font-medium text-[var(--accent-ink)]">Budget years represented by gross assets</p>
                <p className={`tnum mt-1 flex flex-wrap items-baseline gap-x-2 font-semibold leading-tight tracking-[-0.045em] text-[var(--accent-ink)] ${fundBudget.coverageYearsFuture === null ? "text-[28px]" : "text-[38px]"}`}>
                  {fundBudget.coverageYearsFuture === null ? "No annual spending" : <>{number.format(fundBudget.coverageYearsFuture)} <span className="text-base font-medium tracking-normal text-[var(--accent-ink)]">years</span></>}
                </p>
                {fundBudget.coverageYearsFuture === null ? <p className="mt-1 text-xs text-[var(--accent-ink)]">Enter grant spending above zero to calculate years of coverage.</p> : <>
                  <p className="tnum mt-1 text-xs leading-relaxed text-[var(--accent-ink)]">At {price.format(futurePrice)} / ZEC{futurePrice !== currentPrice ? <>{" "}<span className="mx-1 text-[var(--accent-muted)]">·</span> {number.format(fundBudget.coverageYearsNow!)} years at today’s price</> : null}</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-[var(--accent-ink)]">Assumes the ZEC price and annual USD budget stay fixed for the entire period.</p>
                </>}
              </div>

              <dl className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
                <dt className="text-xs font-medium text-stone-600">Annual budget used</dt>
                <dd className="tnum text-lg font-semibold tracking-tight" title={money.format(fundBudget.annualSpendingUsd)}>{compactMoney.format(fundBudget.annualSpendingUsd)}<span className="text-xs font-normal tracking-normal text-stone-500"> / year</span></dd>
              </dl>
              <p className="mt-1 text-[11px] text-stone-500">{money.format(toNumber(values.historicalSpend))} {spendingEdited ? "custom spending" : "total grant payments"} ÷ {number.format(toNumber(values.historicalYears))} years you selected</p>

              <table className="tnum mt-4 w-full table-fixed text-left text-xs">
                <caption className="sr-only">Community treasury at the current and scenario ZEC prices</caption>
                <thead><tr className="border-b border-stone-200 text-[11px] text-stone-500">
                  <th scope="col" className="w-[36%] pb-2 font-medium">Same starting balances</th>
                  <th scope="col" className="pb-2 text-right font-medium">Today<span className="mt-0.5 block text-[10px] font-normal">{price.format(currentPrice)} / ZEC</span></th>
                  <th scope="col" className="pb-2 text-right font-semibold text-amber-900">Your scenario<span className="mt-0.5 block text-[10px] font-normal">{price.format(futurePrice)} / ZEC</span></th>
                </tr></thead>
                <tbody className="divide-y divide-[var(--line)]">
                  <tr>
                    <th scope="row" className="py-3 pr-2 font-medium text-stone-600">Treasury value</th>
                    <td className="py-3 text-right"><span className="text-base font-semibold" title={money.format(fundBudget.currentTreasuryUsd)}>{compactMoney.format(fundBudget.currentTreasuryUsd)}</span></td>
                    <td className="py-3 text-right text-amber-900"><span className="text-base font-semibold" title={money.format(fundBudget.futureTreasuryUsd)}>{compactMoney.format(fundBudget.futureTreasuryUsd)}</span></td>
                  </tr>
                  <tr>
                    <th scope="row" className="py-2.5 pr-2 font-medium text-stone-600">% of treasury spent / year</th>
                    <td className="py-2.5 text-right">{fundBudget.annualTreasuryUsePercentNow === null ? "—" : `${number.format(fundBudget.annualTreasuryUsePercentNow)}%`}</td>
                    <td className="py-2.5 text-right font-medium text-amber-900">{fundBudget.annualTreasuryUsePercentFuture === null ? "—" : `${number.format(fundBudget.annualTreasuryUsePercentFuture)}%`}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="py-2.5 pr-2 font-medium text-stone-600">Assumed ZEC sales / year</th>
                    <td className="py-2.5 text-right">{number.format(fundBudget.annualZecSalesNow)}</td>
                    <td className="py-2.5 text-right font-medium text-amber-900">{number.format(fundBudget.annualZecSalesFuture)}</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-3 text-[11px] leading-relaxed text-stone-500">Gross assets include funds already committed to unpaid grants. ZCG and Lockbox require separate approvals to spend. This comparison excludes future funding and rising expenses; it does not forecast how long accessible funds will last.</p>
            </> : <div role="alert" className="rounded-xl border border-[var(--accent-muted)] bg-amber-50 p-4 text-sm text-amber-900">Enter valid spending, asset values, a period above zero, and positive ZEC prices to see fund coverage.</div>}
          </div>
        </div>

        <div className="border-t border-stone-200/80 px-5 py-4 sm:px-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs font-semibold text-stone-700">Starting balances & spending history</h3>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${reportedFundsEdited ? "bg-amber-50 text-amber-800" : "bg-stone-100 text-stone-500"}`}>{reportedFundsEdited ? "Custom values" : "Reported values"}</span>
            </div>
            <span className="text-[11px] text-stone-500"><SourceLink href={devFundData.zcg?.sourceUrl ?? SOURCES.zcg}>View official report ↗</SourceLink></span>
          </div>
          <dl className="grid gap-3 sm:grid-cols-3 sm:divide-x sm:divide-[var(--line)]">
            <div>
              <dt className="text-[11px] text-stone-500">ZCG + Lockbox holdings</dt>
              <dd className="tnum mt-1 text-base font-semibold">{Number.isFinite(fundZec) ? number.format(fundZec) : "Unavailable"}<span className="ml-1 text-[11px] font-normal text-stone-500">ZEC</span></dd>
            </div>
            <div className="sm:pl-4">
              <dt className="text-[11px] text-stone-500">USD cash in treasury</dt>
              <dd className="tnum mt-1 text-base font-semibold">{Number.isFinite(fundCash) ? money.format(fundCash) : "Unavailable"}</dd>
            </div>
            <div className="sm:pl-4">
              <dt className="text-[11px] text-stone-500">{spendingEdited ? "Custom spending history" : "ZCG grant payments · all time"}</dt>
              <dd className="tnum mt-1 text-base font-semibold">{Number.isFinite(toNumber(values.historicalSpend)) ? money.format(toNumber(values.historicalSpend)) : "Unavailable"}</dd>
            </div>
          </dl>
          <details className="group mt-3 rounded-lg border border-stone-200 bg-[var(--surface2)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-medium text-stone-700 transition hover:bg-[var(--surface2)]">
              Edit starting balances & spending history <span aria-hidden="true" className="text-base leading-none text-stone-400 transition-transform group-open:rotate-45">+</span>
            </summary>
            <div className="grid gap-3 px-3 pt-1 pb-3 sm:grid-cols-3">
              <Field label="ZCG + Lockbox holdings" value={useReportedTreasury ? defaults.fundZec : values.fundZec} onChange={(value) => editFundBalance("fundZec", value)} unit="ZEC" />
              <Field label="USD cash in treasury" value={useReportedTreasury ? defaults.fundCash : values.fundCash} onChange={(value) => editFundBalance("fundCash", value)} unit="USD" />
              <Field label="Total ZCG grant payments" value={values.historicalSpend} onChange={(value) => edit("historicalSpend", value)} unit="USD" />
              <p className="text-[11px] leading-relaxed text-stone-500 sm:col-span-3">The reported total includes grant milestones and grant-funded contractor payments. Choose how many years to divide it by to estimate annual spending. Separate discretionary spending and committee stipends are excluded.</p>
              {reportedFundsEdited && <button type="button" onClick={restoreReportedFunds} className="w-fit text-xs font-medium text-amber-800 underline underline-offset-4 sm:col-span-3">Restore reported values</button>}
            </div>
          </details>
          <p className="mt-2 text-[11px] leading-relaxed text-stone-500">
            {devFundData.zcg ? `ZCG balance anchor: ${reportDate(devFundData.zcg.snapshotAt)}; retrieved ${quoteTime(devFundData.zcg.importedAt)}.` : "ZCG report unavailable."} {devFundData.lockbox ? `Lockbox accrued through block ${whole.format(devFundData.lockbox.height)}.` : "Lockbox balance unavailable."}
            {(devFundData.zcg?.updatesRequired || devFundData.lockbox?.updatesRequired) && ` The official ${devFundData.zcg?.updatesRequired ? "ZCG" : "Lockbox"} report is marked “updates required”.`}
          </p>
        </div>

        {fundBudget && scenario && <details className="group border-t border-stone-200/80 bg-[var(--surface2)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-xs font-medium text-stone-600 sm:px-6">
            <span className="min-w-0 flex-1">Funding schedule & estimated market supply<span className="mt-1 block text-[11px] font-normal text-stone-500">Other miners + fund sales at today’s price</span></span>
            <span className="tnum shrink-0 text-right" aria-live="polite" aria-atomic="true"><span className="block text-sm font-semibold text-stone-800">{number.format(scenario.potentialMarketSalesPerDayZec)} ZEC/day</span><span className="mt-0.5 block text-[10px] font-normal text-stone-500">assumed offers</span></span>
            <span aria-hidden="true" className="text-base leading-none text-stone-400 transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="space-y-2 px-5 pb-4 text-xs leading-relaxed text-stone-500 sm:px-6">
            <p>{toNumber(values.fundAllocation) !== 20 ? "Custom allocation scenario. " : ""}{continueDevFund ? "Scenario: allocation continues after the next halving." : "Funding ends at the next halving, following the current schedule."} Halvings reduce new issuance. These inflows are excluded from the spending coverage above.</p>
            <p className="tnum">New ZEC received by the funds: {number.format(scenario.devFundPerDayZec)} ZEC/day. Estimated sales at today’s price: {number.format(otherMinerOffersPerDay!)} from other miners + {number.format(scenario.budgetSalesPerDayZec)} to pay expenses = <strong className="font-medium text-stone-700">{number.format(scenario.potentialMarketSalesPerDayZec)} ZEC/day</strong>. This estimate depends on the sale percentages you entered; actual market liquidity is unknown.</p>
            <p className="tnum">Other miners are assumed to sell {values.minerSales}% of their rewards, editable under “Edit company assumptions” in the Company tab.{scenario.devFundPerDayZec > 0 ? ` The spending sale equivalent is ${number.format(scenario.budgetSalesPerDayZec / scenario.devFundPerDayZec * 100)}% of current fund inflows.` : ""}</p>
            {useReportedTreasury && devFundData.zcg && devFundData.lockbox && <p className="tnum">ZCG: {devFundData.zcg.zec === null ? "unavailable" : `${number.format(devFundData.zcg.zec)} ZEC`} + {devFundData.zcg.cashUsd === null ? "cash unavailable" : money.format(devFundData.zcg.cashUsd)} cash. Lockbox: {number.format(devFundData.lockbox.zec)} ZEC. {fundValue !== null && Number.isFinite(fundValue) ? `Combined value today: ${money.format(fundValue)}.` : ""}</p>}
          </div>
        </details>}
      </section>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-stone-500">
        <p>{priceEdited ? "Current price entered by you" : initialPriceUsd === null ? "Current market price unavailable" : `${priceStale ? "Last available" : "Market"} quote · ${quoteTime(priceQuotedAt)}`}</p>
        <p>USD purchase estimates · excludes mining costs & market impact</p>
      </div>
      <p className="mt-1 text-[11px] text-stone-500">All dollar amounts are USD. M = million · B = billion. Future prices and sale percentages are your assumptions.</p>
      {(supplyStale || supplyFallbackDate) && !supplyEdited && <p className="mt-1 text-[11px] text-amber-800">Last available circulating supply reading: {supplyFallbackDate ?? quoteTime(supplyQuotedAt)}.</p>}

      <details className="group mt-4 border-t border-stone-200 pt-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-stone-600">
          Sources & calculation <span aria-hidden="true" className="text-stone-400 transition-transform group-open:rotate-180">⌄</span>
        </summary>
        <div className="mt-4 grid gap-5 text-xs leading-relaxed text-stone-500 md:grid-cols-2">
          <div className="space-y-2.5">
            <p><SourceLink href={SOURCES.company}>Cypherpunk dashboard</SourceLink> · 326,417.51 ZEC, checked Sep 23, 2026. The latest ZEC entry is dated Aug 31 and already includes mining.</p>
            <p><SourceLink href={SOURCES.mining}>Company release · Sep 22, 2026</SourceLink> · 3,023.13 ZEC mined Aug 18–31, all added to treasury. The model averages this over 14 calendar days; exact operating hours and the subsidy/fee split are not disclosed.</p>
            <p><SourceLink href={SOURCES.goal}>Company annual report · p. 8</SourceLink> · goal of at least 5% of total circulating supply.</p>
            <p><SourceLink href={SOURCES.economics}>Zcash economics</SourceLink> · 21M cap, 75-second blocks, 1.5625 ZEC subsidy in the current era: 1,800 ZEC/day total, 1,440 to miners.</p>
            <p><SourceLink href={SOURCES.market}>CoinGecko market data</SourceLink> · {supplyEdited ? "manually edited supply" : `${whole.format(initialCirculatingSupplyZec)} circulating ZEC`}. {supplyFallbackDate ? `Snapshot: ${supplyFallbackDate}.` : `Supply reading: ${quoteTime(supplyQuotedAt)}.`}</p>
            <p><SourceLink href={devFundData.zcg?.sourceUrl ?? SOURCES.zcg}>Official ZCG balance report</SourceLink> · {devFundData.zcg ? <>
              {devFundData.zcg.paidMilestonesUsd === null ? "Paid milestones unavailable" : `${money.format(devFundData.zcg.paidMilestonesUsd)} of cumulative paid grant milestones`}; {devFundData.zcg.zec === null ? "ZEC balance unavailable" : `${number.format(devFundData.zcg.zec)} ZEC`}; {devFundData.zcg.cashUsd === null ? "cash unavailable" : `${money.format(devFundData.zcg.cashUsd)} cash`}. Balance block dated {reportDate(devFundData.zcg.snapshotAt)}, retrieved {quoteTime(devFundData.zcg.importedAt)}. Other cells can be revised without changing the block date. Paid milestones include grant-funded contractors; separate discretionary spending and committee stipends are excluded.
            </> : "Report unavailable. Enter a manual scenario value."}</p>
            <p><SourceLink href={devFundData.lockbox?.sourceUrl ?? SOURCES.zcg}>Official Lockbox / Coinholder report</SourceLink> · {devFundData.lockbox ? <>
              {number.format(devFundData.lockbox.zec)} ZEC, using the {reportDate(devFundData.lockbox.snapshotAt)} balance plus protocol accrual through block {whole.format(devFundData.lockbox.height)}. Retrieved {quoteTime(devFundData.lockbox.importedAt)}. Later payouts require a new source balance. The combined valuation uses the same balances as the home-page treasury overview, at this calculator’s current ZEC price. Source CSV balances are rounded; future receivables are excluded.
            </> : "Balance unavailable. Enter a manual scenario value."}</p>
          </div>
          <div className="space-y-2.5">
            <p><strong className="font-medium text-stone-700">Purchase need</strong> = max(0, target % × supply − holdings − projected mining) × ZEC price. Each scenario uses its own price and projected supply. Mining starts from the reported balance; no undisclosed mining is added.</p>
            <p><SourceLink href={SOURCES.schedule}>Halving schedule</SourceLink> · output steps down every 1,680,000 blocks. The next halving is at block 4,406,400. Network height used: {whole.format(network.height)} ({network.shared ? "saved scenario assumption" : network.snapshot ? `company dashboard snapshot, ${NETWORK_SNAPSHOT_DATE}` : "node reading via lightwalletd"}). Block times are estimates.</p>
            {scenario && <p>
              {scenario.simpleYearsToMineTodayGap === null ? "Without mining output, purchases are needed to close the gap." : scenario.simpleYearsToMineTodayGap === 0 ? "The treasury already meets today’s target." : <><strong className="font-medium text-stone-700">Constant-output benchmark: {number.format(scenario.simpleYearsToMineTodayGap)} years</strong> to mine today’s gap at {number.format(scenario.miningPerDayZec)} ZEC/day. This simplified comparison freezes both supply and mining output. The main mining result follows the full halving schedule.</>}
            </p>}
            <p><SourceLink href={SOURCES.funding}>Funding rules · ZIP 214</SourceLink> · currently 20% goes to funding (8% grants, 12% deferred fund). The default follows its scheduled expiry at the third halving. Editing the allocation or enabling renewal creates a hypothetical scenario. Halvings still reduce total issuance in every mode.</p>
            <p>Annual spending = historical USD spending / historical years. Fund assets at each price = ZEC holdings × that price + USD cash. Coverage = those assets / annual spending, holding today’s balances and annual USD expenses constant. This compares valuations; it does not project balances after the mining horizon, future inflows or inflation. ZEC sale equivalent = annual spending × assumed share funded by ZEC sales / scenario price. Cash-funded payments require no new ZEC sale. The ZCG spending average is only a proxy for future combined-fund spending; the two pools have different governance and expenses.</p>
            <p>The observed share of miner rewards{scenario ? ` (${number.format(scenario.minerRewardSharePercent)}%)` : ""} is calibrated against the official allocation in the observation’s era (Aug 2026 for the company preset; the current era for custom output), then held constant. All company mining is retained. Market circulating supply and the node height are separate readings; projected issuance is added to that market baseline, capped at 21M. This can differ from protocol-issued supply. Funding retention changes potential offers without automatically adding a price premium. Order-book depth and other holders’ sales are not measured.</p>
            <p>Mining electricity, equipment, fees, taxes and purchase slippage are excluded. Saved market purchases are not mining profit. Future prices are your assumptions.</p>
          </div>
        </div>
      </details>
    </div>
  );
}
