import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StaticPage } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

const STATIC_PAGE_SLUGS = [
  'conditions-utilisation',
  'politique-confidentialite',
  'mentions-legales',
  'faq',
  'documentation',
  'contact',
] as const;

const SUPPORTED_LOCALES = ['fr', 'ar'] as const;

type StaticPageSlug = (typeof STATIC_PAGE_SLUGS)[number];
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

type UpdateStaticPageInput = {
  title?: string;
  content?: string;
  locale?: string;
  updatedBy?: string | null;
};

type ManageStaticPageInput = {
  locale?: string;
  updatedBy?: string | null;
};

const LEGACY_FR_DEFAULT_CONTENT: Record<StaticPageSlug, string> = {
  'conditions-utilisation': `
<div class="sp-grid sp-grid-3">
  <article class="sp-card"><h3>Usage encadre</h3><p>Le portail est reserve aux usages conformes aux procedures administratives et references officielles ANAM.</p></article>
  <article class="sp-card"><h3>Compte securise</h3><p>Chaque utilisateur est responsable de la confidentialite de ses identifiants et de son activite.</p></article>
  <article class="sp-card"><h3>Conformite legale</h3><p>Les operations doivent respecter la legislation nationale applicable aux activites minieres.</p></article>
</div>
<div class="sp-sections">
  <section class="sp-section">
    <h3>Acceptation des conditions</h3>
    <p>L acces et l utilisation du Portail des Activites Minieres impliquent l acceptation pleine et entiere des presentes conditions d utilisation.</p>
    <p>Si vous n acceptez pas ces conditions, vous devez cesser l utilisation des services numeriques proposes.</p>
  </section>
  <section class="sp-section">
    <h3>Compte utilisateur et securite</h3>
    <p>Vous vous engagez a fournir des informations exactes et a jour lors de la creation et de la gestion de votre compte.</p>
    <p>Vous etes responsable de toute action realisee via votre compte. En cas de suspicion d acces non autorise, vous devez en informer immediatement l administration du portail.</p>
    <ul class="sp-list">
      <li>Ne pas partager les identifiants de connexion.</li>
      <li>Utiliser un mot de passe robuste et le renouveler regulierement.</li>
      <li>Signaler tout comportement suspect ou tentative de fraude.</li>
    </ul>
  </section>
  <section class="sp-section">
    <h3>Usage autorise du service</h3>
    <p>Le portail doit etre utilise uniquement pour des activites legitimes liees aux demandes, suivis et formalites administratives.</p>
    <p>Tout usage abusif, tentative d intrusion, manipulation de donnees ou action susceptible de perturber le service est strictement interdit.</p>
    <ul class="sp-list">
      <li>Respect des workflows et formulaires officiels.</li>
      <li>Interdiction de publier des contenus illicites, offensants ou trompeurs.</li>
      <li>Interdiction de contourner les controles de securite du systeme.</li>
    </ul>
  </section>
  <section class="sp-section">
    <h3>References officielles ANAM</h3>
    <p>Le portail est exploite par l Agence Nationale des Activites Minieres (ANAM), instituee par la loi n 14-05 du 24 fevrier 2014 portant loi miniere.</p>
    <p>Reference institutionnelle: <a href="https://www.anam.gov.dz/a_propos/index.php?lang=_fr" target="_blank" rel="noopener noreferrer">www.anam.gov.dz/a_propos</a></p>
    <p>Reference contact officiel: <a href="https://anam.gov.dz/contact/index.php?lang=_fr" target="_blank" rel="noopener noreferrer">anam.gov.dz/contact</a></p>
  </section>
  <section class="sp-section">
    <h3>Responsabilite, suspension et evolution</h3>
    <p>L administration du portail peut suspendre ou limiter l acces a un compte en cas de non respect des presentes conditions, pour des raisons de securite ou de maintenance.</p>
    <p>Les conditions d utilisation peuvent etre mises a jour afin de tenir compte des evolutions techniques, organisationnelles ou reglementaires.</p>
    <p>Adresse de correspondance ANAM: 42 Chemin Mohamed Seghir Gacem, El Mouradia, Alger - Algerie.</p>
  </section>
</div>
`.trim(),
  'politique-confidentialite': `
<div class="sp-grid sp-grid-3">
  <article class="sp-card"><h3>Transparence</h3><p>Nous expliquons clairement quelles donnees sont traitees, dans quel cadre legal et pour quelle duree.</p></article>
  <article class="sp-card"><h3>Protection</h3><p>Des mesures techniques et organisationnelles sont appliquees sur l infrastructure du portail pour proteger les informations traitees.</p></article>
  <article class="sp-card"><h3>Maitrise</h3><p>Chaque utilisateur peut exercer ses droits via les canaux officiels ANAM.</p></article>
</div>
<div class="sp-sections">
  <section class="sp-section">
    <h3>Donnees collectees</h3>
    <p>Le portail collecte les informations necessaires a la creation de compte, au traitement des demandes et au suivi administratif.</p>
    <p>Ces informations peuvent inclure des donnees d identification, de contact, des informations techniques et des historiques d interactions.</p>
  </section>
  <section class="sp-section">
    <h3>Finalites de traitement</h3>
    <p>Les donnees sont traitees pour gerer les parcours utilisateurs, instruire les dossiers, assurer la tracabilite des decisions et ameliorer la qualite du service.</p>
    <p>Les traitements sont limites aux usages strictement necessaires au fonctionnement du portail et aux missions de service public confiees a l ANAM.</p>
  </section>
  <section class="sp-section">
    <h3>Securite et conservation</h3>
    <p>Les donnees sont conservees pendant une duree adaptee a la finalite du traitement et aux exigences reglementaires.</p>
    <p>Le portail est heberge sur une infrastructure institutionnelle dediee au domaine pom.anam.dz avec des dispositifs de securite pour prevenir les acces non autorises, pertes, alterations ou divulgations indebites.</p>
    <ul class="sp-list">
      <li>Gestion des acces par roles et permissions.</li>
      <li>Journalisation des operations sensibles.</li>
      <li>Revues de securite et surveillance operationnelle.</li>
    </ul>
  </section>
  <section class="sp-section">
    <h3>Vos droits</h3>
    <p>Sous reserve des dispositions legales applicables, vous pouvez demander l acces, la rectification ou la limitation de traitement de vos donnees.</p>
    <p>Vous pouvez adresser vos demandes a l ANAM via <a href="mailto:anam@anam.gov.dz">anam@anam.gov.dz</a> ou par courrier a l adresse 42 Chemin Mohamed Seghir Gacem, El Mouradia, Alger - Algerie.</p>
  </section>
  <section class="sp-section">
    <h3>References officielles ANAM</h3>
    <p>Presentation institutionnelle ANAM: <a href="https://www.anam.gov.dz/a_propos/index.php?lang=_fr" target="_blank" rel="noopener noreferrer">www.anam.gov.dz/a_propos</a></p>
    <p>Contact officiel ANAM: <a href="https://anam.gov.dz/contact/index.php?lang=_fr" target="_blank" rel="noopener noreferrer">anam.gov.dz/contact</a></p>
    <p>Les regles de cette politique peuvent evoluer selon les changements techniques ou reglementaires applicables.</p>
  </section>
</div>
`.trim(),
  'mentions-legales': `
<div class="sp-grid sp-grid-3">
  <article class="sp-card sp-identity-card"><span>Editeur du portail</span><strong>ANAM - Agence Nationale des Activites Minieres</strong></article>
  <article class="sp-card sp-identity-card"><span>Adresse legale</span><strong>42 Chemin Mohamed Seghir Gacem, El Mouradia, Alger - Algerie</strong></article>
  <article class="sp-card sp-identity-card"><span>Contact officiel</span><strong>anam@anam.gov.dz | +213 (0)23 48 81 25 / +213 (0)23 48 81 24</strong></article>
  <article class="sp-card sp-identity-card"><span>Sites officiels</span><strong>www.anam.gov.dz | pom.anam.dz</strong></article>
  <article class="sp-card sp-identity-card"><span>Hebergeur</span><strong>Infrastructure institutionnelle ANAM (plateforme pom.anam.dz)</strong></article>
</div>
<div class="sp-sections">
  <section class="sp-section">
    <h3>Informations editeur</h3>
    <p>Le portail pom.anam.dz est edite par l Agence Nationale des Activites Minieres (ANAM), etablissement public dote de la personnalite juridique et de l autonomie financiere.</p>
    <p>Conformement a la presentation institutionnelle officielle de l ANAM, l agence est instituee par la loi n 14-05 du 24 fevrier 2014 portant loi miniere.</p>
  </section>
  <section class="sp-section">
    <h3>Hebergement et exploitation</h3>
    <p>L hebergement du portail est assure sur une infrastructure institutionnelle dediee au domaine pom.anam.dz.</p>
    <p>L exploitation technique est encadree par des operations de supervision, de maintenance et de securisation afin de garantir la disponibilite du service.</p>
  </section>
  <section class="sp-section">
    <h3>References officielles ANAM</h3>
    <p>Reference institutionnelle: <a href="https://www.anam.gov.dz/a_propos/index.php?lang=_fr" target="_blank" rel="noopener noreferrer">www.anam.gov.dz/a_propos</a></p>
    <p>Reference contact officiel: <a href="https://anam.gov.dz/contact/index.php?lang=_fr" target="_blank" rel="noopener noreferrer">anam.gov.dz/contact</a></p>
    <p>Reference portail de services: <a href="https://pom.anam.dz" target="_blank" rel="noopener noreferrer">pom.anam.dz</a></p>
  </section>
  <section class="sp-section">
    <h3>Liens externes et responsabilite</h3>
    <p>Le portail peut contenir des liens vers des ressources externes. L ANAM ne peut etre tenue responsable du contenu ou des politiques de ces sites tiers.</p>
    <p>Malgre le soin apporte a la publication des informations, aucune garantie absolue ne peut etre apportee sur l absence d erreurs ou d interruptions de service.</p>
  </section>
  <section class="sp-section">
    <h3>Signalement et contact</h3>
    <p>Pour toute question juridique ou signalement, vous pouvez contacter l ANAM via <a href="mailto:anam@anam.gov.dz">anam@anam.gov.dz</a>.</p>
    <p>Adresse de correspondance: 42 Chemin Mohamed Seghir Gacem, El Mouradia, Alger - Algerie.</p>
  </section>
  <section class="sp-section">
    <h3>Mise a jour des mentions</h3>
    <p>Les presentes mentions legales peuvent etre modifiees a tout moment pour tenir compte des evolutions reglementaires, techniques ou organisationnelles.</p>
    <p>La version affichee sur cette page est la version de reference a la date de consultation.</p>
  </section>
</div>
`.trim(),
  faq: `
<div class="sp-sections">
  <section class="sp-section">
    <h3>Compte et acces</h3>
    <details class="sp-faq-item"><summary>Comment creer un compte sur le portail ?</summary><p>Cliquez sur le bouton d'inscription, completez les informations demandees puis validez votre adresse e-mail. Une fois le compte active, vous pouvez deposer et suivre vos demarches.</p></details>
    <details class="sp-faq-item"><summary>Je n'ai pas recu l'e-mail de verification, que faire ?</summary><p>Verifiez d'abord vos dossiers Spam/Indesirable. Si le message n'apparait pas, relancez l'envoi depuis l'ecran de connexion ou contactez l'assistance technique via l'adresse officielle.</p></details>
    <details class="sp-faq-item"><summary>Quelle est la difference entre les roles utilisateur ?</summary><p>Le role Investisseur gere les demandes et le suivi des procedures, le role Operateur suit les permis operationnels, le role Cadastre utilise les modules de verification et de carte, et le role Admin pilote l'instruction.</p></details>
  </section>
  <section class="sp-section">
    <h3>Demandes et permis</h3>
    <details class="sp-faq-item"><summary>Comment deposer une nouvelle demande ?</summary><p>Depuis votre espace, ouvrez "Nouvelle Demande" puis completez les etapes (type, zone, pieces, validation). Le dossier est ensuite transmis pour instruction selon le workflow officiel.</p></details>
    <details class="sp-faq-item"><summary>Puis-je modifier une demande deja soumise ?</summary><p>Apres soumission, certaines informations peuvent etre verrouillees pour garantir la tracabilite. Si une correction est necessaire, utilisez la messagerie ou les demandes de complement lorsqu elles sont disponibles.</p></details>
    <details class="sp-faq-item"><summary>Comment suivre l'etat de mon dossier ?</summary><p>Le tableau de bord affiche le statut en temps reel (brouillon, en cours, en attente, valide, refuse, etc.) ainsi que l'historique des actions et des notifications associees.</p></details>
    <details class="sp-faq-item"><summary>Le depot en ligne signifie-t-il que le permis est accorde ?</summary><p>Non. Le depot lance la procedure administrative. L'octroi final depend de l'instruction technique et juridique effectuee par les services competents.</p></details>
  </section>
  <section class="sp-section">
    <h3>Carte et verification</h3>
    <details class="sp-faq-item"><summary>A quoi sert la verification prealable ?</summary><p>Elle permet de controler les coordonnees, les perimetres et les chevauchements avant soumission. Cela reduit les erreurs techniques et accelere l'analyse des dossiers.</p></details>
    <details class="sp-faq-item"><summary>Que montre la carte publique ?</summary><p>La carte publique presente les couches de reference, les zones et les titres publies selon les donnees disponibles au public, sans exposer les informations confidentielles des dossiers internes.</p></details>
    <details class="sp-faq-item"><summary>Pourquoi mes coordonnees semblent decalees ?</summary><p>Un decalage peut venir d'un probleme de projection, d'un format de coordonnees ou d'une saisie incomplete. Verifiez le systeme de reference attendu et utilisez le module de controle geometrique.</p></details>
  </section>
</div>
`.trim(),
  documentation: `
<div class="sp-grid sp-grid-3">
  <a class="sp-quick-link" href="/acceuil/faq">FAQ</a>
  <a class="sp-quick-link" href="/acceuil/actualites">Actualites</a>
  <a class="sp-quick-link" href="/auth/login">Connexion</a>
</div>
<div class="sp-grid sp-grid-2">
  <article class="sp-card">
    <h3>Acces et securite</h3>
    <p>Demarrage du portail, authentification et bonnes pratiques de securite pour les comptes utilisateurs.</p>
    <ul class="sp-list">
      <li>Creation de compte et verification e-mail.</li>
      <li>Connexion, mot de passe oublie et recuperation d acces.</li>
      <li>Protection des identifiants et gestion des sessions.</li>
    </ul>
  </article>
  <article class="sp-card">
    <h3>Deposer une demande</h3>
    <p>Parcours de saisie complet pour preparer, verifier et transmettre un dossier administratif.</p>
    <ul class="sp-list">
      <li>Saisie des informations de societe et des beneficiaires.</li>
      <li>Ajout des pieces justificatives et validation des etapes.</li>
      <li>Soumission du dossier et suivi de statut en temps reel.</li>
    </ul>
  </article>
  <article class="sp-card">
    <h3>Carte et verification prealable</h3>
    <p>Outils cartographiques et controles techniques pour limiter les erreurs avant instruction.</p>
    <ul class="sp-list">
      <li>Verification des coordonnees et du systeme de projection.</li>
      <li>Controle des chevauchements et du perimetre.</li>
      <li>Visualisation des couches de reference et du contexte minier.</li>
    </ul>
  </article>
  <article class="sp-card">
    <h3>Suivi, notifications et decisions</h3>
    <p>Lecture des notifications, historique des actions et interpretation des retours administratifs.</p>
    <ul class="sp-list">
      <li>Consultation des notifications par role et par dossier.</li>
      <li>Suivi des demandes de complement et des validations.</li>
      <li>Traitement des decisions et des prochaines etapes.</li>
    </ul>
  </article>
</div>
<div class="sp-note">
  <h3>Parcours recommande</h3>
  <ol class="sp-list">
    <li>Creer et verifier votre compte.</li>
    <li>Completer le dossier de demande.</li>
    <li>Verifier les donnees cartographiques.</li>
    <li>Soumettre puis suivre les notifications.</li>
  </ol>
  <p><a href="/auth/login">Acceder au portail</a></p>
</div>
`.trim(),
  contact: `
<div class="sp-note">
  <h3>Contact et directions ANAM</h3>
  <p>Consultez les coordonnees officielles de l ANAM et la carte interactive des principales antennes regionales.</p>
  <p>Adresse e-mail principale: <a href="mailto:anam@anam.gov.dz">anam@anam.gov.dz</a></p>
</div>
`.trim(),
};

