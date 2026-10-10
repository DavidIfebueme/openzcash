import localFont from "next/font/local";
import type { ReactNode } from "react";

/**
 * The Zcash Ceremony pages set their titles in a serif, loaded here so the
 * rest of the workspace never downloads it. The bundled font also keeps
 * production builds independent of the Google Fonts stylesheet response.
 */
const serif = localFont({
  src: "./fonts/cormorant-garamond.woff2",
  weight: "500 600",
  style: "normal",
  variable: "--font-ceremony",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

export default function CeremonyLayout({ children }: { children: ReactNode }) {
  return <div className={serif.variable}>{children}</div>;
}
