import { useEffect, useRef } from 'react';

let lockCount = 0;
let savedOverflow = null;

function lockBodyScroll() {
  if (typeof document === 'undefined' || !document.body) {
    return;
  }
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;
}

function unlockBodyScroll() {
  if (typeof document === 'undefined' || !document.body) {
    return;
  }
  if (lockCount === 0) {
    return;
  }
  lockCount -= 1;
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow ?? '';
    savedOverflow = null;
  }
}

export function useBodyScrollLock(active) {
  const lockedRef = useRef(false);

  useEffect(() => {
    if (active && !lockedRef.current) {
      lockBodyScroll();
      lockedRef.current = true;
    } else if (!active && lockedRef.current) {
      unlockBodyScroll();
      lockedRef.current = false;
    }

    return () => {
      if (lockedRef.current) {
        unlockBodyScroll();
        lockedRef.current = false;
      }
    };
  }, [active]);
}
