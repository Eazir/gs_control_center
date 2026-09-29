import NextTopLoader from 'nextjs-toploader';
import type { Metadata } from 'next';
import React from 'react';
import './globals.css';
import { ProjectProvider } from '@/contexts/project-context';
import { Space_Grotesk } from "next/font/google";
import { cn } from "@/lib/utils";

const spaceGrotesk = Space_Grotesk({subsets:['latin'],variable:'--font-sans'});

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

