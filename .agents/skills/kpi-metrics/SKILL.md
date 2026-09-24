---
name: kpi-metrics
description: Definir o modificar KPIs, vistas materializadas, metas y cálculo de comisiones en gs_control_center. Úsala siempre que se hable de facturación bruta o neta, ticket promedio, ranking de closers, embudo, tendencias de ventas, cumplimiento de metas, comisiones escalonadas o dashboards que van lentos.
---

# KPIs y métricas

## Principio

El cálculo vive en la base de datos, no en el resolver ni en el frontend. Los dashboards leen vistas
materializadas o agregados indexados. Si un dashboard hace aritmética sobre filas crudas, está mal.

## Vistas

`mv_daily_kpis`, `mv_closer_daily_kpis`, `mv_funnel` y las que se agreguen:

- Agrupan por `(project_id, fecha, ...)`.
- Llevan índice único sobre la clave de agrupación para permitir refresco concurrente.
- Se refrescan con `REFRESH MATERIALIZED VIEW CONCURRENTLY` desde un repeatable job de BullMQ.
- La frecuencia se decide por KPI: los operativos cada pocos minutos, los históricos una vez al día.

## Definiciones (respétalas, no las reinventes)

- **Facturación bruta**: suma de ventas aprobadas de productos del catálogo del proyecto.
- **Facturación neta**: bruta menos comisiones de pasarela y afiliaciones.
- **Ventas de lanzamiento**: solo productos vinculados explícitamente al lanzamiento.
- **Ticket promedio**: facturación bruta / número de ventas aprobadas.
- Solo cuentan los productos del catálogo configurado. Un producto no catalogado no computa en
  facturación, metas ni comisiones, aunque la venta exista.
- Fechas de agrupación sobre `payment_date`, convertida a la zona horaria del proyecto antes de truncar.
  Agrupar en UTC crudo desplaza las ventas nocturnas de día.

## Comisiones

Escalonadas por porcentaje de cumplimiento de meta. El tramo se resuelve con la regla vigente en la
fecha de la venta, no con la regla actual. Guarda la comisión calculada y la versión de la regla usada;
nunca la recalcules al vuelo para reportes históricos.

## Frescura

Toda respuesta de dashboard incluye `calculatedAt`. El frontend lo muestra. "Tiempo casi real" con dato
sin marca de tiempo genera reclamos de clientes que no se pueden auditar.
