#!/usr/bin/env -S PYTHONUNBUFFERED=1 uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "fire>=0.7.1",
#   "python-frontmatter>=1.1.0",
#   "watchdog>=4.0.0",
# ]
# ///
import json
import fire
import frontmatter
import shutil
import subprocess
import re
import time
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

EMBED_RE = re.compile(r'!\[\[([^\]]+)\]\]')
WIKI_RE = re.compile(r'\[\[([^\]|]+)(?:\|([^\]]+))?\]\]')
DATAVIEW_RE = re.compile(r'```dataview\n(.*?)```', re.DOTALL)
MANAGED_MARKER = ".publish_managed"


def load_config(config_path=None):
    if config_path is None:
        for candidate in [
            Path(__file__).parent / "publish.md",
            Path.home() / "obsidian" / "publish.md",
        ]:
            if candidate.exists():
                config_path = candidate
                break
    if config_path is None:
        raise FileNotFoundError("No publish.md found")
    post = frontmatter.load(str(config_path))
    cfg = dict(post.metadata)
    return cfg


def load_managed(site: Path):
    marker = site / MANAGED_MARKER
    if not marker.exists():
        return set()
    return {l.strip() for l in marker.read_text().splitlines() if l.strip()}


def save_managed(site: Path, paths: set):
    (site / MANAGED_MARKER).write_text("\n".join(sorted(paths)) + "\n")


def slugify(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r'[^\w\s-]', '', s)
    s = re.sub(r'[\s_]+', '-', s)
    return re.sub(r'-+', '-', s).strip('-')


def find_assets_dir(md_path: Path):
    assets = md_path.parent / "assets"
    return assets if assets.is_dir() else None


def copy_assets(src_dir: Path, site: Path, prefix: str):
    ad = find_assets_dir(src_dir)
    if not ad or not ad.is_dir():
        return
    dest = site / "assets" / "images" / prefix
    dest.mkdir(parents=True, exist_ok=True)
    for f in ad.iterdir():
        if f.is_file():
            shutil.copy2(f, dest / f.name)
    print(f"  copied assets -> assets/images/{prefix}")


def rewrite_obsidian_embeds(content: str, md_path: Path, asset_prefix: str):
    assets_dir = find_assets_dir(md_path)

    def replace_embed(m):
        filename = m.group(1).strip()
        if assets_dir and (assets_dir / filename).exists():
            return f"![{filename}](/assets/images/{asset_prefix}/{filename})"
        return f"![{filename}](/assets/images/{filename})"

    return EMBED_RE.sub(replace_embed, content)


def rewrite_wikilinks(content: str):
    def replace_wiki(m):
        target = m.group(1).strip()
        display = m.group(2)
        if display:
            return f"[{display.strip()}]({target})"
        return f"[{target}]({target})"
    return WIKI_RE.sub(replace_wiki, content)


def resolve_dataview(content: str, vault: Path):
    def replace_block(m):
        query = m.group(1).strip()
        lines = [l.strip() for l in query.splitlines()]
        if not lines or not lines[0].upper().startswith("TABLE"):
            return m.group(0)

        from_tag = None
        where_clauses = []
        sort_field, sort_dir = "file.mtime", "DESC"
        for line in lines:
            up = line.upper()
            if up.startswith("FROM"):
                from_tag = line.split("FROM", 1)[1].strip().lstrip("#")
            elif up.startswith("WHERE"):
                where_clauses.append(line.split("WHERE", 1)[1].strip())
            elif up.startswith("SORT"):
                parts = line.split("SORT", 1)[1].strip().split()
                sort_field = parts[0] if parts else "file.mtime"
                sort_dir = parts[1].upper() if len(parts) > 1 else "DESC"

        if not from_tag:
            return m.group(0)

        matches = []
        for md in vault.rglob("*.md"):
            try:
                p = frontmatter.load(md)
            except Exception:
                continue
            tags = p.get("tags", [])
            if isinstance(tags, str):
                tags = [tags]
            if from_tag not in tags:
                continue
            ok = True
            for clause in where_clauses:
                if "=" in clause:
                    parts = clause.split("=")
                    key = parts[0].strip().strip('"').strip("'")
                    val = parts[-1].strip().strip('"').strip("'")
                    if str(p.get(key, "")) != val:
                        ok = False
            if ok:
                matches.append((md, p))

        reverse = sort_dir == "DESC"
        if sort_field == "file.mtime":
            matches.sort(key=lambda x: x[0].stat().st_mtime, reverse=reverse)
        else:
            matches.sort(key=lambda x: str(x[1].get(sort_field, "")), reverse=reverse)

        if not matches:
            return "*No items found.*"

        rows = []
        for md, p in matches:
            title = p.get("title", md.stem)
            author = p.get("author", "")
            ch_read = p.get("chapters_read", 0)
            ch_total = p.get("total_chapters", 0)
            progress = f'<progress value="{ch_read}" max="{ch_total}"></progress> {ch_read}/{ch_total}' if ch_total else ""
            rows.append(f"| {title} | {author} | {progress} |")

        header = "| Book | Author | Progress |\n| --- | --- | --- |"
        return header + "\n" + "\n".join(rows)

    return DATAVIEW_RE.sub(replace_block, content)


def process_md(src: Path, vault: Path, asset_prefix: str, layout="page", permalink=None):
    post = frontmatter.load(src)
    if post.get("publish") is False:
        return None
    meta = dict(post.metadata)
    meta.setdefault("layout", layout)
    if "title" not in meta:
        meta["title"] = src.stem.replace("-", " ").replace("_", " ").title()
    if permalink:
        meta["permalink"] = permalink
    content = rewrite_obsidian_embeds(post.content, src, asset_prefix)
    content = rewrite_wikilinks(content)
    content = resolve_dataview(content, vault)
    return frontmatter.Post(content, **meta)


