# StarRank-Daily

基于 GitHub REST API 收集的 **1000 个最高星标公共开源仓库** 的本地数据库应用，提供完整的增删改查功能、数据可视化图表和高级筛选能力，并通过 GitHub Actions 每日自动同步最新数据。

## 在线访问（GitHub Pages）

本项目支持通过 GitHub Pages 直接在线浏览，无需安装任何软件或运行服务器：

**访问地址**：`https://BioConvolutionyt.github.io/StarRank-Daily/`

GitHub Pages 版本为只读浏览模式，支持搜索、筛选、排序、分页和图表可视化。数据通过每日自动同步的 `data.json` 驱动，始终保持最新。

## 项目结构

```
StarRank Daily/
├── index.html                    # GitHub Pages 静态入口（在线访问）
├── data.json                     # 静态站点数据源（同步时自动更新）
├── app.py                        # Flask 后端主程序（本地完整版入口）
├── sync.py                       # GitHub API 数据同步脚本
├── repos.db                      # SQLite 数据库（首次运行自动生成）
├── top_1000_os_rules.csv         # 原始 CSV 数据源（同步时自动更新）
├── requirements.txt              # Python 依赖清单
├── templates/
│   └── index.html                # Flask 网页模板（本地完整版）
├── static/
│   ├── css/style.css             # 自定义样式（两个版本共享）
│   └── js/
│       ├── app.js                # Flask 版前端逻辑
│       └── app-static.js         # GitHub Pages 版前端逻辑
└── .github/
    └── workflows/
        └── daily-sync.yml        # GitHub Actions 每日同步工作流
```

## 环境要求

- Python 3.8+

## 安装与运行

**1. 安装依赖**

```bash
pip install -r requirements.txt
```

依赖包：

| 包名 | 版本 | 用途 |
|------|------|------|
| Flask | 3.1.0 | Web 框架 |
| openpyxl | 3.1.5 | Excel 导出支持 |
| requests | >=2.31.0 | GitHub API 数据同步 |

**2. 启动应用**

```bash
python app.py
```

首次启动时会自动读取 `top_1000_os_rules.csv` 并导入到 SQLite 数据库 `repos.db` 中。

**3. 打开浏览器访问**

```
http://localhost:5000
```

如果需要局域网内其他设备访问，使用本机 IP 地址替换 `localhost`。

## 配置项

所有可配置项位于 `app.py` 文件顶部：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DB_PATH` | `repos.db` | 数据库文件路径 |
| `CSV_PATH` | `top_1000_os_rules.csv` | 数据源 CSV 路径 |
| `HOST` | `0.0.0.0` | 监听地址（`0.0.0.0` 允许外部访问） |
| `PORT` | `5000` | 监听端口 |
| `DEBUG` | `True` | 调试模式（生产环境请设为 `False`） |

## 数据自动同步

项目内置了 GitHub Actions 工作流和同步脚本，可以每天自动通过 GitHub REST API 更新数据。

### 自动同步（GitHub Actions）

工作流文件 `.github/workflows/daily-sync.yml` 会在每天 **UTC 02:00（北京时间 10:00）** 自动运行，执行以下步骤：

1. 通过 Search API 拉取 Top 1000 仓库的基础数据（stars、forks、issues 等）
2. 逐个查询每个仓库的社区规范信息（README、行为准则、贡献指南、工作流）
3. 更新 `repos.db` 数据库和 `top_1000_os_rules.csv` 文件
4. 自动提交变更到仓库

### 手动同步（本地运行）

也可以在本地手动运行同步脚本：

```bash
# Linux / macOS
export GITHUB_TOKEN="Your Token"
python sync.py

