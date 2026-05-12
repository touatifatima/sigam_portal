import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  FiAlertCircle,
  FiCheck,
  FiEdit2,
  FiPlus,
  FiSave,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import { useAuthStore } from '@/src/store/useAuthStore';
import { isAdminRole } from '@/src/utils/roleNavigation';
import {
  createNavbarLink,
  deleteNavbarLink,
  fetchAdminNavbarLinks,
  updateNavbarLink,
  type NavbarQuickLinkItem,
} from '@/src/utils/navbarLinksApi';
import styles from './navbar-config.module.css';

type FormState = {
  key: string;
  label: string;
  href: string;
  description: string;
  icon: string;
  section: string;
  sortOrder: number;
  isActive: boolean;
  showForAdmin: boolean;
  showForOperateur: boolean;
  showForInvestisseur: boolean;
  requiredPermission: string;
};

const getNextSortOrder = (items: NavbarQuickLinkItem[]) =>
  items.reduce((max, item) => Math.max(max, Number(item.sortOrder) || 0), 0) + 1;

const createEmptyForm = (sortOrder: number): FormState => ({
  key: '',
  label: '',
  href: '',
  description: '',
  icon: '',
  section: 'main',
  sortOrder: sortOrder > 0 ? sortOrder : 1,
  isActive: true,
  showForAdmin: true,
  showForOperateur: true,
  showForInvestisseur: true,
  requiredPermission: '',
});

const mapItemToForm = (item: NavbarQuickLinkItem): FormState => ({
  key: item.key || '',
  label: item.label || '',
  href: item.href || '',
  description: item.description || '',
  icon: item.icon || '',
  section: item.section || 'main',
  sortOrder: Number(item.sortOrder) || 0,
  isActive: Boolean(item.isActive),
  showForAdmin: Boolean(item.showForAdmin),
  showForOperateur: Boolean(item.showForOperateur),
  showForInvestisseur: Boolean(item.showForInvestisseur),
  requiredPermission: item.requiredPermission || '',
});

