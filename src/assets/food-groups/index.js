/**
 * index.js — food-group menu photos supplied by the product owner (stock
 * photos, one per Nutridigm fine food group), replacing the generic
 * lucide-react icons on the Food Groups menus.
 *
 * Fine group codes (b1, b2, ... l) match `foodGroupID` in
 * src/data/cache/groups.json. COARSE_GROUP_IMAGES needs its own explicit
 * picks (not derived from FINE_GROUP_IMAGES) because 6 of the 10 coarse
 * groups (b, c, g, h, i, k) each span multiple fine groups with no single
 * photo of their own, so a representative fine photo stands in.
 */
import b1 from './b1.webp';
import b2 from './b2.webp';
import b3 from './b3.webp';
import c1 from './c1.webp';
import c2 from './c2.webp';
import c3 from './c3.webp';
import d from './d.webp';
import e from './e.webp';
import f from './f.webp';
import g1 from './g1.webp';
import g2 from './g2.webp';
import h1 from './h1.webp';
import h2 from './h2.webp';
import i1 from './i1.webp';
import i2 from './i2.webp';
import j1 from './j1.webp';
import k1 from './k1.webp';
import k2 from './k2.webp';
import l from './l.webp';

export const FINE_GROUP_IMAGES = Object.freeze({
  b1,
  b2,
  b3,
  c1,
  c2,
  c3,
  d,
  e,
  f,
  g1,
  g2,
  h1,
  h2,
  i1,
  i2,
  j1,
  k1,
  k2,
  l,
});

export const COARSE_GROUP_IMAGES = Object.freeze({
  b: b2,
  c: c1,
  d,
  e,
  f,
  g: g1,
  h: h1,
  i: i1,
  j: j1,
  k: k1,
});