def sync_dir_as_posts(vault_dir: Path, site: Path, vault: Path, prefix: str, curr_managed: set):
    if not vault_dir.is_dir():
        return
    posts_dir = site / "_posts"
    posts_dir.mkdir(exist_ok=True)
    synced = set()
    for src in sorted(vault_dir.iterdir()):
        if src.suffix != ".md" or src.name == "index.md":
            continue
        post = process_md(src, vault, prefix, layout="post")
        if post is None:
            print(f"  skip: {src.name}")
            continue
        dest = posts_dir / src.name
        with open(dest, "w") as f:
            f.write(frontmatter.dumps(post))
        curr_managed.add(str(dest.relative_to(site)))
        synced.add(src.name)
        print(f"  synced: {src.name}")

    for existing in posts_dir.iterdir():
        if existing.suffix == ".md" and existing.name not in synced:
            existing.unlink()
            print(f"  removed stale: {existing.name}")

    copy_assets(vault_dir, site, prefix)


def sync_file(src: Path, site: Path, vault: Path, prefix: str, curr_managed: set):
    target_name = slugify(src.stem) + ".md"
    post = process_md(src, vault, prefix)
    if post is None:
        print(f"  skip: {src.name}")
        return None
    dest = site / target_name
    with open(dest, "w") as f:
        f.write(frontmatter.dumps(post))
    curr_managed.add(str(dest.relative_to(site)))
    print(f"  synced: {src.name} -> {target_name}")
    copy_assets(src.parent, site, prefix)
    return {"title": post.get("title", src.stem), "url": f"/{slugify(src.stem)}/"}


def sync(config_path=None):
    cfg = load_config(config_path)
    vault = Path(cfg["obsidian_vault"])
    site = Path(cfg["site_repo"])
    paths = cfg.get("paths", [])

    prev_managed = load_managed(site)
    curr_managed = set()
    sidebar = []

    for p in paths:
        src = vault / p
        name = p.rstrip("/")

        if p.endswith("/"):
            print(f"[{p}] syncing directory as posts")
            sync_dir_as_posts(src, site, vault, slugify(name), curr_managed)
            sidebar.append({"title": "Blogs", "url": "/"})
        else:
            print(f"[{p}] syncing file")
            entry = sync_file(src, site, vault, slugify(Path(p).stem), curr_managed)
            if entry:
                sidebar.append(entry)

    stale = prev_managed - curr_managed
    for rel in stale:
        fp = site / rel
        if fp.exists():
            fp.unlink()
            print(f"  removed: {rel}")

    save_managed(site, curr_managed)

    data_dir = site / "_data"
    data_dir.mkdir(exist_ok=True)
    with open(data_dir / "sidebar.json", "w") as f:
        json.dump(sidebar, f, indent=2)
    print(f"  wrote _data/sidebar.json ({len(sidebar)} entries)")

    print("\nsync complete.")


def build(config_path=None):
    cfg = load_config(config_path)
    site = Path(cfg["site_repo"])
    print("running jekyll build...")
    result = subprocess.run(
        ["bundle", "exec", "jekyll", "build"],
        cwd=site, capture_output=True, text=True,
    )
    print(result.stdout)
    if result.returncode != 0:
        print(f"BUILD FAILED:\n{result.stderr}")
        return False
    print("build succeeded.")
    return True


def push(config_path=None, message=None):
    cfg = load_config(config_path)
    site = Path(cfg["site_repo"])
    if message is None:
        message = f"publish: {time.strftime('%Y-%m-%d %H:%M:%S')}"
    subprocess.run(["git", "add", "-A"], cwd=site, check=True)
    diff = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=site)
    if diff.returncode == 0:
        print("nothing to commit.")
        return
    subprocess.run(["git", "commit", "-m", message], cwd=site, check=True)
    subprocess.run(["git", "push"], cwd=site, check=True)
    print("pushed to remote.")


def publish(config_path=None, message=None):
    sync(config_path)
    if build(config_path):
        push(config_path, message)
    else:
        print("aborting push due to build failure.")


class VaultHandler(FileSystemEventHandler):
    def __init__(self, cfg, config_path):
        self.cfg = cfg
        self.config_path = config_path
        self.vault = Path(cfg["obsidian_vault"])
        self.paths = cfg.get("paths", [])
        self.last_sync = 0

    def on_any_event(self, event):
        if event.is_directory:
            return
        path = Path(event.src_path)
        if path.suffix not in (".md", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"):
            return
        try:
            rel = str(path.relative_to(self.vault))
        except ValueError:
            return
        for p in self.paths:
            check = p.rstrip("/")
            if rel.startswith(check):
                now = time.time()
                if now - self.last_sync < 2:
                    return
                self.last_sync = now
                print(f"\nchange detected: {rel}")
                sync(self.config_path)
                return


def watch(config_path=None):
    cfg = load_config(config_path)
    vault = Path(cfg["obsidian_vault"])

    sync(config_path)

    handler = VaultHandler(cfg, config_path)
    observer = Observer()

    for p in cfg.get("paths", []):
        d = vault / p.rstrip("/")
        watch_dir = str(d if d.is_dir() else d.parent)
        if Path(watch_dir).exists():
            observer.schedule(handler, watch_dir, recursive=True)
            print(f"watching: {watch_dir}")

    observer.start()
    print("watching for changes... (ctrl+c to stop)")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()


if __name__ == "__main__":
    fire.Fire({
        "sync": sync,
        "build": build,
        "push": push,
        "publish": publish,
        "watch": watch,
    })
