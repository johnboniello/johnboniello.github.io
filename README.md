# johnboniello.com

Source for johnboniello.com — a small [Eleventy](https://www.11ty.dev/) site. Replaces the old
Jekyll/Minimal Mistakes setup.

## Posting something new

1. Add a new file in `src/posts/`, named like `src/posts/my-post-title.md`.
2. Give it this front matter at the top:

   ```markdown
   ---
   layout: post.njk
   title: Your Post Title
   date: 2026-09-15
   summary: One sentence that shows up in the post list.
   ---
   Your post content, written in normal markdown.
   ```

3. Commit and push to `main` (or merge the PR). The site rebuilds and deploys automatically —
   no other steps needed.

To edit the homepage, nav, project links, or social links, see `src/_data/site.js`. The
consulting page placeholder is `src/consulting.md`.

## Running locally

```
npm install
npm start        # serves at http://localhost:8080 with live reload
npm run build     # builds the site into _site/
```

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the site and publishes
it via GitHub Pages. In the repo's **Settings → Pages**, the source needs to be set to
**"GitHub Actions"** (the old setup used "Deploy from a branch" with Jekyll — that needs to be
switched over once, the first time this is deployed). The custom domain (`johnboniello.com`) is
set via `src/CNAME`, which gets copied into the build output automatically.
