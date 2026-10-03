#!/usr/bin/env bash
# Deploys HEAD to the shared production server (see docker-compose.prod.yml).
#
#   deploy/deploy.sh
#
# The server also runs Bitdefender.mn ("bdmn" stack, owner of ports 80/443 and the Caddy).
# This script only touches /opt/zurkhai, the "zurkhai" compose project and
# /opt/caddy-sites/zurkhai.caddy — and checks that Bitdefender still answers afterwards.
# First-time setup (once): /opt/zurkhai/.env (chmod 600, secrets generated on the server).
set -euo pipefail

HOST="${DEPLOY_HOST:-root@2.28.197.187}"
SSH_KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/id_ed25519}"
DOMAIN="${DEPLOY_DOMAIN:-zurkhai.2-28-197-187.sslip.io}"
NEIGHBOUR="https://2-28-197-187.sslip.io/"
DIR=/opt/zurkhai

ssh_() { ssh -o BatchMode=yes -i "$SSH_KEY" "$HOST" "$@"; }

cd "$(git rev-parse --show-toplevel)"
if [ -n "$(git status --porcelain)" ]; then
  echo "note: uncommitted changes are not deployed (git archive HEAD)"
fi
echo "==> deploying $(git rev-parse --short HEAD) to $DOMAIN"

ssh_ "test -f $DIR/.env" || { echo "missing $DIR/.env on the server (first-time setup)"; exit 1; }

echo "==> upload source"
git archive --format=tar HEAD | ssh_ "set -e
  rm -rf $DIR/src.new && mkdir -p $DIR/src.new && tar -x -C $DIR/src.new
  rm -rf $DIR/src.old && { [ ! -d $DIR/src ] || mv $DIR/src $DIR/src.old; } && mv $DIR/src.new $DIR/src
  rm -rf $DIR/src.old"

echo "==> build, migrate, start"
ssh_ "set -e
  cd $DIR/src
  C='docker compose --env-file $DIR/.env -f docker-compose.prod.yml'
  nice -n 10 \$C --profile tools build web tools
  \$C up -d db
  \$C run --rm tools pnpm db:migrate
  \$C up -d --remove-orphans web cron
  docker image prune -f >/dev/null"

echo "==> Caddy site"
scp -q -o BatchMode=yes -i "$SSH_KEY" deploy/zurkhai.caddy "$HOST:/opt/caddy-sites/zurkhai.caddy.new"
ssh_ "set -e
  cd /opt/caddy-sites
  if cmp -s zurkhai.caddy.new zurkhai.caddy; then rm zurkhai.caddy.new; exit 0; fi
  [ -f zurkhai.caddy ] && cp zurkhai.caddy zurkhai.caddy.bak
  mv zurkhai.caddy.new zurkhai.caddy
  if docker exec bdmn-caddy-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
    docker exec bdmn-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
  else
    echo 'caddy validate failed — keeping the previous site file'
    if [ -f zurkhai.caddy.bak ]; then mv zurkhai.caddy.bak zurkhai.caddy; else rm zurkhai.caddy; fi
    exit 1
  fi"

echo "==> wait for the app"
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null "https://$DOMAIN/" 2>/dev/null; then break; fi
  sleep 5
done

echo "==> checks"
printf "zurkhai:     "; ours=$(curl -sS -o /dev/null -w "%{http_code}" "https://$DOMAIN/" || echo 000); echo "$ours"
printf "bitdefender: "; code=$(curl -sS -o /dev/null -w "%{http_code}" "$NEIGHBOUR" || echo 000); echo "$code"
ssh_ "free -m; docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}'"
if [ "$code" != "200" ]; then
  echo "!! Bitdefender does not answer 200 — roll back: rm /opt/caddy-sites/zurkhai.caddy, reload Caddy,"
  echo "!! docker compose -p zurkhai down — and investigate."
  exit 1
fi
if [ "$ours" != "200" ]; then
  echo "!! $DOMAIN answers $ours — see: docker logs --tail 50 zurkhai-web-1"
  exit 1
fi
echo "==> done"
