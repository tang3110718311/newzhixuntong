---
AIGC:
  ContentProducer: '001191110102MAD55U9H0F10002'
  ContentPropagator: '001191110102MAD55U9H0F10002'
  Label: '1'
  ProduceID: 'cb4a14aa-e493-4fbb-a5ed-c2b0b8e8e71e'
  PropagateID: 'cb4a14aa-e493-4fbb-a5ed-c2b0b8e8e71e'
  ReservedCode1: '30add026-c698-43c2-b639-e694efea021b'
  ReservedCode2: '30add026-c698-43c2-b639-e694efea021b'
---

# 智训通原型对齐技能

> 本技能总结自智训通 Next.js 重构项目中，严格按原型截图逐页对齐前端的实战经验。
> 适用于：前端页面需要对齐产品原型图的所有场景。

---

## 一、核心原则

1. **原型为准，禁止自由创新** — 模块位置、排版、组件摆放严格1:1复刻原型，不多不少
2. **看不清就问，不要脑补** — 截图模糊、信息不足时，直接向用户确认，严禁自行推断设计
3. **逐页对齐，改完即验** — 每改完一页必须验证（typecheck + 视觉截图），不能攒一堆再验

---

## 二、CSS Grid 必成对检查（最高频错误）

### 规则
每次写 `grid-template-columns` 时，**第一行必须是 `display: grid`**。

### 典型错误
```css
/* ❌ 错误：缺少 display: grid，grid-template-columns 不生效 */
.prototype-stats {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

/* ✅ 正确：必须先声明 display: grid */
.prototype-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
```

### 自检清单（每写一个 Grid 容器必查）
| 属性 | 是否必须 | 说明 |
|------|:---:|------|
| `display: grid` | ✅ | Grid 布局的前提，没有则所有 grid 属性都不生效 |
| `grid-template-columns` | ✅ | 列定义 |
| `gap` | 推荐 | 间距，默认0容易挤在一起 |
| `padding` | 视情况 | 内边距 |

### 排查方法
在 globals.css 中搜索所有 `grid-template-columns`，逐一确认其所在选择器是否在同一条规则块内有 `display: grid`。

---

## 三、原型页面结构模板

智训通原型的页面统一采用以下结构，所有页面必须遵守：

### 3.1 整体布局
```
┌──────────────────────────────────────────────────┐
│ 顶部导航栏（面包屑 + 消息通知 + 用户信息）         │
├──────┬───────────────────────────┬───────────────┤
│ 左侧 │    中间主内容区            │  右侧侧边栏    │
│ 菜单  │                          │  (278px)      │
│(248px)│                          │               │
│      │                          │               │
└──────┴───────────────────────────┴───────────────┘
```

- 用 `.home-grid` 实现中间+右侧的左右布局（`grid-template-columns: minmax(0, 1fr) 278px`）
- 右侧侧边栏用 `<aside className="right-rail">`

### 3.2 侧边栏3卡（所有页面统一）
从上到下固定3张卡片，顺序不可变、不可增减：
1. **用户信息卡** — `<div className="profile card">`，头像+姓名+身份标签
2. **培训概况卡** — `<div className="sidecard card">`，本年度+已完成数+3指标（对练/考试/合格率）
3. **通知消息卡** — `<div className="sidecard card">`，通知文案

### 3.3 页面内部顺序（按原型从上到下）
1. 页面标题 + 描述（`page-header`）
2. 统计卡区（`prototype-stats`，2行3列或4列）
3. 筛选控件区（下拉 + 搜索 + 按钮）
4. 主内容区（表格/卡片列表/图表）
5. 弹窗/抽屉等覆盖层

---

## 四、首页专属结构

```
横幅（hero-card，蓝紫渐变）
  ├── 左侧：小标题 + 大标题
  └── 右侧：胶囊按钮（border-radius: 20px，半透明紫色）

通知横条（notice-strip）
  └── "通知消息" + 原型原文（标点不可改）

home-grid
  ├── home-main
  │   ├── 数据概览大卡片（overview）
  │   │   ├── 标题行：左"数据概览" + 右"租户名·年度"
  │   │   ├── 筛选行：部门下拉 + 时间下拉（flex并排）
  │   │   └── 6指标卡：2行×3列 grid（repeat(3, 1fr)）
  │   └── home-bottom-grid
  │       ├── 年度整体趋势（chart，1fr）  ← 左右等宽并排
  │       └── 任务参与度排名（rankcard，1fr）
  └── right-rail
      ├── 用户信息卡
      ├── 培训概况卡
      └── 通知消息卡
```

