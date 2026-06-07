# Ravnur Simulcast Manager — User Guide

> **This guide has moved.** The operator/user guide is now a published site:
>
> ### 👉 <https://ravnur-inc.github.io/oryx-restream/>
>
> The source lives in [`docs-site/`](../docs-site/) (MkDocs Material) and is
> published to GitHub Pages automatically on every push to `main`.

## Editing the guide

Edit the Markdown files in [`docs-site/`](../docs-site/) and the nav in
[`mkdocs.yml`](../mkdocs.yml). On merge to `main`, the
[`Docs` workflow](../.github/workflows/docs.yml) rebuilds and redeploys the site.

To preview locally:

```bash
pip install -r docs-site/requirements.txt
mkdocs serve   # http://127.0.0.1:8000
```

**Keep it current:** any change that affects what a user sees or does in the UI
must update the relevant `docs-site/` page in the same pull request.
