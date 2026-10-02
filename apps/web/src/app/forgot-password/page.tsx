'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { GrowthSellHexagon } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email) {
      setErrorMsg('Por favor ingresa tu correo electrónico.');
      return;
    }

    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Error al procesar la solicitud.');
      }

      setSuccessMsg(data.message || 'Si el correo está registrado, recibirás un enlace de recuperación.');
      setEmail('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error inesperado';
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Elementos decorativos de fondo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <Card className="w-full max-w-[420px] border-border bg-card/95 relative z-10 p-2 sm:p-4 shadow-2xl">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="mb-5 transition-transform hover:scale-105">
              <GrowthSellHexagon size={48} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Recuperar Contraseña
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Ingresa el correo asociado a tu cuenta y te enviaremos las instrucciones para restablecer tu acceso.
            </p>
          </div>

          {errorMsg && (
            <Alert variant="destructive" className="mb-5 animate-in fade-in-50 border-red-500/30 bg-red-950/40 text-red-200">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="text-xs mt-1">{errorMsg}</AlertDescription>
            </Alert>
          )}

          {successMsg && (
            <Alert variant="success" className="mb-5 animate-in fade-in-50 bg-emerald-950/40 border-emerald-500/30 text-emerald-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <AlertTitle>Solicitud enviada</AlertTitle>
              <AlertDescription className="text-xs mt-1">{successMsg}</AlertDescription>
            </Alert>
          )}

          {!successMsg && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">
                  Correo Electrónico
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="nombre@ejemplo.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className="pl-10 h-10 text-xs"
                    autoComplete="email"
                    autoFocus
                  />
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <Button
                type="submit"
                variant="gold"
                className="w-full font-bold tracking-wider uppercase text-xs h-10 shadow-lg mt-2"
                disabled={isLoading || !email}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar Enlace de Recuperación'
                )}
              </Button>
            </form>
          )}

          <div className="text-center mt-6">
            <Link
              href="/login"
              className="inline-flex items-center text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Volver al inicio de sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
