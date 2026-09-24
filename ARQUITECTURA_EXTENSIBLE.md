# Arquitectura extensible — agregar servicios sin reescribir

El requisito es claro: poder sumar módulos de servicio con el tiempo sin tocar lo que ya funciona.
Eso no se consigue eligiendo microservicios; se consigue definiendo un **contrato de módulo** y
respetándolo. Un monolito con contratos estrictos es extensible; un conjunto de microservicios sin
contratos es un monolito distribuido, que es peor.

---

## 1. El contrato: manifiesto de módulo

Todo módulo declara qué es, qué expone y qué consume en un único archivo:
`apps/api/src/modules/<nombre>/module.manifest.ts`.

```ts
export const salesManifest = defineModule({
  name: 'sales',
  version: '1.4.0',
  schema: 'sales',                      // único schema que puede tocar

  publicApi: SalesPublicApi,            // interfaz que otros módulos pueden consumir

  emits: [SaleApprovedEvent, SaleRefundedEvent, CommissionCalculatedEvent],
  consumes: [ExternalEventNormalizedEvent],

  graphql: { typeDefs, resolvers },
  rest: [],                             // solo `integrations` expone REST público
  jobs: [refreshKpiViewsJob, dailyReconciliationJob],

  permissions: salesAbilities,          // reglas CASL del módulo
  featureFlag: null,                    // o 'module.sales' si es opcional por proyecto
  docs: 'docs/20-servicios/sales.md',
});
```

Esto no es burocracia. El manifiesto es lo que alimenta el catálogo generado de eventos y jobs, la
matriz de permisos, el índice de documentación y la verificación automática de fronteras. Un módulo sin
manifiesto no arranca.

### Reglas que el contrato hace cumplir

1. Un módulo solo accede a su `schema`. Se refuerza con `GRANT` en PostgreSQL y con lint.
2. Otros módulos solo pueden importar el `publicApi`. `eslint-plugin-boundaries` bloquea el resto.
3. Un módulo solo puede emitir eventos declarados en `emits` y reaccionar a los de `consumes`.
   El bus rechaza en desarrollo un evento no declarado, con el nombre del módulo infractor.
4. Todo evento tiene un esquema Zod versionado en `packages/contracts/events/`.

---

## 2. Registro y descubrimiento

`apps/api/src/modules/index.ts` no se edita a mano: el arranque descubre todos los
`module.manifest.ts`, valida que no haya colisiones de schema ni de nombres de evento, resuelve el orden
de inicialización y monta GraphQL, REST, jobs y permisos.

Agregar un módulo = crear la carpeta con su manifiesto. No hay un archivo central que editar, que es
justo donde aparecen los conflictos de merge y los olvidos.

Un módulo con `featureFlag` se puede activar por proyecto: su schema existe siempre, pero sus queries,
jobs y pantallas solo aparecen donde está habilitado. Así se lanza un módulo nuevo a un cliente piloto
sin afectar al resto.

---

## 3. Comunicación entre módulos

Dos caminos, y solo dos.

### 3.1 Llamada directa a la interfaz pública
Para lecturas sincrónicas que el llamador necesita para responder. Va siempre a través de un DataLoader.

```ts
const closers = await this.authApi.findUsersByIds(ids);   // sí
const closers = await this.prisma.auth.user.findMany();   // nunca
```

### 3.2 Eventos sobre Redis Streams
Para todo efecto secundario. El emisor no sabe ni le importa quién escucha.

```ts
await this.bus.emit(SaleApprovedEvent, {
  saleId, projectId, closerId, amount, occurredAt,
});
```

Redis Streams en lugar de Pub/Sub porque persiste y permite consumer groups: si el worker está caído
cuando se aprueba una venta, la notificación de Telegram se entrega al reiniciar en vez de perderse.

**Esta es la pieza que hace real la extensibilidad.** El día que agregues un módulo de facturación
electrónica, se suscribe a `SaleApprovedEvent` y `sales` no se entera. Cero cambios en el código
existente. Si para agregar un módulo tienes que modificar otro, el diseño falló y hay que revisar el
contrato antes de seguir.

