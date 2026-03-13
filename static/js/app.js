/* ── 状态 ──────────────────────────────────────────────────────── */
let currentPage = 1;
let totalPages = 1;
let deleteTargetId = null;
let chartInstances = {};
let cachedStats = null;

/* ── 语言颜色映射（GitHub 官方色） ────────────────────────────── */
const LANG_COLORS = {
    "Python":           { bg: "#3572A5", text: "#fff" },
    "JavaScript":       { bg: "#f1e05a", text: "#333" },
    "TypeScript":       { bg: "#3178c6", text: "#fff" },
    "Java":             { bg: "#b07219", text: "#fff" },
    "Go":               { bg: "#00ADD8", text: "#fff" },
    "Rust":             { bg: "#dea584", text: "#333" },
    "C++":              { bg: "#f34b7d", text: "#fff" },
    "C":                { bg: "#555555", text: "#fff" },
    "C#":               { bg: "#178600", text: "#fff" },
    "Ruby":             { bg: "#701516", text: "#fff" },
    "PHP":              { bg: "#4F5D95", text: "#fff" },
    "Swift":            { bg: "#F05138", text: "#fff" },
    "Kotlin":           { bg: "#A97BFF", text: "#fff" },
    "Dart":             { bg: "#00B4AB", text: "#fff" },
    "Shell":            { bg: "#89e051", text: "#333" },
    "HTML":             { bg: "#e34c26", text: "#fff" },
    "CSS":              { bg: "#563d7c", text: "#fff" },
    "Jupyter Notebook": { bg: "#DA5B0B", text: "#fff" },
    "Markdown":         { bg: "#083fa1", text: "#fff" },
    "Vue":              { bg: "#41b883", text: "#fff" },
    "Lua":              { bg: "#000080", text: "#fff" },
    "Scala":            { bg: "#c22d40", text: "#fff" },
    "R":                { bg: "#198CE7", text: "#fff" },
    "Haskell":          { bg: "#5e5086", text: "#fff" },
    "Elixir":           { bg: "#6e4a7e", text: "#fff" },
    "Clojure":          { bg: "#db5855", text: "#fff" },
    "Zig":              { bg: "#ec915c", text: "#333" },
    "Objective-C":      { bg: "#438eff", text: "#fff" },
    "Assembly":         { bg: "#6E4C13", text: "#fff" },
    "Dockerfile":       { bg: "#384d54", text: "#fff" },
};

function getLangStyle(lang) {
    if (!lang) return null;
    return LANG_COLORS[lang] || { bg: "#e0e7ff", text: "#4338ca" };
}

/* ── 深色模式 ──────────────────────────────────────────────────── */
function initTheme() {
    const saved = localStorage.getItem("theme");
    if (saved) {
        setTheme(saved);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setTheme("dark");
    } else {
        setTheme("light");
    }
}

function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const icon = document.getElementById("theme-icon");
    if (theme === "dark") {
        icon.className = "bi bi-sun-fill";
    } else {
        icon.className = "bi bi-moon-fill";
    }
    localStorage.setItem("theme", theme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    setTheme(next);
    rebuildChartsForTheme();
}

function rebuildChartsForTheme() {
    if (cachedStats) {
        renderLangDistChart(cachedStats.language_distribution);
        renderTop10Chart(cachedStats.top_10);
        renderLangStarsChart(cachedStats.language_distribution);
        renderStarsRangeChart(cachedStats.stars_ranges);
    }
}

function getChartTextColor() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "#94a3b8" : "#6b7280";
}

function getChartBorderColor() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "#1e293b" : "#ffffff";
}

