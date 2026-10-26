#!/usr/bin/env bash
# 本地使用：先 pnpm build，再 bash deploy/deploy.sh；不上传源码或环境文件。
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
server="${DEPLOY_SERVER:-root@43.140.214.49}"
release_id="${1:-manual-$(date -u +%Y%m%dT%H%M%SZ)}"
case "$release_id" in ''|.*|*[!a-zA-Z0-9._-]*) echo '无效发布版本 ID' >&2; exit 1;; esac
[ -f "$project_dir/dist/index.html" ] || { echo '请先执行 pnpm build' >&2; exit 1; }
grep -q '/xunshi/assets/' "$project_dir/dist/index.html" || { echo '构建资源路径不匹配 /xunshi/' >&2; exit 1; }
release_dir="/var/www/xunshi-releases/$release_id"
ssh -o BatchMode=yes "$server" "test ! -e '$release_dir' && mkdir -p '$release_dir'"
rsync -rlptz --no-owner --no-group -e 'ssh -o BatchMode=yes' "$project_dir/dist/" "$server:$release_dir/"
case "$server" in
  root@*) ssh -o BatchMode=yes "$server" "bash -s -- '$release_id'" < "$project_dir/deploy/activate.sh" ;;
  *) ssh -o BatchMode=yes "$server" "sudo -n /usr/local/sbin/xunshi-activate '$release_id'" ;;
esac
