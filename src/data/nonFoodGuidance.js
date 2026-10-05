/**
 * nonFoodGuidance.js — short, practical, general-information guidance for
 * Nutridigm's non-food "lifestyle / therapy / avoid" items (coarse group
 * 'j': Smoking, Exercise, Excess body weight, Socialize/join a club,
 * acupuncture, alcohol, supplements, hygiene, ...). Checklist #45.
 *
 * !!! DRAFT COPY — FOR SUNNY TO REVIEW before release. Every line here is
 * general-information-only: no diagnosis, no dosing, no treatment claims.
 * Each block ends with the shared DOCTOR_NOTE. Edit freely; the mapping
 * (ITEM_CATEGORY) is separate from the copy (GUIDANCE) so wording can change
 * without touching IDs.
 *
 * Scope: coarse group 'j' only. Nutrients/herbals (coarse 'k') and the ~52
 * real foods the classifier mislabels with fine group 'x' (Beef, Chicken,
 * Eggs, Milk ...; coarse b-i) deliberately get NO guidance —
 * `getNonFoodGuidance` returns null for them.
 *
 * Keyed by foodItemID (src/data/cache/items.json). Any coarse-'j' item not
 * listed falls back to a generic block chosen by fine group (j1 = therapy or
 * practice, x = lifestyle factor), so every non-food item resolves.
 */

export const DOCTOR_NOTE =
  'General information only, not medical advice. Talk to your doctor before making changes, especially if you have a health condition or take medication.';

/** @type {Record<string, {title: string, tips: string[]}>} */
export const GUIDANCE = {
  smoking: {
    title: 'If you want to quit',
    tips: [
      'Free quit support is available in the US: call 1-800-QUIT-NOW (1-800-784-8669) or visit smokefree.gov.',
      'Pick a quit date, tell people close to you, and plan for your usual triggers such as coffee, stress or breaks.',
      'Ask your doctor or pharmacist what cessation options exist; many people try more than once before it sticks.',
    ],
  },
  alcohol: {
    title: 'Keeping an eye on alcohol',
    tips: [
      'Track how many drinks you have in a typical week so you know your baseline.',
      'Alternate alcoholic drinks with water and set your limit before you go out.',
      'Some medications and conditions do not mix with alcohol, so ask your doctor what applies to you.',
    ],
  },
  activity: {
    title: 'Getting started with movement',
    tips: [
      'Start small: a 10-minute walk after a meal counts, and you can build from there.',
      'General public-health guidance for adults is about 150 minutes a week of moderate activity, spread over the week.',
      'Pick something you enjoy and warm up first; stop and rest if you feel pain, dizziness or chest discomfort.',
    ],
  },
  weight: {
    title: 'Steady, gradual changes',
    tips: [
      'Small, gradual changes you can keep up tend to last longer than quick fixes or crash diets.',
      'Focus on regular meals, reasonable portions and everyday movement rather than a single number.',
      'A doctor or registered dietitian can help set a healthy goal that fits your body and conditions.',
    ],
  },
  social: {
    title: 'Staying connected',
    tips: [
      'Try joining a club, class, faith group or volunteer team that meets regularly.',
      'Shared activities such as walking groups, choirs or hobby clubs make it easier to keep showing up.',
      'Even a weekly call or coffee with a friend or neighbor is a good place to begin.',
    ],
  },
  sleep: {
    title: 'Building better rest',
    tips: [
      'Keep a regular sleep and wake time, even on weekends.',
      'Wind down with a calm routine and keep screens, bright light and heavy meals away from bedtime.',
      'If you often struggle to sleep or feel tired during the day, mention it to your doctor.',
    ],
  },
  stress: {
    title: 'Managing stress and mood',
    tips: [
      'Short daily practices such as slow breathing, a walk outside or a few minutes of quiet can help.',
      'Talking with someone you trust, or a counselor or therapist, is a common and reasonable step.',
      'If stress, low mood or worry is getting in the way of daily life, reach out to a healthcare professional.',
    ],
  },
  bodywork: {
    title: 'Before you try a therapy',
    tips: [
      'Talk to your doctor first, especially if you have a health condition, are pregnant or take medication.',
      'Look for a licensed or certified practitioner and ask about their training, costs and what a session involves.',
      'Treat it as a complement to your regular care, not a replacement, and stop and tell your doctor if something feels wrong.',
    ],
  },
  diet: {
    title: 'Thinking about a diet pattern',
    tips: [
      'Read about the approach from reputable health sources and see how it fits your tastes, budget and routine.',
      'Make changes gradually and keep a variety of foods so you do not miss key nutrients.',
      'Check with your doctor or a registered dietitian first, particularly with a medical condition or medication.',
    ],
  },
  eating: {
    title: 'Everyday eating habits',
    tips: [
      'Small habits such as eating slowly and noticing fullness cues are easy to try.',
      'Regular meal times and sensible portion sizes can make eating feel steadier through the day.',
      'If you have a condition that affects what or when you should eat, follow your care team\'s advice.',
    ],
  },
  foodChoice: {
    title: 'Choosing and preparing food',
    tips: [
      'Look at this as a general pattern rather than a strict rule, and notice how different foods and preparations sit with you.',
      'Reading labels and cooking at home gives you more control over what goes into a meal.',
      'If a food or preparation affects one of your conditions, ask your doctor or dietitian what is right for you.',
    ],
  },
  additives: {
    title: 'Reading labels',
    tips: [
      'Check ingredient lists to see whether this appears in the products you buy.',
      'Fresh or minimally processed foods usually contain fewer additives.',
      'If you think an ingredient affects you, note when symptoms happen and discuss it with your doctor.',
    ],
  },
  medicine: {
    title: 'Medicines and supplements',
    tips: [
      'Keep a current list of everything you take, including over-the-counter products and supplements, and share it with your doctor and pharmacist.',
      'Follow the label and your doctor\'s instructions; this app does not give dosing advice.',
      'Ask before starting, stopping or combining anything, because some products interact with medicines or conditions.',
    ],
  },
  hygiene: {
    title: 'Everyday habits and surroundings',
    tips: [
      'Small routines, done consistently, add up: think about how this fits into your day at home or work.',
      'Where you can, adjust your surroundings or routine to make the healthier choice the easy one.',
      'If it is linked to symptoms or a condition you have, ask your doctor or a related professional for advice.',
    ],
  },
  help: {
    title: 'When to get help',
    tips: [
      'For a medical emergency, call your local emergency number right away (911 in the US).',
      'For possible poisoning in the US, Poison Help is available 24/7 at 1-800-222-1222.',
      'For non-urgent concerns, contact your doctor or dentist and describe your symptoms.',
    ],
  },
  therapyFallback: {
    title: 'Before you try this',
    tips: [
      'Learn what it involves from reputable health sources.',
      'Talk to your doctor first, especially if you have a health condition or take medication.',
      'Consider it alongside, not instead of, your regular medical care.',
    ],
  },
  lifestyleFallback: {
    title: 'Thinking about this one',
    tips: [
      'Notice how often this shows up in your routine and whether a small change is realistic.',
      'Start with one manageable step rather than changing everything at once.',
      'Ask your doctor how it relates to your own conditions.',
    ],
  },
};