/* ── 初始化 ────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    loadLanguages();
    loadRepos();
    loadStats();
    initSortHeaders();

    document.getElementById("search-input").addEventListener("keydown", (e) => {
        if (e.key === "Enter") loadRepos(1);
    });
});

/* ── 视图切换（带过渡动画） ──────────────────────────────────── */
function switchView(view) {
    const tableView = document.getElementById("view-table");
    const chartView = document.getElementById("view-charts");
    const btnTable = document.getElementById("btn-view-table");
    const btnCharts = document.getElementById("btn-view-charts");

    const outgoing = view === "table" ? chartView : tableView;
    const incoming = view === "table" ? tableView : chartView;

    outgoing.classList.add("fade-out");
    setTimeout(() => {
        outgoing.classList.add("d-none");
        outgoing.classList.remove("fade-out");
        incoming.classList.remove("d-none");
        incoming.classList.add("fade-in");
        setTimeout(() => incoming.classList.remove("fade-in"), 260);
    }, 250);

    if (view === "table") {
        btnTable.classList.add("active");
        btnCharts.classList.remove("active");
    } else {
        btnTable.classList.remove("active");
        btnCharts.classList.add("active");
        loadStats();
    }
}

/* ── 数字格式化 ────────────────────────────────────────────────── */
function formatNumber(n) {
    if (n == null) return "-";
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "k";
    return n.toLocaleString();
}

function formatNumberFull(n) {
    if (n == null) return "-";
    return n.toLocaleString("zh-CN");
}

/* ── countUp 动画 ──────────────────────────────────────────────── */
function countUp(el, target, duration = 800) {
    if (target == null || isNaN(target)) { el.textContent = "-"; return; }
    const start = performance.now();
    const initial = 0;
    const isLargeNum = target >= 1000;

    function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(initial + (target - initial) * eased);

        if (isLargeNum) {
            el.textContent = formatNumber(current);
        } else {
            el.textContent = formatNumberFull(current);
        }

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            if (isLargeNum) {
                el.textContent = formatNumber(target);
            } else {
                el.textContent = formatNumberFull(target);
            }
        }
    }
    requestAnimationFrame(update);
}

/* ── 加载语言列表 ──────────────────────────────────────────────── */
async function loadLanguages() {
    const res = await fetch("/api/languages");
    const langs = await res.json();
    const select = document.getElementById("language-filter");
    langs.forEach((lang) => {
        const opt = document.createElement("option");
        opt.value = lang;
        opt.textContent = lang;
        select.appendChild(opt);
    });
}

/* ── 搜索防抖 ──────────────────────────────────────────────────── */
let searchTimer = null;
function debounceSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadRepos(1), 350);
}

function clearSearch() {
    document.getElementById("search-input").value = "";
    loadRepos(1);
}

/* ── 高级筛选参数收集 ─────────────────────────────────────────── */
function getAdvancedFilterParams() {
    const params = {};
    const starsMin = document.getElementById("filter-stars-min").value;
    const starsMax = document.getElementById("filter-stars-max").value;
    const forksMin = document.getElementById("filter-forks-min").value;
    const forksMax = document.getElementById("filter-forks-max").value;
    const ageMin = document.getElementById("filter-age-min").value;
    const ageMax = document.getElementById("filter-age-max").value;

    if (starsMin) params.stars_min = starsMin;
    if (starsMax) params.stars_max = starsMax;
    if (forksMin) params.forks_min = forksMin;
    if (forksMax) params.forks_max = forksMax;
    if (ageMin) params.age_min = ageMin;
    if (ageMax) params.age_max = ageMax;

    if (document.getElementById("filter-has-readme").checked) params.req_readme = "1";
    if (document.getElementById("filter-has-coc").checked) params.req_coc = "1";
    if (document.getElementById("filter-has-contributing").checked) params.req_contributing = "1";
    if (document.getElementById("filter-has-workflows").checked) params.req_workflows = "1";

    return params;
}

function getActiveFilterCount() {
    const p = getAdvancedFilterParams();
    return Object.keys(p).length;
}

function updateAdvToggleState() {
    const count = getActiveFilterCount();
    const btn = document.getElementById("btn-adv-toggle");
    const existingBadge = btn.querySelector(".active-filter-count");
    if (existingBadge) existingBadge.remove();

    if (count > 0) {
        btn.classList.add("active");
        const badge = document.createElement("span");
        badge.className = "active-filter-count";
        badge.textContent = count;
        btn.appendChild(badge);
    } else {
        btn.classList.remove("active");
    }
}

