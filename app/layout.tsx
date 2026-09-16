import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NOM_PLATEFORME } from "@/lib/constantes";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${NOM_PLATEFORME} — La plateforme des beatmakers`,
  description: "Crée ta boutique de beats, vends tes licences, gère tes collabs et tes abonnés.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
