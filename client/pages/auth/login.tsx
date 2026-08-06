'use client';// page login 

import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuthStore } from '../../src/store/useAuthStore';
import { getPostLoginPath } from '../../src/utils/roleNavigation';
import { executeRecaptcha, preloadRecaptcha } from '../../src/utils/recaptcha';
import gunamLogo from '../../src/assets/gunam-login.png';
import institutionalMark from '../../src/assets/test.png';
import styles from '../login.module.css';

const REMEMBER_ME_EMAIL_KEY = 'sigam_remember_email';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const apiURL = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedEmail = window.localStorage.getItem(REMEMBER_ME_EMAIL_KEY);
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }

    preloadRecaptcha();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      if (!apiURL) {
        setError('Configuration API manquante (NEXT_PUBLIC_API_URL).');
        return;
      }

      const recaptchaToken = await executeRecaptcha('login');

      const response = await axios.post(
        `${apiURL}/auth/login`, 
        { email, password, recaptchaToken },
        { 
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data?.error) {
        if (response.data.error === 'IDENTIFICATION_PENDING') {
          router.push('/auth/account-pending');
          return;
        }
        const msg =
          response.data.error === 'Email non vérifié'
            ? 'Veuillez vérifier votre email avant de vous connecter.'
            : response.data.error === 'IDENTIFICATION_REJECTED'
              ? response.data.message ||
                "Desole, votre compte n'a pas ete valide par l'administration. Veuillez contacter le support ANAM pour plus d'informations."
              : 'Email ou mot de passe invalide';
        setError(msg);
        return;
      }

      login(response.data);
      if (typeof window !== 'undefined') {
        if (rememberMe) {
          window.localStorage.setItem(REMEMBER_ME_EMAIL_KEY, email.trim());
        } else {
          window.localStorage.removeItem(REMEMBER_ME_EMAIL_KEY);
        }
      }

      const user = response.data?.user;
      const rawRoles = Array.isArray(user?.role)
        ? user.role
        : typeof user?.role === 'string'
          ? user.role.split(',')
          : Array.isArray(user?.roles)
            ? user.roles
            : typeof user?.roles === 'string'
              ? user.roles.split(',')
              : [];
      const isVerified = Boolean(
        user?.isEntrepriseVerified ??
        user?.entrepriseVerified ??
        user?.entreprise_verified
      );
      const shouldShowWelcome = Boolean(
        user?.firstLoginAfterConfirmation ??
        user?.first_login_after_confirmation
      );

      router.push(
        getPostLoginPath({
          role: rawRoles,
          isEntrepriseVerified: isVerified,
          shouldShowWelcome,
        }),
      );
      
    } catch (err: any) {
      console.error('Login error:', err);
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.detail ||
          'Email ou mot de passe invalide',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin(e as any);
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const panel = rightPanelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    panel.style.setProperty('--cursor-x', `${event.clientX - rect.left}px`);
    panel.style.setProperty('--cursor-y', `${event.clientY - rect.top}px`);
    panel.style.setProperty('--cursor-opacity', '1');
  };

  const handlePointerLeave = () => {
    rightPanelRef.current?.style.setProperty('--cursor-opacity', '0');
  };

  return (
    <div className={styles.container}>
      <div className={styles.leftSection}>
        <Link href="/" className={styles.homeButton} aria-label="Retour à l'accueil">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          <span>Accueil</span>
        </Link>

        <div className={styles.badgeMark} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12 2l3 7h7l-5.5 4.5L18.5 21 12 16.5 5.5 21l2-7.5L2 9h7z" />
          </svg>
        </div>
        <div className={styles.sweep} aria-hidden="true" />
        <div className={styles.dust} aria-hidden="true">
          {Array.from({ length: 12 }).map((_, index) => (
            <span key={index} />
          ))}
        </div>
        <div className={styles.leftContent}>
          <div className={styles.brandCopy}>
            <div className={styles.institutionalMark}>
              <img src={institutionalMark} alt="" aria-hidden="true" />
            </div>
            <span className={styles.eyebrow}>Guichet unique national des activités minières</span>
            <h1 className={styles.title}>Agence Nationale des Activités Minières</h1>
            <p className={styles.subtitle}>
              Plateforme officielle de gestion, de suivi et d&apos;instruction des titres et activités minières.
            </p>
            <div className={styles.trustRow} aria-label="Indicateurs de la plateforme">
              <span><strong>58</strong><small>Wilayas</small></span>
              <span><strong>100%</strong><small>Dématérialisé</small></span>
              <span><strong>24/7</strong><small>Accès</small></span>
            </div>
          </div>
        </div>
        <div className={styles.goldSeam} aria-hidden="true" />
      </div>

      <div
        ref={rightPanelRef}
        className={styles.rightSection}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <div className={styles.cursorSpotlight} aria-hidden="true" />
        <div className={styles.cursorRing} aria-hidden="true" />
        <div className={styles.formCard}>
          <div className={styles.formLogo} aria-label="GUNAM">
            <img src={gunamLogo} alt="GUNAM" />
          </div>
          <div className={styles.formMark} aria-hidden="true" />
          <div className={styles.formHeader}>
            <span className={styles.formEyebrow}>Espace sécurisé</span>
            <h2>Connexion</h2>
            <p>Accédez à votre espace personnel GUNAM.</p>
          </div>

          {error && (
            <div className={styles.errorMessage}>
              <svg className={styles.errorIcon} width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="email">Email *</label>
              <div className={styles.inputWithIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 6-10 7L2 6" />
                </svg>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="exemple@email.com"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="password">Mot de passe *</label>
              <div className={styles.passwordWrapper}>
                <svg className={styles.fieldIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Entrez votre mot de passe"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className={styles.rememberForgot}>
              <label className={styles.rememberMe}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                />
                <span>Se souvenir de moi</span>
              </label>
              <Link href="/auth/forgot-password" className={styles.forgotPassword}>
                Mot de passe oublié ?
              </Link>
            </div>

            <button 
              type="submit" 
              className={styles.submitBtn} 
              disabled={isLoading}
            >
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </button>

            <p className={styles.signupLink}>
              Vous n'avez pas de compte ? <Link href="/Signup/page">Créer un compte</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}


