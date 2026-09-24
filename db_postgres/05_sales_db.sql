-- ============================================================================
-- 05 — SALES SERVICE (sales_db)
-- Ejecutar: psql -h localhost -U postgres -d sales_db -f 05_sales_db.sql
-- ============================================================================
SET search_path TO public;

CREATE TYPE sale_status AS ENUM
    ('PENDING','APPROVED','REFUNDED','CANCELLED','CHARGEBACK');
CREATE TYPE sale_source AS ENUM
    ('HOTMART','CENTRALIZE','GOHIGHLEVEL','MANUAL');
CREATE TYPE payment_type AS ENUM
    ('ONE_TIME','INSTALLMENT');
CREATE TYPE installment_status AS ENUM
    ('PENDING','PAID','OVERDUE','CANCELLED');

-- ----------------------------------------------------------------------------
-- customers
-- ----------------------------------------------------------------------------
CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL,
    email           TEXT,
    phone           TEXT,
    full_name       TEXT,
    profile         JSONB DEFAULT '{}'::jsonb,
    pipeline_row_id UUID,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, email)
);

CREATE INDEX customers_idx_customers_phone
    ON customers(phone) WHERE phone IS NOT NULL;
CREATE INDEX customers_idx_customers_email_trgm
    ON customers USING GIN (email gin_trgm_ops);
CREATE INDEX customers_idx_customers_profile_gin
    ON customers USING GIN (profile jsonb_path_ops);

-- ----------------------------------------------------------------------------
-- sales
-- ----------------------------------------------------------------------------
CREATE TABLE sales (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id         UUID NOT NULL,
    customer_id        UUID REFERENCES customers(id),
    pipeline_row_id    UUID,
    closer_id          UUID,

    external_order_id  TEXT NOT NULL,
    external_txn_id    TEXT,
    source             sale_source NOT NULL,

    product_id         TEXT,
    product_name       TEXT,
    product_data       JSONB NOT NULL DEFAULT '{}'::jsonb,

    amount             NUMERIC(14,2) NOT NULL,
    currency           TEXT DEFAULT 'COP',
    commission_amount  NUMERIC(14,2),

    status             sale_status DEFAULT 'PENDING',

    payment_type       payment_type NOT NULL DEFAULT 'ONE_TIME',
    payment_data       JSONB NOT NULL DEFAULT '{}'::jsonb,

    installment_number SMALLINT,
    installments_total SMALLINT,
    installment_status installment_status,
    parent_sale_id     UUID REFERENCES sales(id),
    next_due_date      DATE,

    sale_date          TIMESTAMPTZ NOT NULL,
    payment_date       TIMESTAMPTZ,
    approved_at        TIMESTAMPTZ,
    refunded_at        TIMESTAMPTZ,

    raw_payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata           JSONB DEFAULT '{}'::jsonb,

    created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_installment_consistency CHECK (
        (payment_type = 'ONE_TIME'
         AND installment_number IS NULL AND installments_total IS NULL)
        OR
        (payment_type = 'INSTALLMENT'
         AND installment_number IS NOT NULL AND installments_total IS NOT NULL
         AND installment_number BETWEEN 1 AND installments_total)
    )
);

CREATE UNIQUE INDEX sales_uniq_source_order_txn
    ON sales(source, external_order_id, COALESCE(external_txn_id, ''));

CREATE INDEX sales_idx_sales_project_date
    ON sales(project_id, sale_date DESC);
CREATE INDEX sales_idx_sales_project_payment_date
    ON sales(project_id, payment_date DESC) WHERE payment_date IS NOT NULL;
CREATE INDEX sales_idx_sales_closer
    ON sales(closer_id, sale_date DESC) WHERE closer_id IS NOT NULL;
CREATE INDEX sales_idx_sales_status
    ON sales(status) WHERE status = 'APPROVED';
CREATE INDEX sales_idx_sales_product
    ON sales(project_id, product_id) WHERE product_id IS NOT NULL;
CREATE INDEX sales_idx_sales_payment_type
    ON sales(project_id, payment_type);
CREATE INDEX sales_idx_sales_installment
    ON sales(project_id, installment_status)
    WHERE payment_type = 'INSTALLMENT';
CREATE INDEX sales_idx_sales_parent
    ON sales(parent_sale_id) WHERE parent_sale_id IS NOT NULL;
CREATE INDEX sales_idx_sales_next_due
    ON sales(next_due_date)
    WHERE installment_status = 'PENDING' AND next_due_date IS NOT NULL;
CREATE INDEX sales_idx_sales_product_data_gin
    ON sales USING GIN (product_data jsonb_path_ops);
CREATE INDEX sales_idx_sales_payment_data_gin
    ON sales USING GIN (payment_data jsonb_path_ops);
CREATE INDEX sales_idx_sales_raw_payload_gin
    ON sales USING GIN (raw_payload jsonb_path_ops);

-- ----------------------------------------------------------------------------
-- commissions
-- ----------------------------------------------------------------------------
CREATE TABLE commissions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id         UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    project_id      UUID NOT NULL,
    user_id         UUID NOT NULL,
    role            TEXT NOT NULL,
    percentage      NUMERIC(5,4) NOT NULL,
    amount          NUMERIC(14,2) NOT NULL,
    status          TEXT DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','PAID','CANCELLED')),
    paid_at         TIMESTAMPTZ,
    rule_applied    JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX commissions_idx_commissions_sale
    ON commissions(sale_id);
CREATE INDEX commissions_idx_commissions_user
    ON commissions(user_id, status);
CREATE INDEX commissions_idx_commissions_project
    ON commissions(project_id, created_at DESC);
CREATE INDEX commissions_idx_commissions_rule_gin
    ON commissions USING GIN (rule_applied jsonb_path_ops);

-- ----------------------------------------------------------------------------
-- Permisos
-- ----------------------------------------------------------------------------
GRANT ALL ON ALL TABLES    IN SCHEMA public TO svc_sales;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO svc_sales;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO svc_sales;