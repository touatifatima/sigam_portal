import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeInfo,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  Database,
  FileSearch,
  FileText,
  Gem,
  Globe,
  LayoutDashboard,
  Mail,
  MapPin,
  Phone,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import styles from "./TarifsAbonnements.module.css";

type BillingCycle = "monthly" | "annual";

type FeatureValue = boolean | "limited" | "unlimited" | "email" | "priority" | "dedicated" | "sla";

type PlanCard = {
  key: "basic" | "standard" | "premium" | "enterprise";
  name: string;
  description: string;
  priceMonthly: string;
  priceAnnual: string;
  ctaLabel: string;
  ctaHref: string;
  accent: "purple" | "green" | "orange";
  icon: LucideIcon;
  popular?: boolean;
  features: string[];
};

type ComparisonRow = {
  label: string;
  basic: FeatureValue;
  standard: FeatureValue;
  premium: FeatureValue;
  enterprise: FeatureValue;
};

type StepItem = {
  number: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: "purple" | "green" | "blue" | "orange";
};

type TrustItem = {
  title: string;
  description: string;
  icon: LucideIcon;
};

const NAV_ITEMS = [
  { label: "Accueil", href: "/" },
  { label: "Services", href: "#services" },
  { label: "Tarifs & Abonnements", href: "#tarifs", active: true },
  { label: "Resources", href: "#resources" },
  { label: "Aide & Support", href: "#support" },
  { label: "A propos", href: "#about" },
];

const HOW_IT_WORKS: StepItem[] = [
  {
    number: "1",
    title: "Choisissez votre offre",
    description: "Selectionnez l'abonnement qui correspond a vos besoins.",
    icon: Users,
    tone: "purple",
  },
  {
    number: "2",
    title: "Creez votre compte",
    description: "Renseignez vos informations et activez votre espace securise.",
    icon: Building2,
    tone: "green",
  },
  {
    number: "3",
    title: "Effectuez le paiement",
    description: "Payez en ligne de maniere securisee via la plateforme.",
    icon: Wallet,
    tone: "blue",
  },
  {
    number: "4",
    title: "Accedez a vos services",
    description: "Profitez immediatement de toutes les fonctionnalites disponibles.",
    icon: Rocket,
    tone: "orange",
  },
];

const PLAN_CARDS: PlanCard[] = [
  {
    key: "basic",
    name: "Basic",
    description: "Ideal pour les consultants et petites structures",
    priceMonthly: "15.000 DZD /mois",
    priceAnnual: "150.000 DZD /an",
    ctaLabel: "Choisir cette offre",
    ctaHref: "/Signup/page",
    accent: "purple",
    icon: FileText,
    features: [
      "Consultation des cartes",
      "Verification des perimetres (limitee)",
      "Telechargement de documents (limite)",
      "Support par email",
    ],
  },
  {
    key: "standard",
    name: "Standard",
    description: "Pour les entreprises et exploitants miniers",
    priceMonthly: "35.000 DZD /mois",
    priceAnnual: "350.000 DZD /an",
    ctaLabel: "Choisir cette offre",
    ctaHref: "/Signup/page",
    accent: "green",
    icon: BarChart3,
    features: [
      "Toutes les fonctionnalites Basic",
      "Verification des perimetres (illimitee)",
      "Gestion de vos demandes",
      "Rapports et statistiques",
      "Support prioritaire",
    ],
  },
  {
    key: "premium",
    name: "Premium",
    description: "Pour les grandes entreprises et institutions",
    priceMonthly: "65.000 DZD /mois",
    priceAnnual: "650.000 DZD /an",
    ctaLabel: "Choisir cette offre",
    ctaHref: "/Signup/page",
    accent: "purple",
    icon: Gem,
    popular: true,
    features: [
      "Toutes les fonctionnalites Standard",
      "Donnees geologiques avancees",
      "API & Integrations",
      "Utilisateurs multiples",
      "Support 24/7 dedie",
    ],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    description: "Solution sur mesure pour les grands organismes",
    priceMonthly: "Sur devis",
    priceAnnual: "Sur devis",
    ctaLabel: "Nous contacter",
    ctaHref: "#support",
    accent: "orange",
    icon: Building2,
    features: [
      "Toutes les fonctionnalites Premium",
      "Solutions personnalisees",
      "Integration sur mesure",
      "Formation et accompagnement",
      "SLA garanti",
    ],
  },
];

