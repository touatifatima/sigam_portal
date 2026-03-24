'use client';

import { FormEvent, useMemo, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from './ForgotPassword.module.css';

function getPasswordChecks(password: string) {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSymbol: /[^A-Za-z0-9]/.test(password),
  };
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;

  const token = useMemo(() => {
    const value = router.query.token;
    return typeof value === 'string' ? value.trim() : '';
  }, [router.query.token]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const checks = getPasswordChecks(password);
  const isPasswordStrong =
    checks.minLength && checks.hasUppercase && checks.hasNumber && checks.hasSymbol;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!apiURL) {
      setError('Configuration API manquante (NEXT_PUBLIC_API_URL).');
      return;
    }
    if (!token) {
      setError('Lien invalide ou expire.');
      return;
    }
    if (!isPasswordStrong) {
      setError(
        'Mot de passe faible: minimum 8 caracteres, 1 majuscule, 1 chiffre, 1 symbole.',
      );
      return;
    }
    if (password !== confirmPassword) {
      setError('La confirmation du mot de passe ne correspond pas.');
      return;
    }

    try {
      setIsSubmitting(true);
      await axios.post(
        `${apiURL}/auth/reset-password`,
        {
          token,
          password,
          confirmPassword,
        },
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
      setSuccess(true);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          'Le lien est invalide ou a expire.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>A</div>
        <h1 className={styles.title}>Reinitialiser le mot de passe</h1>
        <p className={styles.subtitle}>
          Definissez un nouveau mot de passe securise pour votre compte ANAM.
        </p>

        {error && <div className={styles.errorBox}>{error}</div>}

        {success ? (
          <div className={styles.successBox}>
            <strong>Votre mot de passe a ete modifie avec succes !</strong>
            <div style={{ marginTop: 10 }}>
              Vous pouvez maintenant vous reconnecter avec votre nouveau mot de
              passe.
            </div>
            <Link href="/auth/login" className={styles.link} style={{ marginTop: 12, display: 'inline-block' }}>
              Retour a la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <label className={styles.label} htmlFor="new-password">
              Nouveau mot de passe
            </label>
            <input
              id="new-password"
              type="password"
              className={styles.input}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
            />

            <label className={styles.label} htmlFor="confirm-password">
              Confirmer le mot de passe
            </label>
            <input
              id="confirm-password"
              type="password"
              className={styles.input}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
            />

            <div className={styles.infoBox}>
              <ul className={styles.ruleList}>
                <li className={checks.minLength ? styles.ruleOk : styles.ruleKo}>
                  Minimum 8 caracteres
                </li>
                <li className={checks.hasUppercase ? styles.ruleOk : styles.ruleKo}>
                  Au moins une majuscule
                </li>
                <li className={checks.hasNumber ? styles.ruleOk : styles.ruleKo}>
                  Au moins un chiffre
                </li>
                <li className={checks.hasSymbol ? styles.ruleOk : styles.ruleKo}>
                  Au moins un symbole
                </li>
              </ul>
            </div>

            <button type="submit" className={styles.button} disabled={isSubmitting}>
              {isSubmitting ? 'Mise a jour en cours...' : 'Changer mon mot de passe'}
            </button>
          </form>
        )}

        <div className={styles.links}>
          <Link href="/auth/forgot-password" className={styles.link}>
            Redemander un lien
          </Link>
          <Link href="/auth/login" className={styles.link}>
            Retour a la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