/** category key -> foodItemIDs (coarse group 'j'). */
const CATEGORY_IDS = {
  smoking: [986],
  alcohol: [844, 845],
  activity: [898, 899, 900, 1004, 1012, 993, 971, 1005, 959, 998],
  weight: [895, 884, 947, 877, 1282, 1288],
  social: [987, 1380, 943, 964, 1281, 994, 874, 1379, 961],
  sleep: [985, 1256, 891, 1432],
  stress: [991, 950, 977, 1324, 970, 940],
  bodywork: [
    848, 849, 851, 862, 866, 876, 893, 894, 906, 935, 937, 938, 939, 948, 949, 953, 958, 962,
    975, 976, 979, 988, 996, 997, 1356, 1339, 1290, 858, 887, 1271, 1283, 856, 857, 1322,
  ],
  diet: [751, 852, 855, 909, 910, 911, 957, 1002, 1085, 1421, 892, 902],
  eating: [889, 890, 1285, 1003, 941, 908, 946, 835, 1248],
  foodChoice: [
    352, 473, 871, 872, 873, 875, 903, 904, 907, 914, 915, 916, 917, 918, 919, 920, 921, 922,
    923, 924, 925, 926, 927, 928, 932, 942, 955, 981, 982, 989, 1000, 1010, 1244, 1274, 1301,
    1309, 1313, 1332, 1331, 1273, 123,
  ],
  additives: [859, 860, 864, 865, 905, 912, 913, 952, 966, 980, 992, 1007, 882, 883, 954, 956, 960, 968, 863],
  medicine: [
    699, 853, 854, 861, 867, 888, 944, 965, 990, 999, 1241, 1289, 1381, 931, 930, 945, 951, 936,
    1278, 1323, 1372, 1378, 1272, 1276,
  ],
  hygiene: [
    25, 133, 162, 869, 878, 1006, 1011, 1008, 1009, 896, 984, 1292, 1293, 934, 850, 972, 973,
    1366, 933, 963, 969, 978, 897, 1260, 1433, 1246, 1247, 1263, 1001, 929, 1291,
  ],
  help: [870, 881, 880, 879],
};

/** foodItemID -> category key. Built once from CATEGORY_IDS. */
export const ITEM_CATEGORY = Object.freeze(
  Object.entries(CATEGORY_IDS).reduce((m, [cat, ids]) => {
    for (const id of ids) m[id] = cat;
    return m;
  }, {})
);

const MIN_DESC_LEN = 20;

/**
 * Resolve guidance for an opened item.
 *
 * Returns null when the item is not a lifestyle/therapy ("coarse j") item —
 * including real foods wrongly tagged fine group 'x' (coarse b-i) and
 * nutrient/herbal ('k') items. When `foodId` is unmapped, falls back by fine
 * group. When `group` is unknown (undefined) a mapped ID is still honored.
 *
 * @param {Object} args
 * @param {number|string|null} [args.foodId]
 * @param {string} [args.group] - coarse group code
 * @param {string} [args.fineGroup] - fine group code
 * @param {string} [args.longDescription] - Nutridigm long description
 * @returns {{category: string, title: string, tips: string[], note: string, about: string|null}|null}
 */
export function getNonFoodGuidance({ foodId, group, fineGroup, longDescription } = {}) {
  const id = foodId == null ? null : Number(foodId);
  let category = id != null ? ITEM_CATEGORY[id] : undefined;
  if (!category) {
    if (group !== 'j') return null;
    category = fineGroup === 'j1' ? 'therapyFallback' : 'lifestyleFallback';
  } else if (group && group !== 'j') {
    return null;
  }
  const block = GUIDANCE[category];
  const desc = (longDescription || '').trim();
  return {
    category,
    title: block.title,
    tips: block.tips,
    note: DOCTOR_NOTE,
    about: desc.length >= MIN_DESC_LEN ? desc : null,
  };
}