const LEGACY_AR_DEFAULT_CONTENT: Record<StaticPageSlug, string> = {
  'conditions-utilisation':
    '<p>\u064a\u0645\u0643\u0646 \u062a\u0639\u062f\u064a\u0644 \u0634\u0631\u0648\u0637 \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0645\u0646 \u0644\u0648\u062d\u0629 \u0627\u0644\u0627\u062f\u0627\u0631\u0629.</p>',
  'politique-confidentialite':
    '<p>\u064a\u0645\u0643\u0646 \u062a\u0639\u062f\u064a\u0644 \u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629 \u0645\u0646 \u0644\u0648\u062d\u0629 \u0627\u0644\u0627\u062f\u0627\u0631\u0629.</p>',
  'mentions-legales':
    '<p>\u064a\u0645\u0643\u0646 \u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0627\u0634\u0639\u0627\u0631\u0627\u062a \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064a\u0629 \u0645\u0646 \u0644\u0648\u062d\u0629 \u0627\u0644\u0627\u062f\u0627\u0631\u0629.</p>',
  faq:
    '<p>\u064a\u0645\u0643\u0646 \u062a\u0639\u062f\u064a\u0644 \u0645\u062d\u062a\u0648\u0649 \u0627\u0644\u0627\u0633\u0626\u0644\u0629 \u0627\u0644\u0634\u0627\u0626\u0639\u0629 \u0645\u0646 \u0644\u0648\u062d\u0629 \u0627\u0644\u0627\u062f\u0627\u0631\u0629.</p>',
  documentation:
    '<p>\u064a\u0645\u0643\u0646 \u062a\u0639\u062f\u064a\u0644 \u0645\u062d\u062a\u0648\u0649 \u0627\u0644\u0648\u062b\u0627\u0626\u0642 \u0645\u0646 \u0644\u0648\u062d\u0629 \u0627\u0644\u0627\u062f\u0627\u0631\u0629.</p>',
  contact:
    '<p>\u064a\u0645\u0643\u0646 \u062a\u0639\u062f\u064a\u0644 \u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0645\u0646 \u0644\u0648\u062d\u0629 \u0627\u0644\u0627\u062f\u0627\u0631\u0629.</p>',
};

