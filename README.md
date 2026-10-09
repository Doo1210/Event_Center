# 事件中心 Vue 2 重构原型

本目录把事件驱动1023的静态原型改为 Vue 2.6 + JavaScript 单文件组件，按事件列表、接入配置、处理流程、模拟测试和运行记录拆分。代码可独立演示，也可作为 @wanwu/components 中新 EventCenter 模块的迁移起点。

## 运行

在本目录依次执行：

    npm install
    npm run serve
    npm test
    npm run build

demo/main.js 注入 createMockEventCenterApi()。演示数据只存在本次页面运行的内存中，刷新后恢复初始样例；模拟测试不会调用真实动作，也不会新增正式运行记录。初始数据按 1023 原型提供 19 个事件、综合处理流程的草稿与三个版本、分组工具目录，以及历史事件样例。

## GitHub Pages 部署

推送到 `main` 后，`.github/workflows/deploy-pages.yml` 会安装依赖、构建 `dist` 并发布到 [Event Center](https://doo1210.github.io/Event_Center/)。生产构建使用 `/Event_Center/` 作为资源路径；本地开发仍使用 `/`。

## 目录

- src/EventCenter.vue：对外入口、页面切换、列表操作与服务注入。
- src/components/：列表、接入表单、流程与版本、条件/动作编辑、测试、记录/统计、弹窗。
- src/domain/model.mjs：不依赖 Vue 的状态、分支匹配和发布前校验规则。
- src/services/mockApi.mjs：内存演示服务；只实现前端约定的能力，不代表真实后端接口。
- src/data/fixtures.mjs：演示事件、动作资源和记录。
- src/styles.css：以 ec- 类名限定的组件样式。
- 事件中心前端架构调整规划.md：宿主集成、API 缺口、迁移和验收规划。

## 宿主接入约定

组件以 EventCenter 命名导出。必传 api 对象；可传 initialView（list、config、records）和 initialEventId。页面切换时组件发送 navigate 事件，参数为 { view, eventId }，宿主据此同步 Vue Router。新模块内部没有宿主 @/api 或 @/router 引用。

独立演示显式设置 showSidebar: true，展示与 1023 原型一致的 180 px 左侧导航。该 prop 默认 false；集成进已有导航的 wanwu-web 时沿用宿主侧栏，避免重复导航。窄屏下演示侧栏收起，可通过右上角按钮展开。

api 的方法均返回 Promise。事件列表返回 { items, total }，记录列表返回 { items, total, page, pageSize }；创建、编辑和版本操作返回更新后的完整事件，deleteEvent 返回确认结果，simulate 返回模拟轨迹。失败时抛出带用户可读 message 的 Error。

前端服务能力：listEvents、getEvent、createEvent、updateEvent、setIntake、duplicateEvent、deleteEvent、saveDraft、publishDraft、publishVersion、cancelPublish、deleteVersion、copyVersionToDraft、updateVersionDescription、listResources、simulate、listRuns、getRun、getActionStats。入参与返回数据可参照 src/services/mockApi.mjs；现有后端的映射和缺口见规划文档。

生产接入前必须完成宿主 API 适配、权限和路由映射、后端版本/记录语义确认、私服预览包发布及联调。演示服务会去掉密码、Token 等凭据字段；真实凭据的生成、更新和保管由服务端负责。

此目录是可运行的组件化原型，尚未覆盖 1023 PRD 的全部细节；Timer 触发预览、WebHook 高级字段和真实执行轨迹等差异列在规划文档的“当前原型与 1023 需求的差异”小节。
