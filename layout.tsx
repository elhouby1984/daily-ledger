import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daily Ledger",
  description: "A professional browser-based daily ledger."
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}