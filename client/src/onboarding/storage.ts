const HAS_SEEN_ONBOARDING_KEY = "hasSeenOnboarding";
const ONBOARDING_ACTIVE_KEY = "onboardingActive";
const ONBOARDING_PAGE_PREFIX = "onboardingPageSeen:";

const INVESTOR_ONBOARDING_PAGES = [
  "investor-dashboard",
  "demande-verification",
  "demande-start",
  "demande-documents",
  "demande-cadastre",
] as const;

const CADASTRE_ONBOARDING_PAGES = [
  "cadastre-dashboard",
  "demande-verification",
] as const;

const ONBOARDING_FLOWS = [
  INVESTOR_ONBOARDING_PAGES,
  CADASTRE_ONBOARDING_PAGES,
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

  const allCompleted = ONBOARDING_FLOWS.some((requiredPages) =>
    requiredPages.every((requiredKey) => getOnboardingPageSeen(requiredKey)),
  );

  if (allCompleted) {
    setHasSeenOnboarding(true);
    setOnboardingActive(false);
  }
};

export const resetOnboardingPages = (): void => {
  if (!hasWindow()) return;
  const uniquePages = new Set(ONBOARDING_FLOWS.flat());
  uniquePages.forEach((pageKey) => {
    window.localStorage.removeItem(`${ONBOARDING_PAGE_PREFIX}${pageKey}`);
  });
};

export const stopOnboardingForever = (): void => {
  setOnboardingActive(false);
  setHasSeenOnboarding(true);
};
