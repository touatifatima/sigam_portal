'use client';
import '../../src/config/arcgis-enterprise';
import { useEffect, useMemo, useRef, useState } from 'react';
import EsriMap from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import WebTileLayer from '@arcgis/core/layers/WebTileLayer';
import Basemap from '@arcgis/core/Basemap';
import esriConfig from '@arcgis/core/config';
import '@arcgis/core/assets/esri/themes/dark/main.css';
import styles from './promotion.module.css';
import Navbar from '../navbar/Navbar';
import Sidebar from '../sidebar/Sidebar';
import axios from 'axios';
import { FiTrash2, FiX } from 'react-icons/fi';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useViewNavigator } from '@/src/hooks/useViewNavigator';

const PROMOTION_URL = 'https://sig.anam.dz/server/rest/services/sigam_cadastre/FeatureServer/2';

type CategoryFilter = {
  key: string;
  label: string;
  count: number;
  expression: string;
};

export default function PromotionTrashPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<MapView | null>(null);
  const layerRef = useRef<FeatureLayer | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<any | null>(null);
  const [comment, setComment] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string>('corbeille');
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const apiURL = process.env.NEXT_PUBLIC_API_URL;
  const { auth, logout } = useAuthStore();
  const displayUsername = auth.username ?? '';
  const { currentView, navigateTo } = useViewNavigator('promotion');

  const categories: CategoryFilter[] = useMemo(
    () => [
      { key: 'demande', label: 'Demande', count: 46, expression: "UPPER(Nom) LIKE '%DEMANDE%'" },
      { key: 'avis_wali', label: 'Avis Wali / AW', count: 120, expression: "UPPER(Nom) LIKE '%AVIS WALI%' OR UPPER(Nom) LIKE '% AW %' OR UPPER(Nom) LIKE 'AW %' OR UPPER(Nom) LIKE '% AW'" },
      { key: 'avis_defav', label: 'Avis défavorable', count: 126, expression: "UPPER(Nom) LIKE '%AVIS DÉFAVOR%' OR UPPER(Nom) LIKE '%AVIS DEFAVOR%'" },
      { key: 'avis', label: 'Avis (général)', count: 4977, expression: "UPPER(Nom) LIKE '%AVIS%'" },
      { key: 'attribution', label: 'Attribution', count: 3509, expression: "UPPER(Nom) LIKE '%ATTRIB%'" },
      { key: 'extension', label: 'Extension', count: 1584, expression: "UPPER(Nom) LIKE '%EXTENS%'" },
      { key: 'corrige', label: 'Corrigé', count: 114, expression: "UPPER(Nom) LIKE '%CORRIG%'" },
      { key: 'substitution', label: 'Substitution', count: 1560, expression: "UPPER(Nom) LIKE '%SUBSTIT%'" },
      { key: 'annule', label: 'Annulé', count: 513, expression: "UPPER(Nom) LIKE '%ANNUL%'" },
      { key: 'fusion', label: 'Fusion', count: 38, expression: "UPPER(Nom) LIKE '%FUSION%'" },
      { key: 'rectification', label: 'Rectification', count: 17, expression: "UPPER(Nom) LIKE '%RECTIFIC%'" },
      { key: 'modification', label: 'Modification', count: 75, expression: "UPPER(Nom) LIKE '%MODIFIC%'" },
      { key: 'renonce', label: 'Renoncé', count: 41, expression: "UPPER(Nom) LIKE '%RENONC%'" },
      { key: 'promotion', label: 'Promotion', count: 1201, expression: "UPPER(Nom) LIKE '%PROMOTION%'" },
      { key: 'expire', label: 'Expiré', count: 491, expression: "UPPER(Nom) LIKE '%EXPIR%'" },
      { key: 'refuse', label: 'Refusé', count: 288, expression: "UPPER(Nom) LIKE '%REFUS%'" },
      { key: 'abandon', label: 'Abandon / Renonciation', count: 38, expression: "UPPER(Nom) LIKE '%ABANDON%' OR UPPER(Nom) LIKE '%RENON%'" },
      { key: 'prorogation', label: 'Prorogation / Prolongation', count: 1, expression: "UPPER(Nom) LIKE '%PROROG%' OR UPPER(Nom) LIKE '%PROLONG%'" },
      { key: 'ville_nouvelle', label: 'Ville nouvelle', count: 1, expression: "UPPER(Nom) LIKE '%VILLE NOUVELLE%'" },
      {
        key: 'autres',
        label: 'Autres',
        count: 2088,
        expression: [
          "NOT (",
          "UPPER(Nom) LIKE '%DEMANDE%' OR",
          "(UPPER(Nom) LIKE '%AVIS WALI%' OR UPPER(Nom) LIKE '% AW %' OR UPPER(Nom) LIKE 'AW %' OR UPPER(Nom) LIKE '% AW') OR",
          "(UPPER(Nom) LIKE '%AVIS DÉFAVOR%' OR UPPER(Nom) LIKE '%AVIS DEFAVOR%') OR",
          "UPPER(Nom) LIKE '%AVIS%' OR",
          "UPPER(Nom) LIKE '%ATTRIB%' OR",
          "UPPER(Nom) LIKE '%EXTENS%' OR",
          "UPPER(Nom) LIKE '%CORRIG%' OR",
          "UPPER(Nom) LIKE '%SUBSTIT%' OR",
          "UPPER(Nom) LIKE '%ANNUL%' OR",
          "UPPER(Nom) LIKE '%FUSION%' OR",
          "UPPER(Nom) LIKE '%RECTIFIC%' OR",
          "UPPER(Nom) LIKE '%MODIFIC%' OR",
          "UPPER(Nom) LIKE '%RENONC%' OR",
          "UPPER(Nom) LIKE '%PROMOTION%' OR",
          "UPPER(Nom) LIKE '%EXPIR%' OR",
          "UPPER(Nom) LIKE '%REFUS%' OR",
          "UPPER(Nom) LIKE '%ABANDON%' OR UPPER(Nom) LIKE '%RENON%' OR",
          "UPPER(Nom) LIKE '%PROROG%' OR UPPER(Nom) LIKE '%PROLONG%' OR",
          "UPPER(Nom) LIKE '%VILLE NOUVELLE%'",
          ")",
        ].join(' '),
      },
    ],
    [],
  );
  useEffect(() => {
    if (!mapRef.current || viewRef.current) return;
    // Ensure ArcGIS assets (workers, i18n) are fetched from a reachable location
    if (!esriConfig.assetsPath) {
      esriConfig.assetsPath = 'https://js.arcgis.com/4.33/';
    }

    // Always use OSM tiles to avoid basemap load failures
    const osmLayer = new WebTileLayer({
      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      title: 'OpenStreetMap',
    });
    const osmBasemap = new Basemap({ baseLayers: [osmLayer] });
    const map = new EsriMap({ basemap: osmBasemap });
    const view = new MapView({
      container: mapRef.current,
      map,
      center: [2.6, 28.1],
      zoom: 6,
      constraints: {
        snapToZoom: false,
      },
    });
    const promotionLayer = new FeatureLayer({
      url: PROMOTION_URL,
      outFields: ['*'],
      popupEnabled: false,
    });
    layerRef.current = promotionLayer;
    map.add(promotionLayer);

    const clickHandle = view.on('click', async (event) => {
      const response = await view.hitTest(event);
      const result = response.results.find(
        (r: any) => r.graphic?.layer === promotionLayer,
      );
      if (result && 'graphic' in result) {
        setSelectedFeature((result as any).graphic);
        setConfirmOpen(true);
      }
    });

    viewRef.current = view;
    return () => {
      clickHandle.remove();
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const catMap = new Map(categories.map((c) => [c.key, c.expression]));
    const exprs = selectedCategories
      .map((key) => catMap.get(key))
      .filter((e): e is string => !!e)
      .map((e) => `(${e})`);
    const categoryExpr = exprs.join(' OR ');
    layer.definitionExpression = categoryExpr || undefined;
    layer.refresh();
  }, [categories, selectedCategories]);

  // Live search debounce
  useEffect(() => {
    const t = setTimeout(() => {
      handleSearch();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const handleSearch = async () => {
    const layer = layerRef.current;
    const view = viewRef.current;
    const text = searchText.trim();
    setSearchError(null);
    if (!layer || !view) {
      setSearchError('Carte non prête');
      return;
    }
    if (!text) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const safe = text.replace(/'/g, "''").toUpperCase();
      const query = layer.createQuery();
      query.where = `UPPER(Nom) LIKE '%${safe}%'`;
      query.outFields = ['OBJECTID', 'Nom', 'IdZone', 'SIG_AREA'];
      query.returnGeometry = true;
      query.num = 50;
      const res = await layer.queryFeatures(query);
      setSearchResults(res.features || []);
      if (!res.features?.length) {
        setSearchError('Aucun résultat');
      }
    } catch (e) {
      console.error('Search failed', e);
      setSearchError('Erreur lors de la recherche');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleResultClick = async (graphic: any) => {
    const view = viewRef.current;
    if (!view || !graphic?.geometry) return;
    try {
      const target: any = graphic.geometry.extent ?? graphic.geometry;
      await view.goTo(target, { duration: 800 });
    } catch (e) {
      console.warn('Failed to goTo result', e);
    }
  };

  const handleDelete = async () => {
    if (!selectedFeature || !apiURL) return;
    const attrs = selectedFeature.attributes || {};
    const objectId = attrs.OBJECTID ?? attrs.objectid ?? attrs.objectId;
    if (!objectId) {
      console.error('No OBJECTID on selected feature');
      return;
    }
    try {
      await axios.post(
        `${apiURL}/gis/promotion/${objectId}/delete`,
        {
          deletedBy: displayUsername,
          commentaire: comment,
          targetLayer: deleteTarget,
        },
        { withCredentials: true },
      );
      layerRef.current?.refresh();
      setConfirmOpen(false);
      setSelectedFeature(null);
      setComment('');
    } catch (e) {
      console.error('Failed to delete promotion', e);
    }
  };

  return (
    <div className={styles.page}>
          <Navbar />
      <div className={`${styles.layout} ${!sidebarOpen ? styles.layoutCollapsed : ''}`}>
        {sidebarOpen && <Sidebar currentView={currentView} navigateTo={navigateTo} />}
        <main className={styles.main}>
          <div className={styles.toolbar}>
            <div className={styles.header}>
              <h2>Promotion</h2>
              <p>Filtrez, cherchez, et inspectez les polygones Promotion.</p>
            </div>
            <div className={styles.actionsRow}>
              <button
                className={styles.toggleButton}
                onClick={() => setSidebarOpen((v) => !v)}
              >
                {sidebarOpen ? 'Masquer le menu' : 'Afficher le menu'}
              </button>
              <button
                className={styles.clearButton}
                onClick={() => setSelectedCategories([])}
              >
                Réinitialiser filtres
              </button>
              <button
                className={styles.toggleButton}
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? 'Masquer filtres' : 'Afficher filtres'}
              </button>
            </div>
          </div>

          <div className={`${styles.content} ${!showFilters ? styles.noFilters : ''}`}>
            <div className={styles.searchPanel}>
              <div className={styles.filterTitle}>Recherche par nom</div>
              <div className={styles.searchRow}>
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Chercher dans Nom..."
                  className={styles.searchInput}
                />
                {searchLoading && <span className={styles.searchSpinner}>…</span>}
              </div>
              {searchError && (
                <div className={styles.searchError}>{searchError}</div>
              )}
              {searchResults.length > 0 && (
                <div className={styles.searchResults}>
                  {searchResults.map((f: any) => (
                    <button
                      key={f.attributes?.OBJECTID ?? f.attributes?.objectid}
                      onClick={() => handleResultClick(f)}
                      className={styles.searchResultItem}
                    >
                      <div className={styles.resultTitle}>{f.attributes?.Nom ?? f.attributes?.nom ?? '—'}</div>
                      <div className={styles.resultMeta}>OBJECTID: {f.attributes?.OBJECTID ?? f.attributes?.objectid ?? '—'}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.map} ref={mapRef} />

            {showFilters && (
              <div className={styles.filtersPanel}>
                <div className={styles.filterHeader}>
                  <div>
                    <div className={styles.filterTitle}>Filtres par catégorie</div>
                    <div className={styles.filterHint}>Cochez pour filtrer la couche Promotion sur la carte.</div>
                  </div>
                </div>
                <div className={styles.filterList}>
                  {categories.map((cat) => (
                    <label key={cat.key} className={styles.filterItem}>
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat.key)}
                        onChange={(e) => {
                          setSelectedCategories((prev) =>
                            e.target.checked
                              ? [...prev, cat.key]
                              : prev.filter((k) => k !== cat.key),
                          );
                        }}
                      />
                      <span className={styles.filterLabel}>{cat.label}</span>
                      <span className={styles.filterCount}>{cat.count}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {confirmOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <button
              className={styles.close}
              onClick={() => setConfirmOpen(false)}
            >
              <FiX />
            </button>
            <div className={styles.modalIcon}>
              <FiTrash2 size={32} />
            </div>
            <h3>Supprimer cette zone de promotion ?</h3>
            <p>
              Elle sera retirée de la couche et archivée dans la corbeille avec vos commentaires.
            </p>
            <div className={styles.details}>
              <h4>Données du polygone</h4>
              <div className={styles.attrGrid}>
                {selectedFeature &&
                  Object.entries(selectedFeature.attributes || {}).map(
                    ([key, value]) => (
                      <div key={key} className={styles.attrItem}>
                        <span className={styles.attrKey}>{key}</span>
                        <span className={styles.attrValue}>
                          {value === null || value === undefined
                            ? '—'
                            : String(value)}
                        </span>
                      </div>
                    ),
                  )}
              </div>
            </div>
            <textarea
              placeholder="Commentaire (optionnel)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className={styles.textarea}
            />
            <div className={styles.selectRow}>
              <label>Envoyer vers la table</label>
              <select
                value={deleteTarget}
                onChange={(e) => setDeleteTarget(e.target.value)}
                className={styles.select}
              >
                <option value="corbeille">Corbeille (défaut)</option>
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.actions}>
              <button
                className={styles.secondary}
                onClick={() => setConfirmOpen(false)}
              >
                Annuler
              </button>
              <button className={styles.primary} onClick={handleDelete}>
                Confirmer et supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
