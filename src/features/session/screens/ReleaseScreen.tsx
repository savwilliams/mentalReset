import { useCallback, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { Card, PrimaryCTA, Screen, SecondaryButton } from '@/components/ui';
import {
  RELEASE_ANIMATION_MS,
  useReleaseQueue,
} from '@/features/session/hooks/useReleaseQueue';
import { useSessionGuard } from '@/features/shell';
import { useSessionActions } from '@/lib/sessionMachine';
import type { Thought } from '@/types/session';

type ReleaseListsSnapshot = {
  releaseList: Thought[];
  canDoWithoutList: Thought[];
};

function ReleaseItemList({
  title,
  items,
  animating,
}: {
  title: string;
  items: Thought[];
  animating: boolean;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="mt-4" aria-label={title}>
      <h3 className="text-[length:var(--font-size-label)] font-medium text-[var(--color-text-secondary)]">
        {title}
      </h3>
      <ul className="mt-2 flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {items.map((thought) => (
            <motion.li
              key={thought.id}
              layout={!animating}
              initial={false}
              animate={
                animating
                  ? { opacity: 0, filter: 'blur(6px)', y: 8 }
                  : { opacity: 1, filter: 'blur(0px)', y: 0 }
              }
              exit={{ opacity: 0, filter: 'blur(6px)', y: 8 }}
              transition={{
                duration: RELEASE_ANIMATION_MS / 1000,
                ease: 'easeOut',
              }}
            >
              <Card>
                <p className="text-[var(--color-text-primary)]">{thought.text}</p>
              </Card>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}

export function ReleaseScreen() {
  const { requestAbandon } = useSessionGuard();
  const { continue: continueSession, isTransitioning } = useSessionActions();
  const prefersReducedMotion = useReducedMotion();
  const {
    releaseList,
    canDoWithoutList,
    hasItemsToRelease,
    canContinue,
    releaseAll,
  } = useReleaseQueue();

  const [animatingOut, setAnimatingOut] = useState<ReleaseListsSnapshot | null>(null);
  const [hasReleased, setHasReleased] = useState(false);

  const displayReleaseList = animatingOut?.releaseList ?? releaseList;
  const displayCanDoWithoutList = animatingOut?.canDoWithoutList ?? canDoWithoutList;
  const showingItems =
    displayReleaseList.length > 0 || displayCanDoWithoutList.length > 0;

  const handleContinue = useCallback(() => {
    if (!canContinue || animatingOut) {
      return;
    }
    void continueSession();
  }, [animatingOut, canContinue, continueSession]);

  const handleReleaseAll = useCallback(() => {
    if (!hasItemsToRelease || animatingOut || isTransitioning) {
      return;
    }

    const snapshot: ReleaseListsSnapshot = {
      releaseList: [...releaseList],
      canDoWithoutList: [...canDoWithoutList],
    };

    // Discard immediately so interrupted animation still leaves content gone.
    releaseAll();
    setHasReleased(true);

    if (prefersReducedMotion) {
      return;
    }

    setAnimatingOut(snapshot);
    window.setTimeout(() => {
      setAnimatingOut(null);
    }, RELEASE_ANIMATION_MS);
  }, [
    animatingOut,
    canDoWithoutList,
    hasItemsToRelease,
    isTransitioning,
    prefersReducedMotion,
    releaseAll,
    releaseList,
  ]);

  return (
    <Screen
      title="Mental Reset"
      footer={
        <PrimaryCTA
          type="button"
          onClick={handleContinue}
          disabled={isTransitioning || !canContinue || Boolean(animatingOut)}
        >
          Continue
        </PrimaryCTA>
      }
    >
      <h2 className="text-[length:var(--font-size-heading)] font-medium text-[var(--color-text-primary)]">
        Release
      </h2>
      <p className="mt-2 text-[var(--color-text-secondary)]">
        Some thoughts do not need to stay with you. Let them go.
      </p>

      {showingItems ? (
        <>
          <ReleaseItemList
            title="Release list"
            items={displayReleaseList}
            animating={Boolean(animatingOut)}
          />
          <ReleaseItemList
            title="Can Do Without"
            items={displayCanDoWithoutList}
            animating={Boolean(animatingOut)}
          />

          {hasItemsToRelease ? (
            <SecondaryButton
              type="button"
              className="mt-[var(--spacing-section)]"
              onClick={handleReleaseAll}
              disabled={isTransitioning || Boolean(animatingOut)}
            >
              Release All
            </SecondaryButton>
          ) : null}
        </>
      ) : (
        <p className="mt-[var(--spacing-section)] text-[var(--color-text-secondary)]">
          {hasReleased
            ? 'These thoughts have been released. Continue when you are ready.'
            : 'Nothing to release right now. Continue when you are ready.'}
        </p>
      )}

      <SecondaryButton
        type="button"
        className="mt-[var(--spacing-section)]"
        onClick={() => requestAbandon()}
        disabled={isTransitioning}
      >
        Leave session
      </SecondaryButton>
    </Screen>
  );
}
