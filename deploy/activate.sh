#!/usr/bin/env bash
# 在服务器执行；完整上传后才切换入口，健康检查失败则恢复前一版本。
set -euo pipefail
release_id="${1:?需要发布版本 ID}"
case "$release_id" in ''|.*|*[!a-zA-Z0-9._-]*) echo '无效发布版本 ID' >&2; exit 1;; esac
site_path=/var/www/xunshi
release_dir="/var/www/xunshi-releases/$release_id"
next_link="${site_path}.next"
[ -f "$release_dir/index.html" ] && [ -d "$release_dir/assets" ] || { echo '发布目录不完整' >&2; exit 1; }
if [ -e "$site_path" ] && [ ! -L "$site_path" ]; then
  echo '站点路径不是符号链接，停止以免覆盖其他文件' >&2
  exit 1
fi
exec 9>/var/lock/xunshi-deploy.lock
flock -n 9 || { echo '另一个循势部署正在进行' >&2; exit 1; }
previous="$(readlink "$site_path" 2>/dev/null || true)"
rollback() {
  trap - ERR
  if [ -n "$previous" ]; then
    rm -f "$next_link"
    ln -s "$previous" "$next_link"
    mv -Tf "$next_link" "$site_path"
  else
    rm -f "$site_path"
  fi
  echo '健康检查失败，已恢复部署前的站点入口' >&2
}
rm -f "$next_link"
ln -s "$release_dir" "$next_link"
mv -Tf "$next_link" "$site_path"
trap rollback ERR
ready=false
for attempt in $(seq 1 10); do
  if curl --max-time 10 -fsS http://127.0.0.1/xunshi/signals | grep -q '循势'; then
    ready=true
    break
  fi
  sleep 1
done
[ "$ready" = true ]
curl --max-time 15 -fsS http://127.0.0.1/xunshi/api/stock-signals/dates | python3 -c 'import json,sys; assert isinstance(json.load(sys.stdin),list)'
missing_status="$(curl --max-time 10 -s -o /dev/null -w '%{http_code}' http://127.0.0.1/xunshi/assets/__missing__.js)"
[ "$missing_status" = 404 ]
trap - ERR
printf '循势发布成功：%s\n前一版本：%s\n' "$release_dir" "${previous:-无}"
