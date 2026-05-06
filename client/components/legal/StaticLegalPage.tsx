import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { FiCalendar, FiFileText, FiGlobe } from 'react-icons/fi';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import {
  fetchPublicStaticPage,
  getCurrentLocale,
  type StaticPageItem,
  type StaticPageLocale,
  type StaticPageSlug,
} from '@/src/utils/staticPagesApi';
import styles from './StaticLegalPage.module.css';
import 'leaflet/dist/leaflet.css';

type StaticLegalPageProps = {
  slug: StaticPageSlug;
};

type ContactOffice = {
  id: string;
  title: string;
  address: string;
  phone: string;
  fax?: string;
  email: string;
  lat: number;
  lng: number;
};

type ContactCard = {
  id: string;
  officeId: string | null;
  title: string;
  paragraphs: string[];
};

const CONTACT_OFFICES: ContactOffice[] = [
  {
    id: 'siege',
    title: 'Direction Generale - Siege ANAM',
    address: '42 Chemin Mohamed Seghir Gacem, El Mouradia, Alger',
    phone: '+213 (0)23 48 81 25',
    fax: '+213 (0)23 48 81 24',
    email: 'anam@anam.gov.dz',
    lat: 36.7538,
    lng: 3.0422,
  },
  {
    id: 'boumerdes',
    title: 'Antenne Regionale - Boumerdes',
    address: "Boulevard de l'ALN, Centre Villa de Boumerdes",
    phone: '024 79 10 41',
    fax: '024 79 10 43',
    email: 'anam-boumerdes@anam.gov.dz',
    lat: 36.7667,
    lng: 3.4833,
  },
  {
    id: 'oran',
    title: 'Antenne Regionale - Oran',
    address: 'Cite Jordaine n 46, 2eme etage, Les Castors, Oran',
    phone: '041 46 26 48',
    fax: '041 45 52 76',
    email: 'anam-oran@anam.gov.dz',
    lat: 35.6971,
    lng: -0.6308,
  },
  {
    id: 'tebessa',
    title: 'Antenne Regionale - Tebessa',
    address: 'Zone urbaine n 02, quartier El Djorf, Tebessa',
    phone: '037 47 49 15',
    fax: '037 47 48 97',
    email: 'anam-tebessa@anam.gov.dz',
    lat: 35.4042,
    lng: 8.1242,
  },
  {
    id: 'bechar',
    title: 'Antenne Regionale - Bechar',
    address: 'Hai El Djihani n 11, Lot 49, Bechar',
    phone: '049 23 07 90',
    fax: '049 23 08 91',
    email: 'anam-bechar@anam.gov.dz',
    lat: 31.6167,
    lng: -2.2167,
  },
  {
    id: 'ouargla',
    title: 'Antenne Regionale - Ouargla',
    address: "Cite 460 Logts, Rue Larbi Ben M'hidi, Mekhadma, Ouargla",
    phone: '029 71 18 16',
    email: 'anam-ouargla@anam.gov.dz',
    lat: 31.9539,
    lng: 5.3326,
  },
  {
    id: 'tamanrasset',
    title: 'Antenne Regionale - Tamanrasset',
    address: 'Sonarem-ORGM, Gattaa El Oued, Tamanrasset',
    phone: '029 32 45 04',
    fax: '029 32 45 04',
    email: 'anam-tamanrasset@anam.gov.dz',
    lat: 22.785,
    lng: 5.5228,
  },
];

const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

const CONTACT_CARD_SELECTOR = '.sp-contact-card';
const CONTACT_CARD_TITLE_SELECTOR = 'h1,h2,h3,h4';

const buildDefaultContactCards = (): ContactCard[] =>
  CONTACT_OFFICES.map((office) => ({
    id: office.id,
    officeId: office.id,
    title: office.title,
    paragraphs: [
      office.address,
      `Tel/Fax: ${office.phone}${office.fax ? ` - ${office.fax}` : ''}`,
      office.email,
    ],
  }));

