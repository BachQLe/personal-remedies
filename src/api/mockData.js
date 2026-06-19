// ── Swipe deck ────────────────────────────────────────────────────────────────
export const swipeDeckFoods = [
  { id: 's1', name: 'Salmon', emoji: '🐟', category: 'Fish', color: '#4A90D9' },
  { id: 's2', name: 'Broccoli', emoji: '🥦', category: 'Vegetables', color: '#34A853' },
  { id: 's3', name: 'Blueberries', emoji: '🫐', category: 'Fruits', color: '#6B4FBB' },
  { id: 's4', name: 'Lentils', emoji: '🍲', category: 'Legumes', color: '#E89B3B' },
  { id: 's5', name: 'Walnuts', emoji: '🥜', category: 'Nuts & Seeds', color: '#C9973A' },
  { id: 's6', name: 'Spinach', emoji: '🥬', category: 'Vegetables', color: '#2E7D32' },
  { id: 's7', name: 'Sweet Potato', emoji: '🍠', category: 'Vegetables', color: '#D4722A' },
  { id: 's8', name: 'Sardines', emoji: '🐠', category: 'Fish', color: '#1565C0' },
  { id: 's9', name: 'Greek Yogurt', emoji: '🥛', category: 'Dairy', color: '#6B9FD4' },
  { id: 's10', name: 'Avocado', emoji: '🥑', category: 'Fruits', color: '#558B2F' },
  { id: 's11', name: 'Quinoa', emoji: '🌾', category: 'Grains', color: '#A1887F' },
  { id: 's12', name: 'Dark Chocolate', emoji: '🍫', category: 'Antioxidants', color: '#4E342E' },
];

// ── Conditions ─────────────────────────────────────────────────────────────────
export const popularConditions = [
  'Type 2 Diabetes',
  'Hypertension (high blood pressure)',
  'High cholesterol',
  'Hypothyroidism',
  'Chronic kidney disease (CKD)',
  'Asthma',
  'Depression',
  'Osteoarthritis',
  'Heart failure',
  'Irritable bowel syndrome (IBS)',
];

// ── Allergies ──────────────────────────────────────────────────────────────────
export const commonAllergies = [
  'Tree Nuts', 'Peanuts', 'Shellfish', 'Fish', 'Dairy', 'Eggs', 'Wheat / Gluten', 'Soy', 'Sesame',
];

// ── References ─────────────────────────────────────────────────────────────────
export const referencesDb = {
  // foodId:condition -> Reference[]
  'f1:Type 2 Diabetes': [
    { source: 'Am J Clin Nutr', year: 2019, url: 'https://ajcn.nutrition.org' },
    { source: 'Diabetes Care (ADA)', year: 2021, url: 'https://diabetesjournals.org' },
    { source: 'NIH/NIDDK', year: 2020 },
  ],
  'f1:Hypertension (high blood pressure)': [
    { source: 'J Hypertension', year: 2018, url: 'https://journals.lww.com/jhypertension' },
    { source: 'NHANES Study', year: 2020 },
  ],
  'f2:Type 2 Diabetes': [
    { source: 'Nutrition Reviews', year: 2022 },
    { source: 'BMJ Open Diabetes', year: 2021 },
  ],
  'f2:High cholesterol': [
    { source: 'Arteriosclerosis, Thrombosis & Vasc Biol', year: 2019 },
    { source: 'JAMA Internal Medicine', year: 2020 },
  ],
  'f3:Hypertension (high blood pressure)': [
    { source: 'NEJM', year: 2019 },
    { source: 'Circulation', year: 2020 },
    { source: 'AHA Scientific Statement', year: 2021 },
  ],
  'f3:Type 2 Diabetes': [
    { source: 'Diabetes Research Clin Pract', year: 2021 },
  ],
  'f4:High cholesterol': [
    { source: 'Lipids in Health & Disease', year: 2020 },
    { source: 'Am J Clin Nutr', year: 2018 },
  ],
  'f4:Heart failure': [
    { source: 'European Heart Journal', year: 2022 },
  ],
  'f5:Type 2 Diabetes': [
    { source: 'Diabetologia', year: 2020 },
    { source: 'Nutrients', year: 2021 },
  ],
  'f5:Chronic kidney disease (CKD)': [
    { source: 'JASN', year: 2019 },
    { source: 'Kidney Int Reports', year: 2020 },
  ],
  'f6:Depression': [
    { source: 'Lancet Psychiatry', year: 2019 },
    { source: 'Nutrients', year: 2022 },
  ],
  'f7:IBS': [
    { source: 'Gastroenterology', year: 2020 },
    { source: 'Gut', year: 2021 },
  ],
  'f8:Hypothyroidism': [
    { source: 'Thyroid', year: 2020 },
    { source: 'J Clin Endocrinology', year: 2019 },
  ],
  'f9:Osteoarthritis': [
    { source: 'Arthritis & Rheumatology', year: 2021 },
    { source: 'Nutrients', year: 2020 },
  ],
  'f10:Type 2 Diabetes': [
    { source: 'Diabetes Care', year: 2022 },
    { source: 'Am J Clin Nutr', year: 2020 },
  ],
  'f11:Hypertension (high blood pressure)': [
    { source: 'NEJM', year: 2020 },
  ],
  'f12:Heart failure': [
    { source: 'JACC', year: 2021 },
  ],
  'f13:High cholesterol': [
    { source: 'Am J Clin Nutr', year: 2019 },
    { source: 'European J Nutr', year: 2020 },
  ],
  'f14:Depression': [
    { source: 'Nutrients', year: 2021 },
    { source: 'Biological Psychiatry', year: 2020 },
  ],
};

