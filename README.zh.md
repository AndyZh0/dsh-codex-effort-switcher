---
description: "为 DSH composer 提供 Codex 样式的模型与推理等级选择器"
kind: "package-bundle"
---

# dsh-codex-effort-switcher

[English](README.md) | 中文

## 摘要

把 composer 的模型选择器替换为 Codex 样式的卡片：推理等级标题、不透明的分段强度滑杆，以及按提供商分组的模型列表。把打包好的归档安装进 profile 后重启即可；卸载该包即恢复出厂选择器，不留残留。`/model` 命令、设置中的模型页与 Host 选择链路保持原样，因此两处任一处切换都会同步到另一处。卡片以 `priority: -1` 占据 composer 单占用模型槽位的第二个占用项，复用同一份会话级 `modelDirectories` 服务，并提供 `codexModelTiers` 客户端服务供其他插件追加档位。

## 目录

- [安装](#install)
- [使用](#use)
- [与 DSH 的组合方式](#how-it-composes-with-dsh)
- [第三方档位](#third-party-tiers)
- [开发](#development)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)

-----

<a id="install"></a>
## 安装

在本目录内构建；开发依赖与产物都留在本目录。请使用 DSH 支持的 Node.js 版本。

```powershell
npm install --ignore-scripts --workspaces=false
npm run build
npm pack
dsh plugin --profile <profile> add "./dsh-codex-effort-switcher-0.2.2.tgz"
```

也可以在 DSH 插件管理器中填入 `.tgz` 的绝对路径。装进你实际使用的 profile；桌面端请用桌面端自己的插件管理器，因为 CLI 会拒绝由应用托管的 profile。安装后需要重启应用：没有实时补丁重载的 profile 只在启动时组合新 bundle。本插件不会自行安装到任何 profile。

<a id="use"></a>
## 使用

点击 composer 右侧的模型按钮。卡片默认停在强度面：当前等级（蓝色，带右向箭头）在上、模型名在下，合成一个按钮，点击任意一处都会打开模型列表；其下是扁平轨道，每个可选等级一个圆点，纯色填充条的末端与球钮对齐，两端档位与轨道圆角留出间距，最高档时正好铺满这段范围。点击圆点或在轨道上横向拖动即可切换等级；右侧圆形箭头恢复该模型的默认等级。选到该模型的最高等级时，填充条由蓝转紫，并有浅紫色粒子自右向左飘过。面板在调整期间保持打开——等级、模型或默认值都可以连续切换，不必反复打开；点击外部才会关闭，`Esc` 先退回强度面、再关闭面板。“选择模型”面：按提供商分组列出模型，当前模型带勾选。选择模型时：同一路由保留当前等级，换路由则采用该路由的默认等级。

触发按钮显示模型名与等级，并保持原有的无障碍名称；composer 的紧凑模式仍会把它折叠为模型图标。`Esc` 先退回上一级再关闭卡片；方向键移动焦点；选择被拒绝时通过应用 Toast 提示，目录加载失败则在卡片内提供“重新加载”。

<a id="how-it-composes-with-dsh"></a>
## 与 DSH 的组合方式

composer 的模型位是单占用槽位。本插件以 `priority: -1` 注册第二个占用项，遮蔽（shadow）出厂选择器而不卸载它，并复用同一份会话级 `modelDirectories` 服务——因此本卡片与 `/model` 中任一处切换都会同步到另一处，Host 收到的始终是一次 `session.selectModel`。卸载插件即恢复出厂选择器，不留残留。

仅当有多个提供商提供模型时才显示提供商标题；单提供商目录渲染为平铺列表。卡片刻意不透明：使用主题的选择器表面色，而非半透明菜单材质。没有搜索框，列表可滚动。

卸载会移除 bundle 层与卡片；已保存的模型选择与会话日志不受影响。

<a id="third-party-tiers"></a>
## 第三方档位

浏览器侧提供 `codexModelTiers` 客户端服务（`SeatTierRegistry`）。客户端插件注入该服务并注册 `SeatTier`（`id`、`label`、`description`、`available(model)`、`effort(model)`、`active(sessionId)`、`apply(sessionId, selection, model, select)`），即可在模型自身档位之上追加档位。卡片把注册档位排在出厂档位之后；`apply` 收到标准 `select`，Host 仍只收到一次 `session.selectModel`。最高档使用紫色 `data-ultra` skin。没有贡献者时注册表为空，卡片不变；移除贡献者只会移除其档位，不影响选择与会话日志。

档位贡献者就是一个普通的客户端插件：注入该服务、注册自己的档位，并可自带 Host 半来承载该档位在强度之外的语义。依赖是单向的 —— 贡献者依赖本包，反之不成立。

<a id="development"></a>
## 开发

```powershell
npm run typecheck
npm test
node tests/browser-smoke.mjs
```

前两条命令相互独立；切换器测试也覆盖贡献档位。浏览器冒烟测试会打包插件，通过 `apps/cli/lib/bin.js` 安装到一次性的 `DSH_HOME` profile，把夹具提供商指向本地模型端点，从 DSH checkout 启动 `dsh web`，并用 Microsoft Edge 真实操作卡片——断言卡片各面、滑杆、视口适配、以及实际发出的模型与推理强度。它需要 DSH checkout 先执行 `pnpm run build`，证据写入被忽略的 `.runtime/`。发布包不含测试与开发依赖。

浏览器侧除平台 seed 模块（`react`、`react-dom`、`@deepseek-ai/dsh-client-ui-primitives`）外不依赖其他 DSH 模块。它提供档位贡献者注入的 `codexModelTiers` 注册表。Host 入口是空标记，只为让客户端扫描看到该 bundle 行。

<a id="model-experience"></a>
## 模型体验

无：该层不新增面向模型的界面。它改变的是 composer 模型位如何渲染、以及一次选择如何抵达 Host；`/model` 命令、设置中的模型页与那一次 `session.selectModel` 调用都不受影响。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与后续工作

- 模型槽位是单占用，两个同优先级插件同时遮蔽它会抛错。
- 卡片刻意不透明，且没有搜索框。
- 仅当多个提供商都有模型时才显示提供商标题。
- 贡献档位排在出厂档位之后；两个档位共用同一 `id` 会抛错。
- 桌面端安装请走桌面端自己的插件管理器；CLI 会拒绝由应用托管的 profile。
- bundle 在启动时组合，因此没有实时补丁重载的 profile 需要重启应用。
