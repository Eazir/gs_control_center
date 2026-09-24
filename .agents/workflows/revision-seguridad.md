---
description: Auditar un cambio o módulo contra las reglas de seguridad y aislamiento del proyecto.
---

Revisa el código indicado y responde punto por punto. Si algo no aplica, dilo explícitamente.

1. ¿Algún módulo consulta un schema que no es suyo, o importa fuera del `index.ts` público de otro?
2. ¿Todas las consultas filtran por `project_id` y por `deleted_at IS NULL`?
3. ¿Cada operación verifica permisos con CASL antes de delegar?
4. ¿Las consultas sensibles corren dentro de `withRls`? ¿Hay algún `SET LOCAL` suelto?
5. ¿Un CLOSER podría alcanzar un lead no asignado por alguna ruta, incluida la API directa?
6. ¿Un CLIENTE recibe en el payload algún dato de contacto de lead o dato operativo de closer?
7. ¿Se registran en logs tokens, secretos o PII?
8. ¿Los webhooks verifican firma antes de leer el cuerpo? ¿Se mantiene la garantía de idempotencia?
9. ¿Hay algún secreto o credencial en el repositorio?
10. ¿Algún input llega a `JSONB` sin pasar por Zod?

Entrega los hallazgos ordenados por severidad, con el archivo y la línea, y una corrección propuesta
para cada uno. No corrijas nada sin aprobación.