const TRUST_ITEMS: TrustItem[] = [
  {
    title: "Donnees officielles et certifiees",
    description: "Acces a des informations issues des referentiels officiels.",
    icon: ShieldCheck,
  },
  {
    title: "Conformite legale et reglementaire",
    description: "Une offre alignee avec les exigences du secteur minier.",
    icon: BadgeInfo,
  },
  {
    title: "Securite maximale et confidentialite",
    description: "Protection des comptes et des donnees sensibles.",
    icon: Globe,
  },
  {
    title: "Disponible 24/7 sans interruption",
    description: "Un service accessible a tout moment, ou que vous soyez.",
    icon: Clock3,
  },
];

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    label: "Consultation des cartes",
    basic: true,
    standard: true,
    premium: true,
    enterprise: true,
  },
  {
    label: "Verification des perimetres",
    basic: "limited",
    standard: "unlimited",
    premium: "unlimited",
    enterprise: "unlimited",
  },
  {
    label: "Telechargement de documents",
    basic: "limited",
    standard: "unlimited",
    premium: "unlimited",
    enterprise: "unlimited",
  },
  {
    label: "Gestion des demandes",
    basic: true,
    standard: true,
    premium: true,
    enterprise: true,
  },
  {
    label: "Rapports et statistiques",
    basic: false,
    standard: false,
    premium: true,
    enterprise: true,
  },
  {
    label: "Donnees geologiques avancees",
    basic: false,
    standard: false,
    premium: true,
    enterprise: true,
  },
  {
    label: "API & Integrations",
    basic: false,
    standard: false,
    premium: true,
    enterprise: true,
  },
  {
    label: "Utilisateurs multiples",
    basic: false,
    standard: false,
    premium: true,
    enterprise: true,
  },
  {
    label: "Support",
    basic: "email",
    standard: "priority",
    premium: "dedicated",
    enterprise: "sla",
  },
];

const billingLabels: Record<BillingCycle, string> = {
  monthly: "Mensuel",
  annual: "Annuel",
};

function formatCompareValue(value: FeatureValue) {
  if (value === true) {
    return <Check className={styles.yesMark} />;
  }
  if (value === false) {
    return <span className={styles.dash}>-</span>;
  }
  if (value === "limited") return "Limite";
  if (value === "unlimited") return "Illimite";
  if (value === "email") return "Email";
  if (value === "priority") return "Prioritaire";
  if (value === "dedicated") return "24/7 dedie";
  if (value === "sla") return "24/7 + SLA";
  return value;
}

function HeroMetric({
  title,
  value,
  hint,
  icon: Icon,
  className,
}: {
  title: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  className: string;
}) {
  return (
    <div className={`${styles.metricCard} ${className}`}>
      <div className={styles.metricIcon}>
        <Icon size={18} />
      </div>
      <div className={styles.metricBody}>
        <div className={styles.metricTitle}>{title}</div>
        <div className={styles.metricValue}>{value}</div>
        <div className={styles.metricHint}>{hint}</div>
      </div>
    </div>
  );
}

