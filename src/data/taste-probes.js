/**
 * @typedef {'american'|'italian'|'mexican'|'east_asian'|'se_asian'|'south_asian'|'mediterranean'|'middle_eastern'} Cuisine
 *
 * @typedef {Object} TasteProbe
 * @property {string} id
 * @property {string} name
 * @property {Cuisine} cuisine
 * @property {number} spice         0 = mild → 1 = hot
 * @property {number} plantForward  -1 = meat-centric, 0 = neutral, +1 = plant/veg
 * @property {number} sweetness     0 = savory → 1 = dessert-sweet
 * @property {boolean} seafood
 * @property {string} image
 * @property {string} color
 * @property {string} description
 */

// TODO: `spice` values are hand-set. When wiring the real API, spice MUST be
// derived from recipe ingredients (chili, jalapeño, cayenne, gochujang, harissa,
// etc.) because Edamam/recipe metadata does not expose a heat level.

/** @type {TasteProbe[]} */
export const TASTE_PROBES = [
  { id: 'pancakes',  name: 'Blueberry Pancakes',   cuisine: 'american',       spice: 0.00, plantForward:  0.0, sweetness: 1.00, seafood: false, image: 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=600&h=400&fit=crop', color: '#8B6CC1', description: 'Fluffy buttermilk pancakes with blueberries, butter, maple syrup' },
  { id: 'shakshuka', name: 'Shakshuka',            cuisine: 'middle_eastern', spice: 0.40, plantForward:  0.5, sweetness: 0.15, seafood: false, image: 'https://images.unsplash.com/photo-1590947132387-155cc02f3212?w=600&h=400&fit=crop', color: '#C4552A', description: 'Eggs poached in a cumin-spiced tomato-and-pepper sauce' },
  { id: 'carbonara', name: 'Spaghetti Carbonara',  cuisine: 'italian',        spice: 0.00, plantForward: -1.0, sweetness: 0.05, seafood: false, image: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=600&h=400&fit=crop', color: '#D4A84A', description: 'Egg, pecorino, guanciale and black pepper over spaghetti' },
  { id: 'tacos',     name: 'Carne Asada Tacos',    cuisine: 'mexican',        spice: 0.50, plantForward: -1.0, sweetness: 0.10, seafood: false, image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=600&h=400&fit=crop', color: '#8B6E3A', description: 'Grilled lime-marinated beef with onion, cilantro, salsa' },
  { id: 'kfc',       name: 'Korean Fried Chicken', cuisine: 'east_asian',     spice: 0.90, plantForward: -1.0, sweetness: 0.60, seafood: false, image: 'https://images.unsplash.com/photo-1575932444877-5106bee2a599?w=600&h=400&fit=crop', color: '#B5452A', description: 'Double-fried chicken glazed in sticky gochujang-garlic sauce' },
  { id: 'padthai',   name: 'Shrimp Pad Thai',      cuisine: 'se_asian',       spice: 0.40, plantForward: -1.0, sweetness: 0.55, seafood: true,  image: 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=600&h=400&fit=crop', color: '#C9553A', description: 'Rice noodles with shrimp, peanuts, lime, and tamarind sauce' },
  { id: 'greek',     name: 'Greek Salad',          cuisine: 'mediterranean',  spice: 0.00, plantForward:  1.0, sweetness: 0.10, seafood: false, image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=600&h=400&fit=crop', color: '#5A8C5E', description: 'Tomato, cucumber, red onion, olives and feta in olive oil' },
  { id: 'chana',     name: 'Chana Masala',         cuisine: 'south_asian',    spice: 0.50, plantForward:  1.0, sweetness: 0.15, seafood: false, image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&h=400&fit=crop', color: '#C9973A', description: 'Chickpeas simmered in a tomato, onion and garam-masala sauce' },
  { id: 'burger',    name: 'Cheeseburger',         cuisine: 'american',       spice: 0.05, plantForward: -1.0, sweetness: 0.15, seafood: false, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=400&fit=crop', color: '#D4722A', description: 'Grilled beef patty with melted cheese, lettuce, tomato, pickle' },
  { id: 'wings',     name: 'Buffalo Wings',        cuisine: 'american',       spice: 0.80, plantForward: -1.0, sweetness: 0.10, seafood: false, image: 'https://images.unsplash.com/photo-1608039755401-742074f0548d?w=600&h=400&fit=crop', color: '#B5452A', description: 'Crispy chicken wings tossed in spicy buffalo sauce' },
];
