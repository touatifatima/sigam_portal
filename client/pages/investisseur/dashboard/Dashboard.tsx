import { JSX, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  FileText,
  Gem,
  ListChecks,
  CreditCard,
  FolderOpen,
  LogOut,
  Plus,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ChevronDown,
  User,
  Settings,
} from "lucide-react";
import axios from "axios";
import styles from "./Dashboard.module.css";
import { useAuthStore } from "@/src/store/useAuthStore";
import { useAuthReady } from "@/src/hooks/useAuthReady";

type StatState = {
  demandesEnCours: number;
  permisActifs: number;
};

type CardConfig = {
  title: string;
  description: string;
  route: string;
  tone: "rose" | "blue" | "green" | "amber" | "violet" | "mint";
  icon: JSX.Element;
};

const cards: CardConfig[] = [
  {
    title: "Mes Entreprises",
    description: "Gerer vos entreprises, actionnaires et informations legales",
    route: "/investisseur/entreprises",
    tone: "rose",
    icon: <Building2 size={26} />,
  },
  {
    title: "Mes Demandes",
    description: "Soumettre et suivre vos demandes de permis miniers",
    route: "/investisseur/demandes",
    tone: "blue",
    icon: <FileText size={26} />,
  },
  {
    title: "Mes Permis",
    description: "Consulter vos permis delivres et leur validite",
    route: "/investisseur/permis",
    tone: "green",
    icon: <Gem size={26} />,
  },
  {
    title: "Procedures",
    description: "Suivre l'avancement de vos procedures en cours",
    route: "/investisseur/procedures",
    tone: "amber",
    icon: <ListChecks size={26} />,
  },
  {
    title: "Paiements",
    description: "Gerer vos factures et effectuer vos paiements",
    route: "/investisseur/paiements",
    tone: "mint",
    icon: <CreditCard size={26} />,
  },
  {
    title: "Documents",
    description: "Consulter et telecharger vos documents officiels",
    route: "/investisseur/documents",
    tone: "violet",
    icon: <FolderOpen size={26} />,
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { auth, logout } = useAuthStore();
  const isAuthReady = useAuthReady();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;
  const [stats, setStats] = useState<StatState>({
    demandesEnCours: 0,
    permisActifs: 0,
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!auth?.email && !auth?.username) {
      navigate("/");
    }
  }, [auth?.email, auth?.username, isAuthReady, navigate]);

  useEffect(() => {
    let isActive = true;
    if (!apiURL) return () => undefined;
    axios
      .get(`${apiURL}/investisseur/stats`, { withCredentials: true })
      .then((response) => {
        if (!isActive) return;
        setStats({
          demandesEnCours: response.data?.demandesEnAttente ?? 0,
          permisActifs: response.data?.permisActifs ?? 0,
        });
      })
      .catch(() => {
        if (!isActive) return;
        setStats((prev) => ({ ...prev }));
      });
    return () => {
      isActive = false;
    };
  }, [apiURL]);

  const displayName = useMemo(() => {
    return auth?.username || auth?.email || "Utilisateur";
  }, [auth?.email, auth?.username]);

  const displayRoles = useMemo(() => {
    const roleMap: Record<string, string> = {
      investor: "Investisseur",
      investisseur: "Investisseur",
      admin: "Administrateur",
      operateur: "Operateur",
      operator: "Operateur",
    };
    const rawRoles = Array.isArray(auth?.role)
      ? auth?.role
      : auth?.role
      ? String(auth?.role).split(",")
      : [];
    const labels = rawRoles
      .map((role) => roleMap[role.trim().toLowerCase()] || role.trim())
      .filter(Boolean);
    return labels.length ? labels.join(" / ") : "Investisseur";
  }, [auth?.role]);

  const handleLogout = async () => {
    setIsMenuOpen(false);
    await logout();
    navigate("/");
  };

  if (!isAuthReady) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <span className={styles.logoMark}>SIGAM</span>
            <span className={styles.logoText}>Portail</span>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.userMenu} ref={menuRef}>
              <button
                className={styles.userMenuButton}
                onClick={() => setIsMenuOpen((prev) => !prev)}
                aria-expanded={isMenuOpen}
                aria-haspopup="menu"
              >
                <div className={styles.avatar}>{displayName[0] || "U"}</div>
                <div className={styles.userMeta}>
                  <div className={styles.userName}>{displayName}</div>
                  <div className={styles.userRole}>{displayRoles}</div>
                </div>
                <ChevronDown
                  size={16}
                  className={`${styles.menuChevron} ${
                    isMenuOpen ? styles.menuChevronOpen : ""
                  }`}
                />
              </button>

              {isMenuOpen && (
                <div className={styles.userDropdown} role="menu">
                  <button
                    className={styles.dropdownItem}
                    onClick={() => {
                      setIsMenuOpen(false);
                      navigate("/investisseur/profil");
                    }}
                  >
                    <User size={18} className={styles.dropdownIcon} />
                    Mon profil
                  </button>

                  <button
                    className={styles.dropdownItem}
                    onClick={() => {
                      setIsMenuOpen(false);
                      navigate("/investisseur/parametres");
                    }}
                  >
                    <Settings size={18} className={styles.dropdownIcon} />
                    Parametres
                  </button>

                  <button
                    className={`${styles.dropdownItem} ${styles.dropdownLogout}`}
                    onClick={handleLogout}
                  >
                    <LogOut size={18} className={styles.dropdownIcon} />
                    Deconnexion
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>Bienvenue, {displayName}</h1>
            <p className={styles.heroSubtitle}>
              Gerez vos activites minieres depuis votre espace personnel
            </p>
            <div className={styles.roleBadge}>
              <ShieldCheck size={16} />
              <span>{displayRoles}</span>
            </div>
          </div>
          <button
            className={styles.primaryAction}
            onClick={() =>
              navigate(
                "/investisseur/nouvelle_demande/step1_typepermis/page1_typepermis"
              )
            }
          >
            <Plus size={18} />
            Nouvelle Demande
          </button>
        </section>

        <section className={styles.statusRow}>
          <div className={styles.statusCard}>
            <div className={`${styles.statusIcon} ${styles.statusSuccess}`}>
              <CheckCircle2 size={18} />
            </div>
            <div>
              <div className={styles.statusLabel}>Profil entreprise</div>
              <div className={styles.statusValue}>
                {auth.isEntrepriseVerified ? "Confirme" : "Non confirme"}
              </div>
            </div>
          </div>
          <div className={styles.statusCard}>
            <div className={`${styles.statusIcon} ${styles.statusInfo}`}>
              <Clock size={18} />
            </div>
            <div>
              <div className={styles.statusLabel}>Demandes en cours</div>
              <div className={styles.statusValue}>
                {stats.demandesEnCours} demande(s)
              </div>
            </div>
          </div>
          <div className={styles.statusCard}>
            <div className={`${styles.statusIcon} ${styles.statusSuccess}`}>
              <Gem size={18} />
            </div>
            <div>
              <div className={styles.statusLabel}>Permis actifs</div>
              <div className={styles.statusValue}>
                {stats.permisActifs} permis
              </div>
            </div>
          </div>
        </section>

        <section className={styles.quickAccess}>
          <h2 className={styles.sectionTitle}>Acces rapide</h2>
          <div className={styles.cardsGrid}>
            {cards.map((card, index) => (
              <div
                key={card.title}
                className={styles.quickCard}
                data-tone={card.tone}
                style={{ animationDelay: `${0.08 * index}s` }}
              >
                <div className={styles.cardIcon}>{card.icon}</div>
                <div className={styles.cardContent}>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </div>
                <button
                  className={styles.cardButton}
                  onClick={() => navigate(card.route)}
                >
                  Acceder
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
