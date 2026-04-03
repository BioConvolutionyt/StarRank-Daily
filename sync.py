"""
GitHub Top 1000 Repos -- Daily Sync Script

通过 GitHub REST API 拉取最高星标的 1000 个公共仓库数据，
更新本地 SQLite 数据库并导出 CSV 文件。

用法:
    python sync.py

环境变量:
    GITHUB_TOKEN  -- GitHub Personal Access Token
"""

import csv
import os
import sqlite3
import time
from datetime import datetime, timezone

import requests

# ── 配置 ────────────────────────────────────────────────────────────
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
API_BASE = "https://api.github.com"
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "repos.db")
CSV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "top_1000_os_rules.csv")

SEARCH_PAGES = 10
PER_PAGE = 100
SEARCH_SLEEP = 3        # 搜索接口间隔（秒），30 次/分钟限制
COMMUNITY_SLEEP = 0.8   # 社区规范接口间隔（秒），5000 次/小时限制
MAX_RETRIES = 3


def _headers():
    h = {"Accept": "application/vnd.github+json"}
    if GITHUB_TOKEN:
        h["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    return h


def _request_with_retry(method, url, **kwargs):
    """带重试的 HTTP 请求。"""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.request(method, url, timeout=30, **kwargs)
            if resp.status_code == 403:
                reset = resp.headers.get("X-RateLimit-Reset")
                if reset:
                    wait = max(int(reset) - int(time.time()), 1)
                    print(f"  [RATE LIMIT] waiting {wait}s ...")
                    time.sleep(wait + 1)
                    continue
            return resp
        except requests.RequestException as e:
            print(f"  [RETRY {attempt}/{MAX_RETRIES}] {e}")
            if attempt < MAX_RETRIES:
                time.sleep(5 * attempt)
    return None


# ── 1. 拉取 Top 1000 仓库基础数据 ──────────────────────────────────
def fetch_top_repos():
    """通过 Search API 分页获取 Top 1000 仓库的基础信息。"""
    repos = []
    for page in range(1, SEARCH_PAGES + 1):
        print(f"[SEARCH] page {page}/{SEARCH_PAGES} ...")
        resp = _request_with_retry(
            "GET",
            f"{API_BASE}/search/repositories",
            headers=_headers(),
            params={
                "q": "stars:>20000",
                "sort": "stars",
                "order": "desc",
                "per_page": PER_PAGE,
                "page": page,
            },
        )
        if resp is None or resp.status_code != 200:
            print(f"  [ERROR] page {page} failed: {resp.status_code if resp else 'no response'}")
            continue

        items = resp.json().get("items", [])
        repos.extend(items)
        print(f"  got {len(items)} repos (total: {len(repos)})")

        if page < SEARCH_PAGES:
            time.sleep(SEARCH_SLEEP)

    print(f"[SEARCH] done, {len(repos)} repos fetched")
    return repos


# ── 2. 拉取社区规范 ────────────────────────────────────────────────
def fetch_community_profiles(repos):
    """为每个仓库获取社区规范信息（readme, coc, contributing, workflows）。"""
    total = len(repos)
    profiles = {}

    for i, item in enumerate(repos):
        owner = item["owner"]["login"]
        name = item["name"]
        key = f"{owner}/{name}"

        if (i + 1) % 50 == 0 or i == 0:
            print(f"[COMMUNITY] {i + 1}/{total} ...")

        profile = {"has_readme": False, "has_coc": False,
                    "has_contributing": False, "has_workflows": False}

        resp = _request_with_retry(
            "GET",
            f"{API_BASE}/repos/{owner}/{name}/community/profile",
            headers=_headers(),
        )
        if resp and resp.status_code == 200:
            files = resp.json().get("files", {})
            profile["has_readme"] = files.get("readme") is not None
            profile["has_coc"] = files.get("code_of_conduct") is not None
            profile["has_contributing"] = files.get("contributing") is not None
        time.sleep(COMMUNITY_SLEEP)

        resp2 = _request_with_retry(
            "GET",
            f"{API_BASE}/repos/{owner}/{name}/actions/workflows",
            headers=_headers(),
        )
        if resp2 and resp2.status_code == 200:
            profile["has_workflows"] = resp2.json().get("total_count", 0) > 0
        time.sleep(COMMUNITY_SLEEP)

        profiles[key] = profile

    print(f"[COMMUNITY] done, {len(profiles)} profiles fetched")
    return profiles


# ── 3. 写入数据库 ──────────────────────────────────────────────────
def sync_to_db(repos, profiles):
    """将拉取到的数据同步到 SQLite 数据库。"""
    db = sqlite3.connect(DB_PATH)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("""
        CREATE TABLE IF NOT EXISTS repos (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            repo_name       TEXT NOT NULL,
            organization    TEXT,
            language        TEXT,
            stars           INTEGER DEFAULT 0,
            forks           INTEGER DEFAULT 0,
            open_issues     INTEGER DEFAULT 0,
            age_days        INTEGER DEFAULT 0,
            has_coc         INTEGER DEFAULT 0,
            has_contributing INTEGER DEFAULT 0,
            has_workflows   INTEGER DEFAULT 0,
            has_readme      INTEGER DEFAULT 0,
            description     TEXT,
            created_at      TEXT,
            updated_at      TEXT
        )
    """)

    now = datetime.now().isoformat()
    updated = 0
    inserted = 0
    current_keys = set()

    for item in repos:
        owner = item["owner"]["login"]
        name = item["name"]
        key = f"{owner}/{name}"
        current_keys.add((name, owner))
        profile = profiles.get(key, {})

        created_at_str = item.get("created_at", "")
        try:
            repo_created = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
            age_days = (datetime.now(timezone.utc) - repo_created).days
        except (ValueError, TypeError):
            age_days = 0

        values = {
            "repo_name": name,
            "organization": owner,
            "language": item.get("language") or "",
            "stars": item.get("stargazers_count", 0),
            "forks": item.get("forks_count", 0),
            "open_issues": item.get("open_issues_count", 0),
            "age_days": age_days,
            "has_coc": 1 if profile.get("has_coc") else 0,
            "has_contributing": 1 if profile.get("has_contributing") else 0,
            "has_workflows": 1 if profile.get("has_workflows") else 0,
            "has_readme": 1 if profile.get("has_readme") else 0,
            "description": item.get("description") or "",
        }

        existing = db.execute(
            "SELECT id FROM repos WHERE repo_name = ? AND organization = ?",
            (name, owner),
        ).fetchone()

        if existing:
            db.execute("""
                UPDATE repos SET
                    language=?, stars=?, forks=?, open_issues=?, age_days=?,
                    has_coc=?, has_contributing=?, has_workflows=?, has_readme=?,
                    description=?, updated_at=?
                WHERE id=?
            """, (
                values["language"], values["stars"], values["forks"],
                values["open_issues"], values["age_days"],
                values["has_coc"], values["has_contributing"],
                values["has_workflows"], values["has_readme"],
                values["description"], now, existing[0],
            ))
            updated += 1
        else:
            db.execute("""
                INSERT INTO repos (
                    repo_name, organization, language, stars, forks,
                    open_issues, age_days, has_coc, has_contributing,
                    has_workflows, has_readme, description, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                values["repo_name"], values["organization"], values["language"],
                values["stars"], values["forks"], values["open_issues"],
                values["age_days"], values["has_coc"], values["has_contributing"],
                values["has_workflows"], values["has_readme"],
                values["description"], now, now,
            ))
            inserted += 1

    all_rows = db.execute("SELECT id, repo_name, organization FROM repos").fetchall()
    stale_ids = [row[0] for row in all_rows if (row[1], row[2]) not in current_keys]
    if stale_ids:
        placeholders = ",".join("?" * len(stale_ids))
        db.execute(f"DELETE FROM repos WHERE id IN ({placeholders})", stale_ids)

    db.commit()
    db.close()
    print(f"[DB] done -- updated: {updated}, inserted: {inserted}, removed: {len(stale_ids)}")


# ── 4. 导出 CSV ────────────────────────────────────────────────────
def export_csv():
    """从数据库导出最新数据到 CSV 文件。"""
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    rows = db.execute("SELECT * FROM repos ORDER BY stars DESC").fetchall()
    db.close()

    columns = [
        "repo_name", "organization", "language", "stars", "forks",
        "open_issues", "age_days", "has_coc", "has_contributing",
        "has_workflows", "has_readme", "description",
    ]
    bool_fields = {"has_coc", "has_contributing", "has_workflows", "has_readme"}

    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(columns)
        for r in rows:
            row_data = []
            for c in columns:
                val = r[c]
                if c in bool_fields:
                    val = "True" if val else "False"
                row_data.append(val)
            writer.writerow(row_data)

    print(f"[CSV] exported {len(rows)} rows to {CSV_PATH}")


# ── 5. 导出 JSON（供 GitHub Pages 静态站点使用） ────────────────────
JSON_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.json")


def export_json():
    """从数据库导出全量数据为 JSON 文件，用于 GitHub Pages 前端直接加载。"""
    import json

    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    rows = db.execute("SELECT * FROM repos ORDER BY stars DESC").fetchall()
    db.close()

    records = []
    for r in rows:
        records.append({
            "id": r["id"],
            "repo_name": r["repo_name"],
            "organization": r["organization"],
            "language": r["language"],
            "stars": r["stars"],
            "forks": r["forks"],
            "open_issues": r["open_issues"],
            "age_days": r["age_days"],
            "has_coc": bool(r["has_coc"]),
            "has_contributing": bool(r["has_contributing"]),
            "has_workflows": bool(r["has_workflows"]),
            "has_readme": bool(r["has_readme"]),
            "description": r["description"],
        })

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False)

    print(f"[JSON] exported {len(records)} records to {JSON_PATH}")


# ── 入口 ────────────────────────────────────────────────────────────
def main():
    start = time.time()
    print("=" * 60)
    print(f"GitHub Top Repos Sync -- {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Token: {'configured' if GITHUB_TOKEN else 'NOT SET (rate limits will apply)'}")
    print("=" * 60)

    repos = fetch_top_repos()
    if not repos:
        print("[ABORT] no repos fetched, exiting")
        return

    profiles = fetch_community_profiles(repos)
    sync_to_db(repos, profiles)
    export_csv()
    export_json()

    elapsed = time.time() - start
    minutes = int(elapsed // 60)
    seconds = int(elapsed % 60)
    print(f"\n[DONE] completed in {minutes}m {seconds}s")


if __name__ == "__main__":
    main()
