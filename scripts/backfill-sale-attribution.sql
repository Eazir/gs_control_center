-- ============================================================================
-- BACKFILL DE ATRIBUCIÓN DE VENTAS (SCK COMERCIAL vs MARKETING)
-- ============================================================================
-- Reglas (hotfix f9689f7):
--  1. SCK de la venta normalizado coincide con sck_code de un miembro del
--     proyecto => sale.closer_id = dueño del SCK (y se reconcilia lead.closer_id).
--  2. SCK fijo comercial (dh / diego / reynald) => sale.closer_id =
--     lead.closer_id si existe (venta del equipo comercial).
--  3. Sin match ni SCK fijo => sale.closer_id = NULL (MARKETING); se retira
--     el closer heredado al lead.
--
-- Este script SOLO muestra el DRY RUN. Para aplicar, descomenta el UPDATE al
-- final y ejecuta con cuidado.
-- ============================================================================
\set ON_ERROR_STOP on

WITH normalized AS (
  SELECT
    s.id,
    s.project_id,
    s.lead_id,
    s.closer_id AS current_closer_id,
    s.sck,
    l.closer_id AS lead_closer_id,
    regexp_replace(lower(btrim(coalesce(s.sck, ''))), '\s+', '', 'g') AS norm_sck
  FROM sales.sales s
  LEFT JOIN sales.leads l ON l.id = s.lead_id
),
matched AS (
  SELECT
    n.*,
    (SELECT pu.user_id
     FROM projects.project_users pu
     CROSS JOIN LATERAL unnest(coalesce(pu.sck_codes, '{}')) AS pu_code
     WHERE pu.project_id = n.project_id
       AND regexp_replace(lower(btrim(pu_code)), '\s+', '', 'g') = n.norm_sck
     LIMIT 1) AS sck_closer_id,
    (regexp_replace(lower(btrim(coalesce(n.sck, ''))), '\s+', '', 'g')
       IN ('dh', 'diego', 'reynald')) AS is_fixed_commercial
  FROM normalized n
),
desired AS (
  SELECT
    m.id,
    m.current_closer_id,
    m.sck_closer_id,
    m.is_fixed_commercial,
    CASE
      WHEN m.sck_closer_id IS NOT NULL THEN m.sck_closer_id
      WHEN m.is_fixed_commercial      THEN m.lead_closer_id
      ELSE NULL
    END AS desired_closer_id
  FROM matched m
)
SELECT
  count(*) FILTER (WHERE current_closer_id IS NOT NULL AND desired_closer_id IS NULL) AS a_marketing,
  count(*) FILTER (WHERE sck_closer_id IS NOT NULL AND current_closer_id IS DISTINCT FROM sck_closer_id) AS s_reasignar_closer,
  count(*) FILTER (WHERE is_fixed_commercial AND current_closer_id IS DISTINCT FROM desired_closer_id) AS seguir_lead_closer,
  count(*) AS total
FROM desired;

-- Detalle por fila (DRY RUN):
SELECT
  current_closer_id,
  sck_closer_id AS m_sck_closer_id,
  is_fixed_commercial,
  desired_closer_id,
  count(*) AS filas
FROM desired
GROUP BY 1, 2, 3, 4
ORDER BY filas DESC;

-- APPLY: ejecutar despues de revisar el DRY RUN
-- UPDATE sales.sales s
-- SET closer_id = d.desired_closer_id
-- FROM desired d
-- WHERE s.id = d.id
--   AND s.closer_id IS DISTINCT FROM d.desired_closer_id;

-- ----------------------------------------------------------------------------
-- APPLY COMPLETO (descomentar y ejecutar en una sola transacción):
-- ----------------------------------------------------------------------------
-- BEGIN;
--
--   WITH normalized AS (
--     SELECT s.id, s.project_id, s.lead_id, s.closer_id AS current_closer_id,
--            s.sck, l.closer_id AS lead_closer_id,
--            regexp_replace(lower(btrim(coalesce(s.sck,''))), '\s+', '', 'g') AS norm_sck
--     FROM sales.sales s LEFT JOIN sales.leads l ON l.id = s.lead_id
--   ),
--   matched AS (
--     SELECT n.*,
--       (SELECT pu.user_id FROM projects.project_users pu
--        CROSS JOIN LATERAL unnest(coalesce(pu.sck_codes,'{}')) pu_code
--        WHERE pu.project_id = n.project_id
--          AND regexp_replace(lower(btrim(pu_code)), '\s+', '', 'g') = n.norm_sck LIMIT 1) AS sck_closer_id,
--       (regexp_replace(lower(btrim(coalesce(n.sck,''))), '\s+', '', 'g') IN ('dh','diego','reynald')) AS is_fixed_commercial
--     FROM normalized n
--   ),
--   desired AS (
--     SELECT m.id, m.lead_id, m.current_closer_id, m.sck_closer_id, m.is_fixed_commercial,
--            CASE
--              WHEN m.sck_closer_id IS NOT NULL THEN m.sck_closer_id
--              WHEN m.is_fixed_commercial THEN m.lead_closer_id
--              ELSE NULL
--            END AS desired_closer_id
--     FROM matched m
--   )
--   UPDATE sales.sales s
--   SET closer_id = d.desired_closer_id
--   FROM desired d
--   WHERE s.id = d.id AND s.closer_id IS DISTINCT FROM d.desired_closer_id;
--
--   WITH normalized AS (
--     SELECT s.id, s.project_id, s.lead_id, s.closer_id AS current_closer_id, s.sck,
--            regexp_replace(lower(btrim(coalesce(s.sck,''))), '\s+', '', 'g') AS norm_sck
--     FROM sales.sales s
--   ),
--   matched AS (
--     SELECT n.*,
--       (SELECT pu.user_id FROM projects.project_users pu
--        CROSS JOIN LATERAL unnest(coalesce(pu.sck_codes,'{}')) pu_code
--        WHERE pu.project_id = n.project_id
--          AND regexp_replace(lower(btrim(pu_code)), '\s+', '', 'g') = n.norm_sck LIMIT 1) AS sck_closer_id
--     FROM normalized n
--   )
--   UPDATE sales.leads l
--   SET closer_id = m.sck_closer_id
--   FROM sales.sales s
--   JOIN matched m ON m.id = s.id
--   WHERE l.id = s.lead_id AND m.sck_closer_id IS NOT NULL
--     AND (l.closer_id IS DISTINCT FROM m.sck_closer_id);
--
-- COMMIT;
