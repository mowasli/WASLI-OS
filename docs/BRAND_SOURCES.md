# Brand and company source audit

## Scope and source boundary

Audited user-provided `WASL Ecosystems _ ABOUT WASL _Sept_2026 (1).pptx` (13 slides; September 2026 company profile). It is company reference material, not engineering instructions or permission to ingest unrelated company data. The brand archive and filing-system archive exceed the download tool's 32 MiB transfer limit and have **not** been inspected. Do not imply those archives have been ingested.

The official assets below are byte-for-byte copies of embedded PowerPoint media, not AI-generated artwork, redrawn logos, or approximate replacements. `public/brand/manifest.json` records each source media path and SHA-256. No third-party logos from the company profile were copied except THV, which the user explicitly needs as a separate workspace identity.

## Reusable supplied assets

| Local public path | Source inside PPTX | Referencing slides | Intended use |
| --- | --- | --- | --- |
| `/brand/wasl-logo-blue.png` | `ppt/media/image56.png` | 10 | Blue bilingual wordmark for white/light surfaces; 680 × 175 |
| `/brand/wasl-logo-white.png` | `ppt/media/image16.png` | 1 | White bilingual wordmark for dark/blue surfaces; 2044 × 525 |
| `/brand/wasl-logo-orange.png` | `ppt/media/image34.png` | 2–13 | Orange bilingual wordmark; 2048 × 526 |
| `/brand/wasl-north-star-blue.png` | `ppt/media/image19.png` | 4, 5, 6 | Official blue North Star graphic |
| `/brand/wasl-north-star-gold.png` | `ppt/media/image23.png` | 1 | Official gold North Star graphic |
| `/brand/wasl-north-star-teal.png` | `ppt/media/image49.png` | 8 | Official teal North Star graphic |
| `/brand/wasl-pattern.png` | `ppt/media/image17.png` | 1 | Official pale-blue repeating brand pattern |
| `/brand/thv-logo.png` | `ppt/media/image63.png` | 10, 12 | Actual Tech Horizons Ventures logo, transparently padded 1200 × 630 image |

THV's logo is present in the authorized deck even though the separate brand archive could not be transferred. Preserve its aspect ratio and native colors. It has transparent vertical padding; use a constrained containing viewport if necessary rather than distorting it. Attribution here is evidence of the supplied image, not a claim that a full THV brand manual was supplied.

## Colors and typography extracted from source

The PPTX includes multiple imported Office themes; their default accent colors are **not** the WASL brand palette. The following values appear explicitly in slide drawing properties and/or the supplied brand artwork:

| Color | Source evidence | Suggested application |
| --- | --- | --- |
| `#002BD9` | 103 direct slide drawing-color occurrences; exact opaque pixel color in blue WASL logo and North Star | Primary WASL action and active state |
| `#050B24` | 48 direct slide drawing-color occurrences | Main dark ink |
| `#5D6475` | 72 direct slide drawing-color occurrences | Secondary text, subject to contrast verification |
| `#F15829` | 24 direct slide drawing-color occurrences; exact opaque color in orange WASL wordmark | Official orange accent |
| `#00CFCF` | 19 direct slide drawing-color occurrences; exact opaque pixel color in teal North Star | Secondary WASL accent |
| `#FFB52E` | 9 direct slide drawing-color occurrences; exact opaque color in gold North Star | Gold highlight |
| `#F7F5F2` | 12 direct slide drawing-color occurrences | Warm background |
| `#FFFFFF` | 81 direct slide drawing-color occurrences | Light surface |

These are observed profile colors, not a substitute for the unavailable formal brand manual. THV logo's dominant flat teal is `#0F7F71` and gray `#797979`. The requested dark-green THV interface can use an accessible darker UI treatment, documented as an interface choice rather than an official brand token.

Poppins is the predominant explicitly declared Latin family (314 drawing-level references), followed by Nunito Sans (67), Montserrat (67), Poppins SemiBold (6), and Inter (4). IBM Plex Sans Arabic and IBM Plex Sans Arabic SemiBold occur once each. The deck contains embedded `.fntdata` font objects, which have not been converted into web fonts or republished. Use appropriately licensed web-font packages for these families, with system fallbacks and proper Arabic shaping. Do not claim approximate system fonts are the official font files.

## Source-backed company facts

| Slide | Supported fact |
| --- | --- |
| 1 | Positioning: “Building the trust infrastructure for entrepreneurship in fragile & underserved markets.” Company profile dated September 2026. |
| 2 | WASL is Yemen-rooted; it designs entrepreneurship programs, venture-readiness support, market intelligence, and stakeholder collaboration pathways. |
| 3 | Four service groupings: startup and ecosystem programs; market intelligence; vetted collaboration pathways; WASL Ventures. |
| 4 | Five complementary capabilities: programs and initiatives; capacity building; market insights and reports; ecosystem support; stakeholder engagement. |
| 5 | Desired outcomes: stronger founders; more investable startups; institutional value; healthier ecosystems. These are strategic outcome categories, not measured achievements or KPI values. |
| 6 | Purpose: reduce fragmentation, strengthen trust, and build enabling systems for sustainable entrepreneurship and opportunity. |
| 7 | Goals: transform fragmented early-stage ecosystems into functional environments; establish trusted platform and brand leadership in fragile and underserved markets. |
| 8 | Program concepts: JISR (Yemeni/regional expertise bridge), MASAR (university student-to-startup pathway), women-led business diagnostic/incubation support, and ESO capacity building. Do not infer live operating status, budgets, or cohorts. |
| 9 | Approach: context → trust → capability → connectivity → sustainable value. |
| 10 | Founding partners named: Ahmed Qasem, Mohamed AlGannam, Ahmed Fadl, Mohammed Alwasli. THV logo appears among team experience marks; that does not establish WASL/THV shared data ownership. |
| 11 | WASL comes from Arabic “وصل” (“connect”); founder readiness and ecosystem readiness both matter. |
| 12 | Stakeholder categories include governmental entities, INGOs and DFIs, educational institutions, banks, logistics firms, real estate developers/investors, ESOs, venture builders, and VCs. Logos are presented as team history and must not be relabeled as current WASL clients or active partnerships. |
| 13 | Public company website shown: `www.wasl-i.com`; public contact shown: `info@wasl-i.com`. |

No operational projects, tasks, deadlines, financial results, current partnerships, intelligence feed entries, or live integrations were inferred from this deck.
