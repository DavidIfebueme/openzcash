import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import "./redesign.css";
import "./workspace.css";
import "./theme.css";
import "./zarvis/zarvis.css";
import "./mobile-shell.css";
import { ShellGate } from "@/components/shell-gate";
import { TreasuryBar } from "@/components/treasury-bar";
import { rootShareMetadata, SITE_DESCRIPTION } from "@/lib/seo/page-metadata";

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
  description: SITE_DESCRIPTION,
  // metadataBase and the site-wide share fields (site name, default card).
  // No og:title here: every page shares under its own title.
  ...rootShareMetadata(),
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
  // shell pads its bars with env(safe-area-inset-*) (theme.css and
  // mobile-shell.css).
  viewportFit: "cover",
};

async function SiteTreasuryBar() {
  // The chat is rendered on its own small client shell. Avoid fetching site
  // treasury data on a direct chat request, including on the isolated pilot.
  if ((await headers()).get("x-pathname") === "/private-chat") return null;
  return <TreasuryBar />;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Management controls stay off even for clients holding an old session.
  const isAdmin = false;

  return (
    <html
      lang="en"
      className={`${inter.variable} ${geist.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full">
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
              <SiteTreasuryBar />
            </Suspense>
          }
        >
          {children}
        </ShellGate>
      </body>
    </html>
  );
}
