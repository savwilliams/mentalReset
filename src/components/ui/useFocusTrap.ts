import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(active: boolean, containerRef: RefObject<HTMLElement | null>): void {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const getFocusableElements = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => !element.hasAttribute('disabled') && element.tabIndex !== -1,
      );

    const focusableElements = getFocusableElements();
    focusableElements[0]?.focus();

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Tab') {
        return;
      }

      const elements = getFocusableElements();
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }

      event.preventDefault();

      const currentIndex = elements.indexOf(document.activeElement as HTMLElement);
      const activeIndex = currentIndex === -1 ? 0 : currentIndex;

      if (event.shiftKey) {
        const previousIndex = activeIndex <= 0 ? elements.length - 1 : activeIndex - 1;
        elements[previousIndex]?.focus();
        return;
      }

      const nextIndex = activeIndex >= elements.length - 1 ? 0 : activeIndex + 1;
      elements[nextIndex]?.focus();
    }

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [active, containerRef]);
}
