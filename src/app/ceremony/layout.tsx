import { Cormorant_Garamond } from "next/font/google";
import type { ReactNode } from "react";

/**
 * The Zcash Ceremony pages set their titles in a serif, loaded here so the
 * rest of the workspace never downloads it. next/font self-hosts the file.
 */
const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-ceremony",
  display: "swap",
});

export default function CeremonyLayout({ children }: { children: ReactNode }) {
  return <div className={serif.variable}>{children}</div>;
}
