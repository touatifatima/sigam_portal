'use client';

import { FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { executeRecaptcha, preloadRecaptcha } from '../../src/utils/recaptcha';
import styles from './ForgotPassword.module.css';

const DEFAULT_SUCCESS_MESSAGE =
  "Un email de reinitialisation a ete envoye a l'adresse indiquee. Si un compte est associe a cet email, vous recevrez un lien dans les prochaines minutes. Verifiez votre boite de reception (et vos spams). Le lien est valide pendant 15 minutes.";

export default function ForgotPasswordPage() {
  const apiURL = process.env.NEXT_PUBLIC_API_URL;
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    preloadRecaptcha();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!apiURL) {
      setError('Configuration API manquante (NEXT_PUBLIC_API_URL).');
      return;
    }

    try {
      setIsSubmitting(true);
      const recaptchaToken = await executeRecaptcha('forgot_password');
      const response = await axios.post(
        `${apiURL}/auth/forgot-password`,
        { email, recaptchaToken },
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      setSuccessMessage(response.data?.message || DEFAULT_SUCCESS_MESSAGE);
    } catch (err: any) {
      if (err?.response?.status === 429) {
        setError(
          err?.response?.data?.message ||
            'Trop de demandes. Reessayez dans une heure.',
        );
        return;
      }
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'Impossible de traiter la demande pour le moment.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>A</div>
        <h1 className={styles.title}>Mot de passe oublie</h1>
        <p className={styles.subtitle}>
          Entrez l&apos;email de votre compte ANAM. Nous vous enverrons un lien
          securise de reinitialisation valable 15 minutes.
        </p>

        {error && <div className={styles.errorBox}>{error}</div>}

        {successMessage ? (
          <div className={styles.successBox}>
            <strong>Demande envoyee.</strong>
            <ul className={styles.successList}>
              <li>Un email de reinitialisation a ete envoye a l&apos;adresse indiquee.</li>
              <li>
                Si un compte est associe a cet email, vous recevrez un lien dans
                les prochaines minutes.
              </li>
              <li>Verifiez votre boite de reception (et vos spams).</li>
              <li>Le lien est valide pendant 15 minutes.</li>
            </ul>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <label className={styles.label} htmlFor="forgot-email">
              Email
            </label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={styles.input}
              placeholder="nom@anam.dz"
              required
              autoComplete="email"
            />
            <button type="submit" className={styles.button} disabled={isSubmitting}>
              {isSubmitting
                ? 'Envoi en cours...'
                : 'Envoyer le lien de reinitialisation'}
            </button>
          </form>
        )}

        <div className={styles.links}>
          <Link href="/auth/login" className={styles.link}>
            Retour a la connexion
          </Link>
          <Link href="/" className={styles.link}>
            Retour a l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
