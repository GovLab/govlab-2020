# Previous homepage (archived)

`index.html` in this folder is the homepage that served `https://thegovlab.org/`
until the `hp2026` design replaced it. It is kept here so the swap can be undone
in one step.

**Do not delete this folder.** It is the revert artifact — without it, restoring
the old homepage means digging through git history.

It is browsable as-is at `https://thegovlab.org/hp-previous/`.

## Restoring it as the homepage

### Option A — Netlify rollback (fastest, no repo access needed)

Netlify → **Deploys** → find the last deploy from before the swap → **Publish
deploy**. It goes live in seconds, with no rebuild.

This is a stopgap: the next push to `main` republishes whatever is in the repo.
If you need the rollback to hold, pause auto-publishing in Netlify, or use
Option B instead.

### Option B — push to `main` (durable)

`main` is not protected, so this can go straight in without a pull request.

    git clone https://github.com/GovLab/govlab-2020.git
    cd govlab-2020

    cp hp-previous/index.html index.html

    git commit -am "Restore previous homepage"
    git push origin main

Netlify rebuilds from `main` and the old homepage is live in about a minute.

If you already have a checkout, use `git checkout main && git pull` in place of
the clone.

Nothing else has to move. The page's images, CSS and JS under `/static/…` never
left the repo root, and the links in this copy are root-relative, so they resolve
correctly whether the file sits here or at the root.

## Going back to the hp2026 homepage

Easiest: revert the commit that restored the old homepage.

    git revert <sha of the "Restore previous homepage" commit>
    git push origin main

That brings back the exact page that was live, with nothing to reconstruct.

If that history is not available, rebuild it from `hp2026/index.html`. Two edits
are needed: the root copy points at `/hp2026/assets/…` where the standalone copy
uses relative `assets/…`, and the root copy carries a favicon link the standalone
one does not.

    cp hp2026/index.html index.html
    sed -i 's|"assets/|"/hp2026/assets/|g; s|url('"'"'assets/|url('"'"'/hp2026/assets/|g' index.html
    sed -i '/name="description"/a <link href="/static/img/favicon-transparent.png" rel="shortcut icon">' index.html

    git commit -am "Restore hp2026 homepage"
    git push origin main

Those two commands reproduce the homepage byte for byte. On macOS, `sed -i` needs
an empty argument: `sed -i '' '...'`.

## What was changed in this copy

Only the URLs. The page's relative links (`./about.html`,
`static/styles/styles.css`, …) were rewritten to root-relative (`/about.html`,
`/static/styles/styles.css`, …) so it renders correctly from this subfolder.
Root-relative paths resolve the same way from the repo root, which is why
Option B is a plain copy with no edits.

Markup, copy, styles and scripts are untouched.

## Also do not delete: `hp2026/assets/`

While the hp2026 design is the homepage, the root `index.html` loads its Proxima
Nova webfonts and two of its logos from `/hp2026/assets/…`, sharing one copy of
those files with the standalone page at `https://thegovlab.org/hp2026/`.
Deleting that folder breaks the live homepage's typography and logos.