function toggleAdvancedFilters() {
    const panel = document.getElementById("advanced-filters");
    const bsCollapse = bootstrap.Collapse.getOrCreateInstance(panel);
    bsCollapse.toggle();
}

function resetAdvancedFilters() {
    document.getElementById("filter-stars-min").value = "";
    document.getElementById("filter-stars-max").value = "";
    document.getElementById("filter-forks-min").value = "";
    document.getElementById("filter-forks-max").value = "";
    document.getElementById("filter-age-min").value = "";
    document.getElementById("filter-age-max").value = "";
    document.getElementById("filter-has-readme").checked = false;
    document.getElementById("filter-has-coc").checked = false;
    document.getElementById("filter-has-contributing").checked = false;
    document.getElementById("filter-has-workflows").checked = false;
    updateAdvToggleState();
    loadRepos(1);
}

/* ── 骨架屏 ────────────────────────────────────────────────────── */
function renderSkeletonRows(count = 5) {
    let html = "";
    for (let i = 0; i < count; i++) {
        html += `<tr><td colspan="9" style="padding:0;border:none">
            <div class="skeleton-row">
                <span class="skeleton" style="width:30px"></span>
                <span class="skeleton"></span>
                <span class="skeleton" style="width:70%"></span>
                <span class="skeleton" style="width:60px"></span>
                <span class="skeleton" style="width:50px"></span>
                <span class="skeleton" style="width:50px"></span>
                <span class="skeleton" style="width:40px"></span>
                <span class="skeleton" style="width:80px"></span>
                <span class="skeleton" style="width:60px"></span>
            </div>
        </td></tr>`;
    }
    return html;
}

