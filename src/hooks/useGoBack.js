import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Back = where the user actually was (checklist 4.10), not a hardcoded route.
 * `fallback` only applies when there is no in-app history to return to (a
 * deep link or fresh tab — react-router marks that entry with key 'default').
 * @param {string} [fallback]
 * @returns {() => void}
 */
export function useGoBack(fallback = '/app/home') {
  const navigate = useNavigate();
  const { key } = useLocation();
  return useCallback(() => {
    if (key === 'default') navigate(fallback, { replace: true });
    else navigate(-1);
  }, [navigate, key, fallback]);
}
