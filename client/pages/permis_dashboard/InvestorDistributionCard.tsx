'use client';

import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip as LeafletTooltip,
  useMap,
} from 'react-leaflet';
import { FiGlobe, FiMapPin, FiMoreHorizontal, FiUsers } from 'react-icons/fi';
import styles from './PermisDashboard.module.css';
import 'leaflet/dist/leaflet.css';

export type InvestorCountryStat = {
  country: string;
  count: number;
  percentage: number;
  latitude: number | null;
  longitude: number | null;
};

export type InvestorDistributionData = {
  totalInvestors: number;
  countries: InvestorCountryStat[];
  noCountry: {
    count: number;
    percentage: number;
  };
};

type InvestorDistributionCardProps = {
  data: InvestorDistributionData | null;
  loading?: boolean;
};

function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) {
      map.setView([20, 0], 2.2, { animate: true });
      return;
    }

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 4 });
  }, [map, points]);

  return null;
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString('fr-FR');
}

export default function InvestorDistributionCard({
  data,
  loading = false,
}: InvestorDistributionCardProps) {
  const mapCountries = data?.countries ?? [];
  const totalInvestors = data?.totalInvestors ?? 0;
  const topCountries = useMemo(() => mapCountries.slice(0, 4), [mapCountries]);
  const markerPoints = useMemo(
    () =>
      mapCountries
        .filter(
          (country) =>
            Number.isFinite(Number(country.latitude)) &&
            Number.isFinite(Number(country.longitude)),
        )
        .map((country) => [Number(country.latitude), Number(country.longitude)] as [number, number]),
    [mapCountries],
  );
  const maxCount = Math.max(...mapCountries.map((item) => item.count), 1);
  const hasAnyData = totalInvestors > 0;

  return (
    <section className={styles.investorDistributionSection}>
      <div className={styles.investorDistributionCard}>
        <div className={styles.investorDistributionHeader}>
          <div>
            <div className={styles.investorDistributionKicker}>Répartition des investisseurs</div>
            <h4 className={styles.investorDistributionTitle}>Répartition des investisseurs</h4>
            <p className={styles.investorDistributionSubtitle}>
              {hasAnyData
                ? `${formatNumber(totalInvestors)} investisseurs inscrits dans le système`
                : 'Aucun investisseur disponible pour le moment'}
            </p>
          </div>

          <div className={styles.investorDistributionHeaderActions}>
            <span className={styles.investorDistributionCounter}>
              <FiUsers />
              {formatNumber(totalInvestors)}
            </span>
            <button
              type="button"
              className={styles.investorDistributionMenu}
              aria-label="Options répartition des investisseurs"
            >
              <FiMoreHorizontal />
            </button>
          </div>
        </div>

        {loading ? (
          <div className={styles.investorDistributionLoading}>
            <div className={styles.investorDistributionLoadingPulse} />
            <div className={styles.investorDistributionLoadingText}>Chargement de la carte...</div>
          </div>
        ) : hasAnyData ? (
          <>
            <div className={styles.investorDistributionMap}>
              <MapContainer
                center={[20, 0]}
                zoom={2.2}
                scrollWheelZoom={false}
                zoomControl
                className={styles.investorDistributionLeaflet}
                worldCopyJump
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitBounds points={markerPoints} />

                {mapCountries.map((country) => {
                  if (
                    !Number.isFinite(Number(country.latitude)) ||
                    !Number.isFinite(Number(country.longitude))
                  ) {
                    return null;
                  }

                  const ratio = country.count / maxCount;
                  const radius = 8 + Math.max(0, Math.sqrt(ratio) * 16);
                  const opacity = 0.42 + ratio * 0.28;

                  return (
                    <CircleMarker
                      key={country.country}
                      center={[Number(country.latitude), Number(country.longitude)]}
                      radius={radius}
                      pathOptions={{
                        color: '#8b5cf6',
                        weight: 2,
                        fillColor: '#a78bfa',
                        fillOpacity: opacity,
                      }}
                    >
                      <LeafletTooltip direction="top" offset={[0, -4]} opacity={1} sticky>
                        <div className={styles.investorDistributionTooltip}>
                          <strong>{country.country}</strong>
                          <span>{formatNumber(country.count)} investisseurs</span>
                          <span>{country.percentage.toFixed(1)}% du total</span>
                        </div>
                      </LeafletTooltip>
                      <Popup>
                        <div className={styles.investorDistributionTooltip}>
                          <strong>{country.country}</strong>
                          <span>{formatNumber(country.count)} investisseurs</span>
                          <span>{country.percentage.toFixed(1)}% du total</span>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>

            <div className={styles.investorDistributionBars}>
              {topCountries.map((country, index) => (
                <div key={`${country.country}-${index}`} className={styles.investorDistributionBarCard}>
                  <div className={styles.investorDistributionBarHeader}>
                    <span className={styles.investorDistributionBarName}>{country.country}</span>
                    <span className={styles.investorDistributionBarMeta}>
                      {formatNumber(country.count)} · {country.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className={styles.investorDistributionBarTrack}>
                    <span
                      className={styles.investorDistributionBarFill}
                      style={{ width: `${Math.max(country.percentage, 3)}%` }}
                    />
                  </div>
                </div>
              ))}

              {data?.noCountry.count ? (
                <div className={styles.investorDistributionBarCard}>
                  <div className={styles.investorDistributionBarHeader}>
                    <span className={styles.investorDistributionBarName}>Pays non renseigné</span>
                    <span className={styles.investorDistributionBarMeta}>
                      {formatNumber(data.noCountry.count)} · {data.noCountry.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className={styles.investorDistributionBarTrack}>
                    <span
                      className={styles.investorDistributionBarFillAlt}
                      style={{ width: `${Math.max(data.noCountry.percentage, 3)}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className={styles.investorDistributionEmpty}>
            <FiGlobe />
            <h5>Aucune donnée géographique disponible</h5>
            <p>Les pays des investisseurs apparaîtront ici dès qu’ils seront renseignés dans les profils.</p>
            <div className={styles.investorDistributionEmptyHint}>
              <FiMapPin />
              <span>Pays non renseigné sera listé séparément lorsqu’il existe des comptes sans pays.</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
