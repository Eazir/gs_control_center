---
name: docker-despliegue
description: Trabajar con la configuración Docker de gs_control_center — Dockerfiles multi-stage, docker-compose base/dev/prod, Traefik, healthchecks, límites de memoria, backups y despliegue al VPS. Úsala siempre que se toque un contenedor, se agregue un servicio al compose, se hable de despliegue, entornos, certificados, consumo de memoria o de por qué algo falla en producción y no en local.
---

# Docker y despliegue

## Estructura

| Archivo | Cuándo se usa |
|---|---|
| `docker-compose.yml` | Base común a todos los entornos |
| `docker-compose.override.yml` | Desarrollo. Se carga solo, expone puertos y monta el código |
| `docker-compose.prod.yml` | Producción. Traefik, imágenes de GHCR, límites de memoria, backups |

```bash
make up                  # desarrollo
make prod-deploy         # producción
```

## Reglas para los Dockerfiles

- Multi-stage siempre: `base → pruner → deps → builder → runner`. La imagen final no lleva código
  fuente ni dependencias de desarrollo.
- `turbo prune <app> --docker` para copiar solo el subgrafo necesario. Copiar el monorepo entero
  invalida la caché en cada cambio de cualquier paquete.
- Instalar dependencias **antes** de copiar el código fuente. Es la capa que más se cachea.
- `tini` como PID 1. Sin él Node no recibe `SIGTERM` y cada despliegue corta jobs de BullMQ a la mitad.
- Usuario no root en el runner.
- Next.js con `output: 'standalone'`.

## Reglas para el compose

- Todo servicio de larga vida lleva `healthcheck` y `depends_on: condition: service_healthy`.
  Sin healthcheck, `api` arranca antes que Postgres y falla de forma intermitente.
- Todo servicio de producción lleva `deploy.resources.limits.memory`. En 12 GB, un contenedor sin
  límite puede tumbar Postgres.
- `logging` con rotación en todos: los logs sin rotar llenan los 200 GB del disco.
- Redis con `maxmemory-policy noeviction`. Desalojar un job de BullMQ es perder una venta.
- Las migraciones **nunca** corren en el arranque del contenedor. Son un paso explícito:
  `make prod-migrate`, con confirmación.
- Un servicio opcional va con `profiles:`, para que se pueda activar sin modificar el archivo base.

## Agregar un servicio nuevo al compose

1. Defínelo en `docker-compose.yml` con healthcheck y `restart: unless-stopped`.
2. En `docker-compose.prod.yml`: imagen de GHCR, labels de Traefik si es público, límite de memoria.
3. **Ajusta el presupuesto de memoria.** Los 12 GB ya están repartidos; di explícitamente de dónde sale
   la RAM del servicio nuevo.
4. Variables nuevas en `.env.example` y en el esquema Zod de entorno.
5. Documenta en `docs/40-operacion/`.

## Antes de desplegar

- [ ] Backup verificado y reciente.
- [ ] Migraciones revisadas: ¿bloquean tablas grandes? Una migración con lock sobre `sales` en horario
      comercial es un incidente, no un despliegue.
- [ ] Variables nuevas presentes en el servidor.
- [ ] Impacto de memoria calculado.
- [ ] Plan de rollback escrito: `make prod-rollback TAG=<sha anterior>`.

Prepara la secuencia y **espera confirmación explícita**. Nunca ejecutes contra producción por tu cuenta.

## Cuando algo falla en producción y no en local

Revisa en este orden: variables de entorno faltantes, healthcheck que nunca pasa, límite de memoria
alcanzado (`docker stats`), permisos del usuario no root sobre un volumen, y diferencias de recursos
entre tu máquina y el VPS. Las cuatro primeras cubren casi todos los casos.
