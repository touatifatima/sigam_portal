'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Navbar from '../navbar/Navbar';
import Sidebar from '../sidebar/Sidebar';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Loader2,
  QrCode,
  Search,
} from 'lucide-react';
import { useViewNavigator } from '@/src/hooks/useViewNavigator';
import { useAuthStore } from '@/src/store/useAuthStore';
import { getDefaultDashboardPath, isAdminRole } from '@/src/utils/roleNavigation';
import styles from './OperatorQrAccess.module.css';

type AccessContext = {
  mode: 'LOGIN' | 'FIRST_ACCESS';
  permit: {
    id: number;
    short_code: string | null;
    code_permis: string | null;
    qr_code: string | null;
  };
  detenteur?: {
    nom: string | null;
    email: string | null;
    telephone: string | null;
  } | null;
  operator?: {
    id: number;
    email: string;
    nom: string;
    Prenom: string;
    role: string | null;
  } | null;
};

type LookupStatus = 'idle' | 'searching' | 'found' | 'error';
type CameraStatus = 'inactive' | 'starting' | 'active' | 'unsupported' | 'error';

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorCtorLike = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

const getBarcodeDetectorCtor = (): BarcodeDetectorCtorLike | null => {
  if (typeof window === 'undefined') return null;
  return ((window as any).BarcodeDetector as BarcodeDetectorCtorLike | undefined) || null;
};

const normalizeCodeQr = (value: string): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    const fromQuery =
      parsed.searchParams.get('codeqr') ||
      parsed.searchParams.get('code_permis') ||
      parsed.searchParams.get('code');
    if (fromQuery) return String(fromQuery).trim();

    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop() || '';
    return String(lastSegment || raw).trim();
  } catch {
    return raw;
  }
};

const buildRedirectPath = (context: AccessContext, codeqr: string) => {
  const safeCode = encodeURIComponent(codeqr);
  if (context.mode === 'LOGIN') {
    return `/operateur/dashboard?codeqr=${safeCode}&open=permit`;
  }
  return `/operateur/access?codeqr=${safeCode}`;
};

