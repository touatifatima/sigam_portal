import {
  ChangeEvent,
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Save,
  Shield,
  User,
  Users2,
} from "lucide-react";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/src/hooks/use-toast";
import { useAuthStore } from "@/src/store/useAuthStore";
import SettingsLayout from "@/components/settings/SettingsLayout";
import PageHeader from "@/components/settings/PageHeader";
import Card from "@/components/settings/Card";
import ProfileSidebar from "@/components/settings/ProfileSidebar";
import styles from "./modifier-profil.module.css";

type ProfileUpdateStatus = {
  canEdit: boolean;
  lastProfileUpdateAt: string | null;
  nextAvailableAt: string | null;
  remainingMs: number;
  cooldownMessage: string | null;
  hasPendingRequest: boolean;
  pendingExpiresAt: string | null;
  resendAvailableAt: string | null;
};

type PasswordFormState = {
  currentPassword: string;
  password: string;
  confirmPassword: string;
};

type PasswordCheckState = "idle" | "checking" | "valid" | "invalid";
type PasswordRuleStatus = "valid" | "invalid" | "pending";

type PasswordRule = {
  label: string;
  status: PasswordRuleStatus;
};

const emptyStatus: ProfileUpdateStatus = {
  canEdit: true,
  lastProfileUpdateAt: null,
  nextAvailableAt: null,
  remainingMs: 0,
  cooldownMessage: null,
  hasPendingRequest: false,
  pendingExpiresAt: null,
  resendAvailableAt: null,
};

