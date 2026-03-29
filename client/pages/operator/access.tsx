'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ShieldCheck, QrCode, KeyRound } from 'lucide-react';
import { useAuthStore } from '../../src/store/useAuthStore';
import styles from './OperatorAccess.module.css';

type AccessContext = {
  mode: 'LOGIN' | 'FIRST_ACCESS';
  permit: {
    id: number;
    short_code: string;
    code_permis: string | null;
    qr_code: string | null;
  };
  detenteur: {
    id_detenteur: number;
    nom: string | null;
    email: string | null;
  } | null;
  operator: {
    id: number;
    email: string;
    nom: string;
    Prenom: string;
    emailVerified: boolean;
  } | null;
};

export default function OperatorAccessPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const apiURL = process.env.NEXT_PUBLIC_API_URL;

  const [context, setContext] = useState<AccessContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codeqr = useMemo(() => {
    if (!router.isReady) return '';
    return typeof router.query.codeqr === 'string' ? router.query.codeqr.trim() : '';
  }, [router.isReady, router.query.codeqr]);

  useEffect(() => {
    if (!router.isReady || !apiURL) return;
    if (!codeqr) {
      setError('Code QR invalide. Veuillez rescanner le permis.');
      setLoading(false);
      return;
    }

    const fetchContext = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get<AccessContext>(`${apiURL}/operator/access`, {
          params: { codeqr },
          withCredentials: true,
        });
        setContext(response.data);
      } catch (err: any) {
        setError(
          err?.response?.data?.message ||
            'Impossible de charger cet acces operateur. Verifiez le QR code.',
        );
      } finally {
        setLoading(false);
      }
    };

    void fetchContext();
  }, [apiURL, codeqr, router.isReady]);

  const permitLabel = context?.permit?.code_permis || codeqr || 'Inconnu';

  const handleOperatorLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password.trim()) {
      setError('Veuillez saisir votre mot de passe operateur.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await axios.post(
        `${apiURL}/operator/access/login`,
        {
          codeqr,
          password,
        },
        { withCredentials: true },
      );

      if (response.data?.token && response.data?.user) {
        login({ token: response.data.token, user: response.data.user });
      }

      await router.push(`/operator/dashboard?codeqr=${encodeURIComponent(codeqr)}`);
    } catch (err: any) {
      const apiMessage = err?.response?.data?.message || err?.response?.data?.error;
      if (apiMessage === 'EMAIL_NOT_VERIFIED_OPERATOR') {
        setError('Votre email operateur n\'est pas encore verifie. Finalisez la creation de votre acces.');
        return;
      }
      setError(apiMessage || 'Connexion impossible. Verifiez votre mot de passe.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>Chargement de votre acces operateur...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <ShieldCheck size={28} />
        </div>

        {context?.mode === 'LOGIN' ? (
          <>
            <h1 className={styles.title}>Connexion Espace Operateur</h1>
            <p className={styles.permit}>Permis : {permitLabel}</p>
            <p className={styles.text}>
              Veuillez entrer votre mot de passe operateur pour acceder a votre espace dedie.
            </p>

            <form className={styles.form} onSubmit={handleOperatorLogin}>
              <label htmlFor="operator-password">Mot de passe operateur</label>
              <div className={styles.inputWrap}>
                <KeyRound size={18} />
                <input
                  id="operator-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  autoComplete="current-password"
                />
              </div>

              {error && <p className={styles.error}>{error}</p>}

              <button type="submit" className={styles.primaryBtn} disabled={submitting}>
                {submitting ? 'Connexion...' : 'Acceder a mon espace operateur'}
              </button>
            </form>

            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() =>
                void router.push(`/operator/create-access?codeqr=${encodeURIComponent(codeqr)}`)
              }
            >
              Reconfigurer mon acces operateur
            </button>
          </>
        ) : (
          <>
            <h1 className={styles.title}>Bienvenue dans l&apos;espace Operateur</h1>
            <p className={styles.permit}>Permis : {permitLabel}</p>
            <p className={styles.text}>Vous n&apos;avez pas encore cree votre acces pour ce permis.</p>
            <p className={styles.text}>
              Pour des raisons de securite, nous devons verifier votre identite.
            </p>

            {error && <p className={styles.error}>{error}</p>}

            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() =>
                void router.push(`/operator/create-access?codeqr=${encodeURIComponent(codeqr)}`)
              }
            >
              Creer mon acces operateur
            </button>
          </>
        )}

        <div className={styles.footerLinks}>
          <Link href="/auth/login">Retour a la connexion generale</Link>
          <Link href="/">
            <QrCode size={14} />
            Scanner un autre permis
          </Link>
        </div>
      </div>
    </div>
  );
}
