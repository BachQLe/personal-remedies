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
  'btn btn-primary btn-sm ' +
  'active:scale-[0.98]';

export default function ProfileSetupAction({ label = 'Set up profile' }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate('/app/profile')} className={BTN_CLS}>
      {label}
    </button>
  );
}
