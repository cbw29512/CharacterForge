BEGIN;

CREATE TABLE bootstrap_guards (
    key TEXT PRIMARY KEY,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (key IN ('first_admin'))
);

COMMIT;
