import { z } from "zod";
import { TREASURY_ACCOUNT } from "./account";

export const TREASURY_KEY_SHA256 = "d11c16ff8152d67188ddead5705e10f63cb74e05a089280ffaba122569f672c9";
export const TREASURY_STALE_MS = 120_000;
const height = z.number().int().nonnegative();
const amount = z.string().regex(/^(0|[1-9]\d{0,15})$/).refine((v) => BigInt(v) <= 2_100_000_000_000_000n);
const datetime = z.iso.datetime();

export const treasuryTransactionSchema = z.object({
  txid: z.string().regex(/^[a-f0-9]{64}$/),
  direction: z.enum(["incoming", "outgoing", "internal"]),
  amountZatoshis: amount,
  feeZatoshis: amount.nullable(),
  recoveredOutputZatoshis: amount.nullable().optional(),
  height,
  confirmedAt: datetime,
  memos: z.array(z.string().max(512)).max(200),
});
export type TreasuryTransaction = z.infer<typeof treasuryTransactionSchema>;

export const treasurySnapshotSchema = z.object({
  version: z.literal(1),
  scanScope: z.literal("external-and-internal"),
  network: z.literal("mainnet"),
  address: z.literal(TREASURY_ACCOUNT.address),
  viewingKeySha256: z.literal(TREASURY_KEY_SHA256),
  source: z.literal("ZKool · public full viewing key"),
  scanStartHeight: height,
  syncedHeight: height,
  tipHeight: height,
  syncedAt: datetime,
  balanceZatoshis: amount,
  receivedZatoshis: amount,
  spentZatoshis: amount,
  transactions: z.array(treasuryTransactionSchema).max(100_000),
}).superRefine((s, ctx) => {
  let received = 0n;
  let spent = 0n;
  const txids = new Set<string>();
  for (const tx of s.transactions) {
    if (tx.direction === "incoming") received += BigInt(tx.amountZatoshis);
    if (tx.direction === "outgoing") spent += BigInt(tx.amountZatoshis);
    if (txids.has(tx.txid) || tx.height < s.scanStartHeight || tx.height > s.syncedHeight || (tx.direction === "internal" && tx.amountZatoshis !== "0")) {
      ctx.addIssue({ code: "custom", message: "Invalid transaction coverage" });
    }
    txids.add(tx.txid);
  }
  if (s.scanStartHeight > s.syncedHeight || s.tipHeight < s.syncedHeight || received.toString() !== s.receivedZatoshis || spent.toString() !== s.spentZatoshis || received - spent !== BigInt(s.balanceZatoshis)) {
    ctx.addIssue({ code: "custom", message: "Treasury ledger does not reconcile" });
  }
});
export type TreasurySnapshot = z.infer<typeof treasurySnapshotSchema>;

export const treasuryFeedSchema = z.object({
  status: z.enum(["unavailable", "syncing", "synced", "stale", "error"]),
  snapshot: treasurySnapshotSchema.nullable(),
});
export type TreasuryFeed = z.infer<typeof treasuryFeedSchema>;

/** No floating-point conversion, including BigDecimal's scientific notation. */
export function parseZec(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d{1,3}))?$/.exec(value);
  if (!match) throw new Error("Invalid ZEC amount");
  const [, sign, integer, fraction = "", exponent = "0"] = match;
  const digits = BigInt(integer + fraction);
  const scale = 8 + Number(exponent) - fraction.length;
  if (Math.abs(scale) > 30) throw new Error("Invalid ZEC scale");
  const divisor = 10n ** BigInt(Math.max(0, -scale));
  if (digits % divisor !== 0n) throw new Error("Fractional zatoshi");
  const result = digits * 10n ** BigInt(Math.max(0, scale)) / divisor;
  if (result > 2_100_000_000_000_000n) throw new Error("ZEC amount exceeds supply");
  return sign ? -result : result;
}

const decimal = z.string().max(100);
export const engineLedgerSchema = z.object({
  accounts: z.array(z.object({ id: height, birth: height, height, incomingOnly: z.literal(false) })).length(1),
  balanceByAccount: z.object({ height, total: decimal }),
  transactionsByAccount: z.array(z.object({
    txid: z.string().regex(/^[a-fA-F0-9]{64}$/),
    height: height.positive(),
    time: z.string(),
    value: decimal,
    notes: z.array(z.object({ scope: z.number().int(), memo: z.string().nullable() })),
    outputs: z.array(z.object({ value: decimal, memo: z.string().nullable() })),
  })),
});

export function buildTreasurySnapshot(raw: unknown, tipHeight: number, syncedAt: string): TreasurySnapshot {
  const data = engineLedgerSchema.parse(raw);
  const account = data.accounts[0];
  if (account.height !== data.balanceByAccount.height || account.height < tipHeight) throw new Error("Incomplete treasury scan");
  let received = 0n;
  let spent = 0n;
  const transactions = data.transactionsByAccount.map((tx): TreasuryTransaction => {
    const net = parseZec(tx.value);
    const recovered = tx.outputs.reduce((sum, output) => sum + parseZec(output.value), 0n);
    if (net > 0n) received += net;
    if (net < 0n) spent -= net;
    // Full details are decoded by the wallet engine. Never render binary memo bytes.
    const memos = [...new Set([...tx.notes.filter((n) => n.scope === 0), ...tx.outputs].map((n) => n.memo).filter((m): m is string => !!m?.trim()))];
    // GraphQL LocalDateTime has no suffix; the engine constructs it from UTC epoch time.
    const confirmedAt = new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(tx.time) ? tx.time : `${tx.time}Z`).toISOString();
    return {
      txid: tx.txid.toLowerCase(),
      direction: net > 0n ? "incoming" : net < 0n ? "outgoing" : "internal",
      amountZatoshis: (net < 0n ? -net : net).toString(),
      feeZatoshis: null,
      recoveredOutputZatoshis: net < 0n && tx.outputs.length > 0 ? recovered.toString() : null,
      height: tx.height,
      confirmedAt,
      memos,
    };
  }).sort((a, b) => b.height - a.height || a.txid.localeCompare(b.txid));
  return treasurySnapshotSchema.parse({
    version: 1, scanScope: "external-and-internal", network: "mainnet", address: TREASURY_ACCOUNT.address, viewingKeySha256: TREASURY_KEY_SHA256,
    source: "ZKool · public full viewing key", scanStartHeight: account.birth, syncedHeight: account.height,
    tipHeight: Math.max(tipHeight, account.height), syncedAt, balanceZatoshis: parseZec(data.balanceByAccount.total).toString(),
    receivedZatoshis: received.toString(), spentZatoshis: spent.toString(), transactions,
  });
}
