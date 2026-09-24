---
description: Fronteras entre módulos y schemas. Siempre activa.
---

# Fronteras de módulo

El backend es un monolito modular que se comporta como si fueran servicios separados.

- Un módulo solo lee y escribe en su propio schema de PostgreSQL.
- Cero foreign keys físicas entre schemas. Referencias lógicas por UUID.
- Nunca importes desde `src/modules/<otro>/**` salvo el `index.ts` público del módulo.
- La comunicación entre módulos es: interfaz pública exportada, o evento publicado en Redis.
- Cualquier dato cross-dominio en GraphQL se resuelve con DataLoader sobre la interfaz pública.

Si una tarea parece requerir un join entre schemas, es señal de que el modelo está mal repartido.
Detente y plantea el problema antes de implementar.
