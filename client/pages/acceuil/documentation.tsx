import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  FileDown,
  FileCheck2,
  Layers3,
  LifeBuoy,
  MapPinned,
  ShieldCheck,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import styles from "./documentation.module.css";

type DocSection = {
  id: string;
  title: string;
  description: string;
  points: string[];
};

const sections: DocSection[] = [
  {
    id: "acces",
    title: "Acces et securite",
    description:
      "Demarrage du portail, authentification et bonnes pratiques de securite pour les comptes utilisateurs.",
    points: [
      "Creation de compte et verification e-mail.",
      "Connexion, mot de passe oublie et recuperation d acces.",
      "Protection des identifiants et gestion des sessions.",
    ],
  },
  {
    id: "demandes",
    title: "Deposer une demande",
    description:
      "Parcours de saisie complet pour preparer, verifier et transmettre un dossier administratif.",
    points: [
      "Saisie des informations de societe et des beneficiaires.",
      "Ajout des pieces justificatives et validation des etapes.",
      "Soumission du dossier et suivi de statut en temps reel.",
    ],
  },
  {
    id: "carto",
    title: "Carte et verification prealable",
    description:
      "Outils cartographiques et controles techniques pour limiter les erreurs avant instruction.",
    points: [
      "Verification des coordonnees et du systeme de projection.",
      "Controle des chevauchements et du perimetre.",
      "Visualisation des couches de reference et du contexte minier.",
    ],
  },
  {
    id: "suivi",
    title: "Suivi, notifications et decisions",
    description:
      "Lecture des notifications, historique des actions et interpretation des retours administratifs.",
    points: [
      "Consultation des notifications par role et par dossier.",
      "Suivi des demandes de complement et des validations.",
      "Traite des decisions et des prochaines etapes.",
    ],
  },
];

const quickLinks = [
  {
    label: "FAQ",
    href: "/acceuil/faq",
    icon: <LifeBuoy size={16} />,
  },
  {
    label: "Actualites",
    href: "/acceuil/actualites",
    icon: <Layers3 size={16} />,
  },
  {
    label: "Connexion",
    href: "/auth/login",
    icon: <ShieldCheck size={16} />,
  },
];

export default function DocumentationPage() {
  return (
    <div className={styles.page}>
      <Header />

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={`container ${styles.heroInner}`}>
            <div className={styles.heroBadge}>
              <BookOpenCheck size={16} />
              <span>Documentation officielle</span>
            </div>
            <h1>Documentation du Portail des Activites Minieres</h1>
            <p>
              Ce centre de documentation regroupe les reperes essentiels pour utiliser
              le portail: creation de compte, depot des demandes, verification
              cartographique et suivi des procedures.
            </p>

            <div className={styles.heroActions}>
              <Link href="/auth/login" className={styles.primaryCta}>
                Commencer maintenant
              </Link>
              <Link href="/acceuil/faq" className={styles.secondaryCta}>
                Voir la FAQ
              </Link>
              <a
                href="/docs/guide-utilisation-pom.pdf"
                download
                className={styles.downloadCta}
              >
                <FileDown size={15} />
                Telecharger le guide PDF
              </a>
            </div>
          </div>
        </section>

        <section className={`container ${styles.quickSection}`}>
          {quickLinks.map((item) => (
            <Link key={item.label} href={item.href} className={styles.quickCard}>
              <span className={styles.quickIcon}>{item.icon}</span>
              <span>{item.label}</span>
              <ArrowRight size={16} />
            </Link>
          ))}
        </section>

        <section className={`container ${styles.docsLayout}`}>
          <div className={styles.docsGrid}>
            {sections.map((section) => (
              <article key={section.id} id={section.id} className={styles.docCard}>
                <header className={styles.docHead}>
                  <div className={styles.docIconWrap}>
                    {section.id === "carto" ? (
                      <MapPinned size={17} />
                    ) : (
                      <FileCheck2 size={17} />
                    )}
                  </div>
                  <h2>{section.title}</h2>
                </header>
                <p className={styles.docDescription}>{section.description}</p>
                <ul className={styles.docList}>
                  {section.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <aside className={styles.sidePanel}>
            <div className={styles.sideCard}>
              <h3>Parcours recommande</h3>
              <ol>
                <li>Creer et verifier votre compte.</li>
                <li>Completer le dossier de demande.</li>
                <li>Verifier les donnees cartographiques.</li>
                <li>Soumettre puis suivre les notifications.</li>
              </ol>
              <a
                href="/docs/guide-utilisation-pom.pdf"
                download
                className={styles.downloadInline}
              >
                <FileDown size={15} />
                Guide PDF (telechargement)
              </a>
              <Link href="/auth/login" className={styles.sideAction}>
                Acceder au portail
                <ArrowRight size={15} />
              </Link>
            </div>
          </aside>
        </section>
      </main>

      <Footer />
    </div>
  );
}
