import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stock Picker IDX",
  description: "Rekomendasi saham IDX berbasis analisis real-time",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
