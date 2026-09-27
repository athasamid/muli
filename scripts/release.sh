#!/usr/bin/env bash
# Release Muli: bump version, tag, push — CI builds the DMGs (x64 + arm64),
# uploads them to the GitHub release, and the landing page is redeployed.
#
# Usage:
#   ./scripts/release.sh 1.0.1          bump to 1.0.1 and release
#   ./scripts/release.sh --landing-only  only redeploy the landing page
set -euo pipefail

cd "$(dirname "$0")/.."

deploy_landing() {
    echo "==> Triggering landing page deploy (GitHub Pages)"
    gh workflow run deploy-pages.yml --ref main
    echo "    Watch it with: gh run list --workflow=deploy-pages.yml"
}

if [[ "${1:-}" == "--landing-only" ]]; then
    deploy_landing
    exit 0
fi

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
    echo "Usage: $0 <version>            e.g. $0 1.0.1"
    echo "       $0 --landing-only"
    exit 1
fi
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Version must look like 1.2.3 (got: $VERSION)"
    exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "main" ]]; then
    echo "Releases are cut from main (current branch: $BRANCH)"
    exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
    echo "Working tree is not clean — commit or stash first."
    git status --short
    exit 1
fi
if git rev-parse "v$VERSION" >/dev/null 2>&1; then
    echo "Tag v$VERSION already exists."
    exit 1
fi
gh auth status >/dev/null

echo "==> Bumping version to $VERSION"
npm version "$VERSION" --no-git-tag-version >/dev/null
git add package.json package-lock.json 2>/dev/null || git add package.json
git commit -m "Release v$VERSION"
git tag "v$VERSION"

echo "==> Pushing main and tag v$VERSION"
git push origin main "v$VERSION"

echo "==> CI is now building the installers and creating the release."
echo "    Watch it with: gh run watch"
echo "    Release page:  https://github.com/athasamid/muli/releases/tag/v$VERSION"

deploy_landing

echo "==> Done. The in-app updater picks up v$VERSION once CI uploads the DMGs."