export default function OperatorQrScanPage() {
  const router = useRouter();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;
  const { auth } = useAuthStore();
  const { currentView, navigateTo } = useViewNavigator('operateur_scan_qr');
  const showSidebar = useMemo(() => isAdminRole(auth?.role), [auth?.role]);
  const dashboardPath = useMemo(() => getDefaultDashboardPath(auth?.role), [auth?.role]);

  const [inputValue, setInputValue] = useState('');
  const [autoOpen, setAutoOpen] = useState(true);
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle');
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('inactive');
  const [message, setMessage] = useState('');
  const [context, setContext] = useState<AccessContext | null>(null);
  const [resolvedCodeQr, setResolvedCodeQr] = useState('');
  const [opening, setOpening] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const detectLockRef = useRef(false);

  const statusLabel = useMemo(() => {
    if (lookupStatus === 'searching') return 'Recherche...';
    if (lookupStatus === 'found') return 'Trouve';
    if (lookupStatus === 'error') return 'Erreur';
    return 'En attente';
  }, [lookupStatus]);

  const cameraMessage = useMemo(() => {
    if (cameraStatus === 'starting') return 'Demarrage de la camera...';
    if (cameraStatus === 'unsupported') return 'Scan camera non supporte sur ce navigateur.';
    if (cameraStatus === 'error') return 'Impossible d activer la camera.';
    if (cameraStatus === 'active') return 'Camera active';
    return 'Camera inactive';
  }, [cameraStatus]);

  const stopCamera = useCallback((nextStatus: CameraStatus = 'inactive') => {
    if (scanIntervalRef.current !== null) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    detectLockRef.current = false;
    detectorRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setCameraStatus(nextStatus);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (!router.isReady) return;
    if (!inputValue) {
      const queryCode =
        typeof router.query.codeqr === 'string' ? router.query.codeqr.trim() : '';
      if (queryCode) {
        setInputValue(queryCode);
      }
    }
  }, [inputValue, router.isReady, router.query.codeqr]);

  const openResolvedPage = useCallback(
    async (nextContext: AccessContext, codeqr: string) => {
      const redirectPath = buildRedirectPath(nextContext, codeqr);
      setOpening(true);
      try {
        await router.push(redirectPath);
      } finally {
        setOpening(false);
      }
    },
    [router],
  );

  const lookupCodeQr = useCallback(
    async (rawOverride?: string, forceOpen = false) => {
      if (!apiURL) {
        setLookupStatus('error');
        setMessage('API URL manquante.');
        return;
      }

      const raw = String(rawOverride ?? inputValue).trim();
      const codeqr = normalizeCodeQr(raw);
      if (!codeqr) {
        setLookupStatus('error');
        setMessage('Veuillez saisir un code QR valide.');
        return;
      }

      setLookupStatus('searching');
      setMessage('');
      setContext(null);

      try {
        const response = await axios.get<AccessContext>(`${apiURL}/operator/access`, {
          params: { codeqr },
          withCredentials: true,
        });

        const nextContext = response.data;
        setContext(nextContext);
        setResolvedCodeQr(codeqr);
        setLookupStatus('found');
        setMessage(
          nextContext.mode === 'LOGIN'
            ? 'Permis trouve. Acces operateur disponible.'
            : 'Permis trouve. Finalisez d abord le premier acces operateur.',
        );

        if (autoOpen || forceOpen) {
          await openResolvedPage(nextContext, codeqr);
        }
      } catch (err: any) {
        setLookupStatus('error');
        setMessage(
          err?.response?.data?.message ||
            'Aucun permis trouve pour ce QR code. Verifiez puis reessayez.',
        );
      }
    },
    [apiURL, autoOpen, inputValue, openResolvedPage],
  );

  const startCamera = useCallback(async () => {
    if (cameraStatus === 'active' || cameraStatus === 'starting') return;

    const detectorCtor = getBarcodeDetectorCtor();
    if (!detectorCtor) {
      setCameraStatus('unsupported');
      setLookupStatus('error');
      setMessage('Votre navigateur ne supporte pas le scan QR natif.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('unsupported');
      setLookupStatus('error');
      setMessage('L acces camera n est pas disponible sur ce navigateur.');
      return;
    }

    setCameraStatus('starting');
    setMessage('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      streamRef.current = stream;

      const videoElement = videoRef.current;
      if (!videoElement) {
        stopCamera('error');
        setLookupStatus('error');
        setMessage('Element video indisponible.');
        return;
      }

      videoElement.srcObject = stream;
      videoElement.setAttribute('playsinline', 'true');
      await videoElement.play();

      try {
        detectorRef.current = new detectorCtor({ formats: ['qr_code'] });
      } catch {
        detectorRef.current = new detectorCtor();
      }

      setCameraStatus('active');
      setLookupStatus('idle');

      scanIntervalRef.current = window.setInterval(() => {
        if (detectLockRef.current) return;
        if (!detectorRef.current || !videoRef.current) return;

        detectLockRef.current = true;
        void detectorRef.current
          .detect(videoRef.current)
          .then((results) => {
            const rawValue = results.find((entry) =>
              Boolean(String(entry?.rawValue || '').trim()),
            )?.rawValue;

            const detectedCode = String(rawValue || '').trim();
            if (!detectedCode) return;

            const normalized = normalizeCodeQr(detectedCode);
            setInputValue(normalized || detectedCode);
            stopCamera();
            void lookupCodeQr(normalized || detectedCode, true);
          })
          .catch(() => {})
          .finally(() => {
            detectLockRef.current = false;
          });
      }, 700);
    } catch {
      stopCamera('error');
      setLookupStatus('error');
      setMessage('Impossible d activer la camera. Verifiez les permissions.');
    }
  }, [cameraStatus, lookupCodeQr, stopCamera]);

  const toggleCamera = useCallback(() => {
    if (cameraStatus === 'active' || cameraStatus === 'starting') {
      stopCamera();
      return;
    }
    void startCamera();
  }, [cameraStatus, startCamera, stopCamera]);

  return (
    <div className={styles.appContainer}>
      <Navbar />
      <div className={styles.appContent}>
        {showSidebar ? <Sidebar currentView={currentView} navigateTo={navigateTo} /> : null}
        <main className={styles.mainContent}>
          <div className={styles.page}>
            <div className={styles.wrap}>
              <div className={styles.topActions}>
                <Link href={dashboardPath} className={styles.topBackBtn}>
                  <ArrowLeft size={16} />
                  Retour au dashboard
                </Link>
              </div>

              <p className={styles.lead}>
                Saisissez le code QR ou scannez-le pour afficher les informations associees et
                ouvrir directement la page concernee.
              </p>

              <section className={styles.card}>
                <header className={styles.cardHeader}>
                  <div>
                    <h1>Entrer ou scanner</h1>
                    <p>Le code peut etre saisi manuellement ou detecte avec la camera.</p>
                  </div>
                  <span className={`${styles.statusPill} ${styles[`status_${lookupStatus}`]}`}>
                    {statusLabel}
                  </span>
                </header>

                <form
                  className={styles.searchRow}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void lookupCodeQr();
                  }}
                >
                  <label className={styles.inputWrap} htmlFor="operator-qr-code">
                    <QrCode size={17} />
                    <input
                      id="operator-qr-code"
                      value={inputValue}
                      onChange={(event) => setInputValue(event.target.value)}
                      placeholder="Ex: 8TQNF-6ZB5F-1G3D0-L9KX2-7F"
                      autoComplete="off"
                    />
                  </label>

                  <button
                    type="submit"
                    className={styles.searchBtn}
                    disabled={lookupStatus === 'searching' || opening}
                  >
                    {lookupStatus === 'searching' ? (
                      <Loader2 size={16} className={styles.spin} />
                    ) : (
                      <Search size={16} />
                    )}
                    Rechercher
                  </button>
                </form>

                <div className={styles.controlsRow}>
                  <button
                    type="button"
                    onClick={toggleCamera}
                    className={styles.cameraBtn}
                    disabled={opening}
                  >
                    <Camera size={16} />
                    {cameraStatus === 'active' || cameraStatus === 'starting'
                      ? 'Arreter la camera'
                      : 'Scanner avec la camera'}
                  </button>

                  <label className={styles.toggleRow}>
                    <input
                      type="checkbox"
                      checked={autoOpen}
                      onChange={(event) => setAutoOpen(event.target.checked)}
                    />
                    Ouvrir la page automatiquement
                  </label>
                </div>

                <div
                  className={`${styles.cameraZone} ${
                    cameraStatus === 'active' || cameraStatus === 'starting'
                      ? styles.cameraZoneActive
                      : ''
                  }`}
                >
                  {cameraStatus === 'active' || cameraStatus === 'starting' ? (
                    <video ref={videoRef} className={styles.cameraVideo} muted />
                  ) : (
                    <div className={styles.cameraPlaceholder}>{cameraMessage}</div>
                  )}
                </div>

                {message ? (
                  <p className={lookupStatus === 'error' ? styles.error : styles.info}>
                    {lookupStatus === 'error' ? <AlertTriangle size={16} /> : null}
                    {message}
                  </p>
                ) : null}

                {context ? (
                  <article className={styles.resultCard}>
                    <h2>{context.permit?.code_permis || 'Permis trouve'}</h2>
                    <p>
                      {context.mode === 'LOGIN'
                        ? 'Acces operateur actif: ouverture directe du permis possible.'
                        : 'Premier acces requis: vous serez redirige vers la page d activation.'}
                    </p>

                    <div className={styles.resultActions}>
                      <button
                        type="button"
                        className={styles.openBtn}
                        onClick={() => void openResolvedPage(context, resolvedCodeQr || inputValue)}
                        disabled={opening}
                      >
                        {opening ? (
                          <Loader2 size={16} className={styles.spin} />
                        ) : (
                          <ArrowRight size={16} />
                        )}
                        {context.mode === 'LOGIN'
                          ? 'Ouvrir le permis'
                          : 'Continuer vers l acces operateur'}
                      </button>

                      <Link href="/operateur/dashboard" className={styles.backBtn}>
                        Retour dashboard
                      </Link>
                    </div>
                  </article>
                ) : null}
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
