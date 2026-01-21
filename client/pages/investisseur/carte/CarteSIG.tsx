import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import L from 'leaflet';
import * as turf from '@turf/turf';
import { AlertTriangle, Mountain, FileText, Shield, MapPin, Maximize2, Minus, Plus } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import styles from './CarteSIG.module.css';
import Navbar from '../../navbar/Navbar';
import Sidebar from '../../sidebar/Sidebar';
import { useViewNavigator } from '../../../src/hooks/useViewNavigator';
import layoutStyles from '../nouvelle_demande/step3/capacities3.module.css';

// Types
interface LayerConfig {
  id: string;
  name: string;
  color: string;
  enabled: boolean;
  count: number;
  icon: React.ReactNode;
}

interface FeatureProperties {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'pending' | 'expired';
  surface: number;
  owner?: string;
  dateCreation?: string;
}

interface OverlapInfo {
  layer1: string;
  layer2: string;
  area: number;
}

// Mock GeoJSON data (will be replaced by API calls)
const mockMinesData: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'MINE-001',
        name: 'Mine de Ouenza',
        type: 'Mine de fer',
        status: 'active',
        surface: 450,
        owner: 'Entreprise Minière Algérienne',
        dateCreation: '2018-03-15'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[[7.95, 35.95], [8.05, 35.95], [8.05, 36.05], [7.95, 36.05], [7.95, 35.95]]]
      }
    },
    {
      type: 'Feature',
      properties: {
        id: 'MINE-002',
        name: 'Mine de Ghar Djebilet',
        type: 'Mine de fer',
        status: 'active',
        surface: 1200,
        owner: 'SOMIFER',
        dateCreation: '2015-07-22'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-8.5, 27.2], [-8.3, 27.2], [-8.3, 27.4], [-8.5, 27.4], [-8.5, 27.2]]]
      }
    }
  ]
};

const mockPermisData: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'PERM-001',
        name: 'Permis Exploration Nord',
        type: 'Permis de recherche',
        status: 'active',
        surface: 800,
        owner: 'GeoExplore SARL',
        dateCreation: '2023-01-10'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[[8.0, 35.98], [8.15, 35.98], [8.15, 36.1], [8.0, 36.1], [8.0, 35.98]]]
      }
    },
    {
      type: 'Feature',
      properties: {
        id: 'PERM-002',
        name: 'Permis Exploitation Sud',
        type: "Permis d'exploitation",
        status: 'pending',
        surface: 350,
        owner: 'Mineral Corp',
        dateCreation: '2024-02-28'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[[3.0, 36.5], [3.2, 36.5], [3.2, 36.7], [3.0, 36.7], [3.0, 36.5]]]
      }
    }
  ]
};

const mockZonesProtegeesData: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'ZONE-001',
        name: 'Parc National El Kala',
        type: 'Zone protégée',
        status: 'active',
        surface: 7800,
        dateCreation: '1983-06-23'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[[8.2, 36.8], [8.6, 36.8], [8.6, 37.0], [8.2, 37.0], [8.2, 36.8]]]
      }
    }
  ]
};

const mockAutresData: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'AUTRE-001',
        name: 'Zone Industrielle Rouiba',
        type: 'Zone industrielle',
        status: 'active',
        surface: 250,
        dateCreation: '2010-04-12'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[[3.25, 36.72], [3.35, 36.72], [3.35, 36.78], [3.25, 36.78], [3.25, 36.72]]]
      }
    }
  ]
};

// Map Controls Component
const MapControls: React.FC = () => {
  const map = useMap();

  const handleZoomIn = () => map.zoomIn();
  const handleZoomOut = () => map.zoomOut();
  const handleFitBounds = () => {
    map.setView([28.0, 3.0], 5);
  };

  return (
    <div className={styles.mapControls}>
      <button className={styles.controlButton} onClick={handleZoomIn} title="Zoom avant">
        <Plus size={18} />
      </button>
      <button className={styles.controlButton} onClick={handleZoomOut} title="Zoom arrière">
        <Minus size={18} />
      </button>
      <button className={styles.controlButton} onClick={handleFitBounds} title="Vue d'ensemble">
        <Maximize2 size={18} />
      </button>
    </div>
  );
};

