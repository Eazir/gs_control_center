---
name: shadcn-data-view
description: Construir vistas del frontend Next.js de gs_control_center — dashboards, tablas de pipeline, tableros kanban, formularios y vistas de cliente. Úsala siempre que se pida una pantalla, componente, tabla, gráfico o cualquier UI nueva, y cuando haya que decidir entre Server Component y Client Component.
---

# Vistas del frontend

## Decisión RSC vs cliente

Server Component por defecto. `'use client'` solo si hay estado, evento, animación o API del navegador.
Regla práctica: si la vista solo muestra datos, es RSC. El cliente empieza en el componente interactivo
más pequeño posible, no en la página completa.

- Dashboards, reportes, vista de CLIENTE → RSC con GraphQL tipado por codegen.
- Pipeline y kanban → Apollo Client, que es donde la caché normalizada aporta.

## Los cuatro estados, siempre

1. **Loading**: skeleton con las dimensiones reales del contenido. Nada de spinners centrados.
2. **Empty**: explica qué falta y ofrece la acción para resolverlo.
3. **Error**: mensaje accionable y botón de reintento. Nunca el mensaje crudo del servidor.
4. **Data**.

Una vista sin los cuatro no está terminada.

## Componentes

Solo shadcn/ui + Tailwind + Lucide. Si falta un componente, se compone a partir de los existentes o se
agrega el oficial con el CLI de shadcn. Prohibido escribir botones, inputs, diálogos o tablas a mano.

## Tablas grandes

TanStack Table con virtualización de filas y paginación por cursor. Filtros y orden van al servidor,
nunca sobre un array en memoria. El objetivo es que 50.000 leads se navegue igual que 50.

## Kanban y edición de celdas

- Actualización optimista con `row_version`.
- Si el servidor responde conflicto, revierte visiblemente y muestra quién modificó la fila.
- Selección múltiple ejecuta una sola mutation masiva, no una por fila.
- Edición por celda validada en cliente con el mismo esquema Zod de `packages/contracts` que usa el
  backend. El cliente da la respuesta rápida; el servidor sigue siendo la autoridad.

## Permisos en UI

Las columnas y acciones se renderizan según `visible_roles` y `editable_roles`. Ocultar en UI no es
seguridad: el backend vuelve a verificar siempre. Para el rol CLIENTE, ningún dato de contacto de lead
debe llegar al payload del cliente, ni siquiera oculto por CSS.

## Rendimiento

Objetivo LCP p95 < 2 s. Desktop-first para 1080p+, navegable en tablet y móvil para el rol CLIENTE.