// ── Foods ──────────────────────────────────────────────────────────────────────
export const foods = [
  {
    id: 'f1',
    name: 'Salmon',
    photo: 'https://picsum.photos/seed/salmon/400/300',
    category: 'Fish',
    signal: 'helpful',
    matchedConditions: ['Type 2 Diabetes', 'Hypertension (high blood pressure)', 'Heart failure'],
    referenceCount: 5,
  },
  {
    id: 'f2',
    name: 'Broccoli',
    photo: 'https://picsum.photos/seed/broccoli/400/300',
    category: 'Vegetables',
    signal: 'helpful',
    matchedConditions: ['Type 2 Diabetes', 'High cholesterol', 'Hypertension (high blood pressure)'],
    referenceCount: 4,
  },
  {
    id: 'f3',
    name: 'Blueberries',
    photo: 'https://picsum.photos/seed/blueberries/400/300',
    category: 'Fruits',
    signal: 'helpful',
    matchedConditions: ['Hypertension (high blood pressure)', 'Type 2 Diabetes', 'Heart failure'],
    referenceCount: 4,
  },
  {
    id: 'f4',
    name: 'Lentils',
    photo: 'https://picsum.photos/seed/lentils/400/300',
    category: 'Legumes',
    signal: 'helpful',
    matchedConditions: ['High cholesterol', 'Type 2 Diabetes', 'Heart failure'],
    referenceCount: 3,
  },
  {
    id: 'f5',
    name: 'Walnuts',
    photo: 'https://picsum.photos/seed/walnuts/400/300',
    category: 'Nuts & Seeds',
    signal: 'helpful',
    matchedConditions: ['Type 2 Diabetes', 'Chronic kidney disease (CKD)', 'High cholesterol'],
    referenceCount: 4,
  },
  {
    id: 'f6',
    name: 'Spinach',
    photo: 'https://picsum.photos/seed/spinach/400/300',
    category: 'Vegetables',
    signal: 'helpful',
    matchedConditions: ['Depression', 'Hypertension (high blood pressure)', 'Osteoarthritis'],
    referenceCount: 3,
  },
  {
    id: 'f7',
    name: 'Oats',
    photo: 'https://picsum.photos/seed/oats/400/300',
    category: 'Grains',
    signal: 'helpful',
    matchedConditions: ['High cholesterol', 'Type 2 Diabetes', 'Irritable bowel syndrome (IBS)'],
    referenceCount: 3,
  },
  {
    id: 'f8',
    name: 'Brazil Nuts',
    photo: 'https://picsum.photos/seed/brazilnuts/400/300',
    category: 'Nuts & Seeds',
    signal: 'helpful',
    matchedConditions: ['Hypothyroidism'],
    referenceCount: 2,
  },
  {
    id: 'f9',
    name: 'Ginger',
    photo: 'https://picsum.photos/seed/ginger/400/300',
    category: 'Spices & Herbs',
    signal: 'helpful',
    matchedConditions: ['Osteoarthritis', 'Irritable bowel syndrome (IBS)'],
    referenceCount: 3,
  },
  {
    id: 'f10',
    name: 'Avocado',
    photo: 'https://picsum.photos/seed/avocado/400/300',
    category: 'Fruits',
    signal: 'helpful',
    matchedConditions: ['Type 2 Diabetes', 'High cholesterol', 'Heart failure'],
    referenceCount: 3,
  },
  {
    id: 'f11',
    name: 'Beets',
    photo: 'https://picsum.photos/seed/beets/400/300',
    category: 'Vegetables',
    signal: 'helpful',
    matchedConditions: ['Hypertension (high blood pressure)', 'Heart failure'],
    referenceCount: 2,
  },
  {
    id: 'f12',
    name: 'Dark Chocolate (70%+)',
    photo: 'https://picsum.photos/seed/darkchoc/400/300',
    category: 'Antioxidants',
    signal: 'helpful',
    matchedConditions: ['Heart failure', 'Hypertension (high blood pressure)'],
    referenceCount: 2,
  },
  {
    id: 'f13',
    name: 'Flaxseeds',
    photo: 'https://picsum.photos/seed/flaxseed/400/300',
    category: 'Nuts & Seeds',
    signal: 'helpful',
    matchedConditions: ['High cholesterol', 'Hypertension (high blood pressure)', 'Heart failure'],
    referenceCount: 3,
  },
  {
    id: 'f14',
    name: 'Fermented Foods',
    photo: 'https://picsum.photos/seed/fermented/400/300',
    category: 'Dairy',
    signal: 'helpful',
    matchedConditions: ['Depression', 'Irritable bowel syndrome (IBS)'],
    referenceCount: 3,
  },
  // Avoid foods
  {
    id: 'f20',
    name: 'Processed Deli Meats',
    photo: 'https://picsum.photos/seed/delimeat/400/300',
    category: 'Processed',
    signal: 'avoid',
    matchedConditions: ['Hypertension (high blood pressure)', 'Heart failure', 'High cholesterol'],
    referenceCount: 4,
  },
  {
    id: 'f21',
    name: 'High-Sodium Canned Soups',
    photo: 'https://picsum.photos/seed/cannedsoup/400/300',
    category: 'Processed',
    signal: 'avoid',
    matchedConditions: ['Hypertension (high blood pressure)', 'Chronic kidney disease (CKD)', 'Heart failure'],
    referenceCount: 3,
  },
  {
    id: 'f22',
    name: 'Sugary Beverages',
    photo: 'https://picsum.photos/seed/sugarydrink/400/300',
    category: 'Beverages',
    signal: 'avoid',
    matchedConditions: ['Type 2 Diabetes', 'High cholesterol', 'Hypertension (high blood pressure)'],
    referenceCount: 5,
  },
  {
    id: 'f23',
    name: 'White Bread',
    photo: 'https://picsum.photos/seed/whitebread/400/300',
    category: 'Grains',
    signal: 'avoid',
    matchedConditions: ['Type 2 Diabetes', 'High cholesterol'],
    referenceCount: 3,
  },
];

