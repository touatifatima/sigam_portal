import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import {
  FiAlertCircle,
  FiArrowDown,
  FiArrowUp,
  FiCheck,
  FiEdit2,
  FiPlus,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import Navbar from '../navbar/Navbar';
import Sidebar from '../sidebar/Sidebar';
import { useViewNavigator } from '@/src/hooks/useViewNavigator';
import { useAuthStore } from '@/src/store/useAuthStore';
import styles from './Declarations.module.css';

type ProcedureDeclarationItem = {
  id: number;
  ordre: number;
  texte: string;
  actif: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type ProcedureDeclarationGroup = {
  id: number;
  libelle: string;
  declarations: ProcedureDeclarationItem[];
};

type ApiResponse = {
  typeProcedures?: ProcedureDeclarationGroup[];
};

type EditFormState = {
  ordre: number;
  texte: string;
  actif: boolean;
};

export default function DeclarationsConfigurationPage() {
  const apiURL = process.env.NEXT_PUBLIC_API_URL;
  const router = useRouter();
  const { auth, isLoaded, hasPermission } = useAuthStore();
  const { currentView, navigateTo } = useViewNavigator('manage_declarations');

  const [groups, setGroups] = useState<ProcedureDeclarationGroup[]>([]);
  const [activeTypeId, setActiveTypeId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    ordre: 1,
    texte: '',
    actif: true,
  });

  const [newOrdre, setNewOrdre] = useState<number>(1);
  const [newTexte, setNewTexte] = useState<string>('');
  const [newActif, setNewActif] = useState<boolean>(true);

  const isAdmin =
    hasPermission('Admin-Panel') ||
    String(auth?.role ?? '')
      .toLowerCase()
      .includes('admin');

  useEffect(() => {
    if (!isLoaded) return;
    if (!isAdmin) {
      router.replace('/unauthorized/page?reason=missing_permissions');
    }
  }, [isLoaded, isAdmin, router]);

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeTypeId) ?? null,
    [groups, activeTypeId],
  );

  const refreshData = useCallback(
    async (preferredTypeId?: number | null) => {
      if (!apiURL) {
        setError("NEXT_PUBLIC_API_URL n'est pas defini.");
        setLoading(false);
        return;
      }

      setError(null);
      const response = await axios.get<ApiResponse>(
        `${apiURL}/api/procedure-declarations/admin/all`,
        { withCredentials: true },
      );

      const items = Array.isArray(response.data?.typeProcedures)
        ? response.data.typeProcedures
        : [];

      setGroups(items);

      const nextActiveId =
        preferredTypeId && items.some((item) => item.id === preferredTypeId)
          ? preferredTypeId
          : items[0]?.id ?? null;
      setActiveTypeId(nextActiveId);
    },
    [apiURL],
  );

  useEffect(() => {
    if (!isLoaded || !isAdmin) return;
    (async () => {
      try {
        await refreshData(activeTypeId);
      } catch (err) {
        console.error('Erreur chargement declarations admin', err);
        setError('Impossible de charger les declarations.');
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoaded, isAdmin, refreshData]);

  useEffect(() => {
    const nextOrdreValue =
      (activeGroup?.declarations?.reduce(
        (max, item) => Math.max(max, item.ordre),
        0,
      ) ?? 0) + 1;
    setNewOrdre(nextOrdreValue);
  }, [activeGroup]);

  const startEdit = (item: ProcedureDeclarationItem) => {
    setEditingId(item.id);
    setEditForm({
      ordre: item.ordre,
      texte: item.texte,
      actif: item.actif,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      ordre: 1,
      texte: '',
      actif: true,
    });
  };

  const handleAddDeclaration = async () => {
    if (!activeGroup) return;
    const texte = newTexte.trim();
    if (!texte) {
      setError('Le texte de la declaration est obligatoire.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await axios.post(
        `${apiURL}/api/procedure-declarations/admin`,
        {
          typeProcedureId: activeGroup.id,
          ordre: Number(newOrdre),
          texte,
          actif: newActif,
        },
        { withCredentials: true },
      );
      setNewTexte('');
      setNewActif(true);
      await refreshData(activeGroup.id);
      setSuccess('Declaration ajoutee.');
    } catch (err) {
      console.error('Erreur ajout declaration', err);
      setError("Impossible d'ajouter la declaration.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const texte = editForm.texte.trim();
    if (!texte) {
      setError('Le texte de la declaration est obligatoire.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await axios.patch(
        `${apiURL}/api/procedure-declarations/admin/${editingId}`,
        {
          ordre: Number(editForm.ordre),
          texte,
          actif: editForm.actif,
          typeProcedureId: activeGroup?.id,
        },
        { withCredentials: true },
      );
      const keepTypeId = activeGroup?.id ?? null;
      cancelEdit();
      await refreshData(keepTypeId);
      setSuccess('Declaration mise a jour.');
    } catch (err) {
      console.error('Erreur mise a jour declaration', err);
      setError('Impossible de mettre a jour la declaration.');
    } finally {
      setSaving(false);
    }
  };

  const handleMove = async (id: number, direction: 'up' | 'down') => {
    if (!activeGroup) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await axios.patch(
        `${apiURL}/api/procedure-declarations/admin/${id}/move`,
        { direction },
        { withCredentials: true },
      );
      await refreshData(activeGroup.id);
    } catch (err) {
      console.error('Erreur move declaration', err);
      setError("Impossible de changer l'ordre.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: ProcedureDeclarationItem) => {
    if (!activeGroup) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await axios.patch(
        `${apiURL}/api/procedure-declarations/admin/${item.id}`,
        { actif: !item.actif, typeProcedureId: activeGroup.id },
        { withCredentials: true },
      );
      await refreshData(activeGroup.id);
    } catch (err) {
      console.error('Erreur toggle actif', err);
      setError("Impossible de changer l'etat actif.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!activeGroup) return;
    if (!window.confirm('Supprimer cette declaration ?')) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await axios.delete(`${apiURL}/api/procedure-declarations/admin/${id}`, {
        withCredentials: true,
      });
      await refreshData(activeGroup.id);
      setSuccess('Declaration supprimee.');
    } catch (err) {
      console.error('Erreur suppression declaration', err);
      setError('Impossible de supprimer la declaration.');
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
    <div className={styles.appContainer}>
      <Navbar />
      <div className={styles.appContent}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles.mainContent}>
          <div className={styles.pageHeader}>
            <h1>Configurations des declarations</h1>
            <p>Gestion des textes de confirmation finale avant facture.</p>
          </div>

          {error && (
            <div className={`${styles.alert} ${styles.alertError}`}>
              <FiAlertCircle />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className={`${styles.alert} ${styles.alertSuccess}`}>
              <FiCheck />
              <span>{success}</span>
            </div>
          )}

          <section className={styles.panel}>
            <div className={styles.tabsRow}>
              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  className={`${styles.tabButton} ${
                    activeTypeId === group.id ? styles.tabButtonActive : ''
                  }`}
                  onClick={() => {
                    setActiveTypeId(group.id);
                    setEditingId(null);
                    setError(null);
                    setSuccess(null);
                  }}
                >
                  {group.libelle || `Type #${group.id}`}
                </button>
              ))}
            </div>

            {loading ? (
              <div className={styles.loadingBody}>Chargement des declarations...</div>
            ) : !activeGroup ? (
              <div className={styles.emptyState}>
                Aucun type de procedure disponible.
              </div>
            ) : (
              <>
                <div className={styles.addCard}>
                  <div className={styles.addHeader}>
                    <h3>Ajouter une declaration</h3>
                    <span>Type: {activeGroup.libelle}</span>
                  </div>
                  <div className={styles.addGrid}>
                    <label className={styles.fieldLabel}>
                      Ordre
                      <input
                        type="number"
                        min={1}
                        value={newOrdre}
                        onChange={(e) => setNewOrdre(Number(e.target.value || 1))}
                        className={styles.input}
                      />
                    </label>
                    <label className={styles.fieldLabelInline}>
                      <input
                        type="checkbox"
                        checked={newActif}
                        onChange={(e) => setNewActif(e.target.checked)}
                      />
                      Actif
                    </label>
                  </div>
                  <label className={styles.fieldLabel}>
                    Texte
                    <textarea
                      rows={4}
                      value={newTexte}
                      onChange={(e) => setNewTexte(e.target.value)}
                      placeholder="Saisissez le texte complet de la declaration..."
                      className={styles.textarea}
                    />
                  </label>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={handleAddDeclaration}
                    disabled={saving}
                  >
                    <FiPlus /> Ajouter une declaration
                  </button>
                </div>

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Ordre</th>
                        <th>Texte</th>
                        <th>Actif</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeGroup.declarations.length === 0 ? (
                        <tr>
                          <td colSpan={4} className={styles.emptyRow}>
                            Aucune declaration pour ce type.
                          </td>
                        </tr>
                      ) : (
                        activeGroup.declarations.map((item) => {
                          const isEditing = editingId === item.id;
                          return (
                            <tr key={item.id}>
                              <td className={styles.ordreCol}>
                                {isEditing ? (
                                  <input
                                    type="number"
                                    min={1}
                                    value={editForm.ordre}
                                    className={styles.input}
                                    onChange={(e) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        ordre: Number(e.target.value || 1),
                                      }))
                                    }
                                  />
                                ) : (
                                  item.ordre
                                )}
                              </td>
                              <td className={styles.texteCol}>
                                {isEditing ? (
                                  <textarea
                                    rows={4}
                                    value={editForm.texte}
                                    className={styles.textarea}
                                    onChange={(e) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        texte: e.target.value,
                                      }))
                                    }
                                  />
                                ) : (
                                  <div className={styles.texteContent}>{item.texte}</div>
                                )}
                              </td>
                              <td>
                                {isEditing ? (
                                  <label className={styles.fieldLabelInline}>
                                    <input
                                      type="checkbox"
                                      checked={editForm.actif}
                                      onChange={(e) =>
                                        setEditForm((prev) => ({
                                          ...prev,
                                          actif: e.target.checked,
                                        }))
                                      }
                                    />
                                    Actif
                                  </label>
                                ) : (
                                  <button
                                    type="button"
                                    className={`${styles.badge} ${
                                      item.actif ? styles.badgeOn : styles.badgeOff
                                    }`}
                                    onClick={() => handleToggleActive(item)}
                                    disabled={saving}
                                  >
                                    {item.actif ? 'Actif' : 'Inactif'}
                                  </button>
                                )}
                              </td>
                              <td>
                                <div className={styles.actions}>
                                  {isEditing ? (
                                    <>
                                      <button
                                        type="button"
                                        className={styles.iconBtn}
                                        onClick={handleSaveEdit}
                                        title="Enregistrer"
                                        disabled={saving}
                                      >
                                        <FiCheck />
                                      </button>
                                      <button
                                        type="button"
                                        className={styles.iconBtn}
                                        onClick={cancelEdit}
                                        title="Annuler"
                                        disabled={saving}
                                      >
                                        <FiX />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        className={styles.iconBtn}
                                        onClick={() => handleMove(item.id, 'up')}
                                        title="Monter"
                                        disabled={saving}
                                      >
                                        <FiArrowUp />
                                      </button>
                                      <button
                                        type="button"
                                        className={styles.iconBtn}
                                        onClick={() => handleMove(item.id, 'down')}
                                        title="Descendre"
                                        disabled={saving}
                                      >
                                        <FiArrowDown />
                                      </button>
                                      <button
                                        type="button"
                                        className={styles.iconBtn}
                                        onClick={() => startEdit(item)}
                                        title="Modifier"
                                        disabled={saving}
                                      >
                                        <FiEdit2 />
                                      </button>
                                      <button
                                        type="button"
                                        className={`${styles.iconBtn} ${styles.dangerBtn}`}
                                        onClick={() => handleDelete(item.id)}
                                        title="Supprimer"
                                        disabled={saving}
                                      >
                                        <FiTrash2 />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
