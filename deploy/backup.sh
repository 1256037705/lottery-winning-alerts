#!/usr/bin/env bash
set -euo pipefail
# 从脚本位置定位项目，避免在文档中暴露特定主机的账户与路径。
cd "$(dirname "${BASH_SOURCE[0]}")/.."
umask 077
mkdir -p backups
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
docker compose exec -T db pg_dump -U lottery -d lottery -Fc > "backups/lottery-${stamp}.dump"
cp -- .env "backups/env-${stamp}.secret"
docker compose exec -T db pg_restore --list < "backups/lottery-${stamp}.dump" > /dev/null
printf '备份完成：%s（包含数据库与必要加密密钥；请离线加密保管）\n' "$stamp"
