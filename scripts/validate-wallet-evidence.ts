import { HARDWARE, SOFTWARE } from "../src/app/wallets/catalog-data";
import { WALLET_EVIDENCE } from "../src/lib/wallet-finder/evidence";
import { validateWalletEvidence } from "../src/lib/wallet-finder/matching";

const errors = validateWalletEvidence(WALLET_EVIDENCE);
const catalog = new Set([...SOFTWARE, ...HARDWARE].map(wallet => wallet.name));
const reviewed = new Set(WALLET_EVIDENCE.map(wallet => wallet.walletName));
for (const name of catalog) if (!reviewed.has(name)) errors.push(`${name}: evidence profile missing`);
for (const name of reviewed) if (!catalog.has(name)) errors.push(`${name}: not present in catalog`);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Wallet evidence schema and catalog coverage passed (${reviewed.size} profiles). This check does not verify source truth.`);
}
