BEGIN;

CREATE TABLE bootstrap_guards (
    key TEXT PRIMARY KEY,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (key IN ('first_admin'))
);

INSERT INTO bootstrap_guards (key)
SELECT 'first_admin'
WHERE EXISTS (SELECT 1 FROM users WHERE role = 'admin')
ON CONFLICT (key) DO NOTHING;

COMMIT;
