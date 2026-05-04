'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import { executeRecaptcha, preloadRecaptcha } from '../../src/utils/recaptcha';
const logo = '/anamlogo.png';
import styles from './register.module.css';

const getPasswordChecks = (password: string) => ({
  minLength: password.length >= 8,
  hasUppercase: /[A-Z]/.test(password),
  hasNumber: /\d/.test(password),
  hasSymbol: /[^A-Za-z0-9]/.test(password),
});

const extractRegistrationErrorMessage = (error: any) => {
  const responseData = error?.response?.data;
  const responseMessage = Array.isArray(responseData?.message)
    ? responseData.message.join(' ')
    : responseData?.message;
  const rawMessage =
    responseData?.detail ||
    responseMessage ||
    responseData?.error ||
    error?.message ||
    '';
  const message = String(rawMessage).trim();
  const normalized = message.toLowerCase();

  if (normalized.includes('score recaptcha insuffisant')) {
    return 'Verification anti-bot echouee (score faible). Merci de reessayer.';
  }
  if (normalized.includes('action recaptcha invalide')) {
    return 'Verification anti-bot invalide (action non reconnue). Rechargez la page et reessayez.';
  }
  if (
    normalized.includes('echec de verification recaptcha') ||
    normalized.includes('invalid-input-secret') ||
    normalized.includes('invalid-input-response') ||
    normalized.includes('missing-input-secret') ||
    normalized.includes('missing-input-response')
  ) {
    return `${message} Verifiez la configuration des cles et des domaines reCAPTCHA.`;
  }
  if (normalized.includes('recaptcha')) {
    return message || 'Verification anti-bot echouee. Merci de reessayer.';
  }
  if (normalized.includes('email') && normalized.includes('deja')) {
    return 'Cette adresse email est deja utilisee ou deja verifiee.';
  }
  if (normalized.includes('telephone') && normalized.includes('deja')) {
    return 'Ce numero de telephone est deja utilise.';
  }
  if (normalized.includes('role')) {
    return 'Le type de compte selectionne est invalide.';
  }

  if (message) {
    return message;
  }

  return 'Inscription impossible pour le moment. Merci de verifier les informations puis de reessayer.';
};

