stevertaylor.github.io
=======================

This is the personal website for Dr Stephen R. Taylor, built with [Hugo](https://gohugo.io/) and
deployed to GitHub Pages by `.github/workflows/hugo.yml` on every push to `master`.

## Preview locally

```bash
hugo server            # http://localhost:1313, rebuilds on save
```

## Where things live

| To change…                                    | Edit                                   |
|-----------------------------------------------|----------------------------------------|
| Name, role, email, address, profile links, roles strip, menu | `hugo.yaml` (`params`, `menu`) |
| Homepage text (hero, about, research cards, 2023 feature) | `content/_index.md` (front matter + body) |
| Research / Publications / Group / Teaching / CV pages | `content/*.md`                    |
| Honors (homepage shows `featured: true`)      | `data/honors.yaml`                     |
| Selected papers (by `id`, `tags`, `selected`) | `data/publications.yaml`               |
| Group roster                                  | `data/group.yaml`                      |
| CV highlights (appointments, talks, funding…) | `data/cv.yaml`                         |
| Homepage lectures (talks with `featured: true`; optional `video`) | `data/cv.yaml` (`talks`) |
| Homepage press strip (outlets, optional article links) | `data/press.yaml` |
| The CV PDF                                    | `static/cv.pdf`                        |
| Styles                                        | `assets/css/site.css`                  |
| Homepage animation (binary + GW field)        | `assets/js/gw-hero.js`                 |
| Templates and shortcodes                      | `layouts/`                             |

Images in `static/images/` keep their public URLs and are also converted to responsive WebP at
build time. The card illustrations and the Hellings–Downs figure in `layouts/_partials/art/` are
generated SVG.

The site no longer uses the PaperMod theme; `themes/PaperMod` is an unused submodule that can be removed.
