---
name: nestjs-module
description: Crear o extender un módulo de dominio del backend NestJS de gs_control_center (auth, projects, pipeline, sales, integrations, automation, ai). Úsala siempre que se pida un nuevo caso de uso, entidad, resolver, servicio o endpoint en el backend, aunque el usuario solo diga "agrega X al backend" o "necesito un CRUD de Y".
---

# Módulo de dominio NestJS

## Estructura obligatoria

```
src/modules/<dominio>/
├── index.ts                  # ÚNICA superficie pública del módulo
├── <dominio>.module.ts
├── api/                      # resolvers GraphQL y controladores REST
│   ├── dto/                  # inputs y outputs, validados
│   └── loaders/              # DataLoaders
├── application/              # casos de uso; aquí vive la lógica
├── domain/                   # entidades, value objects, puertos (interfaces)
└── infrastructure/           # repositorios Prisma, clientes HTTP, adaptadores
```

## Procedimiento

1. **Lee `db_postgres/DICCIONARIO.md`** y confirma qué tablas del schema del módulo intervienen.
   Si falta una columna, la migración es parte de esta tarea.
2. **Define el contrato primero** en `packages/contracts`: esquema Zod de entrada y salida.
   El DTO de GraphQL/REST se deriva de ahí, no al revés.
3. **Caso de uso en `application/`**: recibe datos ya validados, depende de puertos (interfaces de
   `domain/`), nunca de PrismaClient directamente.
4. **Repositorio en `infrastructure/`**: implementa el puerto. Es el único sitio con Prisma.
   Toda lectura filtra por `project_id` y por `deleted_at IS NULL`.
5. **Resolver/controlador en `api/`**: valida, aplica CASL, delega, mapea errores. Sin `if` de negocio.
6. **Exporta en `index.ts`** solo lo que otros módulos pueden consumir. Nada más sale del módulo.
7. **Pruebas**: unitaria del caso de uso con puertos falsos, e integración con Testcontainers si toca
   RLS, permisos o transacciones.

## Checklist antes de cerrar

- [ ] Ninguna importación desde otro módulo salvo su `index.ts`.
- [ ] Ninguna consulta fuera del schema propio.
- [ ] Escrituras multi-tabla en `prisma.$transaction`.
- [ ] Permisos verificados con CASL en la frontera.
- [ ] `project_id` presente en todas las consultas.
- [ ] Errores mapeados a códigos estables.
