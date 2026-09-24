---
description: RBAC, RLS, secretos y manejo de datos sensibles. Siempre activa.
---

# Seguridad

## Autorización
- CASL en la capa de aplicación es el control primario. RLS es defensa en profundidad.
- Jerarquía: SUPER_ADMIN > ADMIN > DIRECTOR > CLOSER > CLIENTE.
- CLOSER: solo sus leads asignados. CLIENTE: solo lectura del dashboard de su proyecto, sin datos de
  contacto de leads ni información operativa de closers.
- Todo query lleva `project_id`. No hay consultas cross-project fuera de SUPER_ADMIN/ADMIN.

## RLS con Prisma
`SET LOCAL` solo sobrevive dentro de una transacción y Prisma agrupa conexiones.
Usa siempre el helper:

```ts
await withRls(prisma, ctx, async (tx) => { /* consultas */ });
```

Nunca escribas `SET LOCAL app.current_user_id` fuera de ese helper.

## Secretos y PII
- Credenciales de terceros cifradas con AES-256-GCM. La clave maestra vive en el entorno (SOPS + age).
- Nunca registres tokens, secretos, cuerpos de webhook con PII, emails ni teléfonos en texto plano.
- Firma de webhook verificada antes de leer el cuerpo.
- Rate limiting con Redis en login, endpoints públicos y webhooks.
