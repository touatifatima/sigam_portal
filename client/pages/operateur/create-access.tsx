'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ShieldCheck, MailCheck, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../../src/store/useAuthStore';
import styles from './OperatorCreateAccess.module.css';

type AccessContext = {
  mode: 'LOGIN' | 'FIRST_ACCESS';
  permit: {
    id: number;
    short_code: string;
    code_permis: string | null;
    qr_code: string | null;
  };
  operator: {
    id: number;
    email: string;
    emailVerified: boolean;
  } | null;
};

const getPasswordChecks = (password: string) => ({
  minLength: password.length >= 8,
  hasUppercase: /[A-Z]/.test(password),
  hasNumber: /\d/.test(password),
  hasSymbol: /[^A-Za-z0-9]/.test(password),
});

export default function OperatorCreateAccessPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const apiURL = process.env.NEXT_PUBLIC_API_URL;

  const [context, setContext] = useState<AccessContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [step, setStep] = useState<'FORM' | 'OTP' | 'SUCCESS'>('FORM');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const codeqr = useMemo(() => {
    if (!router.isReady) return '';
    return typeof router.query.codeqr === 'string' ? router.query.codeqr.trim() : '';
  }, [router.isReady, router.query.codeqr]);

  const passwordChecks = getPasswordChecks(password);
  const isPasswordStrong =
    passwordChecks.minLength &&
    passwordChecks.hasUppercase &&
    passwordChecks.hasNumber &&
    passwordChecks.hasSymbol;

  useEffect(() => {
    if (!router.isReady || !apiURL) return;
    if (!codeqr) {
      setError('Code QR invalide.');
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
        const data = response.data;
        setContext(data);
        if (data?.operator?.email) {
          setEmail(data.operator.email);
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Impossible de charger cet acces operateur.');
      } finally {
        setLoading(false);
      }
    };

    void fetchContext();
  }, [apiURL, codeqr, router.isReady]);

  const permitLabel = context?.permit?.code_permis || codeqr || 'Inconnu';

  const handleCreateAccess = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setError('Veuillez saisir votre email.');
      return;
    }
    if (!isPasswordStrong) {
      setError(
        'Le mot de passe doit contenir au moins 8 caracteres, une majuscule, un chiffre et un symbole.',
      );
      return;
    }
    if (password !== confirmPassword) {
      setError('La confirmation du mot de passe ne correspond pas.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await axios.post(
        `${apiURL}/operator/create-access`,
        {
          codeqr,
          email,
          password,
        },
        { withCredentials: true },
      );

      setStep('OTP');
      setSuccessMessage(
        response.data?.message ||
          'Un code de verification vous a ete envoye. Saisissez-le pour activer votre acces.',
      );
      setOtpCode('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Impossible de creer votre acces operateur.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const cleanCode = otpCode.replace(/\D/g, '').slice(0, 6);
    if (cleanCode.length !== 6) {
      setError('Veuillez entrer le code OTP a 6 chiffres.');
      return;
    }

    setVerifying(true);
    try {
      const response = await axios.post(
        `${apiURL}/operator/verify-access`,
        {
          codeqr,
          email,
          code: cleanCode,
        },
        { withCredentials: true },
      );

      if (response.data?.token && response.data?.user) {
        login({ token: response.data.token, user: response.data.user });
      }

      setStep('SUCCESS');
      setSuccessMessage('Acces active avec succes');

      window.setTimeout(() => {
        void router.push(`/operateur/dashboard?codeqr=${encodeURIComponent(codeqr)}`);
      }, 1200);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Code invalide ou expire.');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>Chargement de la creation d&apos;acces...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          {step === 'SUCCESS' ? <CheckCircle2 size={28} /> : <ShieldCheck size={28} />}
        </div>

        {step === 'FORM' && (
          <>
            <h1 className={styles.title}>Creation de votre acces operateur</h1>
            <p className={styles.permit}>Permis : {permitLabel}</p>
            <p className={styles.text}>
              Veuillez creer votre mot de passe personnel pour ce permis.
            </p>

            <form className={styles.form} onSubmit={handleCreateAccess}>
              <label htmlFor="operator-email">Email operateur</label>
              <input
                id="operator-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operateur@entreprise.dz"
                required
              />

              <label htmlFor="operator-password">Mot de passe</label>
              <input
                id="operator-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8+ caracteres, majuscule, chiffre, symbole"
                required
              />

              <label htmlFor="operator-confirm">Confirmation du mot de passe</label>
              <input
                id="operator-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Retapez le mot de passe"
                required
              />

              <ul className={styles.passwordRules}>
                <li className={passwordChecks.minLength ? styles.ruleOk : styles.ruleKo}>
                  Au moins 8 caracteres
                </li>
                <li className={passwordChecks.hasUppercase ? styles.ruleOk : styles.ruleKo}>
                  Au moins une majuscule
                </li>
                <li className={passwordChecks.hasNumber ? styles.ruleOk : styles.ruleKo}>
                  Au moins un chiffre
                </li>
                <li className={passwordChecks.hasSymbol ? styles.ruleOk : styles.ruleKo}>
                  Au moins un symbole
                </li>
              </ul>

              {error && <p className={styles.error}>{error}</p>}

              <button type="submit" className={styles.primaryBtn} disabled={submitting}>
                {submitting ? 'Envoi en cours...' : 'Creer mon acces operateur'}
              </button>
            </form>
          </>
        )}

        {step === 'OTP' && (
          <>
            <h1 className={styles.title}>Verification de votre acces operateur</h1>
            <p className={styles.permit}>Permis : {permitLabel}</p>
            <p className={styles.text}>
              Un code de verification a ete envoye a <strong>{email}</strong>.
            </p>

            {successMessage && <p className={styles.info}>{successMessage}</p>}

            <form className={styles.form} onSubmit={handleVerifyOtp}>
              <label htmlFor="operator-otp">Code OTP (6 chiffres)</label>
              <div className={styles.otpWrap}>
                <MailCheck size={18} />
                <input
                  id="operator-otp"
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                />
              </div>

              {error && <p className={styles.error}>{error}</p>}

              <button type="submit" className={styles.primaryBtn} disabled={verifying}>
                {verifying ? 'Verification...' : 'Activer mon acces'}
              </button>
            </form>
          </>
        )}

        {step === 'SUCCESS' && (
          <>
            <h1 className={styles.title}>Acces active avec succes</h1>
            <p className={styles.permit}>Permis : {permitLabel}</p>
            <p className={styles.text}>Votre compte operateur pour le permis {permitLabel} a ete cree.</p>
            <p className={styles.text}>Vous etes maintenant connecte a votre espace personnel.</p>
          </>
        )}

        <div className={styles.footerLinks}>
          <Link href={`/operateur/access?codeqr=${encodeURIComponent(codeqr)}`}>
            Retour a l&apos;acces operateur
          </Link>
          <Link href="/auth/login">Connexion generale</Link>
        </div>
      </div>
    </div>
  );
}
