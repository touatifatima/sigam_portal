'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, ArrowLeft, CheckCircle2, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import styles from './VerifyEmail.module.css';

const logo = '/assets/logo.jpg';

export default function VerifyEmailPage() {
  const router = useRouter();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;

  const emailQuery = typeof router.query.email === 'string' ? router.query.email : '';
  const [email, setEmail] = useState(emailQuery);
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!emailQuery) return;
    setEmail(emailQuery);
  }, [emailQuery]);

  useEffect(() => {
    if (emailQuery) {
      setInfo('Code envoyé à votre email.');
    }
  }, [emailQuery]);

  useEffect(() => {
    if (!emailQuery) return;
    setResendCooldown(60);
  }, [emailQuery]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (!email) {
      router.push('/Signup/page');
    }
  }, [email, router]);

  const handleInputChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setError(null);
    setInfo(null);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    pastedData.split('').forEach((char, i) => {
      if (i < 6) newOtp[i] = char;
    });
    setOtp(newOtp);
    setError(null);
    setInfo(null);
    const lastIndex = Math.min(pastedData.length, 5);
    inputRefs.current[lastIndex]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Veuillez saisir le code complet à 6 chiffres.');
      return;
    }
    setIsVerifying(true);
    setError(null);
    setInfo(null);
    try {
      const res = await axios.post(
        `${apiURL}/auth/verify-email`,
        { email, code },
        { withCredentials: true },
      );
      setIsSuccess(true);
      setInfo('Email vérifié avec succès.');
      setTimeout(() => {
        const user = res.data?.user;
        const verified = Boolean(
          user?.isEntrepriseVerified ??
            user?.entrepriseVerified ??
            user?.entreprise_verified,
        );
        if (verified) {
          router.push('/investisseur/InvestorDashboard');
        } else {
          router.push('/investisseur/Identification/identification-entreprise');
        }
      }, 1500);
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Code invalide ou expiré';
      setError(message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setInfo(null);
    try {
      await axios.post(`${apiURL}/auth/resend-verification`, { email });
      setInfo('Nouveau code envoyé.');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setResendCooldown(60);
    } catch (err: any) {
      const message =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Impossible d'envoyer un nouveau code.";
      setError(message);
    }
  };

  const getInputClassName = (index: number) => {
    let className = styles.otpInput;
    if (otp[index]) className += ` ${styles.filled}`;
    if (error) className += ` ${styles.error}`;
    if (isSuccess) className += ` ${styles.success}`;
    return className;
  };

  if (!email) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.leftPanel}>
        <div className={styles.bgImage} />
        <div className={styles.leftContent}>
          <Image src={logo} alt="ANAM Logo" className={styles.logo} width={120} height={120} />
          <h1 className={styles.title}>
            AGENCE NATIONALE DES
            <br />
            ACTIVITÉS MINIÈRES
          </h1>
          <p className={styles.subtitle}>Vérification de votre adresse email</p>
        </div>
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.formContainer}>
          <div className={styles.header}>
            <Image src={logo} alt="ANAM Logo" className={styles.mobileLogo} width={80} height={80} />
            <h2 className={styles.headerTitle}>Vérification Email</h2>
            <p className={styles.headerSubtitle}>
              Entrez le code de vérification envoyé à votre email
            </p>
          </div>

          <div className={styles.iconContainer}>
            <div className={styles.iconWrapper}>
              <div className={styles.iconBg} />
              <Mail size={40} className={styles.emailIcon} />
            </div>
          </div>

          <div className={styles.otpCard}>
            {error && (
              <div className={`${styles.alert} ${styles.alertError}`}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}
            {info && !error && (
              <div className={`${styles.alert} ${styles.alertSuccess}`}>
                <CheckCircle2 size={18} />
                <span>{info}</span>
              </div>
            )}

            <div className={styles.emailInfo}>
              <div className={styles.emailLabel}>Email</div>
              <div className={styles.emailValue}>{email}</div>
            </div>

            <div className={styles.otpContainer}>
              <div className={styles.otpInputs} onPaste={handlePaste}>
                {otp.map((value, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={value}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className={getInputClassName(index)}
                    aria-label={`Digit ${index + 1}`}
                  />
                ))}
              </div>

              <button
                type="button"
                className={styles.verifyButton}
                onClick={handleVerify}
                disabled={isVerifying}
              >
                {isVerifying ? (
                  <>
                    <Loader2 size={16} />
                    Vérification...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    Vérifier
                  </>
                )}
              </button>
            </div>

            <div className={styles.resendSection}>
              <p className={styles.resendText}>
                Vous n&apos;avez pas reçu le code ?
              </p>
              <button
                type="button"
                className={styles.resendButton}
                onClick={handleResend}
                disabled={resendCooldown > 0}
              >
                <RefreshCw size={16} />
                Renvoyer le code
              </button>
              {resendCooldown > 0 && (
                <div className={styles.countdown}>
                  Réessayez dans{' '}
                  <span className={styles.countdownNumber}>{resendCooldown}s</span>
                </div>
              )}
            </div>

            <Link href="/Signup/page" className={styles.backLink}>
              <ArrowLeft size={16} />
              Retour à l'inscription
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
