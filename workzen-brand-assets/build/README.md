# Asset generation scripts (reference)

These produced the outlined wordmark, favicon, app-icon, OG and email assets from the SVG symbol master.
They were run from a scratch directory, so the `S = '...'` path constants at the top of each file must be pointed at a
working directory before reuse. Needs Python (`fonttools`, `uharfbuzz`, `pillow`), Node + Playwright (rasterising),
and the Inter variable font (SIL OFL 1.1).

Order: `outline.py` -> `build_assets.py` -> `raster.mjs` -> `ico.py`.
