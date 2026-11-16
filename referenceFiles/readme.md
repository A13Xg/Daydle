# Daydle UI/UX Reference

> **Reference material only. Nothing in this folder is a requirement.**
> These screens and design systems are exploratory mockups. They exist so a future design pass has something to look at. They do **not** need to be implemented, matched, or ported unless the owner explicitly asks for a specific screen or style in the current instruction.

## How to use this folder

- **Default: ignore it.** Phase work follows [IDEA.md](../IDEA.md), [roadmap.md](../roadmap.md) and [AGENTS.md](../AGENTS.md). Those documents take precedence over anything here.
- **Implement from it only on explicit request**, for example "build the Today screen from the reference" or "adopt the Obsidian Arcade theme". A request to build a feature or complete a phase is not a request to copy these screens.
- **Do not treat it as approved design.** Visual design is intentionally deferred (see AGENTS.md and IDEA.md). Do not choose a palette, typography or layout system from here on your own initiative.
- **Mockups may conflict with the product baseline.** If a screen shows a feature, flow, data field or social behavior that differs from IDEA.md, roadmap.md or the implemented app, the baseline wins. Examples include names, counts or features shown in the mockups that the app does not offer, and sample data such as "14,280 Live" or invite codes.
- **Do not edit these files to track implementation.** Treat them as a read-only snapshot.

## What is here

All design material lives in `Daydle UI-UX Reference/`.

### Screens

Each screen folder holds two files: `code.html` (a standalone HTML/Tailwind mockup that loads Tailwind and fonts from CDNs) and `screen.png` (a rendered screenshot). The mockups are static; they have no real data, routing or application logic.

| Folder | Screen |
|---|---|
| `welcome_auth/` | Welcome and sign-in |
| `profile_setup/` | Onboarding: profile setup |
| `how_it_works/` | Onboarding: how it works |
| `today/` | Today: daily dashboard |
| `discover/` | Discover: game catalog |
| `statistics/` | Statistics |
| `friends/` | Friends |
| `account/` | Account and settings |
| `paste_results/` | Paste results sheet |
| `lineup_editor/` | Lineup editor |
| `celebration/` | Completion celebration |
| `notifications/` | Notifications |
| `comparisons/` | Head-to-head comparisons |

### Design-system variants

Three alternative visual directions, each as a single `DESIGN.md` with front-matter tokens (colors, typography, spacing) and written style guidance. They are **alternatives to choose between, not layers to combine**, and none has been selected.

| Folder | Theme |
|---|---|
| `obsidian_arcade/` | Dark theme (deep navy background, electric-blue accents) |
| `luminous_modernity/` | Alternative theme |
| `daydle_zest/` | Light theme (blue primary with warm secondary accents) |

## Notes for whoever picks this up later

- The mockups were produced by a design tool and reference a few concepts that are not part of the product baseline (for example "syndicate", "arcade" branding and "Launch All" sequencing). Confirm each one against IDEA.md before building it.
- The HTML relies on CDN-hosted Tailwind and web fonts. Re-implement in the app's own stack (React/TypeScript/Vite) rather than copying the markup.
- Accessibility, error, empty, loading and offline states are not fully shown here but remain required by the product baseline.