@Injectable()
export class StaticPagesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly defaultTitles: Record<SupportedLocale, Record<StaticPageSlug, string>> = {
    fr: {
      'conditions-utilisation': "Conditions d'utilisation",
      'politique-confidentialite': 'Politique de confidentialite',
      'mentions-legales': 'Mentions legales',
      faq: 'FAQ - Foire aux questions',
      documentation: 'Documentation',
      contact: 'Contact',
    },
    ar: {
      'conditions-utilisation': '\u0634\u0631\u0648\u0637 \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645',
      'politique-confidentialite': '\u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u062e\u0635\u0648\u0635\u064a\u0629',
      'mentions-legales': '\u0627\u0644\u0627\u0634\u0639\u0627\u0631\u0627\u062a \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064a\u0629',
      faq: '\u0627\u0644\u0627\u0633\u0626\u0644\u0629 \u0627\u0644\u0634\u0627\u0626\u0639\u0629',
      documentation: '\u0627\u0644\u0648\u062b\u0627\u0626\u0642',
      contact: '\u0627\u062a\u0635\u0644 \u0628\u0646\u0627',
    },
  };

  private readonly defaultContent: Record<SupportedLocale, Record<StaticPageSlug, string>> = {
    fr: LEGACY_FR_DEFAULT_CONTENT,
    ar: LEGACY_AR_DEFAULT_CONTENT,
  };

  private isStaticPageSlug(value: string): value is StaticPageSlug {
    return STATIC_PAGE_SLUGS.includes(value as StaticPageSlug);
  }

  private normalizeLocale(locale?: string): SupportedLocale {
    const normalized = String(locale || '')
      .trim()
      .toLowerCase();

    return normalized === 'ar' ? 'ar' : 'fr';
  }

  private ensureKnownSlug(slug: string): StaticPageSlug {
    const normalizedSlug = String(slug || '').trim();
    if (!this.isStaticPageSlug(normalizedSlug)) {
      throw new BadRequestException('Slug de page statique invalide');
    }

    return normalizedSlug;
  }

  private sanitizeContent(content: string): string {
    let sanitized = String(content || '').trim();

    // Remove executable/embedded tags that should never be stored.
    sanitized = sanitized.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    sanitized = sanitized.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
    sanitized = sanitized.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');
    sanitized = sanitized.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '');
    sanitized = sanitized.replace(/<embed\b[^>]*>/gi, '');
    sanitized = sanitized.replace(/<meta\b[^>]*>/gi, '');
    sanitized = sanitized.replace(/<link\b[^>]*>/gi, '');

    // Remove inline styling and JS event handlers.
    sanitized = sanitized.replace(/\sstyle\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '');
    sanitized = sanitized.replace(/\son[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '');

    return sanitized.trim();
  }

  private sortItems(items: StaticPage[]): StaticPage[] {
    const slugOrder = new Map(STATIC_PAGE_SLUGS.map((slug, index) => [slug, index]));
    const localeOrder = new Map(SUPPORTED_LOCALES.map((locale, index) => [locale, index]));

    return [...items].sort((a, b) => {
      const slugCmp =
        (slugOrder.get(a.slug as StaticPageSlug) ?? 99) -
        (slugOrder.get(b.slug as StaticPageSlug) ?? 99);
      if (slugCmp !== 0) return slugCmp;

      return (
        (localeOrder.get(a.locale as SupportedLocale) ?? 99) -
        (localeOrder.get(b.locale as SupportedLocale) ?? 99)
      );
    });
  }

  private isLegacyPlaceholderContent(locale: SupportedLocale, content: string): boolean {
    const normalized = String(content || '')
      .trim()
      .toLowerCase();

    if (!normalized) {
      return true;
    }

    if (locale === 'fr') {
      return (
        normalized.includes('ce contenu est modifiable depuis l') ||
        normalized.includes('ajoutez ici') ||
        normalized.includes('faq officielle') ||
        normalized.includes('documentation publique officielle') ||
        normalized.includes('voir sur la carte') ||
        normalized.includes('openstreetmap.org/export/embed')
      );
    }

    return (
      normalized.includes('contenu arabe a definir') ||
      normalized.includes('\u064a\u0645\u0643\u0646 \u062a\u0639\u062f\u064a\u0644')
    );
  }

  private async ensureDefaults() {
    const defaults: Prisma.StaticPageCreateManyInput[] = [];

    for (const locale of SUPPORTED_LOCALES) {
      for (const slug of STATIC_PAGE_SLUGS) {
        defaults.push({
          slug,
          locale,
          title: this.defaultTitles[locale][slug],
          content: this.defaultContent[locale][slug],
          updatedBy: null,
        });
      }
    }

    await this.prisma.staticPage.createMany({
      data: defaults,
      skipDuplicates: true,
    });

    const existingRows = await this.prisma.staticPage.findMany({
      where: {
        slug: { in: [...STATIC_PAGE_SLUGS] },
        locale: { in: [...SUPPORTED_LOCALES] },
      },
    });

    for (const row of existingRows) {
      const locale = row.locale === 'ar' ? 'ar' : 'fr';
      const slug = row.slug as StaticPageSlug;
      const shouldPromote =
        !row.updatedBy && this.isLegacyPlaceholderContent(locale, row.content);

      if (!shouldPromote || !this.isStaticPageSlug(slug)) {
        continue;
      }

      await this.prisma.staticPage.update({
        where: { id: row.id },
        data: {
          title: this.defaultTitles[locale][slug],
          content: this.defaultContent[locale][slug],
          updatedBy: null,
        },
      });
    }
  }

  async getAll(locale?: string) {
    await this.ensureDefaults();

    const normalizedLocale = locale ? this.normalizeLocale(locale) : undefined;

    const items = await this.prisma.staticPage.findMany({
      where: normalizedLocale ? { locale: normalizedLocale } : undefined,
    });

    return {
      items: this.sortItems(items),
      slugs: STATIC_PAGE_SLUGS,
      locales: SUPPORTED_LOCALES,
    };
  }

  async getBySlug(slug: string, locale?: string) {
    await this.ensureDefaults();

    const safeSlug = this.ensureKnownSlug(slug);
    const normalizedLocale = this.normalizeLocale(locale);

    let page = await this.prisma.staticPage.findUnique({
      where: {
        slug_locale: {
          slug: safeSlug,
          locale: normalizedLocale,
        },
      },
    });

    if (!page && normalizedLocale !== 'fr') {
      page = await this.prisma.staticPage.findUnique({
        where: {
          slug_locale: {
            slug: safeSlug,
            locale: 'fr',
          },
        },
      });
    }

    if (!page) {
      throw new NotFoundException('Page statique introuvable');
    }

    return {
      item: page,
    };
  }

  async updateBySlug(slug: string, input: UpdateStaticPageInput) {
    await this.ensureDefaults();

    const safeSlug = this.ensureKnownSlug(slug);
    const normalizedLocale = this.normalizeLocale(input.locale);
    const title = String(input.title || '').trim();
    const content = this.sanitizeContent(String(input.content || ''));

    if (!title) {
      throw new BadRequestException('Le titre est obligatoire');
    }

    if (!content) {
      throw new BadRequestException('Le contenu est obligatoire');
    }

    const item = await this.prisma.staticPage.upsert({
      where: {
        slug_locale: {
          slug: safeSlug,
          locale: normalizedLocale,
        },
      },
      create: {
        slug: safeSlug,
        locale: normalizedLocale,
        title,
        content,
        updatedBy: input.updatedBy ? String(input.updatedBy) : null,
      },
      update: {
        title,
        content,
        updatedBy: input.updatedBy ? String(input.updatedBy) : null,
      },
    });

    return {
      item,
    };
  }

  async restoreBySlug(slug: string, input: ManageStaticPageInput) {
    await this.ensureDefaults();

    const safeSlug = this.ensureKnownSlug(slug);
    const normalizedLocale = this.normalizeLocale(input.locale);

    const title = this.defaultTitles[normalizedLocale][safeSlug];
    const content = this.defaultContent[normalizedLocale][safeSlug];

    const item = await this.prisma.staticPage.upsert({
      where: {
        slug_locale: {
          slug: safeSlug,
          locale: normalizedLocale,
        },
      },
      create: {
        slug: safeSlug,
        locale: normalizedLocale,
        title,
        content,
        updatedBy: input.updatedBy ? String(input.updatedBy) : null,
      },
      update: {
        title,
        content,
        updatedBy: input.updatedBy ? String(input.updatedBy) : null,
      },
    });

    return {
      item,
    };
  }

  async clearBySlug(slug: string, input: ManageStaticPageInput) {
    await this.ensureDefaults();

    const safeSlug = this.ensureKnownSlug(slug);
    const normalizedLocale = this.normalizeLocale(input.locale);

    const existing = await this.prisma.staticPage.findUnique({
      where: {
        slug_locale: {
          slug: safeSlug,
          locale: normalizedLocale,
        },
      },
    });

    const title = existing?.title?.trim() || this.defaultTitles[normalizedLocale][safeSlug];

    const item = await this.prisma.staticPage.upsert({
      where: {
        slug_locale: {
          slug: safeSlug,
          locale: normalizedLocale,
        },
      },
      create: {
        slug: safeSlug,
        locale: normalizedLocale,
        title,
        content: '',
        updatedBy: input.updatedBy ? String(input.updatedBy) : null,
      },
      update: {
        title,
        content: '',
        updatedBy: input.updatedBy ? String(input.updatedBy) : null,
      },
    });

    return {
      item,
    };
  }
}