const CarteSIG: React.FC = () => {
  const [basemap, setBasemap] = useState<'streets' | 'satellite'>('streets');
  const [isLoading, setIsLoading] = useState(true);
  const [overlaps, setOverlaps] = useState<OverlapInfo[]>([]);
  
  const [layers, setLayers] = useState<LayerConfig[]>([
    { id: 'mines', name: 'Mines', color: '#e67e22', enabled: true, count: 2, icon: <Mountain size={16} /> },
    { id: 'permis', name: 'Permis', color: '#3498db', enabled: true, count: 2, icon: <FileText size={16} /> },
    { id: 'zones_protegees', name: 'Zones protégées', color: '#27ae60', enabled: false, count: 1, icon: <Shield size={16} /> },
    { id: 'autres', name: 'Autres couches SIG', color: '#9b59b6', enabled: false, count: 1, icon: <MapPin size={16} /> },
  ]);

  const { currentView, navigateTo } = useViewNavigator('carte-sig');
  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Calculate overlaps when layers change
  useEffect(() => {
    const calculateOverlaps = () => {
      const newOverlaps: OverlapInfo[] = [];
      
      const enabledLayers = layers.filter(l => l.enabled);
      const layerData: Record<string, GeoJSON.FeatureCollection> = {
        mines: mockMinesData,
        permis: mockPermisData,
        zones_protegees: mockZonesProtegeesData,
        autres: mockAutresData
      };

      for (let i = 0; i < enabledLayers.length; i++) {
        for (let j = i + 1; j < enabledLayers.length; j++) {
          const layer1 = enabledLayers[i];
          const layer2 = enabledLayers[j];
          const data1 = layerData[layer1.id];
          const data2 = layerData[layer2.id];

          if (data1 && data2) {
            data1.features.forEach(f1 => {
              data2.features.forEach(f2 => {
                try {
                  const intersection = turf.intersect(
                    turf.featureCollection([f1 as GeoJSON.Feature<GeoJSON.Polygon>]),
                    f2 as GeoJSON.Feature<GeoJSON.Polygon>
                  );
                  if (intersection) {
                    const area = turf.area(intersection) / 10000; // Convert to hectares
                    if (area > 0.01) {
                      newOverlaps.push({
                        layer1: layer1.name,
                        layer2: layer2.name,
                        area: Math.round(area * 100) / 100
                      });
                    }
                  }
                } catch (e) {
                  // Ignore intersection errors
                }
              });
            });
          }
        }
      }

      setOverlaps(newOverlaps);
    };

    calculateOverlaps();
  }, [layers]);

  const toggleLayer = (id: string) => {
    setLayers(prev => prev.map(layer => 
      layer.id === id ? { ...layer, enabled: !layer.enabled } : layer
    ));
  };

  const getLayerStyle = useCallback((layerId: string) => {
    const layer = layers.find(l => l.id === layerId);
    const color = layer?.color || '#888';
    
    return {
      color: color,
      weight: 2,
      opacity: 0.8,
      fillColor: color,
      fillOpacity: 0.3,
    };
  }, [layers]);

  const onEachFeature = (feature: GeoJSON.Feature, leafletLayer: L.Layer) => {
    const props = feature.properties as FeatureProperties;
    
    const statusClass = props.status === 'active' ? styles.statusActive : 
                        props.status === 'pending' ? styles.statusPending : 
                        styles.statusExpired;
    
    const statusText = props.status === 'active' ? 'Actif' : 
                       props.status === 'pending' ? 'En attente' : 
                       'Expiré';

    const popupContent = `
      <div class="${styles.popup}">
        <div class="${styles.popupHeader}">
          <div>
            <h4 class="${styles.popupTitle}">${props.name}</h4>
            <p class="${styles.popupType}">${props.type}</p>
          </div>
        </div>
        <div class="${styles.popupDetails}">
          <div class="${styles.popupRow}">
            <span class="${styles.popupLabel}">Code</span>
            <span class="${styles.popupValue}">${props.id}</span>
          </div>
          <div class="${styles.popupRow}">
            <span class="${styles.popupLabel}">Surface</span>
            <span class="${styles.popupValue}">${props.surface} ha</span>
          </div>
          ${props.owner ? `
          <div class="${styles.popupRow}">
            <span class="${styles.popupLabel}">Titulaire</span>
            <span class="${styles.popupValue}">${props.owner}</span>
          </div>
          ` : ''}
          <div class="${styles.popupRow}">
            <span class="${styles.popupLabel}">Statut</span>
            <span class="${styles.popupStatus} ${statusClass}">${statusText}</span>
          </div>
        </div>
      </div>
    `;

    leafletLayer.bindPopup(popupContent);
  };

  const basemapUrl = basemap === 'streets' 
    ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

  const isLayerEnabled = (id: string) => layers.find(l => l.id === id)?.enabled;

  return (
    <div className={layoutStyles.appContainer}>
      <Navbar />
      <div className={layoutStyles.appContent}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={layoutStyles.mainContent}>
    <div className={styles.pageContainer}>
      {/* Left Panel */}
      <aside className={styles.leftPanel}>
        <div className={styles.panelHeader}>
          <h1 className={styles.panelTitle}>Carte SIG – Mines & Permis</h1>
          <p className={styles.panelSubtitle}>Visualisation et analyse spatiale</p>
        </div>

        <div className={styles.panelContent}>
          {/* Overlap Warning */}
          {overlaps.length > 0 && (
            <div className={styles.overlapWarning}>
              <AlertTriangle size={20} className={styles.overlapIcon} />
              <div className={styles.overlapContent}>
                <h4>Chevauchement détecté</h4>
                <p>{overlaps.length} zone(s) de chevauchement identifiée(s)</p>
                <ul className={styles.overlapList}>
                  {overlaps.map((o, i) => (
                    <li key={i}>{o.layer1} ↔ {o.layer2} ({o.area} ha)</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Basemap Toggle */}
          <div className={styles.basemapSection}>
            <h3 className={styles.sectionTitle}>Fond de carte</h3>
            <div className={styles.basemapToggle}>
              <button 
                className={`${styles.basemapButton} ${basemap === 'streets' ? styles.active : ''}`}
                onClick={() => setBasemap('streets')}
              >
                Rues
              </button>
              <button 
                className={`${styles.basemapButton} ${basemap === 'satellite' ? styles.active : ''}`}
                onClick={() => setBasemap('satellite')}
              >
                Satellite
              </button>
            </div>
          </div>

          {/* Layers */}
          <div className={styles.layersSection}>
            <h3 className={styles.sectionTitle}>Couches SIG</h3>
            <div className={styles.layersList}>
              {layers.map(layer => (
                <div 
                  key={layer.id}
                  className={`${styles.layerItem} ${layer.enabled ? styles.active : ''}`}
                  onClick={() => toggleLayer(layer.id)}
                >
                  <input 
                    type="checkbox" 
                    checked={layer.enabled} 
                    onChange={() => {}}
                    className={styles.layerCheckbox}
                  />
                  <div className={styles.layerInfo}>
                    <p className={styles.layerName}>{layer.name}</p>
                    <p className={styles.layerCount}>{layer.count} entités</p>
                  </div>
                  <div 
                    className={styles.layerColor} 
                    style={{ backgroundColor: layer.color }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className={styles.legendSection}>
            <h3 className={styles.sectionTitle}>Légende</h3>
            {layers.filter(l => l.enabled).map(layer => (
              <div key={layer.id} className={styles.legendItem}>
                <div className={styles.legendColor} style={{ backgroundColor: layer.color }} />
                <span className={styles.legendLabel}>{layer.name}</span>
              </div>
            ))}
            {overlaps.length > 0 && (
              <div className={styles.legendItem}>
                <div className={styles.legendColor} style={{ backgroundColor: '#e74c3c' }} />
                <span className={styles.legendLabel}>Zone de chevauchement</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Map Container */}
      <div className={styles.mapContainer}>
        {isLoading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.loadingSpinner}>
              <div className={styles.spinner} />
              <span className={styles.loadingText}>Chargement des couches...</span>
            </div>
          </div>
        )}

        <MapContainer
          center={[28.0, 3.0]}
          zoom={5}
          className={styles.map}
          zoomControl={false}
        >
          <TileLayer
            url={basemapUrl}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          <MapControls />

          {/* GeoJSON Layers */}
          {isLayerEnabled('mines') && (
            <GeoJSON
              key="mines"
              data={mockMinesData}
              style={() => getLayerStyle('mines')}
              onEachFeature={onEachFeature}
            />
          )}

          {isLayerEnabled('permis') && (
            <GeoJSON
              key="permis"
              data={mockPermisData}
              style={() => getLayerStyle('permis')}
              onEachFeature={onEachFeature}
            />
          )}

          {isLayerEnabled('zones_protegees') && (
            <GeoJSON
              key="zones_protegees"
              data={mockZonesProtegeesData}
              style={() => getLayerStyle('zones_protegees')}
              onEachFeature={onEachFeature}
            />
          )}

          {isLayerEnabled('autres') && (
            <GeoJSON
              key="autres"
              data={mockAutresData}
              style={() => getLayerStyle('autres')}
              onEachFeature={onEachFeature}
            />
          )}
        </MapContainer>
      </div>
    </div>
        </main>
      </div>
    </div>
  );
};

export default CarteSIG;
