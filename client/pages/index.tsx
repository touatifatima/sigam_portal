'use client';// page login 

import React, { useState } from 'react';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuthStore } from '../src/store/useAuthStore';
import styles from './login.module.css';

const logo = '/assets/logo.jpg';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const apiURL = process.env.NEXT_PUBLIC_API_URL;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.post(
        `${apiURL}/auth/login`, 
        { email, password },
        { 
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data?.error) {
        const msg =
          response.data.error === 'Email non vérifié'
            ? 'Veuillez vérifier votre email avant de vous connecter.'
            : 'Email ou mot de passe invalide';
        setError(msg);
        return;
      }

      login(response.data);

      const user = response.data?.user;
      const isVerified = Boolean(
        user?.isEntrepriseVerified ??
        user?.entrepriseVerified ??
        user?.entreprise_verified
      );

      if (isVerified) {
        router.push('/investisseur/InvestorDashboard');
      } else {
        router.push('/investisseur/Identification/identification-entreprise');
      }
      
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err?.response?.data?.detail || 'Email ou mot de passe invalide');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin(e as any);
    }
  };

  return (
    <div className={styles.container}>
      {/* SECTION GAUCHE - Identique au sign up */}
      <div className={styles.leftSection}>
        <div className={styles.logoContainer}>
          <Image src={logo} alt="ANAM Logo" className={styles.logo} width={256} height={256} />
        </div>
        <h1 className={styles.title}>
          AGENCE NATIONALE DES <br />
          ACTIVITÉS MINIÈRES
        </h1>
        <p className={styles.subtitle}>Plateforme de gestion et de suivi des activités minières</p>
      </div>

      {/* SECTION DROITE - Formulaire de connexion */}
      <div className={styles.rightSection}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h2>Connexion</h2>
            <p>Accédez à votre espace personnel</p>
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

            <div className={styles.inputGroup}>
              <label htmlFor="password">Mot de passe *</label>
              <div className={styles.passwordWrapper}>
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
                <input type="checkbox" />
                <span>Se souvenir de moi</span>
              </label>
              <Link href="/forgot-password" className={styles.forgotPassword}>
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
