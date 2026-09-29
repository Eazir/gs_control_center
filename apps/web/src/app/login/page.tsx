'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { GrowthSellHexagon } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchWithAuth } from '@/lib/api-client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Guest Guard: si el usuario ya está autenticado, redirigir a dashboard
  useEffect(() => {
    const checkExistingSession = async () => {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('gs_access_token') || sessionStorage.getItem('gs_access_token')
          : null;

      if (!token) {
        setIsCheckingAuth(false);
        return;
      }

      try {
        const res = await fetchWithAuth('/auth/me');
        if (res.ok) {
          router.replace('/dashboard');
          return;
        }
      } catch {
        // Ignorar y limpiar token inválido
      }

      localStorage.removeItem('gs_access_token');
      localStorage.removeItem('gs_user_role');
      sessionStorage.removeItem('gs_access_token');
      sessionStorage.removeItem('gs_user_role');
      setIsCheckingAuth(false);
    };

    checkExistingSession();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Enviar y recibir cookies HttpOnly
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Credenciales inválidas. Verifica tu correo y contraseña.');
      }

      setSuccessMsg(`¡Bienvenido de nuevo, ${data.user?.fullName || 'Usuario'}! Redirigiendo...`);

      // Guardar token en localStorage como fuente única de verdad para sincronización entre pestañas
      if (data.tokens?.accessToken) {
        localStorage.setItem('gs_access_token', data.tokens.accessToken);
        localStorage.setItem('gs_user_role', data.user.role);
        sessionStorage.removeItem('gs_access_token');
        sessionStorage.removeItem('gs_user_role');
      }

      setTimeout(() => {
        router.push('/dashboard');
      }, 1200);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error inesperado al iniciar sesión';
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background">

      {/* Área Central: Tarjeta de Login */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
        {/* Glow de fondo dorado muy sutil */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

        <Card className="w-full max-w-[420px] border-border bg-card/95 relative z-10 p-2 sm:p-4 shadow-2xl">
          <CardContent className="pt-6">
            {/* Logo y Encabezado */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="mb-5 transition-transform hover:scale-105">
                <GrowthSellHexagon size={48} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Iniciar sesión
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                {isCheckingAuth ? 'Comprobando sesión...' : 'Ingresa a tu Centro de Mando.'}
              </p>
            </div>

            {isCheckingAuth ? (
              <div className="space-y-6 py-2 animate-in fade-in-50">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28 bg-muted/60" />
                  <Skeleton className="h-10 w-full bg-muted/40" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24 bg-muted/60" />
                  <Skeleton className="h-10 w-full bg-muted/40" />
                </div>
                <Skeleton className="h-11 w-full rounded-md bg-muted/60 mt-4" />
                <div className="flex justify-center pt-2">
                  <Skeleton className="h-3 w-36 bg-muted/40" />
                </div>
              </div>
            ) : (
              <>
                {/* Mensajes de Alerta */}
                {errorMsg && (
                  <Alert variant="destructive" className="mb-6 animate-in fade-in-50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error de autenticación</AlertTitle>
                    <AlertDescription>{errorMsg}</AlertDescription>
                  </Alert>
                )}

                {successMsg && (
                  <Alert variant="success" className="mb-6 animate-in fade-in-50">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Acceso concedido</AlertTitle>
                    <AlertDescription>{successMsg}</AlertDescription>
                  </Alert>
                )}

                {/* Formulario */}
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo electrónico</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@growthsell.com"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Contraseña</Label>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••••••"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full mt-2 font-bold tracking-wide uppercase text-xs h-11"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Validando credenciales...
                      </>
                    ) : (
                      'Iniciar sesión'
                    )}
                  </Button>

                  <div className="text-center pt-2">
                    <Link
                      href="/recuperar"
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
