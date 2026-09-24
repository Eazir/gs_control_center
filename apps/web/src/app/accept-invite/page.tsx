'use client';

import React, { useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mail,
  ShieldCheck,
  Check,
  X,
  ArrowRight,
} from 'lucide-react';
import { GrowthShellHexagon } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tokenParam = searchParams.get('token') || '';
  const emailParam = searchParams.get('email') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Validación de requisitos de contraseña
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isFormValid = hasMinLength && hasUppercase && hasNumber && passwordsMatch;

  // Comprobar si el token está ausente o es inválido en la URL
  const isTokenMissing = !tokenParam || tokenParam === 'undefined' || tokenParam.length < 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (isTokenMissing) {
      setErrorMsg(
        'El enlace de invitación está incompleto o es inválido. Por favor solicita al administrador un nuevo enlace.'
      );
      return;
    }

    if (!hasMinLength) {
      setErrorMsg('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (!hasUppercase) {
      setErrorMsg('La contraseña debe contener al menos una letra mayúscula (A-Z).');
      return;
    }

    if (!hasNumber) {
      setErrorMsg('La contraseña debe contener al menos un número (0-9).');
      return;
    }

    if (!passwordsMatch) {
      setErrorMsg('Las contraseñas no coinciden. Por favor verifícalas.');
      return;
    }

    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/auth/accept-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: tokenParam,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        let message = data.message || 'Error al activar la cuenta.';
        if (Array.isArray(data.errors) && data.errors.length > 0) {
          message = data.errors.join(' • ');
        }
        if (message.includes('inválida o expirada')) {
          message = 'Esta invitación ya fue utilizada o ha expirado. Si ya creaste tu contraseña, puedes iniciar sesión directamente.';
        }
        throw new Error(message);
      }

      setSuccessMsg('¡Tu cuenta ha sido activada exitosamente! Redirigiendo al inicio de sesión...');

      setTimeout(() => {
        router.push('/login');
      }, 1800);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error inesperado al activar la cuenta';
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-[440px] border-border bg-card/95 relative z-10 p-2 sm:p-4 shadow-2xl">
      <CardContent className="pt-6">
        {/* Logo y Encabezado */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-5 transition-transform hover:scale-105">
            <GrowthShellHexagon size={48} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Bienvenido a GrowthShell
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Establece tu contraseña para activar tu acceso seguro.
          </p>
        </div>

        {/* Pill de Correo Asignado */}
        {emailParam && (
          <div className="mb-5 rounded-lg bg-popover border border-border p-3 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
              Tu correo de acceso:
            </span>
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Mail size={13} className="opacity-80" />
              <span className="truncate max-w-[300px]">{emailParam}</span>
            </div>
          </div>
        )}

        {/* Alerta si el token no viene en la URL */}
        {isTokenMissing && (
          <Alert variant="destructive" className="mb-5 border-amber-500/30 bg-amber-950/40 text-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <AlertTitle>Enlace incompleto</AlertTitle>
            <AlertDescription className="text-xs mt-1">
              El enlace no contiene el token de invitación correspondiente. Por favor pídele al administrador que renueve y copie nuevamente tu enlace de invitación.
              <div className="mt-3">
                <Link href="/login">
                  <Button variant="outline" size="sm" className="h-8 text-xs w-full border-amber-500/30">
                    Ir al inicio de sesión <ArrowRight size={13} className="ml-1" />
                  </Button>
                </Link>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Mensajes de Alerta */}
        {errorMsg && !isTokenMissing && (
          <Alert variant="destructive" className="mb-5 animate-in fade-in-50 border-red-500/30 bg-red-950/40 text-red-200">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertTitle>No se pudo activar la cuenta</AlertTitle>
            <AlertDescription className="text-xs mt-1">{errorMsg}</AlertDescription>
          </Alert>
        )}

        {successMsg && (
          <Alert variant="success" className="mb-5 animate-in fade-in-50">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>¡Activación completada!</AlertTitle>
            <AlertDescription className="text-xs">{successMsg}</AlertDescription>
          </Alert>
        )}

        {/* Formulario de Establecimiento de Contraseña */}
        {!isTokenMissing && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs">
                Nueva Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Crea una contraseña segura"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="pr-10 h-10 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-xs">
                Confirmar Contraseña
              </Label>
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Repite la contraseña"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                className="h-10 text-xs"
              />
            </div>

            {/* Checklist visual de requisitos de contraseña */}
            <div className="rounded-lg bg-card/60 border border-border/70 p-3 space-y-1.5 text-[11px]">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Requisitos de seguridad (Argon2id):
              </span>
              <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                {hasMinLength ? <Check size={13} className="text-emerald-400" /> : <X size={13} className="text-muted-foreground/60" />}
                <span>Mínimo 8 caracteres</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasUppercase ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                {hasUppercase ? <Check size={13} className="text-emerald-400" /> : <X size={13} className="text-muted-foreground/60" />}
                <span>Al menos una letra mayúscula (A-Z)</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                {hasNumber ? <Check size={13} className="text-emerald-400" /> : <X size={13} className="text-muted-foreground/60" />}
                <span>Al menos un número (0-9)</span>
              </div>
              {confirmPassword.length > 0 && (
                <div className={`flex items-center gap-1.5 ${passwordsMatch ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {passwordsMatch ? <Check size={13} className="text-emerald-400" /> : <X size={13} className="text-amber-400" />}
                  <span>Las contraseñas coinciden</span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              variant="gold"
              className="w-full mt-2 font-bold tracking-wider uppercase text-xs h-10 shadow-lg"
              disabled={isLoading || !isFormValid}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Activando cuenta...
                </>
              ) : (
                'Activar Cuenta'
              )}
            </Button>

            <div className="text-center pt-2">
              <Link
                href="/login"
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                ¿Ya activaste tu cuenta? Iniciar sesión
              </Link>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm">Cargando verificación de invitación...</p>
          </div>
        }
      >
        <AcceptInviteContent />
      </Suspense>
    </div>
  );
}
