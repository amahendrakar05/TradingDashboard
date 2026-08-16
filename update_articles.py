"""Build website article data from the local Website source folder."""

import json
import re
import shutil
from datetime import datetime
from pathlib import Path

SOURCE = Path(r"D:\Pyhton code\FINAL Scripts\Website source")
SITE = Path(__file__).resolve().parent
PUBLIC = SITE / "public"
OUTPUT = PUBLIC / "articles.json"
ARTICLE_IMAGES = PUBLIC / "articles"
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


def slugify(value):
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value or "article"


def main():
    if not SOURCE.exists():
        raise SystemExit(f"ERROR: Article source folder not found: {SOURCE}")

    PUBLIC.mkdir(parents=True, exist_ok=True)
    ARTICLE_IMAGES.mkdir(parents=True, exist_ok=True)
    articles = []
    for path in sorted(SOURCE.glob("*.txt"), key=lambda p: p.stat().st_mtime, reverse=True):
        text = path.read_text(encoding="utf-8-sig").strip()
        if not text:
            continue
        lines = text.splitlines()
        title = next((line.strip() for line in lines if line.strip()), path.stem)
        body_start = next((index for index, line in enumerate(lines) if line.strip()), 0) + 1
        cleaned_lines = [re.sub(r"[ \t]+$", "", line).strip() if "\t" not in line else "\t".join(part.strip() for part in line.split("\t")) for line in lines[body_start:]]
        body = "\n".join(cleaned_lines).strip()
        body = re.sub(r"\n{3,}", "\n\n", body)
        preview = re.sub(r"\s+", " ", body)[:240].strip()
        articles.append({
            "kind": "text",
            "slug": slugify(title),
            "title": title,
            "preview": preview,
            "body": body,
            "source_file": path.name,
            "published": datetime.fromtimestamp(path.stat().st_mtime).astimezone().isoformat(timespec="seconds"),
            "category": "Education",
            "reading_minutes": max(1, round(len(body.split()) / 220)),
        })

    for path in sorted(SOURCE.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        if path.stem.lower() == "background image":
            continue
        title = path.stem
        destination = ARTICLE_IMAGES / f"{slugify(title)}{path.suffix.lower()}"
        shutil.copy2(path, destination)
        articles.append({
            "kind": "image",
            "slug": slugify(title),
            "title": title,
            "preview": f"A visual market article from @TheWealthVolume: {title}.",
            "body": "",
            "image": f"public/articles/{destination.name}",
            "source_file": path.name,
            "published": datetime.fromtimestamp(path.stat().st_mtime).astimezone().isoformat(timespec="seconds"),
            "category": "Visual Article",
            "reading_minutes": 1,
        })

    articles.sort(key=lambda article: article["published"], reverse=True)

    background = None
    for candidate in SOURCE.iterdir():
        if candidate.is_file() and candidate.stem.lower() == "background image" and candidate.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
            destination = PUBLIC / f"news-background{candidate.suffix.lower()}"
            shutil.copy2(candidate, destination)
            background = f"public/{destination.name}"
            break

    payload = {
        "updated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "source": str(SOURCE),
        "background_image": background,
        "articles": articles,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Articles updated: {len(articles)}")
    if background:
        print(f"Header image updated: {background}")
    else:
        print("Header image not found; the styled fallback will be used.")


if __name__ == "__main__":
    main()
