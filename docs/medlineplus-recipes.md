# MedlinePlus Recipes — Content & Licensing Research

*Prepared July 2026 for Mory, in response to the Jul 13 2026 request to review [medlineplus.gov/recipes](https://medlineplus.gov/recipes/) ahead of a future Remedi recipe-portfolio expansion. Every claim below is sourced inline; anything I could not directly verify is flagged rather than guessed at.*

---

## Executive summary

MedlinePlus (run by the National Library of Medicine, part of NIH/HHS) hosts a small, static recipe section — **16 category pages, no search or filtering, no health-condition tagging**. It's a content showcase, not a product.

**The "third party" Mory flagged is real and has a name: Food Hero (foodhero.org)**, a SNAP-Ed nutrition-education program run by Oregon State University Extension Service and funded by USDA. The large majority of MedlinePlus recipes (72 of 85 on the Dinner page, for example) are Food Hero recipes republished on medlineplus.gov. A smaller minority (13 of 85 on Dinner) come from **NHLBI** (National Heart, Lung, and Blood Institute) — an NIH institute, i.e., genuinely in-house federal content, not a third party at all.

**The licensing bottom line:** MedlinePlus's own written reuse policy explicitly classifies "Healthy recipes" as **public-domain content**, in the same bucket as its health-topic summaries and videos — not in the bucket it uses for genuinely restricted licensed content (A.D.A.M. Medical Encyclopedia, ASHP drug monographs). Per that policy, recipes may be freely reproduced and redistributed provided you attribute MedlinePlus/NLM as the source. **However**, this creates an unresolved tension I could not fully close out: Food Hero's underlying content is produced by Oregon State University (a state university, not the federal government), and OSU's own copyright guidance states OSU is the copyright holder of its own materials unless a federal-government exception applies. MedlinePlus's policy page does not explain how it reconciles this — it simply lists recipes as public domain without carving out the Food Hero-sourced ones the way it carves out A.D.A.M. and ASHP content. I flag this as a real open question worth a direct confirmation email to NLM and/or Food Hero before Remedi republishes recipe text or photos at scale, even though the plain reading of NLM's policy currently permits it.

---

## 1. How MedlinePlus presents and groups recipes

**Source:** [medlineplus.gov/recipes/](https://medlineplus.gov/recipes/) (fetched directly, raw HTML verified via curl)

### Categories (16 total, image-tile grid, no overlap/tagging)

| Meal-based | Dietary/ingredient | Preparation type |
|---|---|---|
| Breakfast | Dairy Free | Dips/Salsas/Sauces |
| Lunch | Gluten Sensitive | Drinks |
| Dinner | Low-fat | Salads |
| Desserts | Low Sodium | Side Dishes |
| — | Vegetarian | Snacks |
| — | Breads | Soups |

- **No health-condition groupings** (no "diabetes," "heart disease," "kidney" categories) — condition relevance is implicit only in the "Low Sodium" / "Low-fat" tags, not modeled as clinical categories.
- **No search bar, no filters, no sort options** on the landing page — you pick a category tile and get a flat alphabetical list within it (e.g., Dinner has 85 recipes listed A→Z).
- Each category page is a simple text-link list; there's no thumbnail grid at the recipe level, only at the category level.

### Per-recipe page layout

Verified directly on [medlineplus.gov/recipes/baked-meatballs/](https://medlineplus.gov/recipes/baked-meatballs/) (Food Hero recipe) and [medlineplus.gov/recipes/chicken-and-rice/](https://medlineplus.gov/recipes/chicken-and-rice/) (NHLBI recipe):

- **Title** + **prep/cook/total time** + **yield** (e.g., "7 servings")
- **Ingredients**: plain bullet list
- **Directions**: numbered steps, including food-safety notes (handwashing, safe internal temperatures)
- **Hero photo** of the finished dish, placed below the directions
- **Nutrition Facts panel**: FDA's 2016-format label — calories, total/saturated fat, cholesterol, sodium, carbohydrates, fiber, protein, plus vitamins/minerals with %DV, scaled per serving
- **Attribution line**: Food Hero recipes carry *"Find more delicious recipes from FoodHero.org"* with a link to [foodhero.org/recipe-criteria](https://foodhero.org/recipe-criteria) describing FoodHero's recipe-evaluation criteria; NHLBI recipes carry *"A Heart-Healthy Recipe from the National Heart, Lung, and Blood Institute"* and *"Find more delicious heart-healthy recipes from..."*
- Page `<head>` schema.org metadata on the NHLBI recipe explicitly sets `"author":{"@type":"Organization","name":"National Heart, Lung, and Blood Institute"}`.

**Page-level footer** (site-wide, not recipe-specific): *"National Library of Medicine, 8600 Rockville Pike, Bethesda, MD 20894, U.S. Department of Health and Human Services, National Institutes of Health."* No per-recipe copyright line beyond the FoodHero/NHLBI credit strip described above.

---

## 2. Who supplies the recipe content

| Source | Role | Nature of the org |
|---|---|---|
| **Food Hero** (foodhero.org) | Supplies the large majority of recipes (≈85% on the Dinner page) — ingredients, steps, and presumably the nutrition analysis behind the label | SNAP-Ed nutrition-education program, run by **Oregon State University Extension Service**, funded by **USDA Food and Nutrition Service**, in collaboration with the Oregon Department of Human Services. ([Food Hero About page](https://foodhero.org/about-food-hero)) |
| **NHLBI** (National Heart, Lung, and Blood Institute) | Supplies the "Heart-Healthy Recipe" subset (≈15% on Dinner) | An institute of NIH — i.e., the same federal parent as MedlinePlus itself. Not a third party in any licensing sense. |

**This is the third party Mory referred to: Food Hero.** It is a publicly funded university/USDA program, not a commercial recipe-content vendor (there is an unrelated commercial brand at **foodhero.com** — a meal-kit company — that surfaced in search results; that is a different entity and its terms of use do **not** apply here. I'm flagging this explicitly because it's an easy mix-up.)

---

## 3. Attribution and reuse requirements — exact quotes

**Source:** [medlineplus.gov/about/using/usingcontent/](https://medlineplus.gov/about/using/usingcontent/) (fetched and verified against raw HTML, not just the AI-summarized fetch, to guard against paraphrase drift)

### What the policy says, verbatim

> "Some of the content on MedlinePlus is in the public domain (not copyrighted), and other content is copyrighted and licensed specifically for use on MedlinePlus."

> "Works produced by the federal government are not copyrighted under U.S. law. You may reproduce, redistribute, and link freely to non-copyrighted content, including on social media."

The page then lists what falls in the public-domain bucket, and **"Healthy recipes" is explicitly on that list**, alongside: MedlinePlus homepage, health-topic summaries, medical test information, Genetics-page summaries, NLM-watermarked illustrations, MedlinePlus videos, and the "Understanding Medical Words" / "Evaluating Health Information" tutorials.

Required attribution wording:

> "Please acknowledge MedlinePlus as the source of the information by including the phrase 'Courtesy of MedlinePlus from the National Library of Medicine' or 'Source: MedlinePlus, National Library of Medicine.'"

### What is explicitly NOT free to reuse (for contrast — recipes are not in this bucket)

> "Other content on MedlinePlus is copyrighted, and NLM licenses this material specifically for use on MedlinePlus."

Named as copyrighted/licensed: **A.D.A.M. Medical Encyclopedia** (articles and videos) and **drug monographs from the American Society of Health-System Pharmacists (ASHP)**, plus most images/illustrations/photos that aren't NLM-watermarked.

> "You may not ingest and/or brand the copyrighted content found on MedlinePlus in an EHR, patient portal, or other health IT system. To do so, you must license the content directly from the information vendor."

Vendor contacts given for that licensed content:
- A.D.A.M., Inc.: https://www.adam.com/contact
- ASHP: https://www.ashp.org/Contact-Us/
- A.D.A.M.-attributed images: https://www.adamimages.com/ContactUs

Two more restrictions worth noting even though they don't target recipes specifically:
> "You may not frame or manipulate web addresses (URLs) so that MedlinePlus pages appear on a URL other than www.nlm.nih.gov or medlineplus.gov."
> "The MedlinePlus RSS feeds are for personal use only. They may contain licensed content and, therefore, NLM cannot grant you permission to use the MedlinePlus RSS feeds on your web site or information services."

### The gap I could not close

Nowhere on the reuse-policy page does NLM distinguish Food Hero-sourced recipes from NHLBI-sourced recipes, or explain how Food Hero (an Oregon State University program) transferred or licensed rights such that its content could be labeled "public domain" alongside genuinely federal-authored content. I searched foodhero.org directly for its own terms of use / licensing page and could not find one:
- `foodhero.org/web-disclaimer-and-privacy-policy` returned a 404.
- `foodhero.org/recipe-criteria` (the page MedlinePlus itself links to for recipe-evaluation criteria) returned 403 Forbidden to automated fetch.
- General web search surfaced only Oregon State University's institutional copyright guidance (not Food-Hero-specific), which states: *"If you're part of OSU, you don't need permission for OSU materials since the University is the copyright holder, so everyone at OSU can use the material"* — implying OSU, not the federal government, is the rights holder of OSU-authored content in general. ([OSU Library copyright guide](https://guides.library.oregonstate.edu/copyright/permission))

I could not verify whether Food Hero has a separate, more permissive open license (its materials are described elsewhere as "available at no cost" for SNAP-Ed use) or whether NLM secured a specific rights grant to redistribute Food Hero recipes as public domain. **Recommend a direct email to Food Hero (foodheroweb@oregonstate.edu, found via their about page) or to NLM's Customer Support before Remedi republishes Food Hero-original recipe text/photos at scale**, even though MedlinePlus's own policy page, read plainly, currently authorizes it.

---

## 4. What Personal Remedies could and couldn't do

| Action | Status per MedlinePlus's written policy |
|---|---|
| Link to a MedlinePlus recipe page | Freely permitted — direct links explicitly allowed |
| Reproduce recipe text (ingredients/steps) with "Courtesy of MedlinePlus from the National Library of Medicine" attribution | Permitted per the public-domain bucket, which explicitly lists "Healthy recipes" |
| Reproduce the Nutrition Facts panel data | Not separately addressed; presumably follows the recipe's own public-domain classification since it's part of the same page, but not explicitly named the way "recipes" is |
| Reuse the recipe photo | Ambiguous — the public-domain image carve-out is specifically for "illustrations with the 'U.S. National Library of Medicine' watermark and credit," and recipe hero photos are not obviously that; the policy separately says most other images/photos "may be copyright protected" |
| Ingest recipes into a branded product/EHR-like system without attribution | The EHR/health-IT-system restriction language targets copyrighted content (A.D.A.M., ASHP) specifically — recipes, being public domain, likely fall outside that restriction, but this isn't explicitly stated for recipes |
| Rely on Food Hero as ultimate source without checking Food Hero's own terms | Not verified as safe — this is the open gap above |

---

## 5. Recommendation

**Effort to use these recipes:** Low for a handful of recipes with attribution; the site has no bulk API or feed for recipes (the XML web service NLM mentions is for health-topic/genetics data, not recipes, per my reading of the policy page — this should be double-checked before assuming it covers recipes). Scaling to "our recipe portfolio" would mean manually curating and re-keying ~200–300 recipes across the 16 categories, not an automated ingest.

**Licensing risk:** Low-to-moderate. NLM's own policy plainly authorizes reuse of "Healthy recipes" with attribution, which covers the bulk of the legal question. The residual risk is the unresolved Food Hero/OSU rights-chain question above — a documentation gap, not a known prohibition. A 10-minute email to Food Hero and/or MedlinePlus Customer Support (linked from the policy page) would close this out before any at-scale use.

**Attribution format to use, verbatim from policy:** *"Courtesy of MedlinePlus from the National Library of Medicine"* or *"Source: MedlinePlus, National Library of Medicine."* For NHLBI-sourced recipes specifically, MedlinePlus itself additionally credits *"A Heart-Healthy Recipe from the National Heart, Lung, and Blood Institute"* — worth mirroring for those recipes.

**Bigger picture for the product:** the presentation itself (flat category tiles, no condition tagging, no filters) is not something to emulate — it's exactly the gap Remedi's condition-scored approach is positioned to fill (consistent with the finding in `docs/vendor-analysis.md` that no mainstream/public player does per-condition recipe scoring). MedlinePlus recipes could plausibly become a low-cost seed set for Remedi's recipe library once condition-tagging is layered on top, subject to closing the attribution-chain question above.

---

## Sources

- [MedlinePlus: Healthy Recipes (landing page)](https://medlineplus.gov/recipes/)
- [MedlinePlus: Dinner recipes category page](https://medlineplus.gov/recipes/dinner/)
- [MedlinePlus: Breakfast recipes category page](https://medlineplus.gov/recipes/breakfast/)
- [MedlinePlus: Baked Meatballs (Food Hero recipe, example layout)](https://medlineplus.gov/recipes/baked-meatballs/)
- [MedlinePlus: Chicken and Rice (NHLBI recipe, example layout)](https://medlineplus.gov/recipes/chicken-and-rice/)
- [MedlinePlus: Linking to and Using Content from MedlinePlus (reuse policy)](https://medlineplus.gov/about/using/usingcontent/)
- [Food Hero: About Food Hero](https://foodhero.org/about-food-hero)
- [Food Hero: Recipe Criteria](https://foodhero.org/recipe-criteria) (linked from MedlinePlus; returned 403 to automated fetch, so criteria content itself is unverified)
- [Oregon State University Library: Getting Permission (copyright/fair use guide)](https://guides.library.oregonstate.edu/copyright/permission)
- [SNAP-Ed Connection: Food Hero program listing](https://snaped.fns.usda.gov/library/intervention/food-hero)
