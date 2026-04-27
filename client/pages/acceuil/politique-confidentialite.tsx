import Link from "next/link";
import {
  Database,
  LockKeyhole,
  Server,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import styles from "./politique-confidentialite.module.css";

const pillars = [
  {
    title: "Transparence",
    text: "Nous expliquons clairement quelles donnees sont traitees, dans quel cadre legal et pour quelle duree.",
  },
  {
    title: "Protection",
    text: "Des mesures techniques et organisationnelles sont appliquees sur l infrastructure du portail pour proteger les informations traitees.",
  },
  {
    title: "Maitrise",
    text: "Chaque utilisateur peut exercer ses droits via les canaux officiels ANAM.",
  },
];

const sections = [
  {
    id: "collecte",
    title: "Donnees collectees",
    icon: <Database size={18} />,
    paragraphs: [
      "Le portail collecte les informations necessaires a la creation de compte, au traitement des demandes et au suivi administratif.",
      "Ces informations peuvent inclure des donnees d identification, de contact, des informations techniques et des historiques d interactions.",
    ],
  },
  {
    id: "usage",
    title: "Finalites de traitement",
    icon: <Server size={18} />,
    paragraphs: [
      "Les donnees sont traitees pour gerer les parcours utilisateurs, instruire les dossiers, assurer la tracabilite des decisions et ameliorer la qualite du service.",
      "Les traitements sont limites aux usages strictement necessaires au fonctionnement du portail et aux missions de service public confiees a l ANAM.",
    ],
  },
  {
    id: "securite",
    title: "Securite et conservation",
    icon: <LockKeyhole size={18} />,
    paragraphs: [
      "Les donnees sont conservees pendant une duree adaptee a la finalite du traitement et aux exigences reglementaires.",
      "Le portail est heberge sur une infrastructure institutionnelle dediee au domaine pom.anam.dz avec des dispositifs de securite pour prevenir les acces non autorises, pertes, alterations ou divulgations indebites.",
    ],
    points: [
      "Gestion des acces par roles et permissions.",
      "Journalisation des operations sensibles.",
      "Revues de securite et surveillance operationnelle.",
    ],
  },
  {
    id: "droits",
    title: "Vos droits",
    icon: <UserRoundCheck size={18} />,
    paragraphs: [
      "Sous reserve des dispositions legales applicables, vous pouvez demander l acces, la rectification ou la limitation de traitement de vos donnees.",
      "Vous pouvez adresser vos demandes a l ANAM via anam@anam.gov.dz ou par courrier a l adresse 42 Chemin Mohamed Seghir Gacem, El Mouradia, Alger - Algerie.",
    ],
  },
  {
    id: "maj",
    title: "References officielles ANAM",
    icon: <ShieldCheck size={18} />,
    paragraphs: [
      "Presentation institutionnelle ANAM: https://www.anam.gov.dz/a_propos/index.php?lang=_fr",
      "Contact officiel ANAM: https://anam.gov.dz/contact/index.php?lang=_fr",
      "Les regles de cette politique peuvent evoluer selon les changements techniques ou reglementaires applicables.",
    ],
  },
];

export default function PolitiqueConfidentialitePage() {
  return (
    <div className={styles.page}>
      <Header />

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={`container ${styles.heroInner}`}>
            <div className={styles.badge}>Legal</div>
            <h1>Politique de confidentialite</h1>
            <p>
              Cette politique presente la maniere dont les donnees personnelles sont
              collectees, utilisees, protegees et gerees dans le cadre du Portail des
              Activites Minieres.
            </p>
            <div className={styles.actions}>
              <Link href="/acceuil/Home" className={styles.primaryCta}>
                Retour accueil
              </Link>
              <a href="mailto:anam@anam.gov.dz" className={styles.secondaryCta}>
                Exercer un droit
              </a>
            </div>
          </div>
        </section>

        <section className={`container ${styles.pillars}`}>
          {pillars.map((pillar) => (
            <article key={pillar.title} className={styles.pillarCard}>
              <h2>{pillar.title}</h2>
              <p>{pillar.text}</p>
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
