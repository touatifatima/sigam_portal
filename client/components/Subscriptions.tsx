import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Building2, Check, Gem, Lock, User, BarChart3 } from "lucide-react";
import styles from "./Subscriptions.module.css";
import { ScrollReveal } from "./ScrollReveal";

type BillingCycle = "monthly" | "yearly";

type Plan = {
  id: string;
  icon: typeof User;
  name: string;
  tagline: string;
  monthlyPrice: number;
  yearlyPrice: number;
  featured?: boolean;
  features: string[];
  cta: string;
  href: string;
};

const plans: Plan[] = [
  {
    id: "basic",
    icon: User,
    name: "Basic",
    tagline: "Ideal pour les consultants et petites structures",
    monthlyPrice: 15000,
    yearlyPrice: 150000,
    features: [
      "Consultation des cartes",
      "Verification des perimetres (limite)",
      "Telechargement de documents (limite)",
      "Support par email",
    ],
    cta: "Choisir cette offre",
    href: "/Signup/page",
  },
  {
    id: "standard",
    icon: BarChart3,
    name: "Standard",
    tagline: "Pour les entreprises et exploitants miniers",
    monthlyPrice: 35000,
    yearlyPrice: 350000,
    features: [
      "Toutes les fonctionnalites Basic",
      "Verification des perimetres (illimite)",
      "Gestion de vos demandes",
      "Rapports et statistiques",
      "Support prioritaire",
    ],
    cta: "Choisir cette offre",
    href: "/Signup/page",
  },
  {
    id: "premium",
    icon: Gem,
    name: "Premium",
    tagline: "Pour les grandes entreprises et institutions",
    monthlyPrice: 65000,
    yearlyPrice: 650000,
    featured: true,
    features: [
      "Toutes les fonctionnalites Standard",
      "Donnees geologiques avancees",
      "API & Integrations",
      "Utilisateurs multiples",
      "Support 24/7 dedie",
    ],
    cta: "Choisir cette offre",
    href: "/Signup/page",
  },
];

const enterprisePlan = {
  name: "Entreprise",
  tagline: "Solution sur mesure pour les grands organismes",
  features: [
    "Toutes les fonctionnalites Premium",
    "Solutions personnalisees",
    "Integration sur mesure",
    "Formation et accompagnement",
    "SLA garanti",
  ],
};

const comparisonRows: { label: string; values: [string, string, string, string] }[] = [
  { label: "Consultation des cartes", values: ["check", "check", "check", "check"] },
  { label: "Verification des perimetres", values: ["Limite", "Illimite", "Illimite", "Illimite"] },
  { label: "Telechargement de documents", values: ["Limite", "Illimite", "Illimite", "Illimite"] },
  { label: "Gestion des demandes", values: ["", "check", "check", "check"] },
  { label: "Rapports et statistiques", values: ["", "check", "check", "check"] },
  { label: "Donnees geologiques avancees", values: ["", "", "check", "check"] },
  { label: "API & Integrations", values: ["", "", "check", "check"] },
  { label: "Utilisateurs multiples", values: ["", "", "check", "check"] },
  { label: "Support", values: ["Email", "Prioritaire", "24/7 dedie", "24/7 dedie + SLA"] },
];

const formatPrice = (value: number) => `${value.toLocaleString("fr-FR")}`;

export const Subscriptions = () => {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  return (
    <section className={styles.section}>
      <div className={`container ${styles.container}`}>
        <ScrollReveal>
          <div className={styles.header}>
            <span className={styles.label}>Tarifs &amp; abonnements</span>
            <h2 className={styles.title}>
              Une offre adaptee a <span className={styles.titleHighlight}>chaque activite</span>
            </h2>
            <p className={styles.description}>
              Choisissez l'abonnement qui correspond a vos besoins de consultation, de verification
              et de gestion de vos activites minieres.
            </p>

            <div className={styles.toggle} role="group" aria-label="Cycle de facturation">
              <button
                type="button"
                className={`${styles.toggleOption} ${billingCycle === "monthly" ? styles.toggleOptionActive : ""}`}
                aria-pressed={billingCycle === "monthly"}
                onClick={() => setBillingCycle("monthly")}
              >
                Mensuel
              </button>
              <button
                type="button"
                className={`${styles.toggleOption} ${billingCycle === "yearly" ? styles.toggleOptionActive : ""}`}
                aria-pressed={billingCycle === "yearly"}
                onClick={() => setBillingCycle("yearly")}
              >
                Annuel
                <span className={styles.toggleBadge}>-17%</span>
              </button>
            </div>
          </div>
        </ScrollReveal>

        <div className={styles.grid}>
          {plans.map((plan, i) => {
            const Icon = plan.icon;
            const price = billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
            return (
              <ScrollReveal key={plan.id} delay={i * 90}>
                <div className={`${styles.planCard} ${plan.featured ? styles.planCardFeatured : ""}`}>
                  {plan.featured && <span className={styles.planBadge}>Populaire</span>}
                  <div className={styles.planIcon}>
                    <Icon />
                  </div>
                  <h3 className={styles.planName}>{plan.name}</h3>
                  <p className={styles.planTagline}>{plan.tagline}</p>

                  <div className={styles.planPrice}>
                    <span className={styles.planPriceValue}>{formatPrice(price)}</span>
                    <span className={styles.planPriceUnit}>
                      DZD /{billingCycle === "monthly" ? "mois" : "an"}
                    </span>
                  </div>

                  <ul className={styles.planFeatures}>
                    {plan.features.map((feature) => (
                      <li key={feature} className={styles.planFeature}>
                        <Check className={styles.planFeatureIcon} />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={
                      plan.featured
                        ? "homePremiumSignupButton homePremiumButtonMd"
                        : "homePremiumGhostButtonLight homePremiumButtonMd"
                    }
                    asChild
                  >
                    <a href={plan.href}>{plan.cta}</a>
                  </Button>
                </div>
              </ScrollReveal>
            );
          })}

          <ScrollReveal delay={plans.length * 90}>
            <div className={styles.planCard}>
              <div className={styles.planIcon}>
                <Building2 />
              </div>
              <h3 className={styles.planName}>{enterprisePlan.name}</h3>
              <p className={styles.planTagline}>{enterprisePlan.tagline}</p>

              <div className={styles.planPrice}>
                <span className={styles.planPriceValue}>Sur devis</span>
              </div>

              <ul className={styles.planFeatures}>
                {enterprisePlan.features.map((feature) => (
                  <li key={feature} className={styles.planFeature}>
                    <Check className={styles.planFeatureIcon} />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button className="homePremiumGhostButtonLight homePremiumButtonMd" asChild>
                <a href="/auth/login">Nous contacter</a>
              </Button>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal delay={100}>
          <p className={styles.securityNote}>
            <Lock className={styles.securityIcon} />
            Tous nos abonnements incluent la securite des donnees et les mises a jour regulieres.
          </p>
        </ScrollReveal>

        <ScrollReveal delay={140}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fonctionnalites</th>
                  <th>Basic</th>
                  <th>Standard</th>
                  <th className={styles.tableFeaturedCol}>Premium</th>
                  <th>Entreprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label}>
                    <td className={styles.tableRowLabel}>{row.label}</td>
                    {row.values.map((value, idx) => (
                      <td key={idx} className={idx === 2 ? styles.tableFeaturedCol : undefined}>
                        {value === "check" ? (
                          <Check className={styles.tableCheck} />
                        ) : value ? (
                          value
                        ) : (
                          <span className={styles.tableDash}>&mdash;</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default Subscriptions;
