import Link from "next/link";
import { CheckCircle2, FileText, Gavel, ShieldCheck } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import styles from "./conditions-utilisation.module.css";

const keyPoints = [
  {
    title: "Usage encadre",
    text: "Le portail est reserve aux usages conformes aux procedures administratives et references officielles ANAM.",
  },
  {
    title: "Compte securise",
    text: "Chaque utilisateur est responsable de la confidentialite de ses identifiants et de son activite.",
  },
  {
    title: "Conformite legale",
    text: "Les operations doivent respecter la legislation nationale applicable aux activites minieres.",
  },
];

const sections = [
  {
    id: "acceptation",
    title: "Acceptation des conditions",
    icon: <CheckCircle2 size={18} />,
    paragraphs: [
      "L acces et l utilisation du Portail des Activites Minieres impliquent l acceptation pleine et entiere des presentes conditions d utilisation.",
      "Si vous n acceptez pas ces conditions, vous devez cesser l utilisation des services numeriques proposes.",
    ],
  },
  {
    id: "compte",
    title: "Compte utilisateur et securite",
    icon: <ShieldCheck size={18} />,
    paragraphs: [
      "Vous vous engagez a fournir des informations exactes et a jour lors de la creation et de la gestion de votre compte.",
      "Vous etes responsable de toute action realisee via votre compte. En cas de suspicion d acces non autorise, vous devez en informer immediatement l administration du portail.",
    ],
    points: [
      "Ne pas partager les identifiants de connexion.",
      "Utiliser un mot de passe robuste et le renouveler regulierement.",
      "Signaler tout comportement suspect ou tentative de fraude.",
    ],
  },
  {
    id: "usage",
    title: "Usage autorise du service",
    icon: <FileText size={18} />,
    paragraphs: [
      "Le portail doit etre utilise uniquement pour des activites legitimes liees aux demandes, suivis et formalites administratives.",
      "Tout usage abusif, tentative d intrusion, manipulation de donnees ou action susceptible de perturber le service est strictement interdit.",
    ],
    points: [
      "Respect des workflows et formulaires officiels.",
      "Interdiction de publier des contenus illicites, offensants ou trompeurs.",
      "Interdiction de contourner les controles de securite du systeme.",
    ],
  },
  {
    id: "references",
    title: "References officielles ANAM",
    icon: <Gavel size={18} />,
    paragraphs: [
      "Le portail est exploite par l Agence Nationale des Activites Minieres (ANAM), instituee par la loi n 14-05 du 24 fevrier 2014 portant loi miniere.",
      "Reference institutionnelle: https://www.anam.gov.dz/a_propos/index.php?lang=_fr",
      "Reference contact officiel: https://anam.gov.dz/contact/index.php?lang=_fr",
    ],
  },
  {
    id: "responsabilite",
    title: "Responsabilite, suspension et evolution",
    icon: <Gavel size={18} />,
    paragraphs: [
      "L administration du portail peut suspendre ou limiter l acces a un compte en cas de non respect des presentes conditions, pour des raisons de securite ou de maintenance.",
      "Les conditions d utilisation peuvent etre mises a jour afin de tenir compte des evolutions techniques, organisationnelles ou reglementaires.",
      "Adresse de correspondance ANAM: 42 Chemin Mohamed Seghir Gacem, El Mouradia, Alger - Algerie.",
    ],
  },
];

export default function ConditionsUtilisationPage() {
  return (
    <div className={styles.page}>
      <Header />

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={`container ${styles.heroInner}`}>
            <div className={styles.badge}>Legal</div>
            <h1>Conditions d utilisation</h1>
            <p>
              Ce document definit les regles applicables a l utilisation du Portail
              des Activites Minieres, afin de garantir un cadre clair, securise et
              conforme aux exigences administratives.
            </p>
            <div className={styles.actions}>
              <Link href="/acceuil/Home" className={styles.primaryCta}>
                Retour accueil
              </Link>
              <a href="mailto:anam@anam.gov.dz" className={styles.secondaryCta}>
                Contacter le support
              </a>
            </div>
          </div>
        </section>

        <section className={`container ${styles.keyPoints}`}>
          {keyPoints.map((item) => (
            <article key={item.title} className={styles.keyCard}>
              <h2>{item.title}</h2>
              <p>{item.text}</p>
            </article>
          ))}
        </section>

        <section className={`container ${styles.sections}`}>
          {sections.map((section) => (
            <article key={section.id} className={styles.sectionCard} id={section.id}>
              <header className={styles.sectionHead}>
                <div className={styles.iconWrap}>{section.icon}</div>
                <h3>{section.title}</h3>
              </header>

              <div className={styles.sectionBody}>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}

                {section.points ? (
                  <ul className={styles.sectionList}>
                    {section.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      </main>

      <Footer />
    </div>
  );
}
