import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// @ts-ignore
import 'leaflet-draw';
// @ts-ignore
import 'leaflet-draw/dist/leaflet.draw.css';

type DrawnPoint = { x: number; y: number };

const GisTestPage: React.FC = () => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const perimetersLayerRef = useRef<L.GeoJSON<any> | null>(null);
  const drawnPointsRef = useRef<DrawnPoint[]>([]);

  const [idProc, setIdProc] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [showHistoric, setShowHistoric] = useState<boolean>(false);
  const showHistoricRef = useRef<boolean>(false);
  const [selectedProcId, setSelectedProcId] = useState<number | null>(null);
  const selectedProcIdRef = useRef<number | null>(null);
  const [selectedProcedures, setSelectedProcedures] = useState<
    { procId: number; typeLabel: string; codeDemande?: string }[]
  >([]);
  const [selectedTitleInfo, setSelectedTitleInfo] = useState<{
    permisId?: number | null;
    titreId?: number | null;
  } | null>(null);
  const procedureCacheRef = useRef<
    Map<number, { typeLabel: string; codeDemande?: string }>
  >(new Map());

  const [searchPerimeterId, setSearchPerimeterId] = useState<string>('');
  const [searchProcId, setSearchProcId] = useState<string>('');
  const [searchPermisId, setSearchPermisId] = useState<string>('');
  const [searchTitreId, setSearchTitreId] = useState<string>('');

  const updatePerimetersVisibility = () => {
    const layer = perimetersLayerRef.current;
    if (!layer) return;
    const show = showHistoricRef.current;
    const currentSelected = selectedProcIdRef.current;

    layer.eachLayer((l: any) => {
      if (typeof l.setStyle !== 'function') return;
      const f = l.feature as any;
      const props = (f && f.properties) || {};
      const isLatest = !!props.__isLatest;
      const procId = props.sigam_proc_id !== undefined ? Number(props.sigam_proc_id) : NaN;
      const isSelected = !Number.isNaN(procId) && currentSelected !== null && procId === currentSelected;

      if (isLatest) {
        l.setStyle({
          color: '#2563eb',
          weight: 2,
          opacity: 0.8,
          fillOpacity: 0.2,
          dashArray: null,
        });
      } else if (isSelected || show) {
        l.setStyle({
          color: '#8b5cf6',
          weight: 2,
          opacity: 0.8,
          fillOpacity: 0.1,
          dashArray: '4 4',
        });
      } else {
        l.setStyle({
          weight: 0,
          opacity: 0,
          fillOpacity: 0,
        });
      }
    });
  };

  useEffect(() => {
    showHistoricRef.current = showHistoric;
    updatePerimetersVisibility();
  }, [showHistoric]);

  useEffect(() => {
    selectedProcIdRef.current = selectedProcId;
    updatePerimetersVisibility();
  }, [selectedProcId]);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = L.map(mapRef.current).setView([28.163, 2.632], 6);
    mapInstanceRef.current = map;

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // gis_perimeters layer (all attributes in popup)
    const perimetersLayer = L.geoJSON(undefined, {
      style: () => ({
        color: '#2563eb',
        weight: 2,
        opacity: 0.8,
        fillOpacity: 0.2,
      }),
      onEachFeature: (feature, l) => {
        const props: any = feature.properties || {};

        const labelLines: string[] = [];
        Object.entries(props).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== '') {
            labelLines.push(`${key}: ${value}`);
          }
        });

        if (!labelLines.length) {
          labelLines.push('gis_perimeters feature (aucun attribut lisible)');
        }

        l.bindPopup(labelLines.join('<br/>'));

        // When clicking a perimeter, load its related procedures (types) and
        // allow the user to select which procedure's polygon to highlight.
        l.on('click', async () => {
          const toNum = (v: any): number =>
            v === undefined || v === null || v === '' ? NaN : Number(v);

          const baseProps: any = feature.properties || {};
          const permisId =
            baseProps.permis_id !== undefined && baseProps.permis_id !== null
              ? toNum(baseProps.permis_id)
              : toNum(baseProps.sigam_permis_id);
          const titreId = toNum(
            baseProps.titre_id !== undefined
              ? baseProps.titre_id
              : baseProps.idtitre,
          );

          if (Number.isNaN(permisId) && Number.isNaN(titreId)) {
            return;
          }

          const relatedProcIds = new Set<number>();
          perimetersLayer.eachLayer((other: any) => {
            const of = other?.feature as any;
            const op = (of && of.properties) || {};
            const oPermis =
              op.permis_id !== undefined && op.permis_id !== null
                ? toNum(op.permis_id)
                : toNum(op.sigam_permis_id);
            const oTitre = toNum(
              op.titre_id !== undefined ? op.titre_id : op.idtitre,
            );
            if (
              (!Number.isNaN(permisId) && oPermis === permisId) ||
              (!Number.isNaN(titreId) && oTitre === titreId)
            ) {
              const pid = toNum(op.sigam_proc_id);
              if (!Number.isNaN(pid)) {
                relatedProcIds.add(pid);
              }
            }
          });

          if (!relatedProcIds.size) {
            setSelectedProcedures([]);
            setSelectedTitleInfo({ permisId, titreId });
            setSelectedProcId(null);
            setStatus('Aucune procédure trouvée pour ce périmètre.');
            return;
          }

          const apiUrlInner =
            (import.meta as any).env?.VITE_API_URL ||
            (process as any).env?.NEXT_PUBLIC_API_URL ||
            '';

          const procedures: {
            procId: number;
            typeLabel: string;
            codeDemande?: string;
          }[] = [];

          for (const pid of relatedProcIds) {
            let info = procedureCacheRef.current.get(pid);
            if (!info) {
              try {
                const res = await fetch(
                  `${apiUrlInner || ''}/api/procedures/${pid}/demande`,
                );
                if (res.ok) {
                  const d = await res.json();
                  info = {
                    typeLabel:
                      d?.typeProcedure?.libelle ||
                      d?.typeProcedure?.Libelle ||
                      'Inconnu',
                    codeDemande: d?.code_demande,
                  };
                } else {
                  info = { typeLabel: 'Inconnu', codeDemande: undefined };
                }
              } catch {
                info = { typeLabel: 'Inconnu', codeDemande: undefined };
              }
              procedureCacheRef.current.set(pid, info);
            }
            procedures.push({
              procId: pid,
              typeLabel: info.typeLabel,
              codeDemande: info.codeDemande,
            });
          }

          procedures.sort((a, b) => a.procId - b.procId);

          setSelectedTitleInfo({ permisId, titreId });
          setSelectedProcedures(procedures);
          setSelectedProcId(null);
          setStatus(
            `Périmètre sélectionné. Procédures trouvées: ${procedures
              .map((p) => `${p.procId} (${p.typeLabel})`)
              .join(', ')}`,
          );
        });
      },
    }).addTo(map);
    perimetersLayerRef.current = perimetersLayer;

    // cmasig_promotion
    const promotionLayer = L.geoJSON(undefined, {
      style: () => ({
        color: '#dc2626',
        weight: 1.5,
        opacity: 0.9,
        fillColor: '#ef4444',
        fillOpacity: 0.25,
      }),
      onEachFeature: (feature, l) => {
        const props: any = feature.properties || {};
        const labelLines = [
          `Zone de promotion: ${props.nom ?? ''}`,
          `ID zone: ${props.idzone ?? ''}`,
          `Superficie (sig_area): ${props.sig_area ?? ''}`,
        ];
        l.bindPopup(labelLines.join('<br/>'));
      },
    }).addTo(map);

    // cmasig_wilayas
    const wilayasLayer = L.geoJSON(undefined, {
      style: () => ({
        color: '#4b5563',
        weight: 1,
        opacity: 0.8,
        fillOpacity: 0.05,
      }),
      onEachFeature: (feature, l) => {
        const props: any = feature.properties || {};
        const labelLines = [
          `Wilaya: ${props.wilaya ?? ''}`,
          `Superficie: ${props.sig_area ?? ''}`,
        ];
        l.bindPopup(labelLines.join('<br/>'));
      },
    }).addTo(map);

    // cmasig_communes
    const communesLayer = L.geoJSON(undefined, {
      style: () => ({
        color: '#f97316',
        weight: 0.8,
        opacity: 0.8,
        fillOpacity: 0.08,
      }),
      onEachFeature: (feature, l) => {
        const props: any = feature.properties || {};
        const labelLines = [
          `Commune: ${props.commune ?? ''}`,
          `Wilaya: ${props.wilaya ?? ''}`,
          `Code: ${props.code ?? ''}`,
          `Superficie: ${props.sig_area ?? ''}`,
        ];
        l.bindPopup(labelLines.join('<br/>'));
      },
    }).addTo(map);

    // cmasig_villes
    const villesLayer = L.geoJSON(undefined, {
      pointToLayer: (feature, latlng) =>
        L.circleMarker(latlng, {
          radius: 4,
          color: '#b91c1c',
          weight: 1,
          fillColor: '#f97373',
          fillOpacity: 0.9,
        }),
      onEachFeature: (feature, l) => {
        const props: any = feature.properties || {};
        const labelLines = [
          `Ville: ${props.city_name ?? ''}`,
          `Admin: ${props.admin_name ?? ''}`,
          `Statut: ${props.status ?? ''}`,
          `Pop rank: ${props.pop_rank ?? ''}`,
        ];
        l.bindPopup(labelLines.join('<br/>'));
      },
    }).addTo(map);

    // Titres layer (now backed by gis_perimeters via /gis/titres)
    const titresLayer = L.geoJSON(undefined, {
      style: () => ({
        color: '#22c55e',
        weight: 1.5,
        opacity: 0.9,
        fillColor: '#22c55e',
        fillOpacity: 0.15,
      }),
      onEachFeature: (feature, l) => {
        const props: any = feature.properties || {};
        const fullTitulaire = [props.tnom, props.tprenom].filter(Boolean).join(' ');
        const labelLines = [
          `Titre ID: ${props.idtitre ?? ''}`,
          `Code: ${props.code ?? ''}`,
          `Type: ${props.typetitre ?? ''}`,
          `Titulaire: ${fullTitulaire || ''}`,
          `Superficie (sig_area): ${props.sig_area ?? ''}`,
        ];
        l.bindPopup(labelLines.join('<br/>'));
      },
    }).addTo(map);

    // Layer control
    L.control
      .layers(
        undefined,
        {
          'Périmètres (gis_perimeters)': perimetersLayer,
          'Titres (gis_perimeters)': titresLayer,
          'Zones de promotion': promotionLayer,
          'Wilayas': wilayasLayer,
          'Communes': communesLayer,
          'Villes': villesLayer,
        },
      )
      .addTo(map);

    // FeatureGroup for new drawings
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new (L as any).Control.Draw({
      edit: {
        featureGroup: drawnItems,
      },
      draw: {
        polyline: false,
        circle: false,
        rectangle: false,
        marker: false,
        circlemarker: false,
        polygon: {
          allowIntersection: false,
          showArea: true,
        },
      },
    });
    map.addControl(drawControl);

    map.on((L as any).Draw.Event.CREATED, (e: any) => {
      const layer = e.layer as L.Polygon;
      drawnItems.clearLayers();
      drawnItems.addLayer(layer);
      const latlngs = (layer.getLatLngs()[0] as L.LatLng[]) || [];
      drawnPointsRef.current = latlngs.map((ll) => ({
        x: ll.lng,
        y: ll.lat,
      }));
      setStatus(`Polygon drawn with ${latlngs.length} vertices`);
    });

    const apiUrl =
      (import.meta as any).env?.VITE_API_URL ||
      (process as any).env?.NEXT_PUBLIC_API_URL ||
      '';

    const loadPerimeters = () => {
      fetch(`${apiUrl || ''}/gis/perimeters`)
        .then((res) => res.json())
        .then((fc) => {
          perimetersLayer.clearLayers();

          const anyFc: any = fc;
          if (anyFc && Array.isArray(anyFc.features)) {
            // Reset latest flag
            anyFc.features.forEach((feat: any) => {
              if (!feat.properties) feat.properties = {};
              feat.properties.__isLatest = false;
            });

            // Group perimeters by underlying title / procedure
            const groups = new Map<string, any[]>();
            anyFc.features.forEach((feat: any) => {
              const props = feat.properties || {};
              const permisId =
                props.permis_id !== undefined && props.permis_id !== null
                  ? props.permis_id
                  : props.sigam_permis_id;
              let key: string;
              if (permisId !== undefined && permisId !== null) {
                key = `permis:${String(permisId)}`;
              } else if (
                props.sigam_proc_id !== undefined &&
                props.sigam_proc_id !== null
              ) {
                key = `proc:${String(props.sigam_proc_id)}`;
              } else if (props.id !== undefined && props.id !== null) {
                key = `id:${String(props.id)}`;
              } else {
                key = `idx:${Math.random()}`;
              }
              const existing = groups.get(key);
              if (existing) {
                existing.push(feat);
              } else {
                groups.set(key, [feat]);
              }
            });

            // Within each group, mark the latest perimeter as __isLatest
            groups.forEach((arr) => {
              let best = arr[0];
              let bestProc =
                Number(best.properties?.sigam_proc_id ?? 0) || 0;
              let bestId = Number(best.properties?.id ?? 0) || 0;
              arr.forEach((feat: any) => {
                const p = feat.properties || {};
                const proc = Number(p.sigam_proc_id ?? 0) || 0;
                const id = Number(p.id ?? 0) || 0;
                if (proc > bestProc || (proc === bestProc && id > bestId)) {
                  best = feat;
                  bestProc = proc;
                  bestId = id;
                }
              });
              if (!best.properties) best.properties = {};
              best.properties.__isLatest = true;
            });
          }

          perimetersLayer.addData(anyFc as any);

          // Apply initial visibility: latest perimeters solid, historic hidden by default
          updatePerimetersVisibility();

          try {
            const bounds = perimetersLayer.getBounds();
            if (bounds.isValid()) {
              map.fitBounds(bounds);
            }
          } catch {
            // ignore
          }
        })
        .catch((err) => {
          console.error('Failed to load GIS perimeters:', err);
        });
    };

    const loadPromotionZones = () => {
      fetch(`${apiUrl || ''}/gis/promotion-zones`)
        .then((res) => res.json())
        .then((fc) => {
          promotionLayer.clearLayers();
          promotionLayer.addData(fc as any);
        })
        .catch((err) => {
          console.error('Failed to load GIS promotion zones:', err);
        });
    };

    const loadWilayas = () => {
      fetch(`${apiUrl || ''}/gis/wilayas`)
        .then((res) => res.json())
        .then((fc) => {
          wilayasLayer.clearLayers();
          wilayasLayer.addData(fc as any);
        })
        .catch((err) => {
          console.error('Failed to load GIS wilayas:', err);
        });
    };

    const loadCommunes = () => {
      fetch(`${apiUrl || ''}/gis/communes`)
        .then((res) => res.json())
        .then((fc) => {
          communesLayer.clearLayers();
          communesLayer.addData(fc as any);
        })
        .catch((err) => {
          console.error('Failed to load GIS communes:', err);
        });
    };

    const loadVilles = () => {
      fetch(`${apiUrl || ''}/gis/villes`)
        .then((res) => res.json())
        .then((fc) => {
          villesLayer.clearLayers();
          villesLayer.addData(fc as any);
        })
        .catch((err) => {
          console.error('Failed to load GIS villes:', err);
        });
    };

    const loadTitres = () => {
      fetch(`${apiUrl || ''}/gis/titres`)
        .then((res) => res.json())
        .then((fc) => {
          titresLayer.clearLayers();
          titresLayer.addData(fc as any);
        })
        .catch((err) => {
          console.error('Failed to load titres (gis_perimeters view):', err);
        });
    };

    loadPerimeters();
    loadPromotionZones();
    loadWilayas();
    loadCommunes();
    loadVilles();
    loadTitres();

    return () => {
      map.remove();
    };
  }, []);

  const handleSave = async () => {
    try {
      const id = parseInt(idProc, 10);
      if (!id || Number.isNaN(id)) {
        setStatus('Veuillez entrer un id_proc valide.');
        return;
      }
      const pts = drawnPointsRef.current;
      if (!pts || pts.length < 3) {
        setStatus('Dessinez un polygone avant de sauvegarder.');
        return;
      }
      const apiUrl =
        (import.meta as any).env?.VITE_API_URL ||
        (process as any).env?.NEXT_PUBLIC_API_URL ||
        '';
      const payloadPoints = pts.map((p) => ({
        x: p.x.toString(),
        y: p.y.toString(),
        z: '0',
        system: 'WGS84',
        zone: null,
        hemisphere: 'N',
      }));
      await fetch(`${apiUrl || ''}/coordinates/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_proc: id,
          id_zone_interdite: null,
          points: payloadPoints,
          superficie: undefined,
        }),
      });
      setStatus(
        'Coordonnées sauvegardées. Le SIG devrait être mis à jour.',
      );
    } catch (err) {
      console.error('Failed to save coordinates:', err);
      setStatus('Erreur lors de la sauvegarde des coordonnées.');
    }
  };

  const handleZoomToPerimeter = () => {
    const map = mapInstanceRef.current;
    const layer = perimetersLayerRef.current;
    if (!map || !layer) {
      setStatus('La carte ou la couche gis_perimeters ne sont pas prêtes.');
      return;
    }

    const toNum = (v: any): number =>
      v === undefined || v === null || v === '' ? NaN : Number(v);

    const perimId = toNum(searchPerimeterId);
    const procId = toNum(searchProcId);
    const permisId = toNum(searchPermisId);
    const titreId = toNum(searchTitreId);

    const hasAnyFilter =
      !Number.isNaN(perimId) ||
      !Number.isNaN(procId) ||
      !Number.isNaN(permisId) ||
      !Number.isNaN(titreId);

    if (!hasAnyFilter) {
      setStatus('Renseignez au moins un critère de recherche.');
      return;
    }

    const boundsList: L.LatLngBounds[] = [];

    layer.eachLayer((l: any) => {
      const f = l?.feature as any;
      const props = f?.properties || {};

      let match = true;
      if (!Number.isNaN(perimId)) {
        match = match && toNum(props.id) === perimId;
      }
      if (!Number.isNaN(procId)) {
        match = match && toNum(props.sigam_proc_id) === procId;
      }
      if (!Number.isNaN(permisId)) {
        const permisProp = toNum(
          props.permis_id !== undefined
            ? props.permis_id
            : props.sigam_permis_id,
        );
        match = match && permisProp === permisId;
      }
      if (!Number.isNaN(titreId)) {
        const titreProp = toNum(
          props.titre_id !== undefined ? props.titre_id : props.idtitre,
        );
        const permisPropForTitre = toNum(
          props.permis_id !== undefined
            ? props.permis_id
            : props.sigam_permis_id,
        );
        match =
          match &&
          (titreProp === titreId || permisPropForTitre === titreId);
      }

      if (match && typeof l.getBounds === 'function') {
        const b = l.getBounds() as L.LatLngBounds;
        if (b && b.isValid && b.isValid()) {
          boundsList.push(b);
        }
      }
    });

    if (!boundsList.length) {
      setStatus('Aucun périmètre trouvé pour ces critères.');
      return;
    }

    let union = boundsList[0];
    for (let i = 1; i < boundsList.length; i += 1) {
      union.extend(boundsList[i]);
    }

    map.fitBounds(union, { maxZoom: 14 });
    setStatus(`Zoom sur ${boundsList.length} périmètre(s) correspondant(s).`);
  };

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '8px',
          background: '#f3f4f6',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div style={{ marginBottom: 6 }}>
          <label style={{ marginRight: 8 }}>
            id_proc&nbsp;
            <input
              type="number"
              value={idProc}
              onChange={(e) => setIdProc(e.target.value)}
              style={{ width: 120 }}
            />
          </label>
          <button onClick={handleSave} style={{ marginRight: 12 }}>
            Sauvegarder le périmètre dans SIGAM + SIG
          </button>
        </div>
        <div style={{ marginBottom: 4 }}>
          <span style={{ marginRight: 8 }}>
            Recherche périmètre (gis_perimeters)&nbsp;
          </span>
          <label style={{ marginRight: 6 }}>
            id&nbsp;
            <input
              type="number"
              value={searchPerimeterId}
              onChange={(e) => setSearchPerimeterId(e.target.value)}
              style={{ width: 90 }}
            />
          </label>
          <label style={{ marginRight: 6 }}>
            sigam_proc_id&nbsp;
            <input
              type="number"
              value={searchProcId}
              onChange={(e) => setSearchProcId(e.target.value)}
              style={{ width: 110 }}
            />
          </label>
          <label style={{ marginRight: 6 }}>
            permis_id&nbsp;
            <input
              type="number"
              value={searchPermisId}
              onChange={(e) => setSearchPermisId(e.target.value)}
              style={{ width: 120 }}
            />
          </label>
          <label style={{ marginRight: 6 }}>
            titre_code&nbsp;
            <input
              type="number"
              value={searchTitreId}
              onChange={(e) => setSearchTitreId(e.target.value)}
              style={{ width: 90 }}
            />
          </label>
          <button onClick={handleZoomToPerimeter} style={{ marginLeft: 8 }}>
            Zoom sur périmètre
          </button>
        </div>
        {selectedTitleInfo && selectedProcedures.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <span style={{ marginRight: 8 }}>
              Procédures pour le périmètre sélectionné&nbsp;
            </span>
            <select
              value={selectedProcId ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedProcId(v ? Number(v) : null);
              }}
              style={{ minWidth: 260, marginRight: 8 }}
            >
              <option value="">-- choisir une procédure --</option>
              {selectedProcedures.map((p) => (
                <option key={p.procId} value={p.procId}>
                  {p.typeLabel || 'Procédure'} – id_proc {p.procId}
                  {p.codeDemande ? ` (${p.codeDemande})` : ''}
                </option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: '#4b5563' }}>
              La procédure sélectionnée est affichée en pointillés
              (les autres historiques suivent le filtre ci-dessous).
            </span>
          </div>
        )}
        <label style={{ marginLeft: 12 }}>
          <input
            type="checkbox"
            checked={showHistoric}
            onChange={(e) => setShowHistoric(e.target.checked)}
            style={{ marginRight: 4 }}
          />
          Afficher périmètres historiques
        </label>
        <span>{status}</span>
      </div>
      <div style={{ flex: 1 }}>
        <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  );
};

export default GisTestPage;
