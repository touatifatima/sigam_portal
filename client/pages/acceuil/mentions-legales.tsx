import Link from "next/link";
import {
  Building2,
  Globe2,
  Mail,
  Scale,
  Server,
  ShieldAlert,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import styles from "./mentions-legales.module.css";

const identityCards = [
  {
    label: "Editeur du portail",
    value: "ANAM - Agence Nationale des Activites Minieres",
  },
  {
    label: "Adresse legale",
    value: "42 Chemin Mohamed Seghir Gacem, El Mouradia, Alger - Algerie",
  },
  {
    label: "Contact officiel",
    value: "anam@anam.gov.dz | +213 (0)23 48 81 25 / +213 (0)23 48 81 24",
  },
  {
    label: "Sites officiels",
    value: "www.anam.gov.dz | pom.anam.dz",
  },
  {
    label: "Hebergeur",
    value: "Infrastructure institutionnelle ANAM (plateforme pom.anam.dz)",
  },
];

const sections = [
  {
    id: "editeur",
    title: "Informations editeur",
    icon: <Building2 size={18} />,
    paragraphs: [
      "Le portail pom.anam.dz est edite par l Agence Nationale des Activites Minieres (ANAM), etablissement public dote de la personnalite juridique et de l autonomie financiere.",
      "Conformement a la presentation institutionnelle officielle de l ANAM, l agence est instituee par la loi n 14-05 du 24 fevrier 2014 portant loi miniere.",
    ],
  },
  {
    id: "hebergement",
    title: "Hebergement et exploitation",
    icon: <Server size={18} />,
    paragraphs: [
      "L hebergement du portail est assure sur une infrastructure institutionnelle dediee au domaine pom.anam.dz.",
      "L exploitation technique est encadree par des operations de supervision, de maintenance et de securisation afin de garantir la disponibilite du service.",
    ],
  },
  {
    id: "propriete",
    title: "References officielles ANAM",
    icon: <Scale size={18} />,
    paragraphs: [
      "Reference institutionnelle: https://www.anam.gov.dz/a_propos/index.php?lang=_fr",
      "Reference contact officiel: https://anam.gov.dz/contact/index.php?lang=_fr",
      "Reference portail de services: https://pom.anam.dz",
    ],
  },
  {
    id: "liens",
    title: "Liens externes et responsabilite",
    icon: <Globe2 size={18} />,
    paragraphs: [
      "Le portail peut contenir des liens vers des ressources externes. L ANAM ne peut etre tenue responsable du contenu ou des politiques de ces sites tiers.",
      "Malgre le soin apporte a la publication des informations, aucune garantie absolue ne peut etre apportee sur l absence d erreurs ou d interruptions de service.",
    ],
  },
  {
    id: "contact",
    title: "Signalement et contact",
    icon: <Mail size={18} />,
    paragraphs: [
      "Pour toute question juridique ou signalement, vous pouvez contacter l ANAM via anam@anam.gov.dz.",
      "Adresse de correspondance: 42 Chemin Mohamed Seghir Gacem, El Mouradia, Alger - Algerie.",
    ],
  },
  {
    id: "miseajour",
    title: "Mise a jour des mentions",
    icon: <ShieldAlert size={18} />,
    paragraphs: [
      "Les presentes mentions legales peuvent etre modifiees a tout moment pour tenir compte des evolutions reglementaires, techniques ou organisationnelles.",
      "La version affichee sur cette page est la version de reference a la date de consultation.",
    ],
  },
];

export default function MentionsLegalesPage() {
  return (
    <div className={styles.page}>
      <Header />

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={`container ${styles.heroInner}`}>
            <div className={styles.badge}>Legal</div>
            <h1>Mentions legales</h1>
            <p>
              Cette page regroupe les informations juridiques relatives a l edition,
              l exploitation et l usage du Portail des Activites Minieres.
            </p>
            <div className={styles.actions}>
              <Link href="/acceuil/Home" className={styles.primaryCta}>
                Retour accueil
              </Link>
              <a href="mailto:anam@anam.gov.dz" className={styles.secondaryCta}>
                Contact juridique
              </a>
            </div>
          </div>
        </section>

        <section className={`container ${styles.identityGrid}`}>
          {identityCards.map((card) => (
            <article key={card.label} className={styles.identityCard}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </article>
          ))}
        </section>

        <section className={`container ${styles.sections}`}>
          {sections.map((section) => (
            <article key={section.id} className={styles.sectionCard} id={section.id}>
              <header className={styles.sectionHead}>
                <div className={styles.iconWrap}>{section.icon}</div>
                <h2>{section.title}</h2>
              </header>

              <div className={styles.sectionBody}>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </article>
          ))}
        </section>
      </main>

      <Footer />
    </div>
  );
}
