# Módulo: `<nombre>`

> Estado: <en desarrollo | estable> · Versión: <x.y.z> · Schema: `<nombre>`
> Última revisión: <fecha> · Capítulo obligatorio: no dejes marcadores TODO al cerrar la fase.

## 1. Responsabilidad
Qué resuelve este módulo en una o dos frases. **Y qué explícitamente no resuelve** — esta segunda parte
es la que evita que el módulo crezca sin control.

## 2. Fronteras
- Schema propio: `<nombre>`
- Módulos que consume (vía interfaz pública): 
- Módulos que lo consumen: 
- Datos que referencia por UUID sin FK: 

## 3. Modelo de datos
Tablas principales y el porqué de las decisiones no obvias (particiones, JSONB, índices, RLS).
El detalle de columnas está en el [diccionario generado](../30-referencia/diccionario-db.md); aquí va
solo lo que un humano necesita entender y el generador no puede explicar.

## 4. API pública
```ts
// Firma de lo que expone el index.ts. La referencia completa está en TypeDoc.
```

## 5. Eventos
| Emite | Cuándo | Payload |
|---|---|---|
| Consume | De quién | Qué hace |

## 6. Jobs programados
| Job | Frecuencia | Qué pasa si falla |
|---|---|---|

## 7. Reglas de negocio
Las reglas no evidentes, con su razón. Este es el corazón del capítulo: lo que un desarrollador nuevo
(o un agente) no puede deducir leyendo el código.

## 8. Permisos por rol
| Acción | SUPER_ADMIN | ADMIN | DIRECTOR | CLOSER | CLIENTE |
|---|---|---|---|---|---|

## 9. Configuración
Variables de entorno, feature flags y parámetros por proyecto que afectan a este módulo.

## 10. Errores conocidos y trampas
Lo que ya nos mordió una vez. Cada entrada aquí ahorra una tarde a quien venga después.

## 11. Cómo probarlo localmente
```bash
```
