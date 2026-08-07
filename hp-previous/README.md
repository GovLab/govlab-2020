# Previous homepage (archived)

`index.html` here is the homepage that used to live at the repo root and serve
`https://thegovlab.org/`. It was archived when the `hp2026` design was promoted
to the homepage.

It is browsable in place at `https://thegovlab.org/hp-previous/`.

## What changed in the copy

Only the URLs. The page's relative links (`./about.html`, `static/styles/styles.css`,
…) were rewritten to root-relative (`/about.html`, `/static/styles/styles.css`, …)
so the page renders correctly from this subfolder. Root-relative paths resolve the
same way from the repo root, so the file also works unmodified if you put it back.

Nothing else — markup, copy, styles, scripts — was touched.

## How to revert

    cp hp-previous/index.html index.html

That is all that is required; the page's assets (`/static/…`) never moved. Then
optionally `rm -rf hp-previous` to drop this folder.

## Note on the new homepage

The root `index.html` is the `hp2026` page with its font/logo URLs pointed at
`/hp2026/assets/…`, so it shares one copy of those files with the standalone
page at `https://thegovlab.org/hp2026/` rather than duplicating them. **Do not
delete `hp2026/assets/` while the new homepage is live** — the homepage loads
its Proxima Nova webfonts and two logos from there.