export default function Register() {
  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    username: '',                                    
    email: '',
    telephone: '',
    password: '',
    confirmPassword: '',
    role: '',
  });
                         
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showOtpSentModal, setShowOtpSentModal] = useState(false);
  const [otpTargetEmail, setOtpTargetEmail] = useState('');
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apiURL = process.env.NEXT_PUBLIC_API_URL;
  const router = useRouter();
  const passwordChecks = getPasswordChecks(form.password);
  const isPasswordStrong =
    passwordChecks.minLength &&
    passwordChecks.hasUppercase &&
    passwordChecks.hasNumber &&
    passwordChecks.hasSymbol;
  const toRoleList = (payload: any): { id: number; name: string }[] => {
    const candidates = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.roles)
      ? payload.roles
      : Array.isArray(payload?.data)
      ? payload.data
      : [];

    return candidates
      .map((item: any, index: number) => {
        const id = Number(item?.id);
        const name = typeof item?.name === 'string' ? item.name.trim() : '';
        if (!name) return null;
        return { id: Number.isFinite(id) ? id : index + 1, name };
      })
      .filter(Boolean) as { id: number; name: string }[];
  };

  // Exactement comme votre ancien code qui fonctionnait
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await axios.get(`${apiURL}/admin/roles`);
        const fetchedRoles = toRoleList(response.data);
        setRoles(fetchedRoles);
        // SÃ©lectionner automatiquement le premier rÃ´le
        if (fetchedRoles.length > 0) {
          setForm((prev) => ({ ...prev, role: fetchedRoles[0].name }));
        }
      } catch (error) {
        console.error(' Failed to fetch roles:', error);
      }
    };
    fetchRoles();
  }, []);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    preloadRecaptcha();
  }, []);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setFormError(null);
    if (field === 'telephone') {
      setPhoneError(null);
    }
    if (field === 'password' || field === 'confirmPassword') {
      setPasswordError(null);
      setConfirmPasswordError(null);
    }
  };

  const normalizePhone = (value: string) =>
    value.replace(/[\s()-]/g, '');

  const isValidPhone = (value: string) => {
    const cleaned = normalizePhone(value);
    if (!cleaned) return false;
    if (/^0\d{9}$/.test(cleaned)) return true;
    if (/^\+\d{8,15}$/.test(cleaned)) return true;
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setPhoneError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);

    if (!apiURL) {
      setFormError('Configuration API manquante (NEXT_PUBLIC_API_URL).');
      return;
    }

    if (!isPasswordStrong) {
      setPasswordError(
        'Le mot de passe doit contenir au moins 8 caracteres, une majuscule, un chiffre et un symbole.',
      );
      return;
    }
    
    if (form.password !== form.confirmPassword) {
      setConfirmPasswordError('La confirmation du mot de passe ne correspond pas.');
      return;
    }

    if (!isValidPhone(form.telephone)) {
      setPhoneError('Veuillez entrer un numéro de téléphone valide (10 chiffres)');
      return;
    }

    try {
      setIsLoading(true);
      const recaptchaToken = await executeRecaptcha('register');
      await axios.post(`${apiURL}/auth/register`, {
        email: form.email,
        password: form.password,
        role: form.role,
        nom: form.nom,
        prenom: form.prenom,
        username: form.username,
        telephone: normalizePhone(form.telephone),
        recaptchaToken,
      });
      setOtpTargetEmail(form.email);
      setShowOtpSentModal(true);
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
      redirectTimerRef.current = setTimeout(() => {
        void router.push(`/Signup/verify_email?email=${encodeURIComponent(form.email)}`);
      }, 2600);
      
      // RÃ©initialiser le formulaire
      setForm({
        nom: '',
        prenom: '',
        username: '',
        email: '',
        telephone: '',
        password: '',
        confirmPassword: '',
        role: roles.length > 0 ? roles[0].name : '',
      });
    } catch (error: any) {
      setFormError(extractRegistrationErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueToVerification = () => {
    if (!otpTargetEmail) return;
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
    void router.push(`/Signup/verify_email?email=${encodeURIComponent(otpTargetEmail)}`);
  };

  return (
    <div className={styles.container}>
      <Link href="/" className={styles.homeButton} aria-label="Retour a l'accueil">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        <span>Accueil</span>
      </Link>
      {/* SECTION GAUCHE */}
      <div className={styles.leftSection}>
        <div className={styles.logoContainer}>
          <Image src={logo} alt="ANAM Logo" className={styles.logo} width={256} height={256} />
        </div>
        <h1 className={styles.title}>
          AGENCE NATIONALE DES <br />
          ACTIVITEES MINIAIRES
        </h1>
        <p className={styles.subtitle}>Rejoignez la plateforme POM</p>
      </div>

      {/* SECTION DROITE */}
      <div className={styles.rightSection}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h2>Créer un compte</h2>
            <p>Remplissez le formulaire pour vous inscrire</p>
          </div>

          {formError && (
            <div className={styles.errorBanner} role="alert" aria-live="polite">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14A2 2 0 003.82 21h16.36a2 2 0 001.71-3.14l-8.18-14a2 2 0 00-3.42 0z" />
              </svg>
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.grid2}>
              <div className={styles.inputGroup}>
                <label htmlFor="prenom">Prénom *</label>
                <input
                  id="prenom"
                  type="text"
                  value={form.prenom}
                  onChange={e => handleChange('prenom', e.target.value)}
                  placeholder="Prénom"
                  disabled={isLoading}
                  required
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="nom">Nom *</label>
                <input
                  id="nom"
                  type="text"
                  value={form.nom}
                  onChange={e => handleChange('nom', e.target.value)}
                  placeholder="Nom"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="username">Nom d'utilisateur *</label>
              <input
                id="username"
                type="text"
                value={form.username}
                onChange={e => handleChange('username', e.target.value)}
                placeholder="Nom d'utilisateur"
                disabled={isLoading}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="email">Email *</label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={e => handleChange('email', e.target.value)}
                placeholder="email@exemple.com"
                disabled={isLoading}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="telephone">Téléphone *</label>
              <input
                id="telephone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.telephone}
                onChange={e => handleChange('telephone', e.target.value)}
                placeholder="Ex: 0XXXXXXXXX"
                disabled={isLoading}
                className={phoneError ? styles.inputError : ''}
                required
              />
              {phoneError && <span className={styles.errorText}>{phoneError}</span>}
            </div>

            {/* EXACTEMENT COMME VOTRE ANCIEN CODE */}
            <div className={styles.inputGroup}>
              <label htmlFor="role">Type de compte *</label>
              <select
                id="role"
                value={form.role}
                onChange={e => handleChange('role', e.target.value)}
                disabled={isLoading}
                required
              >
                {roles.length === 0 ? (
                  <option value="" disabled>
                    Aucun role disponible
                  </option>
                ) : (
                  roles.map((role) => (
                    <option key={role.id} value={role.name}>
                      {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="password">Mot de passe *</label>
              <input
                id="password"
                type="password"
                value={form.password}
                onChange={e => handleChange('password', e.target.value)}
                placeholder="8+ caracteres, majuscule, chiffre, symbole"
                disabled={isLoading}
                minLength={8}
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
              {passwordError && <span className={styles.errorText}>{passwordError}</span>}
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="confirmPassword">Confirmer le mot de passe *</label>
              <input
                id="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={e => handleChange('confirmPassword', e.target.value)}
                placeholder="Retapez votre mot de passe"
                disabled={isLoading}
                className={confirmPasswordError ? styles.inputError : ''}
                required
              />
              {confirmPasswordError && <span className={styles.errorText}>{confirmPasswordError}</span>}
            </div>

            <button type="submit" className={styles.submitBtn} disabled={isLoading}>
              {isLoading ? 'Inscription...' : 'Créer mon compte'}
            </button>

            <p className={styles.loginLink}>
              Déjà un compte ? <Link href="/auth/login">Se connecter</Link>
            </p>
          </form>
        </div>
      </div>

      {showOtpSentModal && (
        <div className={styles.successOverlay} role="dialog" aria-modal="true">
          <div className={styles.successCard}>
            <div className={styles.successIconWrap} aria-hidden="true">
              <svg viewBox="0 0 24 24" className={styles.successIcon}>
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h3 className={styles.successTitle}>Code de verification envoye</h3>
            <p className={styles.successText}>
              Votre compte ANAM a bien ete enregistre.
            </p>
            <p className={styles.successText}>
              Un code OTP a ete envoye a <strong>{otpTargetEmail}</strong>.
            </p>
            <p className={styles.successHint}>
              Le code est valable 10 minutes. Nous vous redirigeons vers la verification.
            </p>
            <button
              type="button"
              className={styles.successPrimaryBtn}
              onClick={handleContinueToVerification}
            >
              Continuer vers la verification
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

