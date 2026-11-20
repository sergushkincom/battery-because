import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Suspense } from "react";
import { DemoProvider } from "@/components/demo-store";
import { Shell } from "@/components/shell";
import { getDataset } from "@/lib/mock/generate";
import "./globals.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Because — battery revenue, with the reason",
  description: "A console for owners and operators of grid-scale batteries. Every number comes with a reason.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const ds = getDataset();
  const assets = ds.portfolios.flatMap((portfolio) =>
    portfolio.assetIds.map((id) => {
      const asset = ds.assets.find((item) => item.id === id)!;
      return { id: asset.id, name: asset.name, portfolioId: portfolio.id };
    }),
  );
  const pending = ds.approvals.filter((item) => item.state === "pending").length;

  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("because-theme");var role=new URLSearchParams(location.search).get("role");var dark=t?t==="dark":role==="operator";if(dark)document.documentElement.classList.add("dark");}catch(e){}`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <DemoProvider>
          <Suspense fallback={<div className="p-6 text-muted-foreground">Loading the book…</div>}>
            <Shell portfolios={ds.portfolios.map((p) => ({ id: p.id, name: p.name }))} assets={assets} pendingSeed={pending}>
              {children}
            </Shell>
          </Suspense>
        </DemoProvider>
      </body>
    </html>
  );
}
