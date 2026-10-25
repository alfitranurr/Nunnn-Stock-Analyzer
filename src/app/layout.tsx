import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ClientBootstrap } from "@/components/client-bootstrap";
import { AppSplash } from "@/components/app-splash";
import { LanguageProvider } from "@/lib/language-context";
import "./globals.css";

// Di-host sendiri oleh next/font (CSP hanya mengizinkan font dari origin ini).
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["500", "600"], display: "swap", variable: "--font-inter-tight" });

export const metadata: Metadata = {
  title: "Nunnn Stock - Kalkulator Average Down Saham Indonesia (BEI/IDX)",
  description: "Simulasikan rencana pembelian saham Average Down (pembelian bertahap) secara presisi dengan kalkulasi broker fee (pajak transaksi, levy, PPh) khusus pasar saham Indonesia (BEI/IDX).",
  keywords: "saham, average down, kalkulator saham, bursa efek indonesia, bei, idx, investasi, trading, stockbit, ajaib, ipot",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`dark ${inter.variable} ${interTight.variable}`} suppressHydrationWarning>
      <body className="antialiased min-h-screen">
        {/* Animasi pemuatan awal: dirender server agar langsung tampil saat reload */}
        <AppSplash />
        <ClientBootstrap />
        <LanguageProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            forcedTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
