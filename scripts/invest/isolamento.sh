#!/usr/bin/env bash
# Teste de isolamento entre pessoas das tabelas do Invest (migração 27) num Postgres local descartável.
#   scripts/invest/isolamento.sh
# Precisa do Postgres instalado (psql, initdb, pg_ctl). Cria um banco temporário, roda scripts/invest/isolamento.sql e apaga tudo.
set -euo pipefail
cd "$(dirname "$0")/../.."
BIN=$(dirname "$(ls /usr/lib/postgresql/*/bin/initdb 2>/dev/null | tail -1 || command -v initdb)")
DIR=$(mktemp -d)
PORTA=54329
chmod 755 "$DIR"
rodar() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
[ "$(id -u)" = 0 ] && chown postgres "$DIR"
trap 'rodar "$BIN/pg_ctl -D $DIR/db -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
rodar "$BIN/initdb -D $DIR/db -A trust -U postgres" >/dev/null
rodar "$BIN/pg_ctl -D $DIR/db -o '-p $PORTA -c listen_addresses= -k $DIR' -w start" >/dev/null
psql -h "$DIR" -p "$PORTA" -U postgres -v ON_ERROR_STOP=1 -f scripts/invest/isolamento.sql postgres 2>&1 | grep -E "ok:|FALHOU|ERROR|ERRO|ISOLAMENTO" 
