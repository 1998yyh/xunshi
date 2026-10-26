# 循势开发约定

Vue 3 + TypeScript + Vite 独立股票前端。用户确认首版范围：信号筛选与观察池。复用 `../tuanzi-server-base`，服务端协议见 docs/sina-signals-migration.md。

- SFC 使用 `<script setup lang="ts">`，路由页只装配功能组件。组件 props 下传，操作通过 emits 返回。
- 扫描状态在 useSignals，个人观察池在 useWatchlist。保留 AbortController、请求代际及卸载取消。
- 个人数据按身份隔离。退出/切换身份时清除，迟到刷新和写操作不得恢复旧会话或旧清单。
- 库存、命中数、状态只使用实际接口数据。演示数据只放 tests，不进入正式页面。
- 验证运行 pnpm test、pnpm lint、pnpm build、pnpm test:browser；浏览器测试使用隔离数据。
- 未明确要求时不触发生产扫描、修改真实观察池或部署服务。

- 视觉使用深蓝与冷灰；用户明确不喜欢绿色，不使用绿色作为主题或状态配色。
