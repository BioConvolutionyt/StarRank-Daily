/* ── 全量数据 & 状态 ────────────────────────────────────────────── */
let allRepos = [];
let filteredRepos = [];
let currentPage = 1;
let totalPages = 1;
let chartInstances = {};

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
    icon.className = theme === "dark" ? "bi bi-sun-fill" : "bi bi-moon-fill";
    localStorage.setItem("theme", theme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "light" : "dark");
    rebuildCharts();
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
    loadData();
    initSortHeaders();

    document.getElementById("search-input").addEventListener("keydown", (e) => {
        if (e.key === "Enter") renderCurrentPage();
    });
});

/* ── 加载 data.json ───────────────────────────────────────────── */
async function loadData() {
    const tbody = document.getElementById("repos-tbody");
    tbody.innerHTML = renderSkeletonRows();

    try {
        const res = await fetch("data.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        allRepos = await res.json();

        populateLanguageFilter();
        computeStats();
        renderCurrentPage();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8">
            <div class="empty-state">
                <i class="bi bi-exclamation-triangle empty-icon" style="color:var(--danger)"></i>
                <div class="empty-title">数据加载失败</div>
                <div class="empty-hint">${escapeHtml(err.message)}</div>
                <button class="btn btn-outline-primary btn-sm" onclick="loadData()">
                    <i class="bi bi-arrow-clockwise me-1"></i>重新加载
                </button>
            </div>
        </td></tr>`;
    }
}

/* ── 填充语言下拉列表 ─────────────────────────────────────────── */
function populateLanguageFilter() {
    const langs = [...new Set(allRepos.map(r => r.language).filter(Boolean))].sort();
    const select = document.getElementById("language-filter");
    while (select.options.length > 1) select.remove(1);
    langs.forEach(lang => {
        const opt = document.createElement("option");
        opt.value = lang;
        opt.textContent = lang;
        select.appendChild(opt);
    });
}

/* ── 视图切换 ──────────────────────────────────────────────────── */
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
        rebuildCharts();
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
function countUp(el, target, duration = 800, formatter) {
    if (target == null || isNaN(target)) { el.textContent = "-"; return; }
    const start = performance.now();
    const fmt = formatter || (target >= 1000 ? formatNumber : formatNumberFull);

    function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(target * eased);
        el.textContent = fmt(current);
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.textContent = fmt(target);
        }
    }
    requestAnimationFrame(update);
}

/* ── 搜索防抖 ──────────────────────────────────────────────────── */
let searchTimer = null;
function debounceSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => renderCurrentPage(), 350);
}

function clearSearch() {
    document.getElementById("search-input").value = "";
    renderCurrentPage();
}

/* ── 高级筛选参数收集 ─────────────────────────────────────────── */
function getAdvancedFilterParams() {
    return {
        starsMin: document.getElementById("filter-stars-min").value,
        starsMax: document.getElementById("filter-stars-max").value,
        forksMin: document.getElementById("filter-forks-min").value,
        forksMax: document.getElementById("filter-forks-max").value,
        ageMin:   document.getElementById("filter-age-min").value,
        ageMax:   document.getElementById("filter-age-max").value,
        reqReadme:       document.getElementById("filter-has-readme").checked,
        reqCoc:          document.getElementById("filter-has-coc").checked,
        reqContributing: document.getElementById("filter-has-contributing").checked,
        reqWorkflows:    document.getElementById("filter-has-workflows").checked,
    };
}

function getActiveFilterCount() {
    const p = getAdvancedFilterParams();
    let count = 0;
    if (p.starsMin) count++;
    if (p.starsMax) count++;
    if (p.forksMin) count++;
    if (p.forksMax) count++;
    if (p.ageMin) count++;
    if (p.ageMax) count++;
    if (p.reqReadme) count++;
    if (p.reqCoc) count++;
    if (p.reqContributing) count++;
    if (p.reqWorkflows) count++;
    return count;
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
    bootstrap.Collapse.getOrCreateInstance(panel).toggle();
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
    renderCurrentPage();
}

/* ── 客户端筛选 + 排序 ────────────────────────────────────────── */
function getFilteredAndSorted() {
    const search = document.getElementById("search-input").value.trim().toLowerCase();
    const language = document.getElementById("language-filter").value;
    const sortBy = document.getElementById("sort-by").value;
    const order = document.getElementById("sort-order").value;
    const adv = getAdvancedFilterParams();

    let data = allRepos.filter(r => {
        if (search) {
            const s = search;
            if (!(r.repo_name || "").toLowerCase().includes(s) &&
                !(r.description || "").toLowerCase().includes(s) &&
                !(r.organization || "").toLowerCase().includes(s)) return false;
        }
        if (language && r.language !== language) return false;

        if (adv.starsMin && r.stars < Number(adv.starsMin)) return false;
        if (adv.starsMax && r.stars > Number(adv.starsMax)) return false;
        if (adv.forksMin && r.forks < Number(adv.forksMin)) return false;
        if (adv.forksMax && r.forks > Number(adv.forksMax)) return false;
        if (adv.ageMin && r.age_days < Number(adv.ageMin) * 365) return false;
        if (adv.ageMax && r.age_days > Number(adv.ageMax) * 365) return false;

        if (adv.reqReadme && !r.has_readme) return false;
        if (adv.reqCoc && !r.has_coc) return false;
        if (adv.reqContributing && !r.has_contributing) return false;
        if (adv.reqWorkflows && !r.has_workflows) return false;

        return true;
    });

    data.sort((a, b) => {
        let va = a[sortBy];
        let vb = b[sortBy];
        if (typeof va === "string") va = va.toLowerCase();
        if (typeof vb === "string") vb = vb.toLowerCase();
        if (va < vb) return order === "asc" ? -1 : 1;
        if (va > vb) return order === "asc" ? 1 : -1;
        return 0;
    });

    return data;
}

/* ── 渲染当前页 ────────────────────────────────────────────────── */
function renderCurrentPage() {
    updateAdvToggleState();
    filteredRepos = getFilteredAndSorted();

    const perPage = parseInt(document.getElementById("per-page").value);
    totalPages = Math.max(1, Math.ceil(filteredRepos.length / perPage));
    if (currentPage > totalPages) currentPage = 1;

    const startIdx = (currentPage - 1) * perPage;
    const pageData = filteredRepos.slice(startIdx, startIdx + perPage);
    const tbody = document.getElementById("repos-tbody");

    if (pageData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8">
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
        tbody.innerHTML = pageData.map((r, i) => renderRow(r, i)).join("");
    }

    updatePagination();
    updateSortIndicators();
}

/* ── 骨架屏 ────────────────────────────────────────────────────── */
function renderSkeletonRows(count = 5) {
    let html = "";
    for (let i = 0; i < count; i++) {
        html += `<tr><td colspan="8" style="padding:0;border:none">
            <div class="skeleton-row">
                <span class="skeleton" style="width:30px"></span>
                <span class="skeleton"></span>
                <span class="skeleton" style="width:70%"></span>
                <span class="skeleton" style="width:60px"></span>
                <span class="skeleton" style="width:50px"></span>
                <span class="skeleton" style="width:50px"></span>
                <span class="skeleton" style="width:40px"></span>
                <span class="skeleton" style="width:80px"></span>
            </div>
        </td></tr>`;
    }
    return html;
}

/* ── 渲染表格行 ────────────────────────────────────────────────── */
function renderRow(r, index) {
    const communityBadges = [
        { key: "has_readme", icon: "bi-file-text", title: "README" },
        { key: "has_coc", icon: "bi-shield-check", title: "行为准则" },
        { key: "has_contributing", icon: "bi-people", title: "贡献指南" },
        { key: "has_workflows", icon: "bi-gear", title: "工作流" },
    ].map(b => {
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
    </tr>`;
}

/* ── 表头排序 ──────────────────────────────────────────────────── */
function initSortHeaders() {
    document.querySelectorAll("th[data-sort]").forEach(th => {
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
            currentPage = 1;
            renderCurrentPage();
        });
    });
}

