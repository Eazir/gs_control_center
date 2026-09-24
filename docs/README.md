# Documentación de `gs_control_center`

| Carpeta | Contenido | Quién la mantiene |
|---|---|---|
| `00-introduccion/` | Qué es el sistema, glosario de negocio, roles, primeros pasos | Manual |
| `10-arquitectura/` | Visión general, fronteras de módulo, modelo de datos, seguridad, extensibilidad | Manual |
| `20-servicios/` | Un capítulo por módulo | Manual, desde plantilla |
| `30-referencia/` | **Generado.** Diccionario de DB, API, rutas, comandos, permisos, eventos | Automático — no editar |
| `40-operacion/` | Despliegue, entornos, backups, monitoreo, runbooks, troubleshooting | Manual |
| `50-manual-usuario/` | Manual por rol, en lenguaje de negocio | Manual |
| `adr/` | Decisiones arquitectónicas | Manual, inmutables |
| `_plantillas/` | Plantillas a copiar | — |

`30-referencia/` está en `.gitignore`. Se construye con `make docs`.

## Reglas

1. Un cambio de comportamiento sin su capítulo actualizado no está terminado.
2. Nunca edites `30-referencia/`. Si algo está mal, corrige el `COMMENT ON`, el TSDoc o el script.
3. Un ADR no se modifica. Si la decisión cambia, escribe uno nuevo que supersede al anterior.
4. El manual de usuario se escribe cuando la funcionalidad se termina, no al final del proyecto.
