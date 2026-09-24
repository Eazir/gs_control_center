---
name: nuevo-modulo
description: Agregar un módulo de servicio nuevo a gs_control_center o extraer uno existente como servicio independiente. Úsala siempre que se hable de sumar un dominio nuevo (facturación, soporte, afiliados, lo que sea), de conectar un proveedor externo nuevo, de separar un módulo, o cuando se pregunte cómo hacer que el sistema crezca sin romper lo existente.
---

# Agregar un módulo

## Antes de nada: ¿es realmente un módulo?

| Necesidad | Qué corresponde |
|---|---|
| Nueva plataforma de ventas o CRM | Un adaptador `IntegrationProvider` — usa la skill `integration-adapter`, no esta |
| Funcionalidad dentro de un dominio existente | Un caso de uso en el módulo dueño — usa `nestjs-module` |
| Dominio nuevo con sus propias entidades, reglas y ciclo de vida | Un módulo. Sigue aquí. |

Crear un módulo por algo que es una funcionalidad genera schemas anémicos y chatter entre módulos.
Si dudas, pregunta: ¿tiene entidades propias que nadie más posee?

## Procedimiento

```bash
make module N=facturacion
```

El generador crea el esqueleto, el schema aislado con su rol y `GRANT`, los contratos y el capítulo de
documentación. Después completa, en este orden:

1. **Manifiesto** (`module.manifest.ts`): nombre, schema, `publicApi`, `emits`, `consumes`, jobs,
   permisos, feature flag si es opcional por proyecto, ruta del capítulo.
   Declara los eventos **antes** de emitirlos: el bus rechaza en desarrollo los no declarados.
2. **Contratos** en `packages/contracts/src/<modulo>/`, incluidos los esquemas de sus eventos.
3. **Migración inicial** con `COMMENT ON` en cada tabla y columna, índices y RLS si maneja datos por
   closer o por cliente.
4. **Dominio y casos de uso**, después el repositorio, después el resolver. En ese orden.
5. **Interfaz pública** en `index.ts`: lo mínimo que otros módulos necesitan. Empieza exponiendo
   demasiado poco; ampliar es fácil, recortar rompe a terceros.
6. **Frontend**: `apps/web/src/modules/<nombre>/module.config.ts` con rutas, entradas de navegación y
   roles. La navegación se arma sola desde ahí.
7. **Capítulo** `docs/20-servicios/<nombre>.md` completo, sin TODO.
8. **Pruebas**: casos de uso, e integración si hay RLS, permisos o eventos.

## Las reglas que no se negocian

- El módulo **solo** toca su schema. Ni un `SELECT` fuera.
- Nadie importa de él salvo su `index.ts`.
- Solo emite lo que declaró y solo escucha lo que declaró.
- Cero FK físicas hacia otros schemas.

**Si para agregar tu módulo necesitas modificar otro, detente.** Eso significa que el otro módulo no
expone lo que hace falta o que el evento correcto no existe. Plantea el problema antes de escribir la
solución: ese cambio es lo que erosiona la arquitectura.

## Datos de varios módulos en una pantalla

No hagas un join entre schemas ni pidas acceso cruzado. Construye una proyección: una vista o tabla de
lectura en el módulo consumidor, alimentada por los eventos de los demás. Cuesta más al inicio y es lo
único que mantiene el sistema separable.

## Extraer un módulo como servicio independiente

Solo cuando lo justifique el volumen, otro lenguaje o una cadencia de despliegue distinta.
Si las reglas anteriores se respetaron, son cuatro pasos: mover el schema a su propia base, implementar
un cliente HTTP con la misma firma del `publicApi`, apuntar el bus de Redis al nuevo proceso, y
registrar su manifiesto en el gateway. Ninguna lógica de negocio cambia.