export default function NavbarConfigSection() {
  const router = useRouter();
  const { auth, hasPermission, isLoaded } = useAuthStore();

  const [links, setLinks] = useState<NavbarQuickLinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(createEmptyForm(1));
  const hasInitialLoadRef = useRef(false);
  const hasRedirectedRef = useRef(false);

  const isAdmin = useMemo(
    () => hasPermission('Admin-Panel') || isAdminRole(auth?.role),
    [auth?.role, hasPermission],
  );

  const resetForm = useCallback((sortOrder = 1) => {
    setEditingId(null);
    setForm(createEmptyForm(sortOrder));
  }, []);

  const refreshData = useCallback(
    async (keepEditing = false) => {
      const items = await fetchAdminNavbarLinks();
      setLinks(items);

      if (!keepEditing) {
        resetForm(getNextSortOrder(items));
      }

      return items;
    },
    [resetForm],
  );

  useEffect(() => {
    if (!isLoaded) return;
    if (!isAdmin) {
      if (!hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        void router.replace('/unauthorized/page?reason=missing_permissions');
      }
      return;
    }
    hasRedirectedRef.current = false;

    if (hasInitialLoadRef.current) return;
    hasInitialLoadRef.current = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        await refreshData(false);
      } catch (err) {
        console.error('Erreur chargement navbar config', err);
        setError('Impossible de charger la configuration navbar.');
      } finally {
        setLoading(false);
      }
    })();
    // Keep this effect strictly one-shot once auth/admin state is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isLoaded, refreshData]);

  const startEdit = (item: NavbarQuickLinkItem) => {
    setEditingId(item.id);
    setError(null);
    setSuccess(null);
    setForm(mapItemToForm(item));
  };

  const handleSubmit = async () => {
    const trimmedLabel = form.label.trim();
    const trimmedHref = form.href.trim();
    if (!trimmedLabel) {
      setError('Le label est obligatoire.');
      return;
    }
    if (!trimmedHref) {
      setError('Le lien (href) est obligatoire.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const payload = {
        key: form.key.trim() || undefined,
        label: trimmedLabel,
        href: trimmedHref,
        description: form.description.trim() || null,
        icon: form.icon.trim() || null,
        section: form.section.trim() || 'main',
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
        showForAdmin: form.showForAdmin,
        showForOperateur: form.showForOperateur,
        showForInvestisseur: form.showForInvestisseur,
        requiredPermission: form.requiredPermission.trim() || null,
      };

      if (editingId) {
        await updateNavbarLink(editingId, payload);
        setSuccess('Lien navbar mis a jour.');
      } else {
        await createNavbarLink(payload);
        setSuccess('Lien navbar ajoute.');
      }

      await refreshData(false);
    } catch (err: any) {
      console.error('Erreur sauvegarde navbar link', err);
      setError(err?.message || 'Impossible de sauvegarder ce lien navbar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Supprimer ce lien navbar ?')) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await deleteNavbarLink(id);
      await refreshData(editingId !== id);
      setSuccess('Lien navbar supprime.');
    } catch (err: any) {
      console.error('Erreur suppression navbar link', err);
      setError(err?.message || 'Impossible de supprimer ce lien navbar.');
    } finally {
      setSaving(false);
    }
  };

  if (!isLoaded || !isAdmin) {
    return (
      <div className={styles.loadingState}>
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.pageHeader}>
        <h1>Configuration Navbar</h1>
        <p>Ajoutez, modifiez et activez les liens rapides visibles selon les roles.</p>
      </header>

      {error ? (
        <div className={`${styles.alert} ${styles.alertError}`}>
          <FiAlertCircle />
          <span>{error}</span>
        </div>
      ) : null}
      {success ? (
        <div className={`${styles.alert} ${styles.alertSuccess}`}>
          <FiCheck />
          <span>{success}</span>
        </div>
      ) : null}

      <section className={styles.formCard}>
        <div className={styles.formHeader}>
          <h2>{editingId ? 'Modifier le lien' : 'Ajouter un lien navbar'}</h2>
          <span>{editingId ? `Edition #${editingId}` : 'Nouveau lien'}</span>
        </div>

        <div className={styles.formGrid}>
          <label className={styles.field}>
            Cle unique
            <input
              type="text"
              value={form.key}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, key: event.target.value }))
              }
              className={styles.input}
              placeholder="scan-qr"
            />
          </label>

          <label className={styles.field}>
            Label
            <input
              type="text"
              value={form.label}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, label: event.target.value }))
              }
              className={styles.input}
              placeholder="Scan QR"
            />
          </label>

          <label className={styles.field}>
            Href
            <input
              type="text"
              value={form.href}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, href: event.target.value }))
              }
              className={styles.input}
              placeholder="/operateur/scan-qr"
            />
          </label>

          <label className={styles.field}>
            Section
            <input
              type="text"
              value={form.section}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, section: event.target.value }))
              }
              className={styles.input}
              placeholder="main"
            />
          </label>

          <label className={styles.field}>
            Ordre
            <input
              type="number"
              value={form.sortOrder}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  sortOrder: Number(event.target.value || 0),
                }))
              }
              className={styles.input}
              min={0}
            />
          </label>

          <label className={styles.field}>
            Permission requise
            <input
              type="text"
              value={form.requiredPermission}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  requiredPermission: event.target.value,
                }))
              }
              className={styles.input}
              placeholder="scan-qr"
            />
          </label>

          <label className={styles.fieldFull}>
            Description
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              className={styles.textarea}
              rows={2}
              placeholder="Description courte du lien"
            />
          </label>

          <label className={styles.fieldFull}>
            Nom de l icone (optionnel)
            <input
              type="text"
              value={form.icon}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, icon: event.target.value }))
              }
              className={styles.input}
              placeholder="qr, file, bell..."
            />
          </label>
        </div>

        <div className={styles.toggleRow}>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, isActive: event.target.checked }))
              }
            />
            Actif
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={form.showForAdmin}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, showForAdmin: event.target.checked }))
              }
            />
            Admin
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={form.showForOperateur}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  showForOperateur: event.target.checked,
                }))
              }
            />
            Operateur
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={form.showForInvestisseur}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  showForInvestisseur: event.target.checked,
                }))
              }
            />
            Investisseur
          </label>
        </div>

        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => void handleSubmit()}
            disabled={saving}
          >
            {editingId ? <FiSave /> : <FiPlus />}
            {editingId ? 'Enregistrer' : 'Ajouter'}
          </button>

          {editingId ? (
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => resetForm()}
              disabled={saving}
            >
              <FiX />
              Annuler
            </button>
          ) : null}
        </div>
      </section>

      <section className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h2>Liens configures</h2>
          <span>{links.length} element(s)</span>
        </div>

        {loading ? (
          <div className={styles.emptyState}>Chargement...</div>
        ) : links.length === 0 ? (
          <div className={styles.emptyState}>
            Aucun lien configure. Ajoutez un premier lien pour activer la navbar dynamique.
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Ordre</th>
                  <th>Label</th>
                  <th>Href</th>
                  <th>Cle</th>
                  <th>Permission</th>
                  <th>Roles</th>
                  <th>Etat</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {links.map((item) => (
                  <tr key={item.id}>
                    <td>{item.sortOrder}</td>
                    <td>{item.label}</td>
                    <td>{item.href}</td>
                    <td>{item.key}</td>
                    <td>{item.requiredPermission || '-'}</td>
                    <td>
                      <div className={styles.rolesWrap}>
                        {item.showForAdmin ? (
                          <span className={styles.roleBadge}>Admin</span>
                        ) : null}
                        {item.showForOperateur ? (
                          <span className={styles.roleBadge}>Operateur</span>
                        ) : null}
                        {item.showForInvestisseur ? (
                          <span className={styles.roleBadge}>Investisseur</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`${styles.stateBadge} ${
                          item.isActive ? styles.stateOn : styles.stateOff
                        }`}
                      >
                        {item.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => startEdit(item)}
                          disabled={saving}
                          title="Modifier"
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          type="button"
                          className={`${styles.iconBtn} ${styles.dangerBtn}`}
                          onClick={() => void handleDelete(item.id)}
                          disabled={saving}
                          title="Supprimer"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