const extractContactCardsFromContent = (content: string): ContactCard[] => {
  const normalized = String(content || '').trim();
  if (!normalized || typeof window === 'undefined') {
    return [];
  }

  try {
    const doc = new DOMParser().parseFromString(normalized, 'text/html');
    const cards = Array.from(doc.body.querySelectorAll(CONTACT_CARD_SELECTOR));

    return cards
      .map((card, index) => {
        const titleElement = card.querySelector(CONTACT_CARD_TITLE_SELECTOR);
        const title = String(titleElement?.textContent || '').trim();
        const officeId = String(card.getAttribute('data-office-id') || '').trim() || null;
        const paragraphs = Array.from(card.querySelectorAll('p'))
          .map((element) => String(element.textContent || '').trim())
          .filter(Boolean);

        if (!title && paragraphs.length === 0) {
          return null;
        }

        return {
          id: `contact_card_${index}`,
          officeId,
          title: title || `Direction ${index + 1}`,
          paragraphs,
        };
      })
      .filter((card): card is ContactCard => Boolean(card));
  } catch {
    return [];
  }
};

const buildOfficeMap = () =>
  new Map(CONTACT_OFFICES.map((office) => [office.id, office]));

function ContactMapBlock({
  isArabic,
  cards,
}: {
  isArabic: boolean;
  cards: ContactCard[];
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const officeById = useMemo(() => buildOfficeMap(), []);

  const resolvedCards = useMemo(
    () =>
      cards.map((card, index) => ({
        ...card,
        location:
          (card.officeId ? officeById.get(card.officeId) : null) ??
          CONTACT_OFFICES[index] ??
          null,
      })),
    [cards, officeById],
  );

  useEffect(() => {
    let mounted = true;

    const initMap = async () => {
      if (!mounted || !mapRef.current) {
        return;
      }

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const leafletModule = await import('leaflet');
      const L = (leafletModule as any).default ?? leafletModule;

      const map = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: false,
      }).setView([28.163, 2.632], 5);
      mapInstanceRef.current = map;

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const bounds: [number, number][] = [];
      resolvedCards.forEach((card) => {
        if (!card.location) return;

        const latlng: [number, number] = [card.location.lat, card.location.lng];
        bounds.push(latlng);

        L.circleMarker(latlng, {
          radius: 8,
          weight: 2,
          color: '#7a2f55',
          fillColor: '#a54674',
          fillOpacity: 0.92,
        })
          .addTo(map)
          .bindPopup(
            `<strong>${card.title}</strong><br/>${card.paragraphs[0] || card.location.address}<br/>${card.paragraphs[1] || `Tel: ${card.location.phone}`}`,
          );
      });

      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [26, 26] });
      }
    };

    void initMap();

    return () => {
      mounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [resolvedCards]);

  const summaryPhone = resolvedCards[0]?.location?.phone || CONTACT_OFFICES[0]?.phone || '';
  const summaryEmail = resolvedCards[0]?.location?.email || CONTACT_OFFICES[0]?.email || '';

  return (
    <section className={styles.contactBlock}>
      <div className={styles.contactStats}>
        <span>
          {resolvedCards.length}{' '}
          {isArabic ? '\u0639\u0646\u0627\u0648\u064a\u0646' : 'directions affichees'}
          {isArabic ? ' - ' : ' Standard ANAM: '}
        </span>
        <span>{summaryPhone}</span>
        <span>
          <a href={`mailto:${summaryEmail}`}>{summaryEmail}</a>
        </span>
      </div>

      <div className={styles.contactCardsGrid}>
        {resolvedCards.map((card) => {
          const mapHref = card.location
            ? `https://www.google.com/maps?q=${card.location.lat},${card.location.lng}`
            : '';
          return (
            <article key={card.id} className={styles.contactCard}>
              <h3>{card.title}</h3>
              {card.paragraphs.map((paragraph, index) => {
                const value = String(paragraph || '').trim();
                if (!value) return null;

                if (EMAIL_PATTERN.test(value)) {
                  return (
                    <p key={`${card.id}_line_${index}`}>
                      <a href={`mailto:${value}`}>{value}</a>
                    </p>
                  );
                }

                return <p key={`${card.id}_line_${index}`}>{value}</p>;
              })}
              {mapHref ? (
                <a href={mapHref} target="_blank" rel="noreferrer">
                  {isArabic
                    ? '\u0639\u0631\u0636 \u0639\u0644\u0649 \u0627\u0644\u062e\u0631\u064a\u0637\u0629'
                    : 'Voir sur la carte'}
                </a>
              ) : null}
            </article>
          );
        })}
      </div>

      <article className={styles.contactMapCard}>
        <header>
          <h3>
            {isArabic
              ? '\u0645\u0648\u0627\u0642\u0639 \u0627\u0644\u0645\u062f\u064a\u0631\u064a\u0627\u062a'
              : 'Localisation des directions'}
          </h3>
          <p>
            {isArabic
              ? '\u062e\u0631\u064a\u0637\u0629 \u062a\u0641\u0627\u0639\u0644\u064a\u0629 \u0645\u062a\u0627\u062d\u0629 \u0639\u0628\u0631 \u0631\u0648\u0627\u0628\u0637 \u0639\u0631\u0636 \u0639\u0644\u0649 \u0627\u0644\u062e\u0631\u064a\u0637\u0629 \u0644\u0643\u0644 \u0645\u062f\u064a\u0631\u064a\u0629.'
              : "Carte interactive disponible via les liens 'Voir sur la carte' pour chaque direction."}
          </p>
        </header>
        <div ref={mapRef} className={styles.contactMap} />
      </article>
    </section>
  );
}

