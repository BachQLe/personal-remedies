/**
 * recommendationsMock — ranked, already-allergen-filtered recommendations per
 * meal slot. This stands in for the ranking engine until the real API lands.
 *
 * Each slot has 12 entries, ranked 1..12. Tier is derived from rank
 * (1 → top, 2–3 → strong, 4+ → good) so the data and the labels can't drift.
 *
 * Shape matches src/types/recommendations.ts (Recommendation).
 */

import { tierForRank } from '../types/recommendations';

// Raw, pre-ranked seeds per slot. Order === rank. Already allergen-filtered.
const RAW = {
  breakfast: [
    { name: 'Steel-Cut Oats with Blueberries', referenceCount: 16, blurb: 'Soluble fiber + antioxidants', matchedConditions: ['High cholesterol', 'Type 2 Diabetes'], image: 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=400&h=300&fit=crop' },
    { name: 'Greek Yogurt & Walnut Parfait', referenceCount: 12, blurb: 'Protein-forward, low glycemic', matchedConditions: ['Type 2 Diabetes', 'Heart failure'], image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop' },
    { name: 'Spinach & Mushroom Omelette', referenceCount: 11, blurb: 'Folate + lean protein', matchedConditions: ['Depression', 'Hypertension (high blood pressure)'], image: 'https://images.unsplash.com/photo-1510693206972-df098062cb71?w=400&h=300&fit=crop' },
    { name: 'Chia Seed Pudding with Berries', referenceCount: 9, blurb: 'Omega-3 ALA, slow carbs', matchedConditions: ['High cholesterol', 'Heart failure'], image: 'https://images.unsplash.com/photo-1540914124281-342587941389?w=400&h=300&fit=crop' },
    { name: 'Avocado Toast on Rye', referenceCount: 8, blurb: 'Monounsaturated fats', matchedConditions: ['High cholesterol', 'Type 2 Diabetes'], image: 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=400&h=300&fit=crop' },
    { name: 'Overnight Oats with Flaxseed', referenceCount: 7, blurb: 'Beta-glucan + lignans', matchedConditions: ['High cholesterol'], image: 'https://images.unsplash.com/photo-1623428187969-5da2dcea5ebf?w=400&h=300&fit=crop' },
    { name: 'Berry & Spinach Smoothie', referenceCount: 6, blurb: 'Polyphenols, no added sugar', matchedConditions: ['Hypertension (high blood pressure)'], image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&h=300&fit=crop' },
    { name: 'Cottage Cheese with Peaches', referenceCount: 5, blurb: 'Casein protein, low sodium', matchedConditions: ['Type 2 Diabetes'], image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=400&h=300&fit=crop' },
    { name: 'Buckwheat Pancakes', referenceCount: 5, blurb: 'Whole-grain, rutin', matchedConditions: ['Hypertension (high blood pressure)'], image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop' },
    { name: 'Smoked Salmon on Whole Grain', referenceCount: 4, blurb: 'Omega-3 rich', matchedConditions: ['Heart failure'], image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=300&fit=crop' },
    { name: 'Tofu Veggie Scramble', referenceCount: 4, blurb: 'Plant protein, isoflavones', matchedConditions: ['High cholesterol'], image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop' },
    { name: 'Apple-Cinnamon Quinoa Bowl', referenceCount: 3, blurb: 'Complete protein grain', matchedConditions: ['Type 2 Diabetes'], image: 'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?w=400&h=300&fit=crop' },
  ],
  lunch: [
    { name: 'Lentil & Spinach Soup', referenceCount: 18, blurb: 'Fiber, iron, low fat', matchedConditions: ['High cholesterol', 'Type 2 Diabetes'], image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop' },
    { name: 'Salmon Poke Bowl', referenceCount: 13, blurb: 'Omega-3 + brown rice', matchedConditions: ['Heart failure', 'Hypertension (high blood pressure)'], image: 'https://images.unsplash.com/photo-1546069901-d5bfd2cbfb1f?w=400&h=300&fit=crop' },
    { name: 'Quinoa & Chickpea Power Bowl', referenceCount: 12, blurb: 'Plant protein, low GI', matchedConditions: ['Type 2 Diabetes', 'High cholesterol'], image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop' },
    { name: 'Grilled Chicken & Kale Salad', referenceCount: 9, blurb: 'Lean protein, leafy greens', matchedConditions: ['Hypertension (high blood pressure)'], image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=300&fit=crop' },
    { name: 'Mediterranean Chickpea Wrap', referenceCount: 8, blurb: 'Olive oil, legumes', matchedConditions: ['High cholesterol'], image: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&h=300&fit=crop' },
    { name: 'Minestrone with White Beans', referenceCount: 7, blurb: 'Mixed veg + fiber', matchedConditions: ['Type 2 Diabetes'], image: 'https://images.unsplash.com/photo-1534938665420-4193effeacc4?w=400&h=300&fit=crop' },
    { name: 'Beet & Walnut Grain Bowl', referenceCount: 6, blurb: 'Nitrates + healthy fats', matchedConditions: ['Hypertension (high blood pressure)', 'Heart failure'], image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=300&fit=crop' },
    { name: 'Tuna & White Bean Salad', referenceCount: 5, blurb: 'Lean protein, low sodium', matchedConditions: ['Heart failure'], image: 'https://images.unsplash.com/photo-1551248429-40975aa4de74?w=400&h=300&fit=crop' },
    { name: 'Roasted Veggie & Farro Bowl', referenceCount: 5, blurb: 'Whole grain, antioxidants', matchedConditions: ['Type 2 Diabetes'], image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400&h=300&fit=crop' },
    { name: 'Falafel & Tabbouleh Plate', referenceCount: 4, blurb: 'Legume protein, herbs', matchedConditions: ['High cholesterol'], image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&h=300&fit=crop' },
    { name: 'Turkey & Avocado Sandwich', referenceCount: 4, blurb: 'Lean protein, good fats', matchedConditions: ['High cholesterol'], image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&h=300&fit=crop' },
    { name: 'Miso Soup with Edamame', referenceCount: 3, blurb: 'Soy isoflavones', matchedConditions: ['Hypertension (high blood pressure)'], image: 'https://images.unsplash.com/photo-1607301405390-d831c242f59b?w=400&h=300&fit=crop' },
  ],
  dinner: [
    { name: 'Herb-Baked Salmon with Broccoli', referenceCount: 17, blurb: 'Omega-3 + cruciferous', matchedConditions: ['Type 2 Diabetes', 'Heart failure'], image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=300&fit=crop' },
    { name: 'Lentil Bolognese', referenceCount: 12, blurb: 'Plant protein, fiber', matchedConditions: ['High cholesterol', 'Type 2 Diabetes'], image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&h=300&fit=crop' },
    { name: 'Baked Cod with Asparagus', referenceCount: 11, blurb: 'Lean white fish', matchedConditions: ['Heart failure', 'Hypertension (high blood pressure)'], image: 'https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?w=400&h=300&fit=crop' },
    { name: 'Stir-Fried Tofu & Vegetables', referenceCount: 9, blurb: 'Plant protein, low sat fat', matchedConditions: ['High cholesterol'], image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&h=300&fit=crop' },
    { name: 'Chickpea & Spinach Curry', referenceCount: 8, blurb: 'Turmeric, legumes', matchedConditions: ['Type 2 Diabetes'], image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=300&fit=crop' },
    { name: 'Turkey Meatballs & Zucchini', referenceCount: 7, blurb: 'Lean protein, low carb', matchedConditions: ['Type 2 Diabetes'], image: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=400&h=300&fit=crop' },
    { name: 'Miso-Glazed Salmon & Bok Choy', referenceCount: 6, blurb: 'Omega-3 + greens', matchedConditions: ['Heart failure'], image: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&h=300&fit=crop' },
    { name: 'Mediterranean Stuffed Peppers', referenceCount: 5, blurb: 'Veg-forward, brown rice', matchedConditions: ['Hypertension (high blood pressure)'], image: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=400&h=300&fit=crop' },
    { name: 'Shrimp & Quinoa Bowl', referenceCount: 5, blurb: 'Lean protein, whole grain', matchedConditions: ['Type 2 Diabetes'], image: 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=400&h=300&fit=crop' },
    { name: 'Roasted Vegetable Ratatouille', referenceCount: 4, blurb: 'Antioxidant-dense', matchedConditions: ['Hypertension (high blood pressure)'], image: 'https://images.unsplash.com/photo-1572453800999-e8d2d1589b7c?w=400&h=300&fit=crop' },
    { name: 'Grilled Chicken & Sweet Potato', referenceCount: 4, blurb: 'Lean protein, complex carbs', matchedConditions: ['Type 2 Diabetes'], image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=400&h=300&fit=crop' },
    { name: 'Walnut-Crusted Trout', referenceCount: 3, blurb: 'Omega-3, healthy fats', matchedConditions: ['High cholesterol', 'Heart failure'], image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400&h=300&fit=crop' },
  ],
  snack: [
    { name: 'Apple with Almond Butter', referenceCount: 10, blurb: 'Fiber + healthy fats', matchedConditions: ['Type 2 Diabetes', 'High cholesterol'], image: 'https://images.unsplash.com/photo-1570913149827-d2ac84ab3f9a?w=400&h=300&fit=crop' },
    { name: 'Greek Yogurt with Berries', referenceCount: 9, blurb: 'Protein + polyphenols', matchedConditions: ['Type 2 Diabetes'], image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop' },
    { name: 'Handful of Walnuts', referenceCount: 8, blurb: 'Omega-3 ALA', matchedConditions: ['High cholesterol', 'Heart failure'], image: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=400&h=300&fit=crop' },
    { name: 'Hummus & Carrot Sticks', referenceCount: 7, blurb: 'Legume fiber, no added sugar', matchedConditions: ['High cholesterol'], image: 'https://images.unsplash.com/photo-1481931098730-318b6f776db0?w=400&h=300&fit=crop' },
    { name: 'Edamame (lightly salted)', referenceCount: 6, blurb: 'Plant protein, isoflavones', matchedConditions: ['Hypertension (high blood pressure)'], image: 'https://images.unsplash.com/photo-1564894809611-1742fc40ed80?w=400&h=300&fit=crop' },
    { name: 'Cottage Cheese & Pineapple', referenceCount: 5, blurb: 'Casein protein', matchedConditions: ['Type 2 Diabetes'], image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=400&h=300&fit=crop' },
    { name: 'Dark Chocolate (70%+) Square', referenceCount: 5, blurb: 'Flavanols', matchedConditions: ['Hypertension (high blood pressure)', 'Heart failure'], image: 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=400&h=300&fit=crop' },
    { name: 'Roasted Chickpeas', referenceCount: 4, blurb: 'Crunchy fiber + protein', matchedConditions: ['Type 2 Diabetes'], image: 'https://images.unsplash.com/photo-1548340748-6d2b7d7da280?w=400&h=300&fit=crop' },
    { name: 'Cucumber & Tzatziki', referenceCount: 4, blurb: 'Hydrating, low sodium', matchedConditions: ['Hypertension (high blood pressure)'], image: 'https://images.unsplash.com/photo-1607532941433-304659e8198a?w=400&h=300&fit=crop' },
    { name: 'Banana with Peanut Butter', referenceCount: 3, blurb: 'Potassium + protein', matchedConditions: ['Hypertension (high blood pressure)'], image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&h=300&fit=crop' },
    { name: 'Mixed Berries Cup', referenceCount: 3, blurb: 'Antioxidants, low GI', matchedConditions: ['Type 2 Diabetes'], image: 'https://images.unsplash.com/photo-1563746098251-d35aef196e83?w=400&h=300&fit=crop' },
    { name: 'Pumpkin Seeds', referenceCount: 2, blurb: 'Magnesium, zinc', matchedConditions: ['Heart failure'], image: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=400&h=300&fit=crop' },
  ],
};

function buildSlot(slot, items) {
  return items.map((item, i) => {
    const rank = i + 1;
    return {
      id: `${slot}-${rank}`,
      name: item.name,
      slot,
      rank,
      tier: tierForRank(rank),
      referenceCount: item.referenceCount,
      blurb: item.blurb,
      matchedConditions: item.matchedConditions ?? [],
      image: item.image,
    };
  });
}

/** All recommendations grouped by slot, ranked, tier-derived. */
export const recommendationsBySlot = {
  breakfast: buildSlot('breakfast', RAW.breakfast),
  lunch: buildSlot('lunch', RAW.lunch),
  dinner: buildSlot('dinner', RAW.dinner),
  snack: buildSlot('snack', RAW.snack),
};
