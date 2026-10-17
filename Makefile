# Fuente de verdad de los comandos del proyecto.
# scripts/gen-commands.ts genera docs/30-referencia/comandos.md a partir de los
# comentarios ##: de este archivo. Si agregas un target, documéntalo aquí y solo aquí.

-include .env
export

.DEFAULT_GOAL := help
COMPOSE_DEV  := docker compose
COMPOSE_PROD := docker compose -f docker-compose.yml -f docker-compose.prod.yml

help: ##: Lista todos los comandos disponibles
	@grep -E '^[a-zA-Z_-]+:.*?##:' $(MAKEFILE_LIST) | sed 's/:.*##:/\t/' | expand -t28

## ---------- Desarrollo ----------
up: ##: Levanta el entorno completo de desarrollo
	$(COMPOSE_DEV) up -d
up-db: ##: Levanta solo Postgres y Redis para desarrollo local
	$(COMPOSE_DEV) up -d postgres redis
rebuild: ##: Reconstruye la imagen de un servicio y recrea su contenedor (uso: make rebuild S=api)
	$(COMPOSE_DEV) up -d --build $(S)
dev: ##: Ejecuta pnpm dev en local (Fast Refresh para frontend y backend)
	pnpm dev
down: ##: Detiene los contenedores conservando los datos
	$(COMPOSE_DEV) down
reset: ##: PELIGRO - borra volúmenes y reconstruye desde cero
	$(COMPOSE_DEV) down -v && $(COMPOSE_DEV) up -d && sleep 8 && $(MAKE) migrate seed
logs: ##: Sigue los logs (uso: make logs S=api)
	$(COMPOSE_DEV) logs -f --tail=100 $(S)
sh: ##: Abre una shell en un servicio (uso: make sh S=api)
	$(COMPOSE_DEV) exec $(S) sh
ps: ##: Estado y consumo de los contenedores
	$(COMPOSE_DEV) ps && docker stats --no-stream

## ---------- Base de datos ----------
migrate: ##: Aplica migraciones pendientes en desarrollo
	$(COMPOSE_DEV) exec api pnpm --filter api prisma migrate dev
migration: ##: Crea una migración (uso: make migration N=add_sales_table)
	$(COMPOSE_DEV) exec api pnpm --filter api prisma migrate dev --name $(N)
seed: ##: Carga datos de prueba
	$(COMPOSE_DEV) exec api pnpm --filter api db:seed
psql: ##: Abre psql sobre la base de desarrollo
	$(COMPOSE_DEV) exec postgres psql -U $(POSTGRES_USER) -d gs_control_center
studio: ##: Abre Prisma Studio
	$(COMPOSE_DEV) exec api pnpm --filter api prisma studio
seed-admin: ##: Siembra el Super Admin en Postgres (uso: make seed-admin EMAIL=... PASS=...)
	node scripts/crypto-tool.mjs seed-admin $(or $(EMAIL),super_admin@growthsell.com) $(or $(PASS),Admin12345!) | $(COMPOSE_DEV) exec -T postgres psql -U $(POSTGRES_USER) -d gs_control_center
crypto: ##: Utilidad criptográfica (uso: make crypto CMD="generate-key")
	node scripts/crypto-tool.mjs $(CMD)


## ---------- Calidad ----------
lint: ##: ESLint y Prettier en todo el monorepo
	pnpm lint
types: ##: Verificación de tipos sin emitir
	pnpm typecheck
test: ##: Pruebas unitarias
	pnpm test
test-int: ##: Pruebas de integración con Testcontainers (RLS, RBAC, idempotencia)
	pnpm test:integration
test-e2e: ##: Pruebas end-to-end con Playwright, un caso por rol
	pnpm test:e2e
check: lint types test ##: Todo lo que CI ejecuta antes de aceptar un cambio

## ---------- Documentación ----------
docs: ##: Genera la referencia (diccionario, API, rutas, comandos, permisos)
	pnpm docs:generate
docs-serve: ##: Sirve el sitio de documentación en http://localhost:3100
	pnpm --filter docs start
docs-check: ##: Verifica TSDoc, COMMENT ON, enlaces rotos y capítulos incompletos
	pnpm docs:check

## ---------- Módulos ----------
module: ##: Genera un módulo nuevo completo (uso: make module N=facturacion)
	pnpm gen:module $(N)

## ---------- Producción ----------
prod-deploy: ##: Despliega la última imagen publicada en el VPS
	$(COMPOSE_PROD) pull && $(COMPOSE_PROD) up -d --remove-orphans
prod-migrate: ##: Ejecuta migraciones en producción (requiere confirmación)
	@read -p "Migrar PRODUCCIÓN. ¿Hay backup verificado? (si/no) " a; [ "$$a" = "si" ] || exit 1
	$(COMPOSE_PROD) run --rm migrate
prod-logs: ##: Logs de producción (uso: make prod-logs S=ingest)
	$(COMPOSE_PROD) logs -f --tail=200 $(S)
prod-backup: ##: Fuerza un respaldo inmediato
	$(COMPOSE_PROD) exec backup /backup.sh once
prod-restore: ##: Restaura un respaldo en un entorno limpio (uso: make prod-restore F=archivo)
	./scripts/restore.sh $(F)
prod-rollback: ##: Vuelve a la imagen anterior (uso: make prod-rollback TAG=sha)
	TAG=$(TAG) $(COMPOSE_PROD) up -d

.PHONY: help up up-db rebuild dev down reset logs sh ps migrate migration seed seed-admin crypto psql studio lint types test test-int test-e2e check docs docs-serve docs-check module prod-deploy prod-migrate prod-logs prod-backup prod-restore prod-rollback