function LegalContent({ content }: { content: string }) {
  const normalized = String(content || '').trim();

  if (!normalized) {
    return <p>Aucun contenu disponible.</p>;
  }

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const inlineFormat = (value: string) => {
    let output = escapeHtml(value);
    output = output.replace(/`([^`]+)`/g, '<code>$1</code>');
    output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    output = output.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    output = output.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    );
    return output;
  };

  const markdownToHtml = (value: string) => {
    const lines = value.split('\n');
    const output: string[] = [];
    let inUl = false;
    let inOl = false;

    const closeLists = () => {
      if (inUl) {
        output.push('</ul>');
        inUl = false;
      }
      if (inOl) {
        output.push('</ol>');
        inOl = false;
      }
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        closeLists();
        continue;
      }

      if (line.startsWith('### ')) {
        closeLists();
        output.push(`<h3>${inlineFormat(line.slice(4))}</h3>`);
        continue;
      }

      if (line.startsWith('## ')) {
        closeLists();
        output.push(`<h2>${inlineFormat(line.slice(3))}</h2>`);
        continue;
      }

      if (line.startsWith('# ')) {
        closeLists();
        output.push(`<h1>${inlineFormat(line.slice(2))}</h1>`);
        continue;
      }

      if (/^[-*]\s+/.test(line)) {
        if (inOl) {
          output.push('</ol>');
          inOl = false;
        }
        if (!inUl) {
          output.push('<ul>');
          inUl = true;
        }
        output.push(`<li>${inlineFormat(line.replace(/^[-*]\s+/, ''))}</li>`);
        continue;
      }

      if (/^\d+\.\s+/.test(line)) {
        if (inUl) {
          output.push('</ul>');
          inUl = false;
        }
        if (!inOl) {
          output.push('<ol>');
          inOl = true;
        }
        output.push(`<li>${inlineFormat(line.replace(/^\d+\.\s+/, ''))}</li>`);
        continue;
      }

      closeLists();
      output.push(`<p>${inlineFormat(line)}</p>`);
    }

    closeLists();

    return output.join('');
  };

  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(normalized);
  const rendered = looksLikeHtml ? normalized : markdownToHtml(normalized);
  return <div dangerouslySetInnerHTML={{ __html: rendered }} />;
}

export function StaticLegalPage({ slug }: StaticLegalPageProps) {
  const [locale, setLocale] = useState<StaticPageLocale>('fr');
  const [item, setItem] = useState<StaticPageItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLocale(getCurrentLocale());
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await fetchPublicStaticPage(slug, locale);
        if (!cancelled) {
          setItem(data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setItem(null);
          setError(
            err instanceof Error && err.message
              ? err.message
              : 'Impossible de charger la page.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [locale, slug]);

  const title = useMemo(() => {
    if (item?.title) return item.title;
    if (slug === 'conditions-utilisation') return "Conditions d'utilisation";
    if (slug === 'politique-confidentialite') return 'Politique de confidentialite';
    if (slug === 'faq') return 'FAQ - Foire aux questions';
    if (slug === 'documentation') return 'Documentation';
    if (slug === 'contact') return 'Contact';
    return 'Mentions legales';
  }, [item?.title, slug]);

  const isArabic = (item?.locale || locale) === 'ar';

  const lastUpdatedLabel = useMemo(() => {
    if (!item?.updatedAt) return null;

    const date = new Date(item.updatedAt);
    if (Number.isNaN(date.getTime())) return null;

    return new Intl.DateTimeFormat(isArabic ? 'ar-DZ' : 'fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }, [isArabic, item?.updatedAt]);

  const contactCards = useMemo(() => {
    if (slug !== 'contact') {
      return [] as ContactCard[];
    }

    const extracted = extractContactCardsFromContent(item?.content || '');
    if (extracted.length > 0) {
      return extracted;
    }

    return buildDefaultContactCards();
  }, [item?.content, slug]);

  return (
    <div className={styles.page} dir={isArabic ? 'rtl' : 'ltr'}>
      <Header />

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={`container ${styles.heroInner}`}>
            <div className={styles.badge}>
              <FiFileText size={14} />
              <span>
                {isArabic
                  ? '\u0645\u0633\u0627\u062d\u0629 \u0642\u0627\u0646\u0648\u0646\u064a\u0629 \u0631\u0633\u0645\u064a\u0629'
                  : 'Centre de conformite'}
              </span>
            </div>
            <h1>{title}</h1>
            <p>
              {isArabic
                ? '\u0645\u062d\u062a\u0648\u0649 \u0642\u0627\u0646\u0648\u0646\u064a \u062f\u064a\u0646\u0627\u0645\u064a\u0643\u064a \u0642\u0627\u0628\u0644 \u0644\u0644\u062a\u0639\u062f\u064a\u0644 \u0645\u0646 \u0644\u0648\u062d\u0629 \u0627\u0644\u0627\u062f\u0627\u0631\u0629.'
                : "Contenu legal dynamique aligne sur les standards d'un portail institutionnel."}
            </p>

            <div className={styles.metaRow}>
              <span className={styles.metaPill}>
                <FiGlobe size={13} />
                {isArabic ? '\u0627\u0644\u0639\u0631\u0628\u064a\u0629' : 'Francais'}
              </span>
              {lastUpdatedLabel ? (
                <span className={styles.metaPill}>
                  <FiCalendar size={13} />
                  {isArabic
                    ? `\u0622\u062e\u0631 \u062a\u062d\u062f\u064a\u062b ${lastUpdatedLabel}`
                    : `Mise a jour ${lastUpdatedLabel}`}
                </span>
              ) : null}
            </div>

            <div className={styles.actions}>
              <Link href="/acceuil/Home" className={styles.primaryCta}>
                {isArabic
                  ? '\u0627\u0644\u0639\u0648\u062f\u0629 \u0627\u0644\u0649 \u0627\u0644\u0635\u0641\u062d\u0629 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629'
                  : 'Retour accueil'}
              </Link>
              {slug !== 'contact' ? (
                <Link href="/contact" className={styles.secondaryCta}>
                  {isArabic ? '\u0627\u062a\u0635\u0644 \u0628\u0646\u0627' : 'Contact institutionnel'}
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        <section className={`container ${styles.contentWrap}`}>
          {loading ? (
            <div className={styles.feedback}>
              {isArabic
                ? '\u062c\u0627\u0631\u064a \u0627\u0644\u062a\u062d\u0645\u064a\u0644...'
                : 'Chargement...'}
            </div>
          ) : error ? (
            <div className={styles.feedbackError}>{error}</div>
          ) : (
            <>
              <article className={styles.contentCard}>
                <header className={styles.contentHeader}>
                  <h2>{title}</h2>
                  <p>
                    {isArabic
                      ? '\u0646\u0633\u062e\u0629 \u0627\u0644\u0646\u0635 \u0627\u0644\u0645\u0639\u0631\u0648\u0636\u0629 \u062a\u0645 \u0625\u062f\u0627\u0631\u062a\u0647\u0627 \u0639\u0628\u0631 \u0645\u0633\u0627\u062d\u0629 \u0627\u0644\u0625\u062f\u0627\u0631\u0629.'
                      : 'Version officielle publiee depuis l espace administration.'}
                  </p>
                </header>
                <div className={styles.contentBody}>
                  {slug === 'contact' ? (
                    <ContactMapBlock isArabic={isArabic} cards={contactCards} />
                  ) : (
                    <LegalContent content={item?.content || ''} />
                  )}
                </div>
              </article>
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
