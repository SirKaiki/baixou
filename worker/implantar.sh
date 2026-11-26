#!/usr/bin/env bash
# Cria (se preciso) o banco D1, publica o contador e grava o endereço em site/data/contador.json.
# Precisa dos segredos CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID.
set -euo pipefail
cd "$(dirname "$0")"
# wrangler com versão travada no package-lock.json (instalado por "npm ci" no workflow)
W="npx --no-install wrangler"

id_banco() { $W d1 list --json 2>/dev/null | python3 -c "import json,sys; print(next((d['uuid'] for d in json.load(sys.stdin) if d['name']=='baixou_eventos'), ''))"; }

ID="$(id_banco || true)"
if [ -z "$ID" ]; then
  $W d1 create baixou_eventos
  ID="$(id_banco)"
fi
sed "s/__DB_ID__/$ID/" wrangler.template.toml > wrangler.toml

$W d1 execute baixou_eventos --remote --file=schema.sql
$W deploy
TOKEN="$(printf 'baixou-contador:%s' "$CLOUDFLARE_API_TOKEN" | sha256sum | cut -d' ' -f1)"
printf '%s' "$TOKEN" | $W secret put TOKEN

SUB="$(curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/subdomain" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['result']['subdomain'])")"
printf '{"url":"https://baixou-contador.%s.workers.dev"}\n' "$SUB" > ../site/data/contador.json
echo "Contador publicado em https://baixou-contador.$SUB.workers.dev"
