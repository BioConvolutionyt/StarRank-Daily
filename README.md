# StarRank Daily

基于 GitHub REST API 定时抓取 GitHub 上 **Top 1000 星标** 的公共开源仓库数据，助您快速发现值得关注的热门开源项目。

数据通过 GitHub Actions 自动同步，结果直接呈现在 GitHub Pages 静态页面上——无需安装、无需运行，打开浏览器即可查看。

## 在线访问

**访问地址**：`https://BioConvolutionyt.github.io/StarRank-Daily/`

## 功能概览

- **搜索 & 筛选**：按关键词、编程语言、星标/Fork 范围、仓库年龄、社区规范等条件快速定位
- **排序 & 分页**：点击表头一键排序，自定义每页条数
- **仓库详情**：点击仓库名查看完整信息，一键跳转 GitHub
- **图表可视化**：语言分布、Top 10 仓库、语言累计星标、星标区间分布
- **CSV 导出**：将当前筛选结果下载为 CSV 文件
- **深色模式**：支持浅色/深色主题切换

## 数据自动同步

GitHub Actions 工作流每天 **UTC 02:00（北京时间 10:00）** 自动执行（可手动触发）：

1. 通过 Search API 拉取 Top 1000 仓库基础数据
2. 查询每个仓库的社区规范信息（README、行为准则、贡献指南、工作流）
3. 更新数据库并导出 `data.json`、CSV
4. 自动提交变更到仓库


## 项目结构

```
StarRank Daily/
├── index.html                    # GitHub Pages 入口
├── data.json                     # 前端数据源（每日自动更新）
├── sync.py                       # GitHub API 数据同步脚本
├── repos.db                      # SQLite 中间数据库
├── top_1000_os_rules.csv         # CSV 数据副本
├── requirements.txt              # Python 依赖
├── static/
│   ├── css/style.css             # 样式
│   └── js/app-static.js          # 前端逻辑
└── .github/
    └── workflows/
        └── daily-sync.yml        # 每日同步工作流
```

## 数据字段

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

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Bootstrap 5.3 |
| 图标库 | Bootstrap Icons |
| 图表 | Chart.js 4 |
| 数据同步 | GitHub REST API / requests |
| 自动化 | GitHub Actions（每日定时） |
| 部署 | GitHub Pages |