### 3.3 Versionado de eventos
Los eventos son contratos públicos entre módulos. Cambios compatibles (agregar un campo opcional) suben
la versión menor. Cambios incompatibles publican un evento nuevo `SaleApprovedV2` y el anterior se
mantiene con `@deprecated` durante al menos un ciclo de despliegue.

---

## 4. Generador de módulos

```bash
pnpm gen:module facturacion
```

Crea en un solo paso:

```
apps/api/src/modules/facturacion/
├── module.manifest.ts
├── api/  application/  domain/  infrastructure/
├── __tests__/
prisma/schema/facturacion.prisma          # schema aislado
prisma/migrations/xxx_init_facturacion/   # CREATE SCHEMA + rol + GRANT
packages/contracts/src/facturacion/
docs/20-servicios/facturacion.md          # capítulo desde plantilla
```

La migración inicial ya trae el `CREATE SCHEMA`, el rol `svc_facturacion`, los `GRANT` correctos y
`REVOKE` sobre los demás schemas. Que el aislamiento sea el estado por defecto y no algo que hay que
recordar es la diferencia entre que la regla se cumpla y que no.

---

## 5. Tres formas de extender, según el caso

| Necesidad | Mecanismo | Esfuerzo |
|---|---|---|
| Nueva plataforma de ventas o CRM | Adaptador que implementa `IntegrationProvider` | Horas. No se toca nada más. |
| Nuevo dominio de negocio (facturación, soporte, afiliados) | Módulo nuevo con `pnpm gen:module` | Días. Nada existente cambia. |
| Componente con otro ciclo de vida o escalado propio | Extracción a servicio independiente | Ver abajo. |

### Extracción a servicio independiente
Cuando un módulo lo justifique de verdad (volumen, otro lenguaje, cadencia de despliegue distinta):

1. El módulo ya tiene su schema propio y cero FK hacia afuera → la base se separa moviendo el schema.
2. Su `publicApi` ya es una interfaz → se implementa un cliente HTTP/gRPC con la misma firma.
3. Ya se comunica por eventos → el bus de Redis no cambia.
4. El manifiesto se registra en el gateway en vez de en el monolito.

Es una tarde de trabajo, no un proyecto. Ese es todo el argumento para respetar las fronteras desde el
día uno aunque hoy sea un monolito: **pagas la disciplina ahora y compras la opción de separar después.**

---

## 6. Extensibilidad en el frontend

Los módulos del backend tienen su reflejo en el frontend:

```
apps/web/src/modules/<nombre>/
├── module.config.ts      # rutas, entradas de navegación, roles, feature flag
├── components/  hooks/  queries/
```

La navegación se construye a partir de los `module.config.ts` filtrados por rol y por flags activos del
proyecto. Agregar una sección del menú no implica editar un archivo de navegación compartido.

---

## 7. Lo que hay que cuidar

| Riesgo | Cómo se controla |
|---|---|
| Alguien importa el Prisma de otro módulo "solo esta vez" | `eslint-plugin-boundaries` en CI, error bloqueante |
| Eventos que nadie consume, o consumidores de eventos que ya no se emiten | `gen-catalog.ts` reporta huérfanos en cada build |
| El manifiesto se desactualiza respecto al código | Prueba automática: los eventos emitidos en runtime durante los tests deben estar en `emits` |
| Módulos que crecen hasta volverse el nuevo monolito | Revisión al superar ~20 tablas o ~30 casos de uso: probablemente son dos dominios |
| Presión para hacer un join entre schemas por rendimiento | Se resuelve con vista materializada de lectura alimentada por eventos, nunca con acceso cruzado |

El último merece énfasis: cuando un dashboard necesita datos de tres módulos, la respuesta correcta es
una vista materializada de proyección construida desde eventos, no abrir una grieta en el aislamiento.
