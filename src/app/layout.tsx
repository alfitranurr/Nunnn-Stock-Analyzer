import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

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
    <html lang="id" className="dark" suppressHydrationWarning>
      <body className="antialiased min-h-screen">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
