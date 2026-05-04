type GrecaptchaClient = {
  ready: (callback: () => void) => void;
  execute: (
    siteKey: string,
    options: {
      action: string;
    },
  ) => Promise<string>;
};

declare global {
  interface Window {
    grecaptcha?: GrecaptchaClient;
  }
}

const RECAPTCHA_SCRIPT_ATTR = 'data-recaptcha-v3';
let scriptReadyPromise: Promise<void> | null = null;

function getRecaptchaSiteKey() {
  return (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '').trim();
}

function waitForRecaptchaReady(grecaptcha: GrecaptchaClient) {
  return new Promise<void>((resolve) => {
    grecaptcha.ready(() => resolve());
  });
}

async function ensureRecaptchaLoaded(siteKey: string) {
  if (typeof window === 'undefined') {
    throw new Error('reCAPTCHA est disponible uniquement dans le navigateur.');
  }

  if (window.grecaptcha) {
    await waitForRecaptchaReady(window.grecaptcha);
    return;
  }

  if (!scriptReadyPromise) {
    scriptReadyPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        `script[${RECAPTCHA_SCRIPT_ATTR}="true"]`,
      );
      const script = existingScript || document.createElement('script');

      const onLoad = () => {
        if (!window.grecaptcha) {
          reject(new Error("Chargement reCAPTCHA invalide (grecaptcha indisponible)."));
          return;
        }

        void waitForRecaptchaReady(window.grecaptcha).then(resolve).catch(reject);
      };

      const onError = () => {
        reject(new Error("Impossible de charger le service reCAPTCHA."));
      };

      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', onError, { once: true });

      if (!existingScript) {
        script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
        script.async = true;
        script.defer = true;
        script.setAttribute(RECAPTCHA_SCRIPT_ATTR, 'true');
        document.head.appendChild(script);
      }
    }).catch((error) => {
      scriptReadyPromise = null;
      throw error;
    });
  }

  await scriptReadyPromise;
}

export async function executeRecaptcha(action: string) {
  const siteKey = getRecaptchaSiteKey();
  if (!siteKey) {
    throw new Error(
      'Configuration reCAPTCHA manquante (NEXT_PUBLIC_RECAPTCHA_SITE_KEY).',
    );
  }

  await ensureRecaptchaLoaded(siteKey);

  if (!window.grecaptcha) {
    throw new Error("Service reCAPTCHA indisponible. Merci de reessayer.");
  }

  const token = await window.grecaptcha.execute(siteKey, { action });
  if (!token) {
    throw new Error("Echec de verification reCAPTCHA. Merci de reessayer.");
  }

  return token;
}

export function preloadRecaptcha() {
  const siteKey = getRecaptchaSiteKey();
  if (!siteKey || typeof window === 'undefined') {
    return;
  }

  void ensureRecaptchaLoaded(siteKey).catch(() => undefined);
}
