import { useCallback, useRef, useState } from 'react';
import { buildRecipeDetail } from '../../api/api.js';

const NO_CONDITIONS = [];

/**
 * Open FoodDetailCard for a favorite / plan item: seed it at once, then fill in
 * the per-condition detail. Recipes only get the full seed; anything else
 * (an old plan's plain food) opens with just its name and image.
 * @param {string[]} [conditions] - condition names to show on the seed card (stable reference)
 * @returns {{ detail: Object|null, open: (item: Object) => void, close: () => void }}
 */
export function useRecipeDetail(conditions = NO_CONDITIONS) {
  const [detail, setDetail] = useState(null);
  const latest = useRef(0);

  const open = useCallback((item) => {
    const token = ++latest.current;
    if (item.kind !== 'recipe') {
      setDetail({ foodId: item.id, name: item.name, image: item.image });
      return;
    }
    const seed = {
      foodId: item.id,
      name: item.name,
      image: item.image,
      sourceName: item.sourceName ?? null,
      sourceUrl: item.sourceUrl ?? null,
      attribution: item.attribution ?? null,
      nutritionPerServing: item.nutritionPerServing ?? null,
      conditions,
      ingredients: item.ingredients ?? [],
      isRecipe: true,
    };
    setDetail(seed);
    buildRecipeDetail(seed)
      .then((full) => { if (latest.current === token) setDetail({ ...full, isRecipe: true }); })
      .catch(() => {});
  }, [conditions]);

  const close = useCallback(() => {
    latest.current += 1;
    setDetail(null);
  }, []);

  return { detail, open, close };
}
