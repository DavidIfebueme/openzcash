import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import "./redesign.css";
import "./workspace.css";
import "./theme.css";
import "./zarvis/zarvis.css";
import { ShellGate } from "@/components/shell-gate";
import { TapFeedback } from "@/components/tap-feedback";
import { TreasuryBar } from "@/components/treasury-bar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OpenZcash · Dev Fund treasury and public transparency",
  description:
    "Public transparency for the Zcash Dev Fund: ZCG and FPF grant accounting, the live Lockbox, and governance, read-only and mirrored from the official sources.",
  applicationName: "OpenZcash",
  ...(process.env.OPENZCASH_ENV === "redesign"
    ? { robots: { index: false, follow: false } }
    : {}),
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "OpenZcash",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  // The shell is light by default (the theme toggle is per browser, not per
  // OS), so the browser chrome follows the cream canvas.
  themeColor: "#faf8f4",
  width: "device-width",
  initialScale: 1,
  // The installed app paints under the notch and the home indicator; the
  // shell pads its bars with env(safe-area-inset-*) (theme.css, "Phones").
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The bare-vs-shell decision is made client-side in ShellGate (reacts to
  // navigation); here we only need the admin flag for the shell's controls.
  const isAdmin = (await headers()).get("x-admin") === "1";

  return (
    <html
      lang="en"
      className={`${inter.variable} ${geist.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full">
        <TapFeedback />
        <ShellGate
          isAdmin={isAdmin}
          isPreview={process.env.OPENZCASH_ENV === "redesign"}
          footer={
            <Suspense
              fallback={
                <div className="rd-treasury-inner" aria-busy="true">
                  <span className="rd-treasury-name">Treasury at a glance</span>
                </div>
              }
            >
              <TreasuryBar />
            </Suspense>
          }
        >
          {children}
        </ShellGate>
      </body>
    </html>
  );
}
