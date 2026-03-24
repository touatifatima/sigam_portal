import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import styles from "./OnboardingTour.module.css";

export type OnboardingStep = {
  id: string;
  target: string;
  title: string;
  description: string;
  placement?: "top" | "bottom" | "left" | "right" | "auto";
};

type OnboardingTourProps = {
  isOpen: boolean;
  steps: OnboardingStep[];
  onClose: () => void;
  onComplete: () => void;
};

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const TOOLTIP_WIDTH = 360;
const TOOLTIP_HEIGHT = 220;
const VIEWPORT_GAP = 16;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const rectFromElement = (element: Element): Rect => {
  const box = element.getBoundingClientRect();
  return {
    top: box.top,
    left: box.left,
    width: box.width,
    height: box.height,
  };
};

const computeTooltipPosition = (
  rect: Rect | null,
  placement: OnboardingStep["placement"],
): { top: number; left: number } => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (!rect) {
    return {
      top: clamp((viewportHeight - TOOLTIP_HEIGHT) / 2, VIEWPORT_GAP, viewportHeight - TOOLTIP_HEIGHT - VIEWPORT_GAP),
      left: clamp((viewportWidth - TOOLTIP_WIDTH) / 2, VIEWPORT_GAP, viewportWidth - TOOLTIP_WIDTH - VIEWPORT_GAP),
    };
  }

  const prefer = placement === "auto" || !placement ? "bottom" : placement;
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const offset = 18;

  const positions = {
    top: {
      top: rect.top - TOOLTIP_HEIGHT - offset,
      left: centerX - TOOLTIP_WIDTH / 2,
    },
    bottom: {
      top: rect.top + rect.height + offset,
      left: centerX - TOOLTIP_WIDTH / 2,
    },
    left: {
      top: centerY - TOOLTIP_HEIGHT / 2,
      left: rect.left - TOOLTIP_WIDTH - offset,
    },
    right: {
      top: centerY - TOOLTIP_HEIGHT / 2,
      left: rect.left + rect.width + offset,
    },
  };

  const order: Array<"top" | "bottom" | "left" | "right"> =
    prefer === "top"
      ? ["top", "bottom", "right", "left"]
      : prefer === "left"
      ? ["left", "right", "bottom", "top"]
      : prefer === "right"
      ? ["right", "left", "bottom", "top"]
      : ["bottom", "top", "right", "left"];

  const fits = (candidate: { top: number; left: number }) =>
    candidate.top >= VIEWPORT_GAP &&
    candidate.left >= VIEWPORT_GAP &&
    candidate.top + TOOLTIP_HEIGHT <= viewportHeight - VIEWPORT_GAP &&
    candidate.left + TOOLTIP_WIDTH <= viewportWidth - VIEWPORT_GAP;

  const best = order.map((key) => positions[key]).find(fits) ?? positions[order[0]];

  return {
    top: clamp(best.top, VIEWPORT_GAP, viewportHeight - TOOLTIP_HEIGHT - VIEWPORT_GAP),
    left: clamp(best.left, VIEWPORT_GAP, viewportWidth - TOOLTIP_WIDTH - VIEWPORT_GAP),
  };
};

export function OnboardingTour({ isOpen, steps, onClose, onComplete }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);

  const currentStep = steps[stepIndex];
  const totalSteps = steps.length;

  const updateTargetRect = useCallback(() => {
    if (!currentStep) {
      setTargetRect(null);
      return;
    }
    const target = document.querySelector(currentStep.target);
    if (!target) {
      setTargetRect(null);
      return;
    }
    setTargetRect(rectFromElement(target));
  }, [currentStep]);

  useEffect(() => {
    if (!isOpen) return;
    setStepIndex(0);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateTargetRect();
    window.addEventListener("resize", updateTargetRect);
    window.addEventListener("scroll", updateTargetRect, true);

    return () => {
      window.removeEventListener("resize", updateTargetRect);
      window.removeEventListener("scroll", updateTargetRect, true);
    };
  }, [isOpen, updateTargetRect]);

  useEffect(() => {
    if (!isOpen || !currentStep) return;
    const target = document.querySelector(currentStep.target);
    if (!target) {
      setTargetRect(null);
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    const timer = window.setTimeout(() => {
      updateTargetRect();
    }, 260);
    return () => window.clearTimeout(timer);
  }, [currentStep, isOpen, updateTargetRect]);

  const tooltipPosition = useMemo(() => {
    if (!isOpen) return { top: 0, left: 0 };
    return computeTooltipPosition(targetRect, currentStep?.placement ?? "auto");
  }, [currentStep?.placement, isOpen, targetRect]);

  const goNext = () => {
    if (stepIndex >= totalSteps - 1) {
      onComplete();
      return;
    }
    setStepIndex((prev) => prev + 1);
  };

  const goPrev = () => {
    setStepIndex((prev) => Math.max(0, prev - 1));
  };

  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && currentStep && (
        <motion.div
          className={styles.root}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className={styles.overlay} />

          {targetRect && (
            <motion.div
              className={styles.highlight}
              initial={false}
              animate={{
                top: targetRect.top - 8,
                left: targetRect.left - 8,
                width: targetRect.width + 16,
                height: targetRect.height + 16,
              }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            />
          )}

          <motion.div
            className={styles.tooltip}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              top: tooltipPosition.top,
              left: tooltipPosition.left,
            }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-label="Guide d'utilisation"
          >
            <button className={styles.close} onClick={onClose} aria-label="Fermer le guide">
              <X size={16} />
            </button>

            <div className={styles.counter}>
              Etape {stepIndex + 1}/{totalSteps}
            </div>
            <h3 className={styles.title}>{currentStep.title}</h3>
            <p className={styles.description}>{currentStep.description}</p>

            <div className={styles.actions}>
              <button className={styles.secondary} onClick={onClose}>
                Fermer
              </button>
              <div className={styles.rightActions}>
                <button className={styles.secondary} onClick={goPrev} disabled={stepIndex === 0}>
                  Precedent
                </button>
                <button className={styles.primary} onClick={goNext}>
                  {stepIndex === totalSteps - 1 ? "Terminer" : "Suivant"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