/* ── 加载仓库列表 ─────────────────────────────────────────────── */
async function loadRepos(page) {
    if (page !== undefined) currentPage = page;

    const search = document.getElementById("search-input").value;
    const language = document.getElementById("language-filter").value;
    const sortBy = document.getElementById("sort-by").value;
    const order = document.getElementById("sort-order").value;
    const perPage = document.getElementById("per-page").value;

    const params = new URLSearchParams({
        page: currentPage,
        per_page: perPage,
        search, language,
        sort_by: sortBy,
        order,
    });

    const advParams = getAdvancedFilterParams();
    for (const [k, v] of Object.entries(advParams)) {
        params.set(k, v);
    }
    updateAdvToggleState();

    const tbody = document.getElementById("repos-tbody");
    tbody.innerHTML = renderSkeletonRows();

    try {
        const res = await fetch(`/api/repos?${params}`);
        const json = await res.json();
        totalPages = json.total_pages;
        currentPage = json.page;

        if (json.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9">
                <div class="empty-state">
                    <i class="bi bi-search empty-icon"></i>
                    <div class="empty-title">未找到匹配结果</div>
                    <div class="empty-hint">试试其他关键词，或调整筛选条件</div>
                    <button class="btn btn-outline-primary btn-sm" onclick="clearSearch(); resetAdvancedFilters();">
                        <i class="bi bi-arrow-counterclockwise me-1"></i>重置所有筛选
                    </button>
                </div>
            </td></tr>`;
        } else {
            tbody.innerHTML = json.data.map((r, i) => renderRow(r, i)).join("");
        }

        updatePagination(json);
        updateSortIndicators();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="9">
            <div class="empty-state">
                <i class="bi bi-exclamation-triangle empty-icon" style="color:var(--danger)"></i>
                <div class="empty-title">加载失败</div>
                <div class="empty-hint">${escapeHtml(err.message)}</div>
                <button class="btn btn-outline-primary btn-sm" onclick="loadRepos()">
                    <i class="bi bi-arrow-clockwise me-1"></i>重新加载
                </button>
            </div>
        </td></tr>`;
    }
}

/* ── 渲染表格行（带彩色语言标签 + 逐行动画延迟） ──────────────── */
function renderRow(r, index) {
    const communityBadges = [
        { key: "has_readme", icon: "bi-file-text", title: "README" },
        { key: "has_coc", icon: "bi-shield-check", title: "行为准则" },
        { key: "has_contributing", icon: "bi-people", title: "贡献指南" },
        { key: "has_workflows", icon: "bi-gear", title: "工作流" },
    ].map((b) => {
        const active = r[b.key];
        return `<span class="community-badge ${active ? 'active' : 'inactive'}" title="${b.title}">
            <i class="bi ${b.icon}"></i></span>`;
    }).join("");

    let langBadge;
    if (r.language) {
        const ls = getLangStyle(r.language);
        langBadge = `<span class="lang-badge" style="background:${ls.bg};color:${ls.text}">${escapeHtml(r.language)}</span>`;
    } else {
        langBadge = `<span class="text-muted">-</span>`;
    }

    const desc = r.description
        ? `<div class="repo-desc" title="${escapeHtml(r.description)}">${escapeHtml(r.description)}</div>`
        : "";

    const delay = index * 30;

    return `<tr style="animation-delay:${delay}ms">
        <td class="col-id text-muted">${r.id}</td>
        <td>
            <a class="repo-name" onclick="showDetail(${r.id})">${escapeHtml(r.repo_name)}</a>
            ${desc}
        </td>
        <td>${escapeHtml(r.organization || "-")}</td>
        <td>${langBadge}</td>
        <td class="text-end number-cell star-count" title="${formatNumberFull(r.stars)}">${formatNumber(r.stars)}</td>
        <td class="text-end number-cell" title="${formatNumberFull(r.forks)}">${formatNumber(r.forks)}</td>
        <td class="text-end number-cell">${formatNumber(r.open_issues)}</td>
        <td class="text-center">${communityBadges}</td>
        <td class="text-center action-btns">
            <button class="btn btn-outline-primary btn-sm" onclick="openEditModal(${r.id})" title="编辑">
                <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-danger btn-sm" onclick="openDeleteModal(${r.id}, '${escapeHtml(r.repo_name)}')" title="删除">
                <i class="bi bi-trash"></i>
            </button>
        </td>
    </tr>`;
}

/* ── 表头排序 ──────────────────────────────────────────────────── */
function initSortHeaders() {
    document.querySelectorAll("th[data-sort]").forEach((th) => {
        th.addEventListener("click", () => {
            const field = th.getAttribute("data-sort");
            const sortByEl = document.getElementById("sort-by");
            const orderEl = document.getElementById("sort-order");

            if (sortByEl.value === field) {
                orderEl.value = orderEl.value === "desc" ? "asc" : "desc";
            } else {
                sortByEl.value = field;
                orderEl.value = "desc";
            }
            loadRepos(1);
        });
    });
}

function onSortDropdownChange() {
    updateSortIndicators();
    loadRepos(1);
}

function updateSortIndicators() {
    const currentSort = document.getElementById("sort-by").value;
    const currentOrder = document.getElementById("sort-order").value;

    document.querySelectorAll("th[data-sort]").forEach((th) => {
        const arrow = th.querySelector(".sort-arrow");
        const field = th.getAttribute("data-sort");

        if (field === currentSort) {
            th.classList.add("sort-active");
            arrow.className = currentOrder === "asc"
                ? "bi bi-caret-up-fill sort-arrow"
                : "bi bi-caret-down-fill sort-arrow";
        } else {
            th.classList.remove("sort-active");
            arrow.className = "bi bi-chevron-expand sort-arrow";
        }
    });
}

/* ── 分页 ──────────────────────────────────────────────────────── */
function updatePagination(json) {
    document.getElementById("page-info").textContent =
        `共 ${formatNumberFull(json.total)} 条，第 ${json.page}/${json.total_pages} 页`;
    document.getElementById("page-current").textContent = json.page;

    document.getElementById("btn-first").disabled = json.page <= 1;
    document.getElementById("btn-prev").disabled = json.page <= 1;
    document.getElementById("btn-next").disabled = json.page >= json.total_pages;
    document.getElementById("btn-last").disabled = json.page >= json.total_pages;
}

function goPage(dir) {
    switch (dir) {
        case "first": loadRepos(1); break;
        case "prev":  loadRepos(Math.max(1, currentPage - 1)); break;
        case "next":  loadRepos(Math.min(totalPages, currentPage + 1)); break;
        case "last":  loadRepos(totalPages); break;
    }
}

/* ── 详情弹窗（美化版） ──────────────────────────────────────── */
async function showDetail(id) {
    const res = await fetch(`/api/repos/${id}`);
    const r = await res.json();

    const ls = getLangStyle(r.language);
    const langHtml = r.language
        ? `<span class="lang-badge" style="background:${ls.bg};color:${ls.text}">${escapeHtml(r.language)}</span>`
        : "";

    const ghUrl = r.organization
        ? `https://github.com/${encodeURIComponent(r.organization)}/${encodeURIComponent(r.repo_name)}`
        : `https://github.com/search?q=${encodeURIComponent(r.repo_name)}`;

    const checkItem = (checked, label) => `
        <div class="detail-check-item ${checked ? 'checked' : 'unchecked'}">
            <i class="bi ${checked ? 'bi-check-circle-fill' : 'bi-x-circle'}"></i>
            <span>${label}</span>
        </div>`;

    document.getElementById("detail-body").innerHTML = `
        <div class="detail-header">
            <div class="detail-header-left">
                <h4>${escapeHtml(r.repo_name)}</h4>
                <div class="detail-org">
                    <i class="bi bi-building me-1"></i>${escapeHtml(r.organization || "Unknown")}
                    <span class="ms-2">${langHtml}</span>
                </div>
            </div>
            <a href="${ghUrl}" target="_blank" rel="noopener" class="btn btn-outline-primary btn-sm">
                <i class="bi bi-github me-1"></i>在 GitHub 上查看
            </a>
        </div>

        <div class="detail-stats">
            <div class="detail-stat-card stars-card">
                <div class="stat-num">${formatNumberFull(r.stars)}</div>
                <div class="stat-lbl"><i class="bi bi-star-fill me-1"></i>Stars</div>
            </div>
            <div class="detail-stat-card forks-card">
                <div class="stat-num">${formatNumberFull(r.forks)}</div>
                <div class="stat-lbl"><i class="bi bi-diagram-2 me-1"></i>Forks</div>
            </div>
            <div class="detail-stat-card issues-card">
                <div class="stat-num">${formatNumberFull(r.open_issues)}</div>
                <div class="stat-lbl"><i class="bi bi-exclamation-circle me-1"></i>Issues</div>
            </div>
        </div>

        <div class="detail-meta">
            <div class="detail-meta-item">
                <i class="bi bi-calendar3"></i>
                <span>创建于 <strong>${formatNumberFull(r.age_days)}</strong> 天前（约 ${(r.age_days / 365).toFixed(1)} 年）</span>
            </div>
        </div>

        <div class="detail-checklist">
            ${checkItem(r.has_readme, "README 文档")}
            ${checkItem(r.has_coc, "行为准则")}
            ${checkItem(r.has_contributing, "贡献指南")}
            ${checkItem(r.has_workflows, "CI/CD 工作流")}
        </div>

        ${r.description ? `<div class="detail-desc-box">
            <div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:6px">项目描述</div>
            ${escapeHtml(r.description)}
        </div>` : ""}
    `;

    new bootstrap.Modal(document.getElementById("detailModal")).show();
}

/* ── 创建弹窗 ──────────────────────────────────────────────────── */
function openCreateModal() {
    document.getElementById("modal-title").textContent = "添加仓库";
    document.getElementById("repo-form").reset();
    document.getElementById("form-id").value = "";
    new bootstrap.Modal(document.getElementById("repoModal")).show();
}

/* ── 编辑弹窗 ──────────────────────────────────────────────────── */
async function openEditModal(id) {
    const res = await fetch(`/api/repos/${id}`);
    const r = await res.json();

    document.getElementById("modal-title").textContent = "编辑仓库";
    document.getElementById("form-id").value = r.id;
    document.getElementById("form-repo_name").value = r.repo_name;
    document.getElementById("form-organization").value = r.organization || "";
    document.getElementById("form-language").value = r.language || "";
    document.getElementById("form-stars").value = r.stars;
    document.getElementById("form-forks").value = r.forks;
    document.getElementById("form-open_issues").value = r.open_issues;
    document.getElementById("form-age_days").value = r.age_days;
    document.getElementById("form-has_coc").checked = !!r.has_coc;
    document.getElementById("form-has_contributing").checked = !!r.has_contributing;
    document.getElementById("form-has_workflows").checked = !!r.has_workflows;
    document.getElementById("form-has_readme").checked = !!r.has_readme;
    document.getElementById("form-description").value = r.description || "";

    new bootstrap.Modal(document.getElementById("repoModal")).show();
}

/* ── 保存（新建或更新） ──────────────────────────────────────────── */
async function saveRepo() {
    const id = document.getElementById("form-id").value;
    const data = {
        repo_name: document.getElementById("form-repo_name").value.trim(),
        organization: document.getElementById("form-organization").value.trim(),
        language: document.getElementById("form-language").value.trim(),
        stars: parseInt(document.getElementById("form-stars").value) || 0,
        forks: parseInt(document.getElementById("form-forks").value) || 0,
        open_issues: parseInt(document.getElementById("form-open_issues").value) || 0,
        age_days: parseInt(document.getElementById("form-age_days").value) || 0,
        has_coc: document.getElementById("form-has_coc").checked,
        has_contributing: document.getElementById("form-has_contributing").checked,
        has_workflows: document.getElementById("form-has_workflows").checked,
        has_readme: document.getElementById("form-has_readme").checked,
        description: document.getElementById("form-description").value.trim(),
    };

    if (!data.repo_name) {
        showToast("请输入仓库名称", "error");
        return;
    }

    const isEdit = !!id;
    const url = isEdit ? `/api/repos/${id}` : "/api/repos";
    const method = isEdit ? "PUT" : "POST";

    try {
        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        const json = await res.json();

        if (res.ok) {
            bootstrap.Modal.getInstance(document.getElementById("repoModal")).hide();
            showToast(isEdit ? "仓库信息已更新" : "仓库已成功添加", "success");
            loadRepos();
            loadStats();
        } else {
            showToast(json.error || "操作失败", "error");
        }
    } catch (err) {
        showToast("网络错误：" + err.message, "error");
    }
}

/* ── 删除 ──────────────────────────────────────────────────────── */
function openDeleteModal(id, name) {
    deleteTargetId = id;
    document.getElementById("delete-name").textContent = name;
    new bootstrap.Modal(document.getElementById("deleteModal")).show();
}

async function confirmDelete() {
    if (!deleteTargetId) return;

    try {
        const res = await fetch(`/api/repos/${deleteTargetId}`, { method: "DELETE" });
        const json = await res.json();

        bootstrap.Modal.getInstance(document.getElementById("deleteModal")).hide();
        if (res.ok) {
            showToast("仓库已删除", "success");
            loadRepos();
            loadStats();
        } else {
            showToast(json.error || "删除失败", "error");
        }
    } catch (err) {
        showToast("网络错误：" + err.message, "error");
    }
    deleteTargetId = null;
}

/* ── 统计图表 ──────────────────────────────────────────────────── */
const CHART_COLORS = [
    "#4A6CF7", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
    "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16",
    "#06B6D4", "#E11D48", "#A855F7", "#22C55E", "#EAB308",
];

async function loadStats() {
    try {
        const res = await fetch("/api/stats");
        const stats = await res.json();
        cachedStats = stats;

        const s = stats.summary;
        countUp(document.getElementById("stat-total"), s.total);
        countUp(document.getElementById("stat-total-stars"), s.total_stars);
        countUp(document.getElementById("stat-avg-stars"), s.avg_stars);
        countUp(document.getElementById("stat-max-stars"), s.max_stars);
        countUp(document.getElementById("stat-lang-count"), s.lang_count, 500);

        renderLangDistChart(stats.language_distribution);
        renderTop10Chart(stats.top_10);
        renderLangStarsChart(stats.language_distribution);
        renderStarsRangeChart(stats.stars_ranges);
    } catch (err) {
        console.error("Stats load failed:", err);
    }
}

function destroyChart(key) {
    if (chartInstances[key]) {
        chartInstances[key].destroy();
        chartInstances[key] = null;
    }
}

function renderLangDistChart(data) {
    destroyChart("langDist");
    const ctx = document.getElementById("chart-lang-dist").getContext("2d");
    chartInstances.langDist = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: data.map((d) => d.language),
            datasets: [{
                data: data.map((d) => d.count),
                backgroundColor: CHART_COLORS,
                borderWidth: 2,
                borderColor: getChartBorderColor(),
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: "right", labels: { boxWidth: 12, font: { size: 11 }, color: getChartTextColor() } },
            },
        },
    });
}

