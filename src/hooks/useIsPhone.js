import { useState } from 'react';

function detectPhone() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
    navigator.userAgent
  );
}

export default function useIsPhone() {
  const [isPhone] = useState(detectPhone);
  return isPhone;
}