### 关键尺寸
| 元素 | 值 |
|------|-----|
| 侧边栏宽度 | 278px |
| 左侧菜单宽度 | 248px |
| 横幅按钮圆角 | 20px（胶囊形） |
| 指标卡圆角 | 14px |
| 卡片间距 gap | 18-24px |

---

## 五、常见坑与修复记录

### 5.1 `display: grid` 遗漏
- **症状**：设了 `grid-template-columns: repeat(3, 1fr)` 但页面显示为单列
- **原因**：缺少 `display: grid`
- **修复**：在规则块第一行加 `display: grid`

### 5.2 JSX 中 `>` 字符报错
- **症状**：TS1382 `Unexpected token. Did you mean {'>'} or &gt;?`
- **原因**：JSX 中 `>` 会被解析为标签闭合符
- **修复**：用 `&gt;` 代替，如 `查看我的任务 &gt;`

### 5.3 TypeScript 类型不匹配
- **`sceneFilter` 缺字段**：加 `keyword` 时忘了更新 useState 初始值类型
- **`Exam` 缺字段**：用了 `publishedAt` 但类型定义只有 `startAt`/`endAt`/`createdAt`
- **修复原则**：改 TSX 前先读类型定义，确保字段名匹配

### 5.4 通知消息标点
- **原型**：`暂无新的通知消息，系统将及时...`（逗号）
- **错写成**：`暂无新的通知消息。系统将及时...`（句号）
- **修复**：全局搜索替换，注意原型原文的标点

### 5.5 home-grid 闭合标签错位
- **症状**：TS17008 `JSX element has no corresponding closing tag`
- **原因**：给场景管理加了 `<div className="home-grid">` 和 `<div className="home-main">`，但末尾没加对应的 `</div>` 和右侧3卡 `</aside></div>`
- **修复**：在 `</section>` 之前加上 `</div>` + `<aside>` + `</aside>` + `</div>`

### 5.6 菜单默认展开
- **问题**：`openNavGroups` 初始值 `{ statistics: true, sys: true }` 导致菜单默认展开
- **修复**：改为 `{ statistics: false, sys: false }` 或 `{}`

### 5.7 右侧3卡没有从页面顶部开始（最关键布局错误）
- **症状**：右侧3卡只从数据概览/筛选区才开始，和左侧标题不对齐，下方大片空白
- **根因**：`home-grid` 只包裹了部分内容（如数据概览+底部图表），横幅、通知横条、page-header 等放在了 `home-grid` 外面
- **原型要求**：右侧3卡必须从页面标题/横幅的顶部就开始，与左侧所有内容等高对齐
- **修复**：把 `home-grid` 提升到包裹整个页面内容，所有元素（page-header、横幅、统计卡、筛选区、表格等）全部移入 `home-main`，右侧3卡在 `right-rail` 中独立通栏
- **结构**：
  ```
  page-section
    home-grid
      home-main
        page-header    ← 标题移入 home-main
        统计卡
        筛选区
        表格/内容
      right-rail       ← 从标题顶部就与左侧齐平
        用户信息卡
        培训概况卡
        通知消息卡
  ```
- **CSS**：`home-grid` 默认 `align-items: stretch` 让 right-rail 与 home-main 等高，`right-rail` 用 `display: flex; flex-direction: column`

### 5.8 字体偏小、卡片间距太挤
- **症状**：生成的页面字体比原型小一圈，卡片之间紧挨着没有呼吸感
- **根因**：大量使用 13px 字体，gap 间距统一用 18px 不够区分层级
- **原型规范**：
  | 元素 | 字号 | 说明 |
  |------|-----|------|
  | 页面标题 | 24px | `.page-title` |
  | 卡片区标题 | 18-20px | 主内容区 20px，右侧卡 18px |
  | 统计卡数字 | 24px | `.prototype-stats .metric strong` |
  | 统计卡标签 | 14px | `.prototype-stats .metric span` |
  | 统计卡小字 | 12px | `.prototype-stats .metric small` |
  | 表格内容 | 14px | `th, td` |
  | 正文/说明 | 14px | 全局默认，禁止 13px |
  | 辅助小字 | 12px | 角标、极次要说明 |
- **间距规范**：
  | 间距位置 | 值 | 说明 |
  |---------|-----|------|
  | 统计卡之间 | 16px | `.prototype-stats { gap: 16px }` |
  | 模块之间 | 20px | `.home-main { gap: 20px }` |
  | 右侧3卡之间 | 16px | `.right-rail { gap: 16px }` |
  | 大区块左右 | 24px | `.home-grid { gap: 24px }` |
  | 统计卡内边距 | 20px | `.metric { padding: 20px }` |

