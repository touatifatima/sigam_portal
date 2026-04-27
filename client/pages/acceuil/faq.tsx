import { useState } from "react";
import Link from "next/link";
import { ChevronDown, FileText, HelpCircle, MapPinned, ShieldCheck } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import styles from "./faq.module.css";

type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

type FaqSection = {
  id: string;
  title: string;
  icon: typeof HelpCircle;
  items: FaqItem[];
};

const faqSections: FaqSection[] = [
  {
    id: "compte",
    title: "Compte et acces",
    icon: ShieldCheck,
    items: [
      {
        id: "compte-1",
        question: "Comment creer un compte sur le portail ?",
        answer:
          "Cliquez sur le bouton d'inscription, completez les informations demandees puis validez votre adresse e-mail. Une fois le compte active, vous pouvez deposer et suivre vos demarches.",
      },
      {
        id: "compte-2",
        question: "Je n'ai pas recu l'e-mail de verification, que faire ?",
        answer:
          "Verifiez d'abord vos dossiers Spam/Indesirable. Si le message n'apparait pas, relancez l'envoi depuis l'ecran de connexion ou contactez l'assistance technique via l'adresse de contact du footer.",
      },
      {
        id: "compte-3",
        question: "Quelle est la difference entre les roles utilisateur ?",
        answer:
          "Le role Investisseur gere les demandes et le suivi des procedures, le role Operateur suit les permis operationnels, le role Cadastre utilise les modules de verification et de carte, et le role Admin pilote l'instruction.",
      },
    ],
  },
  {
    id: "demandes",
    title: "Demandes et permis",
    icon: FileText,
    items: [
      {
        id: "demandes-1",
        question: "Comment deposer une nouvelle demande ?",
        answer:
          "Depuis votre espace, ouvrez \"Nouvelle Demande\" puis completez les etapes (type, zone, pieces, validation). Le dossier est ensuite transmis pour instruction selon le workflow officiel.",
      },
      {
        id: "demandes-2",
        question: "Puis-je modifier une demande deja soumise ?",
        answer:
          "Apres soumission, certaines informations peuvent etre verrouillees pour garantir la tracabilite. Si une correction est necessaire, utilisez la messagerie ou les demandes de complement quand elles sont disponibles.",
      },
      {
        id: "demandes-3",
        question: "Comment suivre l'etat de mon dossier ?",
        answer:
          "Le tableau de bord affiche le statut en temps reel (brouillon, en cours, en attente, valide, refuse, etc.) ainsi que l'historique des actions et des notifications associees.",
      },
      {
        id: "demandes-4",
        question: "Le depot en ligne signifie-t-il que le permis est accorde ?",
        answer:
          "Non. Le depot lance la procedure administrative. L'octroi final depend de l'instruction technique et juridique effectuee par les services competents.",
      },
    ],
  },
  {
    id: "carte",
    title: "Carte et verification",
    icon: MapPinned,
    items: [
      {
        id: "carte-1",
        question: "A quoi sert la verification prealable ?",
        answer:
          "Elle permet de controler les coordonnees, les perimetres et les chevauchements avant soumission. Cela reduit les erreurs techniques et accelere l'analyse des dossiers.",
      },
      {
        id: "carte-2",
        question: "Que montre la carte publique ?",
        answer:
          "La carte publique presente les couches de reference, les zones et les titres publies selon les donnees disponibles au public, sans exposer les informations confidentielles des dossiers internes.",
      },
      {
        id: "carte-3",
        question: "Pourquoi mes coordonnees semblent decalees ?",
        answer:
          "Un decalage peut venir d'un probleme de projection, d'un format de coordonnees ou d'une saisie incomplete. Verifiez le systeme de reference attendu et utilisez le module de controle geometrique.",
      },
    ],
  },
];

export default function FaqPage() {
  const [openId, setOpenId] = useState<string>(faqSections[0]?.items[0]?.id ?? "");

  return (
    <div className={styles.page}>
      <Header />

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={`container ${styles.heroInner}`}>
            <div className={styles.heroBadge}>
              <HelpCircle size={16} />
              <span>Centre d'aide</span>
            </div>
            <h1 className={styles.title}>FAQ - Foire aux questions</h1>
            <p className={styles.subtitle}>
              Retrouvez les reponses aux questions frequentes sur l'utilisation du
              Portail des Activites Minieres (POM): acces, demandes, verification et suivi.
            </p>
            <div className={styles.actions}>
              <Link href="/" className={styles.primaryCta}>
                Retour a l'accueil
              </Link>
              <Link href="/auth/login" className={styles.secondaryCta}>
                Se connecter
              </Link>
            </div>
          </div>
        </section>

        <section className={`container ${styles.sectionsWrap}`}>
          {faqSections.map((section) => {
            const SectionIcon = section.icon;
            return (
              <article key={section.id} className={styles.sectionCard} id={section.id}>
                <header className={styles.sectionHeader}>
                  <div className={styles.sectionIconWrap}>
                    <SectionIcon size={18} />
                  </div>
                  <h2>{section.title}</h2>
                </header>

                <div className={styles.items}>
                  {section.items.map((item) => {
                    const expanded = openId === item.id;

                    return (
                      <div key={item.id} className={styles.item}>
                        <button
                          type="button"
                          className={styles.question}
                          onClick={() => setOpenId(expanded ? "" : item.id)}
                          aria-expanded={expanded}
                          aria-controls={`faq-panel-${item.id}`}
                        >
                          <span>{item.question}</span>
                          <ChevronDown
                            size={18}
                            className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`}
                          />
                        </button>
                        {expanded ? (
                          <div
                            id={`faq-panel-${item.id}`}
                            className={styles.answer}
                            role="region"
                            aria-label={item.question}
                          >
                            {item.answer}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </section>
      </main>

      <Footer />
    </div>
  );
}

