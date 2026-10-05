/**
 * ProfileSetupAction — the CTA button for DataState's 'empty-no-profile'
 * status across the Suggestions screens. Navigates to /app/profile
 * (ProfileScreen), which owns condition editing (see its "Your conditions"
 * section) so this is always a safe target even in the rare/edge case that
 * produced 'empty-no-profile' (profile cleared mid-session — see
 * profileFallback.js).
 */
import { useNavigate } from 'react-router-dom';

const BTN_CLS =
  'px-5 py-2.5 rounded-xs bg-forest-700 text-white text-sm font-semibold font-sans ' +
  'transition-all duration-fast ease-ds-out hover:bg-forest-800 active:scale-[0.98]';

export default function ProfileSetupAction({ label = 'Set up profile' }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate('/app/profile')} className={BTN_CLS}>
      {label}
    </button>
  );
}