# Windows PowerShell
$env:GITHUB_TOKEN="Your Token"
python sync.py
```

不设置 Token 也可以运行，但会受到 API 速率限制（60 次/小时）。设置 Token 后限制为 5000 次/小时。

完整同步（含社区规范查询）约需 30 分钟。

## UI 界面使用指南

### 导航栏

导航栏位于页面顶部，包含以下操作：

- **深色/浅色模式切换**：点击月亮/太阳图标切换主题，偏好会自动保存
- **表格/图表视图**：点击对应图标在两种视图间切换
- **导出**：下拉菜单选择导出为 CSV 或 Excel 文件
- **添加仓库**：打开表单新增一条记录

### 统计摘要

页面顶部的 5 张卡片实时展示：总仓库数、总星标数、平均星标、最高星标、编程语言数。

### 表格视图

#### 搜索与基础筛选

- **搜索框**：输入关键词，自动在仓库名、描述、组织名中模糊匹配
- **语言筛选**：下拉选择编程语言
- **排序**：通过下拉菜单或直接**点击表头**（仓库名、组织、星标、Forks、Issues）进行排序，点击同一列头切换升序/降序
- **分页**：底部可切换每页 10/20/50/100 条，支持首页、上一页、下一页、末页跳转

#### 高级筛选

点击筛选栏右侧的漏斗图标展开高级筛选面板：

- **星标数范围**：设置最小值和最大值
- **Fork 数范围**：设置最小值和最大值
- **仓库年龄**：按年为单位设置范围（支持小数，如 1.5 年）
- **社区规范要求**：勾选后仅显示满足对应条件的仓库（README、行为准则、贡献指南、工作流）

高级筛选激活时，漏斗按钮上会显示红色数字角标表示当前激活的筛选条件数。点击「重置」可一键清空所有高级条件。

#### 操作

每行末尾有两个操作按钮：

- **编辑**（铅笔图标）：打开表单修改该仓库信息
- **删除**（垃圾桶图标）：弹出确认框，确认后永久删除该记录

#### 查看详情

点击任意仓库名，弹出详情窗口，展示：

- 仓库名称、组织、编程语言标签
- Stars / Forks / Issues 彩色统计卡片
- 仓库年龄
- 社区规范检查清单（绿勾/灰叉）
- 项目描述
- 「在 GitHub 上查看」外链按钮

### 图表视图

点击导航栏的柱状图图标切换到图表视图，包含 4 张交互式图表：

| 图表 | 类型 | 内容 |
|------|------|------|
| 编程语言分布 | 圆环图 | Top 15 语言的仓库数量占比 |
| 星标数 Top 10 | 横向柱状图 | 星标最高的 10 个仓库 |
| 各语言累计星标 | 柱状图 | Top 15 语言的星标总和对比 |
| 星标分布区间 | 饼图 | 按 20k/50k/100k/200k 分段统计 |

### 数据导出

点击导航栏「导出」按钮，选择格式：

- **CSV**：UTF-8 编码，兼容 Excel 直接打开
- **Excel**：带格式表头的 `.xlsx` 文件

导出时会自动应用当前所有筛选条件（搜索、语言、高级筛选），仅导出筛选后的数据。

## 数据字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `repo_name` | 文本 | 仓库名称 |
| `organization` | 文本 | 所属组织或作者 |
| `language` | 文本 | 主要编程语言 |
| `stars` | 整数 | 星标数 |
| `forks` | 整数 | Fork 数 |
| `open_issues` | 整数 | 未解决的 Issue 数 |
| `age_days` | 整数 | 仓库创建至今的天数 |
| `has_coc` | 布尔 | 是否有行为准则文件 |
| `has_contributing` | 布尔 | 是否有贡献指南 |
| `has_workflows` | 布尔 | 是否有 CI/CD 工作流 |
| `has_readme` | 布尔 | 是否有 README 文件 |
| `description` | 文本 | 项目描述 |

## 两种使用方式对比

| 特性 | GitHub Pages（在线版） | Flask（本地完整版） |
|------|----------------------|-------------------|
| 访问方式 | 浏览器直接打开 | 运行 `python app.py` |
| 数据来源 | `data.json` | `repos.db`（SQLite） |
| 搜索/筛选/排序 | 客户端计算 | 服务端 SQL 查询 |
| 图表可视化 | 支持 | 支持 |
| 增删改查 | 只读 | 完整 CRUD |
| 导出 | CSV（客户端生成） | CSV + Excel |
| 数据更新 | GitHub Actions 自动 | 手动运行 sync.py |

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python / Flask |
| 数据库 | SQLite（WAL 模式） |
| 前端框架 | Bootstrap 5.3 |
| 图标库 | Bootstrap Icons |
| 图表 | Chart.js 4 |
| 导出 | openpyxl (Excel) / csv (CSV) |
| 数据同步 | GitHub REST API / requests |
| 自动化 | GitHub Actions（每日定时） |
| 静态部署 | GitHub Pages |
