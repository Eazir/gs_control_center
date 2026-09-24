---
description: Reglas de persistencia, migraciones y consultas. Siempre activa.
---

# Persistencia

- PK `UUID`: `gen_random_uuid()` por defecto; UUIDv7 generado en aplicación para `integrations.events`,
  `pipeline.row_history` y `sales.transactions`.
- Todo timestamp es `timestamptz` en UTC.
- Soft delete universal: `deleted_at IS NULL` significa activo. Nunca `DELETE` en entidades de negocio.
- Todo `JSONB` se valida con Zod (`packages/contracts`) antes de persistir.
- Paginación keyset. `OFFSET` prohibido en listados grandes.
- Índices GIN sobre los campos `JSONB` que realmente se filtran, no sobre el documento completo por defecto.
- Escrituras multi-tabla dentro de `prisma.$transaction`.
- Toda migración pasa por `prisma migrate`. El SQL crudo (RLS, vistas materializadas, particiones) vive
  dentro de una migración versionada, nunca aplicado a mano.
- Antes de crear una columna, consulta `db_postgres/DICCIONARIO.md` y actualízalo en el mismo cambio.
