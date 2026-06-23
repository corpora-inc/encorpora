# Git LFS setup for large SQLite files

This repo (the `encorpora` Git repo) stores `*.sqlite3` files with Git LFS so they can exceed GitHub's 100 MB limit. Run these commands from `/workspace/encorpora` or the root of your `encorpora` clone.

## New users (fresh clone)

1) Install Git LFS.

- macOS (Homebrew): `brew install git-lfs`
- Ubuntu/Debian: `sudo apt-get install git-lfs`
- Windows (Chocolatey): `choco install git-lfs`
- All platforms: https://git-lfs.com

2) Enable LFS and clone.

```bash
git lfs install
git clone https://github.com/corpora-inc/encorpora.git
cd encorpora
git lfs pull
```

## Existing repo (convert to LFS)

From the `encorpora` repo root:

```bash
git lfs install
git lfs track "*.sqlite3"
git add .gitattributes
git commit -m "Track sqlite3 files with Git LFS"
```

If you need to rewrite history to move existing large files into LFS:

```bash
git lfs migrate import --include="*.sqlite3"
```

Then force-push the rewritten history:

```bash
git push --force-with-lease
```

After a history rewrite, collaborators should re-clone, or run:

```bash
git fetch --all
git reset --hard origin/<your-branch>
git lfs pull
```
