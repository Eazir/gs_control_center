import NextTopLoader from 'nextjs-toploader';
import type { Metadata } from 'next';
import React from 'react';
import './globals.css';
import { ProjectProvider } from '@/contexts/project-context';
import localFont from "next/font/local";
import { cn } from "@/lib/utils";

// Fuente auto-hospedada (Space Grotesk, variable 300–700, subset latin) para no
// depender de la red hacia fonts.gstatic.com al compilar en dev o en CI.
const spaceGrotesk = localFont({
  src: "./fonts/space-grotesk-latin.woff2",
  variable: "--font-sans",
  weight: "300 700",
  display: "swap",
});

export const metadata: Metadata = {
  title: 'GrowthSell | Centro de Mando',
  description: 'Plataforma para operar unidades comerciales de infoproductos',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={cn("dark", "font-sans", spaceGrotesk.variable)}>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased selection:bg-primary/30 selection:text-primary">
        <NextTopLoader color="var(--color-primary)" showSpinner={false} />
        <ProjectProvider>{children}</ProjectProvider>
      </body>
    </html>
  );
}