export default function TarifsAbonnementsPage() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("annual");

  useEffect(() => {
    document.title = "Tarifs & Abonnements | Cadastre National des Activites Minieres";
  }, []);

  const activeBillingLabel = useMemo(() => billingLabels[billingCycle], [billingCycle]);

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Link href="/" className={styles.brand}>
            <div className={styles.brandMark} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className={styles.brandText}>
              <div className={styles.brandName}>CADASTRE NATIONAL</div>
              <div className={styles.brandSub}>DES ACTIVITES MINIERES</div>
            </div>
          </Link>

          <nav className={styles.nav} aria-label="Navigation principale">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={`${styles.navLink} ${item.active ? styles.navLinkActive : ""}`}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className={styles.actions}>
            <Link href="/auth/login" className={styles.ghostButton}>
              Se connecter
            </Link>
            <Link href="/Signup/page" className={styles.primaryButton}>
              Creer un compte
            </Link>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section id="top" className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>
              <Sparkles size={14} />
              Plateforme officielle
            </span>
            <h1 className={styles.heroTitle}>
              Accedez a tous les services du
              <span>Cadastre National</span>
              des Activites Minieres
            </h1>
            <p className={styles.heroLead}>
              Une plateforme securisee pour gerer vos titres miniers, verifier les
              perimetres, consulter les donnees officielles et bien plus encore.
            </p>

            <div className={styles.heroBadges}>
              <div className={styles.heroBadge}>
                <ShieldCheck size={18} />
                <div>
                  <strong>Securite</strong>
                  <span>Donnees protegees</span>
                </div>
              </div>
              <div className={styles.heroBadge}>
                <BadgeInfo size={18} />
                <div>
                  <strong>Officiel</strong>
                  <span>Donnees officielles</span>
                </div>
              </div>
              <div className={styles.heroBadge}>
                <Clock3 size={18} />
                <div>
                  <strong>24/7</strong>
                  <span>Acces en continu</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.heroGlow} />
            <div className={styles.heroMapCard}>
              <div className={styles.heroMapTopbar}>
                <span />
                <span />
                <span />
                <div className={styles.heroMapPill} />
              </div>
              <div className={styles.heroMapBody}>
                <img
                  src="/cadastre-satellite-reference.jpg"
                  alt="Illustration de carte cadastrale"
                  className={styles.heroMapImage}
                />
                <div className={styles.heroParcelPin} />
                <HeroMetric
                  title="Titres actifs"
                  value="1,248"
                  hint="ce mois"
                  icon={FileSearch}
                  className={styles.heroMetricLeft}
                />
                <HeroMetric
                  title="Demandes en cours"
                  value="86"
                  hint="Voir tout"
                  icon={Database}
                  className={styles.heroMetricRightTop}
                />
                <HeroMetric
                  title="Superficies totales"
                  value="2,560 km2"
                  hint="Voir details"
                  icon={MapPin}
                  className={styles.heroMetricRightBottom}
                />
              </div>
            </div>
          </div>
        </section>

        <section className={styles.heroFeatures}>
          <div className={styles.heroFeatureItem}>
            <div className={styles.heroFeatureIconGreen}>
              <ShieldCheck size={18} />
            </div>
            <div>
              <strong>Consultation securisee</strong>
              <span>Plateforme officielle et controlee</span>
            </div>
          </div>
          <div className={styles.heroFeatureItem}>
            <div className={styles.heroFeatureIconBlue}>
              <Globe size={18} />
            </div>
            <div>
              <strong>Acces officiel</strong>
              <span>Services et donnees certifiees</span>
            </div>
          </div>
          <div className={styles.heroFeatureItem}>
            <div className={styles.heroFeatureIconOrange}>
              <Clock3 size={18} />
            </div>
            <div>
              <strong>Disponibilite continue</strong>
              <span>Acces 24/7 a votre espace</span>
            </div>
          </div>
        </section>

        <section id="services" className={styles.section}>
          <div className={styles.sectionCard}>
            <h2 className={styles.sectionTitle}>Comment ca marche ?</h2>
            <div className={styles.stepsGrid}>
              {HOW_IT_WORKS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.number} className={styles.stepItem}>
                    <div className={`${styles.stepIcon} ${styles[`stepIcon_${step.tone}`]}`}>
                      <span className={styles.stepNumber}>{step.number}</span>
                      <Icon size={20} />
                    </div>
                    <div className={styles.stepText}>
                      <h3>{step.title}</h3>
                      <p>{step.description}</p>
                    </div>
                    {index < HOW_IT_WORKS.length - 1 ? (
                      <div className={styles.stepArrow}>
                        <ArrowRight size={20} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="tarifs" className={styles.section}>
          <div className={styles.sectionHeaderRow}>
            <div>
              <h2 className={styles.sectionTitle}>Nos offres d&apos;abonnement</h2>
              <p className={styles.sectionLead}>
                Choisissez l&apos;abonnement qui correspond a vos besoins.
              </p>
            </div>

            <div className={styles.billingToggle} role="tablist" aria-label="Periode de facturation">
              <button
                type="button"
                className={billingCycle === "monthly" ? styles.billingActive : styles.billingButton}
                onClick={() => setBillingCycle("monthly")}
              >
                Mensuel
              </button>
              <button
                type="button"
                className={billingCycle === "annual" ? styles.billingActive : styles.billingButton}
                onClick={() => setBillingCycle("annual")}
              >
                Annuel
              </button>
              <span className={styles.billingSave}>-30%</span>
            </div>
          </div>

          <div className={styles.plansGrid}>
            {PLAN_CARDS.map((plan) => {
              const Icon = plan.icon;
              const price = billingCycle === "annual" ? plan.priceAnnual : plan.priceMonthly;
              return (
                <article
                  key={plan.key}
                  className={`${styles.planCard} ${styles[`plan_${plan.accent}`]} ${
                    plan.popular ? styles.planPopular : ""
                  }`}
                >
                  {plan.popular ? <div className={styles.planBadge}>Populaire</div> : null}
                  <div className={styles.planIcon}>
                    <Icon size={20} />
                  </div>
                  <h3 className={styles.planName}>{plan.name}</h3>
                  <p className={styles.planDescription}>{plan.description}</p>
                  <div className={styles.planPrice}>{price}</div>
                  <div className={styles.planBilling}>
                    {plan.key === "enterprise"
                      ? "Contactez-nous pour un accompagnement personnalise"
                      : activeBillingLabel === "Annuel"
                        ? "Paiement annuel avec remise"
                        : "Paiement mensuel"}
                  </div>
                  <ul className={styles.planFeatures}>
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <CheckCircle2 size={16} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {plan.key === "enterprise" ? (
                    <a href={plan.ctaHref} className={`${styles.planButton} ${styles.planButtonOutline}`}>
                      {plan.ctaLabel}
                    </a>
                  ) : (
                    <Link href={plan.ctaHref} className={styles.planButton}>
                      {plan.ctaLabel}
                    </Link>
                  )}
                </article>
              );
            })}
          </div>

          <div className={styles.noteBar}>
            <ShieldCheck size={15} />
            <span>
              Tous nos abonnements incluent la securite des donnees et les mises a jour
              regulieres.
            </span>
          </div>
        </section>

        <section id="resources" className={styles.section}>
          <h2 className={styles.sectionTitle}>Comparez les fonctionnalites</h2>
          <div className={styles.tableWrap}>
            <table className={styles.compareTable}>
              <thead>
                <tr>
                  <th>Fonctionnalites</th>
                  <th>Basic</th>
                  <th>Standard</th>
                  <th>Premium</th>
                  <th>Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{formatCompareValue(row.basic)}</td>
                    <td>{formatCompareValue(row.standard)}</td>
                    <td>{formatCompareValue(row.premium)}</td>
                    <td>{formatCompareValue(row.enterprise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="support" className={styles.section}>
          <div className={styles.trustSection}>
            <div className={styles.trustIntro}>
              <h2>Une plateforme fiable et securisee pour vos activites minieres</h2>
              <p>
                Concue pour les administrations, entreprises et professionnels du secteur
                minier, avec un niveau de securite et de disponibilite eleve.
              </p>
            </div>

            <div className={styles.trustGrid}>
              {TRUST_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className={styles.trustCard}>
                    <div className={styles.trustIcon}>
                      <Icon size={18} />
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.ctaBand}>
            <div className={styles.ctaCopy}>
              <h2>Pret a commencer ?</h2>
              <p>
                Rejoignez des centaines d&apos;entreprises qui utilisent deja le Cadastre
                National des Activites Minieres.
              </p>
            </div>

            <div className={styles.ctaFlow}>
              <div className={styles.ctaStep}>
                <div className={styles.ctaStepIcon}>
                  <Mail size={16} />
                </div>
                <span>Choisissez votre offre</span>
              </div>
              <ArrowRight size={16} className={styles.ctaArrow} />
              <div className={styles.ctaStep}>
                <div className={styles.ctaStepIcon}>
                  <Users size={16} />
                </div>
                <span>Creez votre compte</span>
              </div>
              <ArrowRight size={16} className={styles.ctaArrow} />
              <div className={styles.ctaStep}>
                <div className={styles.ctaStepIcon}>
                  <Wallet size={16} />
                </div>
                <span>Payer en ligne securise</span>
              </div>
              <ArrowRight size={16} className={styles.ctaArrow} />
              <div className={styles.ctaStep}>
                <div className={styles.ctaStepIcon}>
                  <LayoutDashboard size={16} />
                </div>
                <span>Accedez a vos services</span>
              </div>
            </div>

            <div className={styles.ctaAction}>
              <Link href="/Signup/page" className={styles.ctaButton}>
                Commencer maintenant
              </Link>
              <span>Annulation possible a tout moment.</span>
            </div>
          </div>
        </section>

        <footer id="about" className={styles.footer}>
          <div className={styles.footerGrid}>
            <div className={styles.footerBrand}>
              <div className={styles.footerLogoRow}>
                <div className={styles.brandMarkFooter} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <div>
                  <div className={styles.brandNameFooter}>CADASTRE NATIONAL</div>
                  <div className={styles.brandSubFooter}>DES ACTIVITES MINIERES</div>
                </div>
              </div>
              <p>
                Plateforme officielle pour la gestion et la valorisation des donnees
                minieres nationales.
              </p>

              <div className={styles.socialRow}>
                <a href="/auth/login" aria-label="Acceder a la plateforme">
                  <Globe size={16} />
                </a>
                <a href="/auth/login" aria-label="Acceder aux services">
                  <Database size={16} />
                </a>
                <a href="/auth/login" aria-label="Se connecter">
                  <UserIcon />
                </a>
              </div>
            </div>

            <div className={styles.footerColumn}>
              <h3>Services</h3>
              <a href="/cadastre/documents-cadastraux">Cartes geologiques</a>
              <a href="/cadastre/demandedocumentcadastrale">Verification des perimetres</a>
              <a href="/cadastre/trifs_abonnement">Tarifs & Abonnements</a>
              <a href="/cadastre/dashboard">Suivi des titres</a>
              <a href="/cadastre/dashboard">Statistiques</a>
            </div>

            <div className={styles.footerColumn}>
              <h3>Resources</h3>
              <a href="/documentation">Documentation</a>
              <a href="/faq">FAQ</a>
              <a href="/acceuil/actualites">Actualites</a>
              <a href="/conditions-utilisation">Conditions d&apos;utilisation</a>
              <a href="/politique-confidentialite">Politique de confidentialite</a>
            </div>

            <div className={styles.footerColumn}>
              <h3>Nous contacter</h3>
              <a href="https://maps.google.com" target="_blank" rel="noreferrer">
                <MapPin size={15} />
                Cite des Affaires, Alger, Algerie
              </a>
              <a href="tel:+21323456789">
                <Phone size={15} />
                +213 23 45 67 89
              </a>
              <a href="mailto:contact@cadastre-minier.dz">
                <Mail size={15} />
                contact@cadastre-minier.dz
              </a>
              <a href="https://www.cadastre-minier.dz" target="_blank" rel="noreferrer">
                <ArrowUpRight size={15} />
                www.cadastre-minier.dz
              </a>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <span>(c) 2026 Cadastre National des Activites Minieres. Tous droits reserves.</span>
            <div className={styles.footerBottomLinks}>
              <a href="/mentions-legales">Mentions legales</a>
              <span>&gt;</span>
              <a href="/conditions-utilisation">Conditions d&apos;utilisation</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 12.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Zm0 2.1c-4.06 0-7.4 2.16-7.4 4.86V21h14.8v-1.84c0-2.7-3.34-4.86-7.4-4.86Z"
      />
    </svg>
  );
}
