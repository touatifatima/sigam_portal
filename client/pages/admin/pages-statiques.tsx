import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FiEdit3,
  FiFileText,
  FiGlobe,
  FiPlus,
  FiSave,
  FiShield,
  FiTrash2,
} from 'react-icons/fi';
import Navbar from '@/pages/navbar/Navbar';
import Sidebar from '@/pages/sidebar/Sidebar';
import { useViewNavigator } from '@/src/hooks/useViewNavigator';
import { useAuthStore } from '@/src/store/useAuthStore';
import { isAdminRole } from '@/src/utils/roleNavigation';
import {
  fetchAdminStaticPages,
  getCurrentLocale,
  updateStaticPage,
  type StaticPageItem,
  type StaticPageLocale,
  type StaticPageSlug,
} from '@/src/utils/staticPagesApi';
import styles from './pages-statiques.module.css';

const slugLabelMap: Record<StaticPageSlug, string> = {
  'conditions-utilisation': "Conditions d'utilisation",
  'politique-confidentialite': 'Politique de confidentialite',
  'mentions-legales': 'Mentions legales',
  faq: 'FAQ - Foire aux questions',
  documentation: 'Documentation',
  contact: 'Contact',
};

type EditableBlock = {
  id: string;
  tag: string;
  value: string;
  sourceIndex: number | null;
  templateIndex: number | null;
};

type ContactCardBlock = {
  id: string;
  officeId: string;
  title: string;
  paragraphs: string;
};

type ContactCardTemplate = {
  id: string;
  title: string;
  address: string;
  phone: string;
  fax?: string;
  email: string;
};

const CONTACT_CARD_SELECTOR = '.sp-contact-card';
const CONTACT_CARD_TITLE_SELECTOR = 'h1,h2,h3,h4';
const CONTACT_CARD_EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

const CONTACT_CARD_TEMPLATES: ContactCardTemplate[] = [
  {
    id: 'siege',
    title: 'Direction Generale - Siege ANAM',
    address: '42 Chemin Mohamed Seghir Gacem, El Mouradia, Alger',
    phone: '+213 (0)23 48 81 25',
    fax: '+213 (0)23 48 81 24',
    email: 'anam@anam.gov.dz',
  },
  {
    id: 'boumerdes',
    title: 'Antenne Regionale - Boumerdes',
    address: "Boulevard de l'ALN, Centre Villa de Boumerdes",
    phone: '024 79 10 41',
    fax: '024 79 10 43',
    email: 'anam-boumerdes@anam.gov.dz',
  },
  {
    id: 'oran',
    title: 'Antenne Regionale - Oran',
    address: 'Cite Jordaine n 46, 2eme etage, Les Castors, Oran',
    phone: '041 46 26 48',
    fax: '041 45 52 76',
    email: 'anam-oran@anam.gov.dz',
  },
  {
    id: 'tebessa',
    title: 'Antenne Regionale - Tebessa',
    address: 'Zone urbaine n 02, quartier El Djorf, Tebessa',
    phone: '037 47 49 15',
    fax: '037 47 48 97',
    email: 'anam-tebessa@anam.gov.dz',
  },
  {
    id: 'bechar',
    title: 'Antenne Regionale - Bechar',
    address: 'Hai El Djihani n 11, Lot 49, Bechar',
    phone: '049 23 07 90',
    fax: '049 23 08 91',
    email: 'anam-bechar@anam.gov.dz',
  },
  {
    id: 'ouargla',
    title: 'Antenne Regionale - Ouargla',
    address: "Cite 460 Logts, Rue Larbi Ben M'hidi, Mekhadma, Ouargla",
    phone: '029 71 18 16',
    email: 'anam-ouargla@anam.gov.dz',
  },
  {
    id: 'tamanrasset',
    title: 'Antenne Regionale - Tamanrasset',
    address: 'Sonarem-ORGM, Gattaa El Oued, Tamanrasset',
    phone: '029 32 45 04',
    fax: '029 32 45 04',
    email: 'anam-tamanrasset@anam.gov.dz',
  },
];

const HTML_BLOCK_SELECTOR = 'h1,h2,h3,h4,p,li,summary';

const isHtmlContent = (value: string) => /<[a-z][\s\S]*>/i.test(String(value || '').trim());

const labelForTag = (tag: string, index: number) => {
  if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
    return `Titre ${index + 1}`;
  }

  if (tag === 'li') {
    return `Element de liste ${index + 1}`;
  }

  if (tag === 'summary') {
    return `Question ${index + 1}`;
  }

  return `Paragraphe ${index + 1}`;
};