// ── Recipes ────────────────────────────────────────────────────────────────────
export const recipes = [
  {
    id: 'r1',
    title: 'Herb-Baked Salmon with Roasted Broccoli',
    photo: 'https://picsum.photos/seed/salmonrecipe/400/300',
    sourceName: 'NYT Cooking',
    mealType: 'Dinner',
    healthScore: 95,
    matchedConditions: ['Type 2 Diabetes', 'Hypertension (high blood pressure)', 'Heart failure'],
    ingredients: [
      { name: 'Salmon', signal: 'helpful', matchedConditions: ['Type 2 Diabetes', 'Heart failure'] },
      { name: 'Broccoli', signal: 'helpful', matchedConditions: ['Type 2 Diabetes', 'High cholesterol'] },
      { name: 'Olive Oil', signal: 'helpful', matchedConditions: ['Heart failure'] },
      { name: 'Lemon', signal: 'neutral', matchedConditions: [] },
      { name: 'Garlic', signal: 'helpful', matchedConditions: ['Hypertension (high blood pressure)'] },
    ],
  },
  {
    id: 'r2',
    title: 'Lentil & Spinach Soup',
    photo: 'https://picsum.photos/seed/lentilsoup/400/300',
    sourceName: 'Serious Eats',
    mealType: 'Lunch',
    healthScore: 92,
    matchedConditions: ['High cholesterol', 'Type 2 Diabetes', 'Depression'],
    ingredients: [
      { name: 'Lentils', signal: 'helpful', matchedConditions: ['High cholesterol', 'Type 2 Diabetes'] },
      { name: 'Spinach', signal: 'helpful', matchedConditions: ['Depression'] },
      { name: 'Tomatoes', signal: 'neutral', matchedConditions: [] },
      { name: 'Cumin', signal: 'neutral', matchedConditions: [] },
      { name: 'Olive Oil', signal: 'helpful', matchedConditions: ['Heart failure'] },
    ],
  },
  {
    id: 'r3',
    title: 'Blueberry Walnut Overnight Oats',
    photo: 'https://picsum.photos/seed/overnightoats/400/300',
    sourceName: 'Bon Appétit',
    mealType: 'Breakfast',
    healthScore: 88,
    matchedConditions: ['Type 2 Diabetes', 'Hypertension (high blood pressure)', 'High cholesterol'],
    ingredients: [
      { name: 'Rolled Oats', signal: 'helpful', matchedConditions: ['High cholesterol', 'Type 2 Diabetes'] },
      { name: 'Blueberries', signal: 'helpful', matchedConditions: ['Hypertension (high blood pressure)', 'Type 2 Diabetes'] },
      { name: 'Walnuts', signal: 'helpful', matchedConditions: ['Type 2 Diabetes', 'High cholesterol'] },
      { name: 'Greek Yogurt', signal: 'neutral', matchedConditions: [] },
      { name: 'Honey', signal: 'neutral', matchedConditions: [] },
    ],
  },
  {
    id: 'r4',
    title: 'Avocado & Black Bean Bowl',
    photo: 'https://picsum.photos/seed/avobowl/400/300',
    sourceName: 'Minimalist Baker',
    mealType: 'Lunch',
    healthScore: 86,
    matchedConditions: ['Type 2 Diabetes', 'High cholesterol', 'Heart failure'],
    ingredients: [
      { name: 'Avocado', signal: 'helpful', matchedConditions: ['Type 2 Diabetes', 'High cholesterol'] },
      { name: 'Black Beans', signal: 'helpful', matchedConditions: ['Type 2 Diabetes', 'High cholesterol'] },
      { name: 'Brown Rice', signal: 'neutral', matchedConditions: [] },
      { name: 'Lime', signal: 'neutral', matchedConditions: [] },
      { name: 'Cilantro', signal: 'neutral', matchedConditions: [] },
    ],
  },
  {
    id: 'r5',
    title: 'Ginger-Turmeric Stir-Fry',
    photo: 'https://picsum.photos/seed/stirfry/400/300',
    sourceName: 'Epicurious',
    mealType: 'Dinner',
    healthScore: 84,
    matchedConditions: ['Osteoarthritis', 'Irritable bowel syndrome (IBS)', 'Depression'],
    ingredients: [
      { name: 'Ginger', signal: 'helpful', matchedConditions: ['Osteoarthritis', 'Irritable bowel syndrome (IBS)'] },
      { name: 'Turmeric', signal: 'helpful', matchedConditions: ['Osteoarthritis'] },
      { name: 'Broccoli', signal: 'helpful', matchedConditions: ['Type 2 Diabetes'] },
      { name: 'Tofu', signal: 'neutral', matchedConditions: [] },
      { name: 'Sesame Oil', signal: 'neutral', matchedConditions: [] },
    ],
  },
  {
    id: 'r6',
    title: 'Beet & Flaxseed Salad',
    photo: 'https://picsum.photos/seed/beetsalad/400/300',
    sourceName: 'Food52',
    mealType: 'Lunch',
    healthScore: 90,
    matchedConditions: ['Hypertension (high blood pressure)', 'High cholesterol', 'Heart failure'],
    ingredients: [
      { name: 'Beets', signal: 'helpful', matchedConditions: ['Hypertension (high blood pressure)', 'Heart failure'] },
      { name: 'Flaxseeds', signal: 'helpful', matchedConditions: ['High cholesterol', 'Hypertension (high blood pressure)'] },
      { name: 'Arugula', signal: 'neutral', matchedConditions: [] },
      { name: 'Goat Cheese', signal: 'neutral', matchedConditions: [] },
      { name: 'Balsamic Vinegar', signal: 'neutral', matchedConditions: [] },
    ],
  },
  {
    id: 'r7',
    title: 'Kale & Quinoa Power Bowl',
    photo: 'https://picsum.photos/seed/kalebowl/400/300',
    sourceName: 'Cookie and Kate',
    mealType: 'Lunch',
    healthScore: 93,
    matchedConditions: ['Type 2 Diabetes', 'High cholesterol', 'Hypertension (high blood pressure)'],
    ingredients: [
      { name: 'Kale', signal: 'helpful', matchedConditions: ['High cholesterol', 'Type 2 Diabetes'] },
      { name: 'Quinoa', signal: 'helpful', matchedConditions: ['Type 2 Diabetes'] },
      { name: 'Chickpeas', signal: 'helpful', matchedConditions: ['High cholesterol', 'Type 2 Diabetes'] },
      { name: 'Tahini', signal: 'neutral', matchedConditions: [] },
      { name: 'Lemon', signal: 'neutral', matchedConditions: [] },
    ],
  },
  {
    id: 'r8',
    title: 'Chia Seed Pudding with Berries',
    photo: 'https://picsum.photos/seed/chiapudding/400/300',
    sourceName: 'Minimalist Baker',
    mealType: 'Breakfast',
    healthScore: 87,
    matchedConditions: ['High cholesterol', 'Type 2 Diabetes', 'Heart failure'],
    ingredients: [
      { name: 'Chia Seeds', signal: 'helpful', matchedConditions: ['High cholesterol', 'Heart failure'] },
      { name: 'Almond Milk', signal: 'neutral', matchedConditions: [] },
      { name: 'Strawberries', signal: 'helpful', matchedConditions: ['Type 2 Diabetes'] },
      { name: 'Raspberries', signal: 'helpful', matchedConditions: ['Type 2 Diabetes'] },
      { name: 'Maple Syrup', signal: 'neutral', matchedConditions: [] },
    ],
  },
  {
    id: 'r9',
    title: 'Mediterranean Stuffed Peppers',
    photo: 'https://picsum.photos/seed/stuffedpeppers/400/300',
    sourceName: 'NYT Cooking',
    mealType: 'Dinner',
    healthScore: 82,
    matchedConditions: ['Hypertension (high blood pressure)', 'Type 2 Diabetes', 'High cholesterol'],
    ingredients: [
      { name: 'Bell Peppers', signal: 'helpful', matchedConditions: ['Hypertension (high blood pressure)'] },
      { name: 'Brown Rice', signal: 'neutral', matchedConditions: [] },
      { name: 'Feta Cheese', signal: 'neutral', matchedConditions: [] },
      { name: 'Tomatoes', signal: 'helpful', matchedConditions: ['Type 2 Diabetes'] },
      { name: 'Olive Oil', signal: 'helpful', matchedConditions: ['High cholesterol'] },
    ],
  },
  {
    id: 'r10',
    title: 'Walnut-Crusted Trout with Asparagus',
    photo: 'https://picsum.photos/seed/troutasparagus/400/300',
    sourceName: 'Bon Appétit',
    mealType: 'Dinner',
    healthScore: 91,
    matchedConditions: ['Heart failure', 'High cholesterol', 'Type 2 Diabetes'],
    ingredients: [
      { name: 'Trout', signal: 'helpful', matchedConditions: ['Heart failure', 'High cholesterol'] },
      { name: 'Walnuts', signal: 'helpful', matchedConditions: ['Type 2 Diabetes', 'High cholesterol'] },
      { name: 'Asparagus', signal: 'helpful', matchedConditions: ['Type 2 Diabetes'] },
      { name: 'Lemon', signal: 'neutral', matchedConditions: [] },
      { name: 'Dill', signal: 'neutral', matchedConditions: [] },
    ],
  },
];

