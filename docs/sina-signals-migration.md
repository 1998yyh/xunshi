# 独立股票前端重建

2026-10-26：旧项目已被用户删除，本项目按用户确认范围重新开发，首版只做信号筛选和观察池。

此前 `personal-homepage` 曾实现股票功能，并在提交 `0da7a7e` 中移除。这里重新编写应用外壳、页面、组件、状态管理与请求层；不恢复历史页面模板。项目复用现有 Vue 工具链版本与后端协议。主站及管理后台此次不修改。

## 服务端契约

| 接口 | 用途 | 权限 |
| --- | --- | --- |
| GET /stock-signals/dates | 已完成扫描日期与命中数 | 公开 |
| GET /stock-signals?date=YYYY-MM-DD | 日期缓存；404 表示尚未扫描 | 公开 |
| POST /stock-signals/scans | 不带 codes 为全市场异步任务，带 codes 为同步结果 | JWT |
| GET /stock-signals/scans/:id | 任务进度，done 时附结果 | 公开 |
| GET /stock-watchlist | 当前用户清单 | JWT |
| POST /stock-watchlist | 批量入池，返回 added / invalid / duplicated / overflow | JWT |
| POST /stock-watchlist/check | 手动检查并返回完整清单 | JWT |
| DELETE /stock-watchlist/:id | 删除本人条目 | JWT |

前缀为 `/api`。指定代码单次最多 500 个；批量入池单次最多 100 个，个人观察池总容量 100 只。B 对应信号值 1；S 由服务端检查入池依据日期之后的信号值 0 并锁定状态。

## 并发与身份

每次查询/扫描生成新的代际与 AbortController，迟到结果不得覆盖新选择。页面卸载取消客户端等待，服务端任务继续运行；运行任务 ID 保留在 URL，刷新后可恢复查询。任务结束清除 URL 中的 run 参数。

个人观察池是一份共享状态，账号切换先清空；查询与写操作以会话代际核对身份，迟到响应不写回新账号。401 刷新采用共享 Promise，刷新期间退出后不得恢复旧令牌。

## 验证范围

浏览器测试使用隔离接口替身覆盖读写与登录状态；线上只做公开历史缓存读取，不操作真实用户观察池或触发市场扫描。本次已扩展部署配置：生产入口 `/xunshi/`，公开仓库 `1998yyh/xunshi`，Actions 发布流水线通过独立部署账号切换版本目录。
