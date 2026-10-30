import { useEffect, useState } from 'react';

const QUERY = '(max-width: 639px)'; // below Tailwind's `sm`

export const isPhoneNow = () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches;

// Phone-width viewport, tracked live so rotating a phone or resizing a window switches layouts without a reload.
export default function useIsPhone() {
  const [isPhone, setIsPhone] = useState(isPhoneNow);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setIsPhone(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isPhone;
}