### 5.9 柱状图太粗
- **症状**：年度趋势柱状图的柱子又粗又挤，几乎占满横向空间
- **根因**：`.chart-bar` 用了 `flex: 1`，8根柱子把容器等分撑满
- **原型规范**：柱子细长，柱宽约占一半，间距约等于柱宽
- **修复**：改为 `width: 28px` 固定宽度 + `justify-content: space-around` 均匀分布
  ```css
  .chart-bars {
    display: flex;
    align-items: flex-end;
    justify-content: space-around;
    gap: 0;
  }
  .chart-bar {
    width: 28px;
    border-radius: 4px 4px 0 0;
    background: linear-gradient(180deg, #93c5fd 0%, #4080ff 100%);
  }
  ```

### 5.10 顶部导航栏缺企业切换下拉
- **症状**：消息通知和用户头像之间有大片空白
- **原型**：消息通知和用户头像之间有企业名称下拉选择器
- **修复**：补上 `<span className="tenant-selector">企业名称 ⌄</span>`，样式为圆角边框+浅白背景

---

## 六、验证流程（每次改动后必执行）

1. **TypeScript 检查**：`npx tsc --noEmit -p apps/admin/tsconfig.json`
2. **视觉验证**：刷新浏览器确认布局效果（不能只靠 typecheck）
3. **原型逐项核对**：对照截图，逐个检查模块位置、文案、样式
4. **CSS 自检**：所有 `grid-template-columns` 必须有配对的 `display: grid`

---

## 七、禁止项

❌ 禁止私自调整模块位置、新增原型不存在的组件
❌ 禁止修改指标的排布方式（2行3列不可改成1列6行）
❌ 禁止修改原型文案（标点、措辞严格照搬）
❌ 禁止把参与度排名放到右侧侧边栏（它在主内容区下半部分）
❌ 禁止自由发挥设计，一切以原型图为准
❌ 禁止使用 13px 字体（全局最小 14px，仅角标/极次要说明可用 12px）
❌ 禁止把 page-header 放在 home-grid 外面（右侧3卡必须从标题顶部开始）
❌ 禁止统计卡数值用动态计算替代原型静态数据（所有页面统计卡数值必须按原型写死）

---

## 八、数据统计页面特殊结构

### 8.1 合并设计
- 部门数据和学员统计合并为**一个页面**，用标签切换（`.tab-bar` > `.tab-item`）
- 导航子菜单 `statistics-dept` / `statistics-learner` 通过 `setActiveSection` 切换，同时联动 tab 高亮
- 当前激活 tab 用 `borderBottom: 2px solid #4080ff` + `color: #4080ff` + `fontWeight: 600` 标识

### 8.2 部门数据标签页布局
1. 4统计卡：培训任务数12 / 参与学员数286 / 任务完成率78% / 考试合格率82%
2. `.home-bottom-grid` 并排：左侧"各部门任务完成率"柱状图(5部门+X轴标签) + 右侧"重点指标排名"(4条)
3. 部门列表表格：部门/任务数/参与人数/完成率/考试合格率/趋势(↑↓箭头)

### 8.3 学员统计标签页布局
1. 4统计卡：学员总数286 / 人均学习时长26.5h / 学习完成率81% / 优秀率34%
2. `.home-bottom-grid` 并排：左侧"学员学习完成率"柱状图(5维度+X轴标签) + 右侧"重点指标排名"(4条)
3. 学员成绩表格：姓名/手机号/成绩/合格情况(合格绿色/不合格红色标签)/操作(查看报告)

---

## 九、原型静态数据规范

所有页面的统计卡数值和表格数据必须严格按原型写死静态数据，不可用 API 动态计算替代。已在以下页面完成对齐：

| 页面 | 统计卡 | 表格 |
|------|--------|------|
| 我的任务 | 全部4/已逾期1/已完成3/进行中2 | 4行任务卡片 |
| 我的考试 | 全部5/待参加2/已通过2/平均成绩78分 | 4行考试记录 |
| 任务管理 | 总数12/进行中6/已完成4/待发布2 | 4行任务 |
| 申诉管理 | 总数87/待处理2/处理中1/已处理84 | 3行申诉 |
| 企业知识库 | 文件夹5/文件12/视频2/存储258.4MB | 5行文件夹 |
| 场景管理 | 无统计卡 | 6行场景 |
| 数据统计-部门 | 任务12/学员286/完成率78%/合格率82% | 4行部门+趋势 |
| 数据统计-学员 | 学员286/时长26.5h/完成率81%/优秀率34% | 5行学员+合格标签 |

> AI生成