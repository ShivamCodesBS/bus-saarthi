import { useEffect, useRef } from 'react';

/**
 * Module-level lock counter so stacked/overlapping modals restore the
 * background scroll only when the LAST one closes (a plain toggle here
 * would leave the page permanently locked when a second modal closed).
 */
let lockCount = 0;

/**
 * Shared modal behaviour for every popup in the app:
 *  - locks the background scroll while open (the page used to scroll
 *    behind every popup);
 *  - pauses the global Lenis smooth-scroller, which otherwise swallows
 *    wheel events aimed at the modal itself;
 *  - closes on Escape.
 *
 * @param {boolean} active  whether the modal is currently open
 * @param {Function} onClose  called when Escape is pressed
 */
export function useModalA11y(active, onClose) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;

    lockCount += 1;
    const lenis = window.__lenis;
    if (lockCount === 1) {
      document.body.style.overflow = 'hidden';
      lenis?.stop?.();
    }

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        document.body.style.overflow = '';
        lenis?.start?.();
      }
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [active]);
}
