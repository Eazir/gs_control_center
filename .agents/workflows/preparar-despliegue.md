---
description: Preparar (no ejecutar) un despliegue al VPS de producción.
---

Prepara el despliegue y detente antes de ejecutar nada contra producción.

1. Lista los commits que entran y las migraciones pendientes.
2. Por cada migración: ¿es reversible? ¿bloquea tablas grandes? ¿necesita ventana de mantenimiento?
   Una migración que toma un lock sobre `sales` o `pipeline.rows` en horario comercial es un incidente.
3. Verifica variables de entorno nuevas y confirma que están en el secreto cifrado del servidor.
4. Estima el impacto en memoria. El VPS tiene 12 GB y ya corren Postgres, Redis, n8n, Traefik, api,
   ingest y worker. Si el cambio agrega un contenedor, di de dónde sale la RAM.
5. Confirma que existe un respaldo reciente y verificado de la base de datos.
6. Escribe el plan de rollback en pasos concretos.
7. Entrega la secuencia exacta de comandos y **espera confirmación explícita** antes de ejecutar.