function onSortDropdownChange() {
    currentPage = 1;
    renderCurrentPage();
}

function updateSortIndicators() {
    const currentSort = document.getElementById("sort-by").value;
    const currentOrder = document.getElementById("sort-order").value;

    document.querySelectorAll("th[data-sort]").forEach(th => {
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
function updatePagination() {
    const total = filteredRepos.length;
    document.getElementById("page-info").textContent =
        `共 ${formatNumberFull(total)} 条，第 ${currentPage}/${totalPages} 页`;
    document.getElementById("page-current").textContent = currentPage;

    document.getElementById("btn-first").disabled = currentPage <= 1;
    document.getElementById("btn-prev").disabled  = currentPage <= 1;
    document.getElementById("btn-next").disabled  = currentPage >= totalPages;
    document.getElementById("btn-last").disabled  = currentPage >= totalPages;
}

function goPage(dir) {
    switch (dir) {
        case "first": currentPage = 1; break;
        case "prev":  currentPage = Math.max(1, currentPage - 1); break;
        case "next":  currentPage = Math.min(totalPages, currentPage + 1); break;
        case "last":  currentPage = totalPages; break;
    }
    renderCurrentPage();
}

/* ── 详情弹窗 ──────────────────────────────────────────────────── */
function showDetail(id) {
    const r = allRepos.find(repo => repo.id === id);
    if (!r) return;

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

/* ── 统计计算（纯客户端） ──────────────────────────────────────── */
function computeStats() {
    if (allRepos.length === 0) return;

    const total = allRepos.length;
    const totalStars = allRepos.reduce((sum, r) => sum + r.stars, 0);
    const avgStars = Math.round(totalStars / total);
    const maxStars = Math.max(...allRepos.map(r => r.stars));
    const langSet = new Set(allRepos.map(r => r.language).filter(Boolean));

    countUp(document.getElementById("stat-total"), total);
    countUp(document.getElementById("stat-total-stars"), totalStars);
    countUp(document.getElementById("stat-avg-stars"), avgStars, 800, formatNumberFull);
    countUp(document.getElementById("stat-max-stars"), maxStars);
    countUp(document.getElementById("stat-lang-count"), langSet.size, 500);
}

/* ── 图表 ──────────────────────────────────────────────────────── */
const CHART_COLORS = [
    "#4A6CF7", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
    "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16",
    "#06B6D4", "#E11D48", "#A855F7", "#22C55E", "#EAB308",
];

function destroyChart(key) {
    if (chartInstances[key]) {
        chartInstances[key].destroy();
        chartInstances[key] = null;
    }
}

function rebuildCharts() {
    if (allRepos.length === 0) return;

    const langMap = {};
    allRepos.forEach(r => {
        const lang = r.language || "Unknown";
        if (!langMap[lang]) langMap[lang] = { count: 0, totalStars: 0 };
        langMap[lang].count++;
        langMap[lang].totalStars += r.stars;
    });
    const langDist = Object.entries(langMap)
        .map(([language, v]) => ({ language, count: v.count, total_stars: v.totalStars }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

    const top10 = [...allRepos].sort((a, b) => b.stars - a.stars).slice(0, 10);

    const ranges = [
        { label: "20k-50k",   min: 20000,  max: 50000 },
        { label: "50k-100k",  min: 50000,  max: 100000 },
        { label: "100k-200k", min: 100000, max: 200000 },
        { label: "200k+",     min: 200000, max: Infinity },
    ];
    const starsRanges = ranges.map(range => ({
        range_label: range.label,
        count: allRepos.filter(r => r.stars >= range.min && r.stars < range.max).length,
    }));

    renderLangDistChart(langDist);
    renderTop10Chart(top10);
    renderLangStarsChart(langDist);
    renderStarsRangeChart(starsRanges);
}

function renderLangDistChart(data) {
    destroyChart("langDist");
    const ctx = document.getElementById("chart-lang-dist").getContext("2d");
    chartInstances.langDist = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: data.map(d => d.language),
            datasets: [{
                data: data.map(d => d.count),
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
            labels: data.map(d => d.repo_name),
            datasets: [{
                label: "星标数",
                data: data.map(d => d.stars),
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
                x: { ticks: { callback: v => formatNumber(v), color: getChartTextColor() }, grid: { color: getChartTextColor() + "22" } },
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
            labels: data.map(d => d.language),
            datasets: [{
                label: "累计星标",
                data: data.map(d => d.total_stars),
                backgroundColor: CHART_COLORS.slice(0, data.length).map(c => c + "99"),
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
                y: { ticks: { callback: v => formatNumber(v), color: getChartTextColor() }, grid: { color: getChartTextColor() + "22" } },
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
            labels: data.map(d => d.range_label),
            datasets: [{
                data: data.map(d => d.count),
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

/* ── CSV 导出（客户端生成） ────────────────────────────────────── */
function exportCSV() {
    const data = getFilteredAndSorted();
    if (data.length === 0) {
        showToast("没有可导出的数据", "error");
        return;
    }

    const columns = ["repo_name", "organization", "language", "stars", "forks",
                      "open_issues", "age_days", "has_coc", "has_contributing",
                      "has_workflows", "has_readme", "description"];

    const csvContent = [
        columns.join(","),
        ...data.map(r => columns.map(c => {
            let val = r[c];
            if (typeof val === "boolean") val = val ? "True" : "False";
            if (typeof val === "string" && (val.includes(",") || val.includes('"') || val.includes("\n"))) {
                val = '"' + val.replace(/"/g, '""') + '"';
            }
            return val ?? "";
        }).join(","))
    ].join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "github_repos.csv";
    a.click();
    URL.revokeObjectURL(url);
    showToast(`已导出 ${data.length} 条数据`, "success");
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