function renderTop10Chart(data) {
    destroyChart("top10");
    const ctx = document.getElementById("chart-top10").getContext("2d");
    chartInstances.top10 = new Chart(ctx, {
        type: "bar",
        data: {
            labels: data.map((d) => d.repo_name),
            datasets: [{
                label: "星标数",
                data: data.map((d) => d.stars),
                backgroundColor: CHART_COLORS.slice(0, data.length),
                borderRadius: 6,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: "y",
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { callback: (v) => formatNumber(v), color: getChartTextColor() }, grid: { color: getChartTextColor() + "22" } },
                y: { ticks: { color: getChartTextColor() }, grid: { display: false } },
            },
        },
    });
}

function renderLangStarsChart(data) {
    destroyChart("langStars");
    const ctx = document.getElementById("chart-lang-stars").getContext("2d");
    chartInstances.langStars = new Chart(ctx, {
        type: "bar",
        data: {
            labels: data.map((d) => d.language),
            datasets: [{
                label: "累计星标",
                data: data.map((d) => d.total_stars),
                backgroundColor: CHART_COLORS.slice(0, data.length).map((c) => c + "99"),
                borderColor: CHART_COLORS.slice(0, data.length),
                borderWidth: 1.5,
                borderRadius: 4,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { ticks: { callback: (v) => formatNumber(v), color: getChartTextColor() }, grid: { color: getChartTextColor() + "22" } },
                x: { ticks: { color: getChartTextColor() }, grid: { display: false } },
            },
        },
    });
}

function renderStarsRangeChart(data) {
    destroyChart("starsRange");
    const ctx = document.getElementById("chart-stars-range").getContext("2d");
    chartInstances.starsRange = new Chart(ctx, {
        type: "pie",
        data: {
            labels: data.map((d) => d.range_label),
            datasets: [{
                data: data.map((d) => d.count),
                backgroundColor: ["#4A6CF7", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"],
                borderWidth: 2,
                borderColor: getChartBorderColor(),
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: "right", labels: { boxWidth: 12, font: { size: 11 }, color: getChartTextColor() } },
            },
        },
    });
}

/* ── 导出（含高级筛选参数） ──────────────────────────────────── */
function exportData(fmt) {
    const search = document.getElementById("search-input").value;
    const language = document.getElementById("language-filter").value;
    const params = new URLSearchParams({ search, language });
    const advParams = getAdvancedFilterParams();
    for (const [k, v] of Object.entries(advParams)) {
        params.set(k, v);
    }
    window.location.href = `/api/export/${fmt}?${params}`;
}

/* ── Toast 通知 ────────────────────────────────────────────────── */
function showToast(message, type = "success") {
    const icon = document.getElementById("toast-icon");
    const title = document.getElementById("toast-title");

    if (type === "success") {
        icon.className = "bi bi-check-circle-fill text-success me-2";
        title.textContent = "成功";
    } else {
        icon.className = "bi bi-exclamation-circle-fill text-danger me-2";
        title.textContent = "错误";
    }

    document.getElementById("toast-body").textContent = message;
    const toast = new bootstrap.Toast(document.getElementById("toast"), { delay: 3000 });
    toast.show();
}

/* ── 工具函数 ──────────────────────────────────────────────────── */
function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
