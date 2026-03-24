const HAS_SEEN_ONBOARDING_KEY = "hasSeenOnboarding";
const ONBOARDING_ACTIVE_KEY = "onboardingActive";
const ONBOARDING_PAGE_PREFIX = "onboardingPageSeen:";

const REQUIRED_ONBOARDING_PAGES = [
  "investor-dashboard",
  "demande-verification",
  "demande-start",
  "demande-documents",
  "demande-cadastre",
] as const;

const hasWindow = () => typeof window !== "undefined";

export const getHasSeenOnboarding = (): boolean => {
  if (!hasWindow()) return false;
  return window.localStorage.getItem(HAS_SEEN_ONBOARDING_KEY) === "true";
};

export const setHasSeenOnboarding = (value: boolean): void => {
  if (!hasWindow()) return;
  window.localStorage.setItem(HAS_SEEN_ONBOARDING_KEY, String(value));
};

export const getOnboardingActive = (): boolean => {
  if (!hasWindow()) return false;
  return window.localStorage.getItem(ONBOARDING_ACTIVE_KEY) === "true";
};

export const setOnboardingActive = (value: boolean): void => {
  if (!hasWindow()) return;
  window.localStorage.setItem(ONBOARDING_ACTIVE_KEY, String(value));
};

export const getOnboardingPageSeen = (pageKey: string): boolean => {
  if (!hasWindow()) return false;
  return window.localStorage.getItem(`${ONBOARDING_PAGE_PREFIX}${pageKey}`) === "true";
};

export const setOnboardingPageSeen = (pageKey: string, value: boolean): void => {
  if (!hasWindow()) return;
  window.localStorage.setItem(`${ONBOARDING_PAGE_PREFIX}${pageKey}`, String(value));
};

export const markOnboardingPageCompleted = (pageKey: string): void => {
  setOnboardingPageSeen(pageKey, true);

  if (!hasWindow()) return;

  const allCompleted = REQUIRED_ONBOARDING_PAGES.every((requiredKey) =>
    getOnboardingPageSeen(requiredKey),
  );

  if (allCompleted) {
    setHasSeenOnboarding(true);
    setOnboardingActive(false);
  }
};

export const resetOnboardingPages = (): void => {
  if (!hasWindow()) return;
  REQUIRED_ONBOARDING_PAGES.forEach((pageKey) => {
    window.localStorage.removeItem(`${ONBOARDING_PAGE_PREFIX}${pageKey}`);
  });
};

export const stopOnboardingForever = (): void => {
  setOnboardingActive(false);
  setHasSeenOnboarding(true);
};
