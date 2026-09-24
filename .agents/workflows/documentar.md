---
description: Poner al día la documentación de una parte del sistema.
---

Para el alcance indicado (un módulo, una funcionalidad o todo el proyecto):

1. Ejecuta `make docs-check` y reporta qué falla: TSDoc faltante, columnas sin `COMMENT ON`,
   descripciones ausentes en el SDL, enlaces rotos, capítulos con TODO.
2. Compara el capítulo de servicio contra el código real. Marca lo que la documentación afirma y el
   código ya no hace — eso es peor que no documentar.
3. Corrige por capas: primero comentarios en el código y `COMMENT ON` (alimentan lo generado), después
   los capítulos manuscritos, al final el manual de usuario.
4. Regenera con `make docs` y revisa que el diccionario y la referencia de API salgan completos.
5. Si encuentras decisiones de arquitectura tomadas y nunca registradas, propón los ADR faltantes.
6. Entrega: qué corregiste, qué quedó pendiente y qué requiere decisión humana.

No inventes documentación para código que no entiendes. Márcalo como pendiente y pregunta.