const PASSWORD_CHANGE_IDLE_TEXT =
  "Saisissez votre mot de passe actuel si vous souhaitez modifier votre mot de passe.";

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { auth, initialize } = useAuthStore();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;

  const [status, setStatus] = useState<ProfileUpdateStatus>(emptyStatus);
  const [statusLoading, setStatusLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const [otpStep, setOtpStep] = useState(false);
  const [otpEmail, setOtpEmail] = useState(auth.email || "");
  const [pendingExpiresLabel, setPendingExpiresLabel] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpInfo, setOtpInfo] = useState<string | null>(null);
  const [formState, setFormState] = useState<PasswordFormState>({
    currentPassword: "",
    password: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentPasswordCheckState, setCurrentPasswordCheckState] =
    useState<PasswordCheckState>("idle");
  const [currentPasswordMessage, setCurrentPasswordMessage] = useState<string | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const currentPasswordValidationSeq = useRef(0);
  const otpCode = useMemo(() => otpDigits.join(""), [otpDigits]);

  const formatDateTime = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const normalizePhoneValue = (value?: string | null) => String(value || "").replace(/\D/g, "");

  const passwordChangeRequested = useMemo(
    () => Boolean(formState.password || formState.confirmPassword),
    [formState.confirmPassword, formState.password],
  );

  const passwordRules = useMemo<PasswordRule[]>(
    () => [
      {
        label: "Au moins 8 caracteres.",
        status: formState.password.length >= 8 ? "valid" : "invalid",
      },
      {
        label: "Au moins une lettre majuscule.",
        status: /[A-Z]/.test(formState.password) ? "valid" : "invalid",
      },
      {
        label: "Au moins une lettre minuscule.",
        status: /[a-z]/.test(formState.password) ? "valid" : "invalid",
      },
      {
        label: "Au moins un chiffre.",
        status: /\d/.test(formState.password) ? "valid" : "invalid",
      },
      {
        label: "Au moins un caractere special.",
        status: /[^A-Za-z0-9]/.test(formState.password) ? "valid" : "invalid",
      },
      {
        label: "Different du mot de passe actuel.",
        status: !passwordChangeRequested || !formState.currentPassword
          ? "pending"
          : formState.password !== formState.currentPassword
            ? "valid"
            : "invalid",
      },
    ],
    [formState.currentPassword, formState.password, passwordChangeRequested],
  );

  const passwordRulesAllValid = useMemo(
    () => passwordRules.every((rule) => rule.status === "valid"),
    [passwordRules],
  );

  const canSubmitPasswordChange =
    passwordChangeRequested &&
    formState.currentPassword.trim().length > 0 &&
    currentPasswordCheckState === "valid" &&
    passwordRulesAllValid &&
    formState.password === formState.confirmPassword;

  const extractApiMessage = (error: any, fallback: string) => {
    const message = error?.response?.data?.message;
    if (Array.isArray(message)) return message.join(" ");
    if (typeof message === "string" && message.trim()) return message;
    if (typeof error?.response?.data?.error === "string" && error.response.data.error.trim()) {
      return error.response.data.error;
    }
    return fallback;
  };

  const syncStatus = async () => {
    if (!apiURL) {
      setStatus({
        ...emptyStatus,
        canEdit: false,
        cooldownMessage: "Configuration API manquante.",
      });
      setStatusLoading(false);
      return;
    }

    setStatusLoading(true);
    try {
      const response = await axios.get(`${apiURL}/auth/profile-update/status`, {
        withCredentials: true,
      });
      const nextStatus = response.data as ProfileUpdateStatus;
      setStatus(nextStatus);
      setOtpStep(Boolean(nextStatus.hasPendingRequest));
      setOtpDigits(["", "", "", "", "", ""]);
      setOtpError(null);
      setOtpInfo(
        nextStatus.hasPendingRequest
          ? "Une demande est deja en attente. Saisissez le code OTP recu par email."
          : null,
      );
      const resendAt = nextStatus.resendAvailableAt
        ? new Date(nextStatus.resendAvailableAt).getTime()
        : 0;
      setResendSecondsLeft(
        resendAt > Date.now() ? Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)) : 0,
      );
      setPendingExpiresLabel(formatDateTime(nextStatus.pendingExpiresAt));
    } catch (error: any) {
      toast({
        title: "Chargement impossible",
        description: extractApiMessage(
          error,
          "Impossible de recuperer le statut de modification du profil.",
        ),
        variant: "destructive",
      });
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    void syncStatus();
  }, [apiURL]);

  useEffect(() => {
    if (resendSecondsLeft <= 0) return;
    const timer = window.setTimeout(() => {
      setResendSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendSecondsLeft]);

  useEffect(() => {
    if (!otpStep) return;
    const timer = window.setTimeout(() => {
      otpInputRefs.current[0]?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [otpStep]);

  useEffect(() => {
    if (!apiURL) return;

    const currentPassword = formState.currentPassword.trim();
    if (!currentPassword) {
      currentPasswordValidationSeq.current += 1;
      setCurrentPasswordCheckState("idle");
      setCurrentPasswordMessage(null);
      return;
    }

    setCurrentPasswordCheckState("checking");
    setCurrentPasswordMessage(null);

    const requestSeq = ++currentPasswordValidationSeq.current;
    const timer = window.setTimeout(async () => {
      try {
        await axios.post(
          `${apiURL}/auth/profile-update/validate-current-password`,
          { currentPassword },
          { withCredentials: true },
        );

        if (currentPasswordValidationSeq.current !== requestSeq) return;
        setCurrentPasswordCheckState("valid");
        setCurrentPasswordMessage("Mot de passe actuel correct.");
      } catch (error: any) {
        if (currentPasswordValidationSeq.current !== requestSeq) return;
        setCurrentPasswordCheckState("invalid");
        setCurrentPasswordMessage(
          extractApiMessage(error, "Le mot de passe actuel est incorrect."),
        );
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [apiURL, formState.currentPassword]);

  const handleChange =
    (field: keyof PasswordFormState) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setFormState((current) => ({
        ...current,
        [field]: event.target.value,
      }));
    };

  const remainingLabel = useMemo(() => {
    if (!status.remainingMs || status.remainingMs <= 0) return null;
    const totalMinutes = Math.ceil(status.remainingMs / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) return `${minutes} min`;
    if (minutes === 0) return `${hours} h`;
    return `${hours} h ${minutes} min`;
  }, [status.remainingMs]);

  const handleRequestOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!apiURL || !status.canEdit || submitting) return;

    if (!passwordChangeRequested) {
      toast({
        title: "Mot de passe requis",
        description: "Veuillez saisir un nouveau mot de passe pour continuer.",
        variant: "destructive",
      });
      return;
    }

    if (!formState.currentPassword) {
      toast({
        title: "Mot de passe actuel requis",
        description: "Veuillez saisir votre mot de passe actuel pour modifier votre mot de passe.",
        variant: "destructive",
      });
      return;
    }

    if (!formState.password || !formState.confirmPassword) {
      toast({
        title: "Confirmation incomplete",
        description: "Veuillez saisir le nouveau mot de passe et sa confirmation.",
        variant: "destructive",
      });
      return;
    }

    if (formState.password !== formState.confirmPassword) {
      toast({
        title: "Mots de passe differents",
        description: "Le nouveau mot de passe et sa confirmation ne correspondent pas.",
        variant: "destructive",
      });
      return;
    }

    if (!canSubmitPasswordChange) {
      toast({
        title: "Validation incomplete",
        description:
          currentPasswordCheckState === "invalid"
            ? "Le mot de passe actuel est incorrect."
            : currentPasswordCheckState === "checking"
              ? "Veuillez patienter pendant la verification du mot de passe actuel."
              : "Veuillez completer correctement les regles du nouveau mot de passe.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        Prenom: auth.Prenom || "",
        nom: auth.nom || "",
        email: auth.email || "",
        telephone: normalizePhoneValue(auth.telephone) || null,
        currentPassword: formState.currentPassword,
        password: formState.password,
        confirmPassword: formState.confirmPassword,
      };

      const response = await axios.post(`${apiURL}/auth/profile-update/request`, payload, {
        withCredentials: true,
      });

      const resendAt = response.data?.resendAvailableAt
        ? new Date(response.data.resendAvailableAt).getTime()
        : Date.now() + 60 * 1000;
      setResendSecondsLeft(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
      setOtpStep(true);
      setOtpDigits(["", "", "", "", "", ""]);
      setOtpEmail(auth.email || "");
      setPendingExpiresLabel(formatDateTime(response.data?.expiresAt));
      setOtpError(null);
      setOtpInfo(
        "Un code a 6 chiffres a ete envoye a votre adresse email actuelle pour confirmer la modification.",
      );
      setStatus((current) => ({
        ...current,
        hasPendingRequest: true,
        pendingExpiresAt: response.data?.expiresAt ?? current.pendingExpiresAt,
        resendAvailableAt: response.data?.resendAvailableAt ?? current.resendAvailableAt,
      }));
    } catch (error: any) {
      toast({
        title: "Envoi impossible",
        description: extractApiMessage(error, "Impossible de lancer la verification OTP."),
        variant: "destructive",
      });
      if (error?.response?.status === 429) {
        await syncStatus();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!apiURL) return;
    if (otpCode.length !== 6) {
      setOtpError("Veuillez saisir le code complet a 6 chiffres.");
      setOtpInfo(null);
      return;
    }

    setVerifying(true);
    setOtpError(null);
    try {
      await axios.post(
        `${apiURL}/auth/profile-update/verify`,
        { code: otpCode },
        { withCredentials: true },
      );

      await initialize();
      setOtpInfo("Code verifie. Votre mot de passe a ete mis a jour.");
      navigate("/investisseur/profil");
    } catch (error: any) {
      setOtpInfo(null);
      setOtpError(extractApiMessage(error, "Le code OTP est invalide ou expire."));
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (!apiURL || resendSecondsLeft > 0) return;

    setSubmitting(true);
    try {
      const response = await axios.post(
        `${apiURL}/auth/profile-update/resend`,
        {},
        { withCredentials: true },
      );

      const resendAt = response.data?.resendAvailableAt
        ? new Date(response.data.resendAvailableAt).getTime()
        : Date.now() + 60 * 1000;
      setResendSecondsLeft(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
      setPendingExpiresLabel(formatDateTime(response.data?.expiresAt));
      setOtpDigits(["", "", "", "", "", ""]);
      setOtpError(null);
      setOtpInfo("Nouveau code envoye a votre adresse email actuelle.");
      otpInputRefs.current[0]?.focus();
    } catch (error: any) {
      setOtpInfo(null);
      setOtpError(extractApiMessage(error, "Impossible de renvoyer le code OTP."));
    } finally {
      setSubmitting(false);
    }
  };

  const isBlocked = !status.canEdit;

  const handleOtpInputChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const nextDigits = [...otpDigits];
    nextDigits[index] = value.slice(-1);
    setOtpDigits(nextDigits);
    setOtpError(null);
    setOtpInfo(null);

    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const pastedData = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    const nextDigits = ["", "", "", "", "", ""];
    pastedData.split("").forEach((digit, index) => {
      nextDigits[index] = digit;
    });

    setOtpDigits(nextDigits);
    setOtpError(null);
    setOtpInfo(null);

    const targetIndex = Math.min(pastedData.length, 5);
    otpInputRefs.current[targetIndex]?.focus();
  };

  const profileInitials = useMemo(() => {
    const first = (auth.Prenom || "").trim().charAt(0);
    const last = (auth.nom || "").trim().charAt(0);
    const fallback = (auth.email || "U").trim().charAt(0).toUpperCase();
    return `${(first || fallback).toUpperCase()}${(last || "").toUpperCase()}`.slice(0, 2);
  }, [auth.Prenom, auth.email, auth.nom]);

  const roleLabel = useMemo(() => {
    const rawRole = String(auth.role || "").trim();
    if (!rawRole) return "Investisseur";
    return rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
  }, [auth.role]);

  const sidebarStats = useMemo(
    () => [
      { label: "Role", value: roleLabel },
      { label: "Email", value: auth.email || "Non renseigne" },
      { label: "Telephone", value: auth.telephone || "Non renseigne" },
    ],
    [auth.email, auth.telephone, roleLabel],
  );

  return (
    <InvestorLayout>
      <SettingsLayout
        className={styles.page}
        sidebar={
          <ProfileSidebar
            initials={profileInitials || "U"}
            displayName={`${auth.Prenom || "Utilisateur"} ${auth.nom || ""}`.trim()}
            role={roleLabel}
            plan="Pro"
            stats={sidebarStats}
            className={styles.sidebar}
            navItems={[
              { to: "/investisseur/profil", label: "Profile Overview", icon: User },
              { to: "/investisseur/modifier-profil", label: "Personal Info", icon: Users2 },
              { to: "/investisseur/parametres#experience", label: "Account Settings", icon: Shield },
              { to: "/investisseur/change-password", label: "Change Password", icon: KeyRound },
              { to: "/investisseur/parametres#notifications", label: "Email Settings", icon: Mail },
            ]}
          />
        }
      >
        <PageHeader crumb="Change Password" />

        {statusLoading ? (
          <div className={styles.bannerLoading}>
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            Verification des droits de modification...
          </div>
        ) : isBlocked ? (
          <div className={styles.bannerWarning}>
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-0.5">
              <p className="font-medium text-amber-800">Modification temporairement indisponible</p>
              <p>
                {status.cooldownMessage ||
                  "Vous avez deja modifie vos informations personnelles recemment."}
              </p>
              {remainingLabel ? <p>Disponible a nouveau dans {remainingLabel}.</p> : null}
            </div>
          </div>
        ) : null}

        <div className="space-y-5">
          <Card title="Change Password" className={styles.card}>
            <form id="security" className={styles.passwordSection} onSubmit={handleRequestOtp}>
              <div className="grid gap-5">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Current Password
                  </span>
                  <div className={styles.passwordField}>
                    <Input
                      type={showCurrentPassword ? "text" : "password"}
                      value={formState.currentPassword}
                      onChange={handleChange("currentPassword")}
                      placeholder="Enter current password"
                      className="h-9 rounded-sm border-slate-200 pr-10 text-sm shadow-sm focus-visible:border-slate-400 focus-visible:ring-slate-200"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() => setShowCurrentPassword((current) => !current)}
                      aria-label={
                        showCurrentPassword
                          ? "Masquer le mot de passe actuel"
                          : "Afficher le mot de passe actuel"
                      }
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-[15px] w-[15px]" strokeWidth={1.8} />
                      ) : (
                        <Eye className="h-[15px] w-[15px]" strokeWidth={1.8} />
                      )}
                    </button>
                  </div>
                  <div
                    className={styles.passwordStatus}
                    data-state={
                      currentPasswordCheckState === "valid"
                        ? "valid"
                        : currentPasswordCheckState === "invalid"
                          ? "invalid"
                          : "neutral"
                    }
                  >
                    {currentPasswordCheckState === "checking" ? (
                      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                    ) : currentPasswordCheckState === "valid" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : currentPasswordCheckState === "invalid" ? (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <span>
                      {currentPasswordMessage ||
                        (formState.currentPassword
                          ? "Verification du mot de passe actuel..."
                          : PASSWORD_CHANGE_IDLE_TEXT)}
                    </span>
                  </div>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    New Password
                  </span>
                  <div className={styles.passwordField}>
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={formState.password}
                      onChange={handleChange("password")}
                      placeholder="Enter new password"
                      className="h-9 rounded-sm border-slate-200 pr-10 text-sm shadow-sm focus-visible:border-slate-400 focus-visible:ring-slate-200"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={
                        showPassword
                          ? "Masquer le nouveau mot de passe"
                          : "Afficher le nouveau mot de passe"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-[15px] w-[15px]" strokeWidth={1.8} />
                      ) : (
                        <Eye className="h-[15px] w-[15px]" strokeWidth={1.8} />
                      )}
                    </button>
                  </div>

                  {(passwordChangeRequested || formState.password) && (
                    <div className={styles.rulesBox}>
                      <div className={styles.rulesTitle}>Security Rules</div>
                      <ul className={styles.rulesList}>
                        {passwordRules.map((rule) => (
                          <li key={rule.label} data-state={rule.status}>
                            {rule.status === "valid" ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                            ) : rule.status === "pending" ? (
                              <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                            ) : (
                              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            )}
                            <span>{rule.label}</span>
                          </li>
                        ))}
                      </ul>

                      {passwordChangeRequested &&
                      formState.currentPassword &&
                      formState.password &&
                      formState.password === formState.currentPassword ? (
                        <div className={styles.confirmStatus} data-state="bad">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>
                            Le nouveau mot de passe doit etre different de votre mot de passe
                            actuel.
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Confirm Password
                  </span>
                  <div className={styles.passwordField}>
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={formState.confirmPassword}
                      onChange={handleChange("confirmPassword")}
                      placeholder="Confirm new password"
                      className="h-9 rounded-sm border-slate-200 pr-10 text-sm shadow-sm focus-visible:border-slate-400 focus-visible:ring-slate-200"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() => setShowConfirmPassword((current) => !current)}
                      aria-label={
                        showConfirmPassword
                          ? "Masquer la confirmation du mot de passe"
                          : "Afficher la confirmation du mot de passe"
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-[15px] w-[15px]" strokeWidth={1.8} />
                      ) : (
                        <Eye className="h-[15px] w-[15px]" strokeWidth={1.8} />
                      )}
                    </button>
                  </div>

                  {(passwordChangeRequested || formState.confirmPassword) && (
                    <div
                      className={styles.confirmStatus}
                      data-state={
                        !formState.password || !formState.confirmPassword
                          ? "neutral"
                          : formState.password === formState.confirmPassword
                            ? "ok"
                            : "bad"
                      }
                    >
                      {!formState.password || !formState.confirmPassword ? (
                        <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                      ) : formState.password === formState.confirmPassword ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      ) : (
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <span>
                        {!formState.password || !formState.confirmPassword
                          ? "Saisissez les deux champs pour verifier la confirmation."
                          : formState.password === formState.confirmPassword
                            ? "Les mots de passe correspondent."
                            : "Les mots de passe ne correspondent pas."}
                      </span>
                    </div>
                  )}
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-start gap-3">
                <Button
                  type="submit"
                  className="mt-1 rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
                  disabled={submitting || !status.canEdit || !canSubmitPasswordChange}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Enregistrer les modifications
                </Button>
              </div>
            </form>
          </Card>

          {otpStep ? (
            <Card title="Validation OTP" className={styles.card}>
              <div id="otp" className={styles.otpSection}>
                <div className="rounded-md border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <p className="font-medium text-slate-800">
                    Saisissez le code envoye a <span className="font-semibold">{otpEmail}</span>.
                  </p>
                  {pendingExpiresLabel ? (
                    <p className="mt-1">Code valable jusqu au {pendingExpiresLabel}.</p>
                  ) : null}
                </div>

                {otpError ? (
                  <div className={styles.otpError}>
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{otpError}</span>
                  </div>
                ) : null}

                {otpInfo ? (
                  <div className={styles.otpSuccess}>
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{otpInfo}</span>
                  </div>
                ) : null}

                <div className={styles.otpGrid} onPaste={handleOtpPaste}>
                  {otpDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(element) => {
                        otpInputRefs.current[index] = element;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={digit}
                      disabled={verifying}
                      onChange={(event) => handleOtpInputChange(index, event.target.value)}
                      onKeyDown={(event) => handleOtpKeyDown(index, event)}
                      className={styles.otpInput}
                      aria-label={`Chiffre OTP ${index + 1}`}
                    />
                  ))}
                </div>

                <div className={styles.otpActions}>
                  <Button
                    className={styles.otpPrimaryButton}
                    onClick={handleVerifyOtp}
                    disabled={otpCode.length !== 6 || verifying}
                    type="button"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Valider le code
                  </Button>

                  <Button
                    variant="outline"
                    className={styles.otpSecondaryButton}
                    onClick={handleResendOtp}
                    disabled={resendSecondsLeft > 0 || submitting}
                    type="button"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    {resendSecondsLeft > 0
                      ? `Renvoyer dans ${resendSecondsLeft}s`
                      : "Renvoyer le code"}
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}

          <Card title="Regles de securite" className={styles.card}>
            <div id="rules" className={styles.rulesSection}>
              <ul className="space-y-2 text-sm leading-7 text-slate-500">
                <li>Validation obligatoire par code OTP a 6 chiffres.</li>
                <li>Le code expire 10 minutes apres son envoi.</li>
                <li>Le code est envoye a votre adresse email actuelle.</li>
                <li>Une seule modification confirmee toutes les 48 heures.</li>
              </ul>

              <p className="rounded-md border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-500">
                Si vous changez votre email ou votre mot de passe, la modification n&apos;est
                appliquee qu&apos;apres verification OTP.
              </p>
            </div>
          </Card>
        </div>
      </SettingsLayout>
    </InvestorLayout>
  );
}