const createBlockId = () =>
  `new_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const escapeHtml = (value: string) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const splitParagraphLines = (value: string): string[] =>
  String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const buildDefaultContactCards = (): ContactCardBlock[] =>
  CONTACT_CARD_TEMPLATES.map((template, index) => ({
    id: `contact_seed_${template.id}_${index}`,
    officeId: template.id,
    title: template.title,
    paragraphs: [
      template.address,
      `Tel/Fax: ${template.phone}${template.fax ? ` - ${template.fax}` : ''}`,
      template.email,
    ].join('\n'),
  }));

const extractContactCardsFromHtml = (html: string): ContactCardBlock[] => {
  if (typeof window === 'undefined') return [];

  try {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const cards = Array.from(doc.body.querySelectorAll(CONTACT_CARD_SELECTOR));

    return cards
      .map((card, index) => {
        const titleElement = card.querySelector(CONTACT_CARD_TITLE_SELECTOR);
        const title = String(titleElement?.textContent || '').trim();
        const officeId =
          String(card.getAttribute('data-office-id') || '').trim() ||
          CONTACT_CARD_TEMPLATES[index]?.id ||
          '';
        const paragraphs = Array.from(card.querySelectorAll('p'))
          .map((element) => String(element.textContent || '').trim())
          .filter(Boolean)
          .join('\n');

        if (!title && !paragraphs) {
          return null;
        }

        return {
          id: `contact_source_${index}_${officeId || 'card'}`,
          officeId,
          title: title || `Direction ${index + 1}`,
          paragraphs,
        };
      })
      .filter((card): card is ContactCardBlock => Boolean(card));
  } catch {
    return [];
  }
};

const buildContactHtmlFromCards = (cards: ContactCardBlock[]): string => {
  const cardsHtml = cards
    .map((card, index) => {
      const title = String(card.title || '').trim();
      const lines = splitParagraphLines(card.paragraphs);
      if (!title && lines.length === 0) {
        return '';
      }

      const officeId =
        String(card.officeId || '').trim() || CONTACT_CARD_TEMPLATES[index]?.id || '';
      const dataOfficeId = officeId ? ` data-office-id="${escapeHtml(officeId)}"` : '';
      const paragraphsHtml = lines
        .map((line) => {
          if (CONTACT_CARD_EMAIL_PATTERN.test(line)) {
            const email = escapeHtml(line);
            return `<p><a href="mailto:${email}">${email}</a></p>`;
          }

          return `<p>${escapeHtml(line)}</p>`;
        })
        .join('');

      return `<article class="sp-contact-card"${dataOfficeId}><h3>${escapeHtml(
        title || `Direction ${index + 1}`,
      )}</h3>${paragraphsHtml}</article>`;
    })
    .filter(Boolean)
    .join('\n');

  return `<div class="sp-contact-cards">\n${cardsHtml}\n</div>`;
};

const toPlainText = (value: string): string => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';

  if (!isHtmlContent(normalized)) {
    return normalized;
  }

  if (typeof window === 'undefined') {
    return normalized.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  try {
    const doc = new DOMParser().parseFromString(normalized, 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  } catch {
    return normalized.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
};

const buildFallbackHtmlFromBlocks = (blocks: EditableBlock[]): string =>
  blocks
    .map((block) => `<p>${escapeHtml(block.value).replace(/\n/g, '<br/>')}</p>`)
    .join('\n')
    .trim();

const extractEditableBlocks = (html: string): EditableBlock[] => {
  if (typeof window === 'undefined') return [];

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const elements = Array.from(doc.body.querySelectorAll(HTML_BLOCK_SELECTOR)).filter(
      (element) => (element.textContent || '').trim().length > 0,
    );

    return elements.map((element, index) => {
      const tag = element.tagName.toLowerCase();
      return {
        id: `source_${index}_${tag}`,
        tag,
        value: (element.textContent || '').trim(),
        sourceIndex: index,
        templateIndex: index,
      };
    });
  } catch {
    return [];
  }
};

const rebuildHtmlFromBlocks = (html: string, blocks: EditableBlock[]): string => {
  if (typeof window === 'undefined') return html;

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const sourceElements = Array.from(doc.body.querySelectorAll(HTML_BLOCK_SELECTOR)).filter(
      (element) => (element.textContent || '').trim().length > 0,
    );
    const sourceByIndex = new Map<number, Element>();
    sourceElements.forEach((element, index) => {
      sourceByIndex.set(index, element);
    });

    const keptSourceIndices = new Set(
      blocks
        .map((block) => block.sourceIndex)
        .filter((value): value is number => value !== null),
    );

    sourceElements.forEach((element, index) => {
      if (!keptSourceIndices.has(index)) {
        element.remove();
      }
    });

    let previousDomElement: Element | null = null;

    blocks.forEach((block) => {
      if (block.sourceIndex !== null) {
        const existing = sourceByIndex.get(block.sourceIndex);
        if (!existing) return;
        existing.textContent = block.value.trim();
        previousDomElement = existing;
        return;
      }

      const template =
        block.templateIndex !== null
          ? sourceByIndex.get(block.templateIndex)
          : null;

      const created = template
        ? (template.cloneNode(true) as Element)
        : doc.createElement(block.tag || 'p');

      created.textContent = block.value.trim();

      if (previousDomElement?.parentNode) {
        previousDomElement.parentNode.insertBefore(
          created,
          previousDomElement.nextSibling,
        );
      } else if (template?.parentNode) {
        template.parentNode.appendChild(created);
      } else {
        doc.body.appendChild(created);
      }

      previousDomElement = created;
    });

    return doc.body.innerHTML.trim();
  } catch {
    return html;
  }
};

const buildFaqHtmlFromBlocks = (blocks: EditableBlock[]): string => {
  type FaqEntry =
    | { type: 'faq'; question: string; answer: string }
    | { type: 'paragraph'; text: string };
  type FaqSection = { title: string; entries: FaqEntry[] };

  const sections: FaqSection[] = [];
  let currentSection: FaqSection | null = null;

  const ensureSection = () => {
    if (!currentSection) {
      currentSection = { title: 'FAQ', entries: [] };
      sections.push(currentSection);
    }
    return currentSection;
  };

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const value = String(block.value || '').trim();

    if (block.tag === 'h3') {
      currentSection = { title: value || `Section ${sections.length + 1}`, entries: [] };
      sections.push(currentSection);
      continue;
    }

    if (block.tag === 'summary') {
      const next = blocks[index + 1];
      const nextIsAnswer = next && next.tag === 'p';
      const answer = nextIsAnswer ? String(next.value || '').trim() : '';

      ensureSection().entries.push({
        type: 'faq',
        question: value,
        answer,
      });

      if (nextIsAnswer) {
        index += 1;
      }
      continue;
    }

    if (block.tag === 'p') {
      ensureSection().entries.push({
        type: 'paragraph',
        text: value,
      });
    }
  }

  if (sections.length === 0) {
    sections.push({ title: 'FAQ', entries: [] });
  }

  const sectionsHtml = sections
    .map((section) => {
      const entriesHtml = section.entries
        .map((entry) => {
          if (entry.type === 'faq') {
            return `<details class="sp-faq-item"><summary>${escapeHtml(
              entry.question,
            )}</summary><p>${escapeHtml(entry.answer)}</p></details>`;
          }

          return `<p>${escapeHtml(entry.text)}</p>`;
        })
        .join('');

      return `<section class="sp-section"><h3>${escapeHtml(
        section.title,
      )}</h3>${entriesHtml}</section>`;
    })
    .join('');

  return `<div class="sp-sections">${sectionsHtml}</div>`;
};

export default function PagesStatiquesAdminPage() {
  const { currentView, navigateTo } = useViewNavigator('manage_static_pages');
  const auth = useAuthStore((state) => state.auth);
  const isAuthLoaded = useAuthStore((state) => state.isLoaded);

  const [locale, setLocale] = useState<StaticPageLocale>('fr');
  const [items, setItems] = useState<StaticPageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingSlug, setEditingSlug] = useState<StaticPageSlug | null>(null);
  const [title, setTitle] = useState('');
  const [sourceHtml, setSourceHtml] = useState('');
  const [editableBlocks, setEditableBlocks] = useState<EditableBlock[]>([]);
  const [contactCards, setContactCards] = useState<ContactCardBlock[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isAdmin = useMemo(() => isAdminRole(auth?.role), [auth?.role]);

  useEffect(() => {
    setLocale(getCurrentLocale());
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await fetchAdminStaticPages(locale);
      setItems(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Impossible de charger les pages statiques.',
      );
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    if (!isAuthLoaded || !isAdmin) {
      if (isAuthLoaded) setLoading(false);
      return;
    }

    void loadItems();
  }, [isAdmin, isAuthLoaded, loadItems]);

  useEffect(() => {
    if (!editingSlug) return;
    const currentItem = items.find((item) => item.slug === editingSlug);
    if (!currentItem) return;

    setTitle(currentItem.title);
    setSourceHtml(currentItem.content);

    if (editingSlug === 'contact') {
      const cards = isHtmlContent(currentItem.content)
        ? extractContactCardsFromHtml(currentItem.content)
        : [];

      setContactCards(cards.length > 0 ? cards : buildDefaultContactCards());
      setEditableBlocks([]);
      return;
    }

    setContactCards([]);
    const blocks = isHtmlContent(currentItem.content)
      ? extractEditableBlocks(currentItem.content)
      : [];

    if (blocks.length > 0) {
      setEditableBlocks(blocks);
      return;
    }

    setEditableBlocks([
      {
        id: 'fallback_text_0',
        tag: 'p',
        value: toPlainText(currentItem.content),
        sourceIndex: null,
        templateIndex: null,
      },
    ]);
  }, [editingSlug, items]);

  const startEdit = (item: StaticPageItem) => {
    setEditingSlug(item.slug);
    setTitle(item.title);
    setSourceHtml(item.content);

    if (item.slug === 'contact') {
      const cards = isHtmlContent(item.content)
        ? extractContactCardsFromHtml(item.content)
        : [];
      setContactCards(cards.length > 0 ? cards : buildDefaultContactCards());
      setEditableBlocks([]);
      setError('');
      setMessage('');
      return;
    }

    setContactCards([]);
    const blocks = isHtmlContent(item.content) ? extractEditableBlocks(item.content) : [];

    if (blocks.length > 0) {
      setEditableBlocks(blocks);
    } else {
      setEditableBlocks([
        {
          id: 'fallback_text_0',
          tag: 'p',
          value: toPlainText(item.content),
          sourceIndex: null,
          templateIndex: null,
        },
      ]);
    }
    setError('');
    setMessage('');
  };

  const findTemplateIndexByTag = (
    blocks: EditableBlock[],
    tag: string,
  ): number | null => {
    const fromSource = blocks.find(
      (entry) => entry.tag === tag && entry.sourceIndex !== null,
    );
    if (fromSource && typeof fromSource.sourceIndex === 'number') {
      return fromSource.sourceIndex;
    }

    const fromTemplate = blocks.find(
      (entry) => entry.tag === tag && entry.templateIndex !== null,
    );
    return fromTemplate?.templateIndex ?? null;
  };

  const addEditableBlock = () => {
    setEditableBlocks((previous) => {
      if (editingSlug === 'faq') {
        const questionBlock: EditableBlock = {
          id: createBlockId(),
          tag: 'summary',
          value: '',
          sourceIndex: null,
          templateIndex: findTemplateIndexByTag(previous, 'summary'),
        };
        const answerBlock: EditableBlock = {
          id: createBlockId(),
          tag: 'p',
          value: '',
          sourceIndex: null,
          templateIndex: findTemplateIndexByTag(previous, 'p'),
        };
        return [...previous, questionBlock, answerBlock];
      }

      return [
        ...previous,
        {
          id: createBlockId(),
          tag: 'p',
          value: '',
          sourceIndex: null,
          templateIndex: findTemplateIndexByTag(previous, 'p'),
        },
      ];
    });
  };

  const removeBlockAt = (index: number) => {
    setEditableBlocks((previous) => {
      if (previous.length <= 1) return previous;
      const block = previous[index];
      if (!block) return previous;

      if (editingSlug === 'faq') {
        const next = previous[index + 1];
        const prev = previous[index - 1];

        if (block.tag === 'summary' && next?.tag === 'p') {
          return [...previous.slice(0, index), ...previous.slice(index + 2)];
        }

        if (block.tag === 'p' && prev?.tag === 'summary') {
          return [...previous.slice(0, index - 1), ...previous.slice(index + 1)];
        }
      }

      return [...previous.slice(0, index), ...previous.slice(index + 1)];
    });
  };

  const addContactCard = () => {
    setContactCards((previous) => {
      const template = CONTACT_CARD_TEMPLATES[previous.length];
      return [
        ...previous,
        {
          id: createBlockId(),
          officeId: template?.id || '',
          title: '',
          paragraphs: '',
        },
      ];
    });
  };

  const removeContactCardAt = (index: number) => {
    setContactCards((previous) => {
      if (previous.length <= 1) return previous;
      return [...previous.slice(0, index), ...previous.slice(index + 1)];
    });
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();

    if (!editingSlug) return;

    if (!title.trim()) {
      setError('Le titre est obligatoire.');
      return;
    }

    let nextContent = '';
    if (editingSlug === 'contact') {
      const normalizedCards = contactCards
        .map((card) => ({
          ...card,
          title: String(card.title || '').trim(),
          paragraphs: splitParagraphLines(card.paragraphs),
        }))
        .filter((card) => card.title || card.paragraphs.length > 0);

      if (normalizedCards.length === 0) {
        setError('Ajoutez au moins un bloc de direction.');
        return;
      }

      const hasMissingTitle = normalizedCards.some((card) => !card.title);
      if (hasMissingTitle) {
        setError('Chaque bloc doit contenir un titre.');
        return;
      }

      const hasMissingParagraph = normalizedCards.some(
        (card) => card.paragraphs.length === 0,
      );
      if (hasMissingParagraph) {
        setError('Chaque bloc doit contenir au moins un paragraphe.');
        return;
      }

      nextContent = buildContactHtmlFromCards(
        normalizedCards.map((card) => ({
          ...card,
          paragraphs: card.paragraphs.join('\n'),
        })),
      );
    } else if (editingSlug === 'faq') {
      nextContent = buildFaqHtmlFromBlocks(editableBlocks);
    } else {
      const hasStructuredHtmlSource =
        isHtmlContent(sourceHtml) && extractEditableBlocks(sourceHtml).length > 0;
      nextContent = hasStructuredHtmlSource
        ? rebuildHtmlFromBlocks(sourceHtml, editableBlocks)
        : buildFallbackHtmlFromBlocks(editableBlocks);
    }

    if (!String(nextContent || '').trim()) {
      setError('Le contenu est obligatoire.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await updateStaticPage(editingSlug, {
        title: title.trim(),
        content: String(nextContent).trim(),
        locale,
      });
      setMessage('Page enregistree avec succes.');
      await loadItems();
    } catch (err: unknown) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Enregistrement de la page impossible.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthLoaded) {
    return <div className={styles.loadingState}>Chargement...</div>;
  }

  if (!isAdmin) {
    return (
      <div className={styles.blockedState}>
        <div className={styles.blockedCard}>
          <FiShield size={24} />
          <h1>Acces limite</h1>
          <p>Cette page est reservee aux administrateurs.</p>
          <Link href="/" className={styles.backLink}>
            Retour accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.appContainer}>
      <Navbar />
      <div className={styles.appContent}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles.mainContent}>
          <section className={styles.hero}>
            <div>
              <div className={styles.badge}>
                <FiFileText size={14} />
                <span>Administration - Pages statiques</span>
              </div>
              <h1>Gestion du contenu legal</h1>
              <p>
                Modifiez les pages statiques (conditions, politique, mentions, FAQ,
                documentation, contact) en francais et en arabe. Le style est gere par
                le code CSS, l edition admin met a jour uniquement le contenu textuel.
              </p>
            </div>
            <div className={styles.localeBox}>
              <label htmlFor="locale-switch">
                <FiGlobe />
                Langue
              </label>
              <select
                id="locale-switch"
                value={locale}
                onChange={(event) => {
                  setLocale(event.target.value as StaticPageLocale);
                  setMessage('');
                  setError('');
                }}
                disabled={saving}
              >
                <option value="fr">Francais</option>
                <option value="ar">Arabe</option>
              </select>
            </div>
          </section>

          {message ? <div className={styles.feedbackSuccess}>{message}</div> : null}
          {error ? <div className={styles.feedbackError}>{error}</div> : null}

          <section className={styles.layout}>
            <article className={styles.listCard}>
              <header>
                <h2>Pages disponibles</h2>
              </header>

              <div className={styles.listBody}>
                {loading ? (
                  <div className={styles.emptyState}>Chargement...</div>
                ) : items.length === 0 ? (
                  <div className={styles.emptyState}>Aucune page disponible.</div>
                ) : (
                  items.map((item) => (
                    <article key={`${item.slug}-${item.locale}`} className={styles.pageItem}>
                      <div>
                        <strong>{slugLabelMap[item.slug]}</strong>
                        <span>{item.slug}</span>
                        <small>Titre: {item.title}</small>
                      </div>
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        disabled={saving}
                        className={styles.editBtn}
                      >
                        <FiEdit3 size={14} />
                        Modifier
                      </button>
                    </article>
                  ))
                )}
              </div>
            </article>

            <article className={styles.editorCard}>
              <header>
                <h2>
                  {editingSlug
                    ? `Edition: ${slugLabelMap[editingSlug]}`
                    : 'Choisissez une page a modifier'}
                </h2>
              </header>

              {editingSlug ? (
                <form className={styles.form} onSubmit={handleSave}>
                  <label className={styles.field}>
                    <span>Titre</span>
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      disabled={saving}
                      placeholder="Titre de la page"
                    />
                  </label>

                  <div className={styles.field}>
                    <span>Contenu</span>
                    {editingSlug === 'contact' ? (
                      <div className={styles.blocksEditor}>
                        <div className={styles.editorToolbar}>
                          <p className={styles.editorHint}>
                            Un bloc = titre + paragraphes (une ligne par paragraphe).
                          </p>
                          <button
                            type="button"
                            onClick={addContactCard}
                            disabled={saving}
                            className={styles.addGlobalBtn}
                          >
                            <FiPlus size={13} />
                            Ajouter un bloc
                          </button>
                        </div>
                        <div className={styles.blocksList}>
                          {contactCards.map((card, index) => (
                            <article key={card.id} className={styles.contactBlockField}>
                              <div className={styles.blockHead}>
                                <span>Bloc {index + 1}</span>
                                <button
                                  type="button"
                                  onClick={() => removeContactCardAt(index)}
                                  disabled={saving || contactCards.length <= 1}
                                  className={styles.deleteBtn}
                                  title="Supprimer ce bloc"
                                >
                                  <FiTrash2 size={13} />
                                  Supprimer
                                </button>
                              </div>
                              <label className={styles.blockField}>
                                <span>Titre</span>
                                <input
                                  value={card.title}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setContactCards((previous) =>
                                      previous.map((entry, entryIndex) =>
                                        entryIndex === index ? { ...entry, title: value } : entry,
                                      ),
                                    );
                                  }}
                                  disabled={saving}
                                  placeholder="Titre de la direction"
                                />
                              </label>
                              <label className={styles.blockField}>
                                <span>Paragraphes (une ligne = un paragraphe)</span>
                                <textarea
                                  value={card.paragraphs}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setContactCards((previous) =>
                                      previous.map((entry, entryIndex) =>
                                        entryIndex === index
                                          ? { ...entry, paragraphs: value }
                                          : entry,
                                      ),
                                    );
                                  }}
                                  disabled={saving}
                                  placeholder={
                                    'Adresse\nTel/Fax: ...\nemail@anam.gov.dz'
                                  }
                                />
                              </label>
                            </article>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className={styles.blocksEditor}>
                        <div className={styles.editorToolbar}>
                          <p className={styles.editorHint}>
                            Le style est verrouille. Modifiez le texte et ajoutez des blocs.
                          </p>
                          <button
                            type="button"
                            onClick={addEditableBlock}
                            disabled={saving}
                            className={styles.addGlobalBtn}
                            title={
                              editingSlug === 'faq'
                                ? 'Ajouter une question et sa reponse'
                                : 'Ajouter un bloc'
                            }
                          >
                            <FiPlus size={13} />
                            Ajouter un bloc
                          </button>
                        </div>
                        <div className={styles.blocksList}>
                          {editableBlocks.map((block, index) => (
                            <label key={block.id} className={styles.blockField}>
                              <span className={styles.blockHead}>
                                <span>
                                  {labelForTag(block.tag, index)}{' '}
                                  <small>({block.tag.toUpperCase()})</small>
                                </span>
                                <span className={styles.blockActions}>
                                  <button
                                    type="button"
                                    onClick={() => removeBlockAt(index)}
                                    disabled={saving || editableBlocks.length <= 1}
                                    className={styles.deleteBtn}
                                    title="Supprimer ce bloc"
                                  >
                                    <FiTrash2 size={13} />
                                    Supprimer
                                  </button>
                                </span>
                              </span>
                              <textarea
                                value={block.value}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setEditableBlocks((previous) =>
                                    previous.map((entry, entryIndex) =>
                                      entryIndex === index ? { ...entry, value } : entry,
                                    ),
                                  );
                                }}
                                disabled={saving}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <button type="submit" className={styles.saveBtn} disabled={saving}>
                    <FiSave size={14} />
                    {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                  </button>
                </form>
              ) : (
                <div className={styles.emptyState}>Selectionnez une page pour afficher le formulaire.</div>
              )}
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
