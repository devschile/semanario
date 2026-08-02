-- ============================================================================
-- 🗞️ Semanario devsChile — esquema de suscriptores
--
-- Correr una sola vez contra la base de Neon:
--   psql "$DATABASE_URL" -f db/schema.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscribers (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Se guarda siempre normalizado (trim + minúsculas) desde la aplicación.
  email              text        NOT NULL,

  status             text        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'confirmed', 'unsubscribed')),

  -- Double opt-in: se manda por correo, se canjea una sola vez.
  confirm_token      uuid        NOT NULL DEFAULT gen_random_uuid(),
  -- Va en el pie de cada edición; no expira.
  unsubscribe_token  uuid        NOT NULL DEFAULT gen_random_uuid(),

  created_at         timestamptz NOT NULL DEFAULT now(),
  confirmed_at       timestamptz,
  unsubscribed_at    timestamptz,

  -- De dónde vino la suscripción (útil para medir qué canal convierte).
  source             text,
  referrer           text,
  ip                 inet
);

-- Un correo, una fila. Es el índice sobre el que actúa el ON CONFLICT del
-- endpoint de suscripción.
CREATE UNIQUE INDEX IF NOT EXISTS subscribers_email_key
  ON subscribers (email);

-- Los tokens se buscan por igualdad en cada confirmación/baja.
CREATE UNIQUE INDEX IF NOT EXISTS subscribers_confirm_token_key
  ON subscribers (confirm_token);
CREATE UNIQUE INDEX IF NOT EXISTS subscribers_unsubscribe_token_key
  ON subscribers (unsubscribe_token);

-- Consulta típica al momento de enviar una edición.
CREATE INDEX IF NOT EXISTS subscribers_status_idx
  ON subscribers (status);
