CREATE TABLE IF NOT EXISTS eventos (
  sessao  TEXT    NOT NULL,
  produto TEXT    NOT NULL,
  tipo    TEXT    NOT NULL,
  ts      INTEGER NOT NULL,
  PRIMARY KEY (sessao, produto, tipo)
);
CREATE INDEX IF NOT EXISTS idx_eventos_ts ON eventos (ts);
CREATE INDEX IF NOT EXISTS idx_eventos_produto ON eventos (produto);