// ── Day plans ──────────────────────────────────────────────────────────────────
const helpfulFoods = foods.filter(f => f.signal === 'helpful');

const makeMeal = (slot, foodIds, recipeIds = []) => ({
  slot,
  items: foodIds.map(id => foods.find(f => f.id === id)).filter(Boolean),
  recipes: recipeIds.map(id => recipes.find(r => r.id === id)).filter(Boolean),
});

export const dayPlans = {
  '2026-06-14': {
    date: '2026-06-14',
    meals: [
      makeMeal('Breakfast', ['f7', 'f3'], ['r3']),
      makeMeal('Lunch', ['f6', 'f4'], ['r2']),
      makeMeal('Dinner', ['f1', 'f2'], ['r1']),
      makeMeal('Snack', ['f5', 'f12']),
    ],
  },
  '2026-06-15': {
    date: '2026-06-15',
    meals: [
      makeMeal('Breakfast', ['f7', 'f14'], []),
      makeMeal('Lunch', ['f10', 'f4'], ['r4']),
      makeMeal('Dinner', ['f1', 'f11'], ['r6']),
      makeMeal('Snack', ['f8']),
    ],
  },
  '2026-06-16': {
    date: '2026-06-16',
    meals: [
      makeMeal('Breakfast', ['f3', 'f7'], ['r3']),
      makeMeal('Lunch', ['f2', 'f9'], ['r5']),
      makeMeal('Dinner', ['f5', 'f6'], ['r2']),
      makeMeal('Snack', ['f10', 'f13']),
    ],
  },
};

// ── Lookup: known and unknown examples ────────────────────────────────────────
export const knownFoods = foods;

// A seeded unknown food for testing the {known:false} path
export const unknownFoodNames = ['Oreo', 'Pringles', 'Mountain Dew', 'Twinkies'];
