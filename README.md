# 循势 · 股票工作台

独立股票前端，基于 Vue 3 + TypeScript + Vite 重新开发，交互控件使用 [Naive UI](https://github.com/tusen-ai/naive-ui)。首版仅包含 **信号筛选** 与 **个人观察池**，复用 `tuanzi-server-base` 的账号、股票接口及数据。

## 首版功能

- `/signals`：默认展示近 30 个自然日内最新已扫描日期；按日查询缓存，全市场或指定代码扫描，强制刷新，异步进度，刷新页面恢复任务跟踪，复制代码，批量加入观察池。结果包含所选日期当日涨幅、从该日收盘到最新报价的距今涨幅（东方财富优先、腾讯备用，前复权，逐只标明实际来源），以及当前行业层级和可展开的主题概念（东方财富），独立分批加载。结果支持按当日涨幅、距今涨幅升降序及一级行业名称拼音排序，可点击表头或使用手机端排序下拉框；缺失数据置后、同值保持原顺序，可恢复默认排序。
- `/watchlist`：独立页面，按状态筛选、名称/代码搜索、补查入池信号日之后的历史 S、区分新增与池内已触发数量、取数失败提示、移除前行内确认。个人清单上限 100 只。
- `/login`：使用现有团子账号；循势专用令牌键 `xunshi.session.v1`，401 单次刷新，退出或切换账号清理个人数据。

公开缓存可匿名查看；发起扫描与观察池操作仍由服务端 JWT 鉴权。B 是新浪信号值 1，S 是入池日期之后出现的信号值 0；只展示信号及状态。服务端按交易日 10:00 / 14:50 检查观察池，前端不另建定时检查任务。

## 启动

Node.js 22.12+，pnpm 10.32.0：

```sh
pnpm install --frozen-lockfile
pnpm dev:online
```

打开 http://127.0.0.1:5212 。线上开发模式通过本地 Vite 代理访问 `http://43.140.214.49/api`。

连接本地后端：

```sh
cp .env.example .env.local
pnpm dev
```

`API_PROXY_TARGET` 是后端源地址（默认 `http://127.0.0.1:3000`，不含 `/api`）；`VITE_API_URL` 默认 `/api`。端口固定 5212，占用时直接报错。前端变量不保存服务端密钥。

## 验证

```sh
pnpm test
pnpm lint
pnpm build
pnpm exec playwright install chromium  # 首次浏览器测试时
pnpm test:browser
```

单元测试覆盖上海日期、真实日期校验、批量代码边界与登录回跳。浏览器测试自行启动随机端口 Vite，以隔离接口数据检查公开查询、登录、扫描/恢复、观察池增删与筛选、账户隔离、令牌过期，以及桌面/手机布局。测试不访问生产账号，不创建真实扫描或修改真实观察池。截图在 `results/`（已忽略）。

## 代码边界

- `src/theme.ts`：Naive UI 的深蓝/冷灰主题及全局中文配置（在 `App.vue` 挂载）。
- `src/components/layout/`：应用外壳与导航。
- `src/components/signals/`：工作区、扫描表单、结果表格及历史扫描选择器。
- `src/components/watchlist/`：个人观察工作区与表格。
- `src/composables/`：扫描状态机、取消与轮询、观察池及身份状态。
- `src/lib/api.ts`、`http.ts`、`session.ts`：业务接口、HTTP/令牌刷新、会话隔离。
- `src/lib/domain.ts`、`src/types.ts`：日期/代码规则与后端契约。
- `src/pages/`：只装配功能组件。

接口复用 `/api/auth/*`、`/api/stock-signals/*`、`/api/stock-watchlist/*`，无需迁移现有数据库。历史扫描列表仅展示上海日期最近 30 个自然日（含今天）内已完成的记录；没有近期记录时默认查询今天并显示近期空态。服务端在启动后及每天上海时间 00:10 清理过期终态任务与 B/空值缓存；历史 S 事件独立保留用于观察池判定。日历和接口只允许近 30 天，过期书签自动回到近期最新日期或今天。服务端改动尚未部署。历史日期不自动回溯周末或节假日；没有缓存时明确显示未扫描。无行情、策略、研究、日报等其他模块。

行业与概念需要后端提供 `GET /api/stock-signals/sectors?codes=000030,600519`；接口和发布顺序见 [板块接口说明](docs/sina-signals-migration.md#行业与概念板块2026-10-26)。板块为当前归属，非历史快照；缺失和取数失败会明确显示，不影响筛选结果。

两种涨幅需要 `GET /api/stock-signals/performance?date=2026-09-10&codes=600396,000030`。当日对应所选日期；距今以该日收盘为基准，今天盘中显示待收盘，缺失数据不填零。页面可见时每轮完成后 30 秒更新，附实际报价时间。接口口径与边界见 [涨幅接口说明](docs/sina-signals-migration.md#筛选日涨幅与距今涨幅2026-10-27)。

## 部署

线上入口为 <http://43.140.214.49/xunshi/>，GitHub 仓库为 <https://github.com/1998yyh/xunshi>。

部署沿用主站的 Node 22 + pnpm 10.32.0 构建、SSH + rsync 上传和 Nginx 静态服务。`.env.production` 固定 `VITE_BASE_PATH=/xunshi/` 与 `VITE_API_URL=/xunshi/api`；路由与资源使用相同基路径，独立 API 反代保留后端 `/api` 前缀。

```sh
pnpm build
bash deploy/deploy.sh
```

脚本默认使用本机已有 SSH 认证连接服务器。CI 设置 `DEPLOY_SERVER=xunshi-deploy@43.140.214.49`，使用专用账号和受限 sudo 发布命令。上传只包含 `dist/`，完成后原子切换 `/var/www/xunshi`，检查失败自动恢复旧入口；历史版本保存在 `/var/www/xunshi-releases/`。

`.github/workflows/deploy.yml` 在推送 `main`（纯 Markdown 修改除外）或手动触发时运行。仓库需要配置：

- Variables：`SERVER_USER=xunshi-deploy`、`SERVER_HOST=43.140.214.49`。
- Secrets：`DEPLOY_SSH_KEY`（循势专用部署私钥）、`SSH_KNOWN_HOSTS`（已核验服务器主机公钥）。

Nginx 首次配置见 `deploy/nginx.conf.example` 和 `deploy/nginx.locations.conf`。后续发版只切换循势版本入口，不改主站静态文件。回滚可在 Actions 页面针对旧 ref 手动重跑，或将 `/var/www/xunshi` 原子切回保留的旧版本目录。

开发背景与接口记录见 [docs/sina-signals-migration.md](docs/sina-signals-migration.md)。
