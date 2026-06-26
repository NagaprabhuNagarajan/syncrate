import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/shared/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Syncrate — Connected Business Operating System",
    template: "%s | Syncrate",
  },
  description:
    "AI-powered Connected Business Operating System for SMEs. Manage inventory, invoicing, purchases, and supplier networks in one platform.",
  keywords: [
    "business management",
    "invoicing",
    "inventory",
    "GST billing",
    "ERP",
    "SME",
  ],
  authors: [{ name: "Syncrate" }],
  creator: "Syncrate",
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2563EB" },
    { media: "(prefers-color-scheme: dark)", color: "#1E40AF" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
