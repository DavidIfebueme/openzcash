import { permanentRedirect } from "next/navigation";

export default function LegacyMarketPage() {
  permanentRedirect("/zec-observatory");
}
