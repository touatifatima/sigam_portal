'use client';

import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  FiAlertTriangle,
  FiCalendar,
  FiCheckCircle,
  FiChevronRight,
  FiClock,
} from 'react-icons/fi';
import { useSearchParams } from '@/src/hooks/useSearchParams';
import Navbar from '../../navbar/Navbar';
import Sidebar from '../../sidebar/Sidebar';
import { useViewNavigator } from '../../../src/hooks/useViewNavigator';
import styles from './Timeline.module.css';

type StepStatus = 'TERMINEE' | 'EN_COURS' | 'EN_ATTENTE' | string;

interface TimelineStep {
  id: number;
  name: string;
  order: number;
  plannedDuration: number | null;
  actualDuration: string | null;
  startDate: string | null;
  endDate: string | null;
  status: StepStatus;
  delay: string | null;
}

interface DemandSummary {
  id: number;
  code: string;
  type: string;
  permitType?: string;
  status: string;
  submissionDate: string | null;
  processingTime: string | null;
}

interface ProcedureInfo {
  id: number;
  number: string;
  type: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  totalDuration: string | null;
}

interface ProcedureTimeline {
  procedure: ProcedureInfo;
  steps: TimelineStep[];
  demands: DemandSummary[];
}

const STATUS_LABEL: Record<string, string> = {
  TERMINEE: 'Terminée',
  EN_COURS: 'En cours',
  EN_ATTENTE: 'En attente',
};

const statusToClass = (status: StepStatus) => {
  switch (status) {
    case 'TERMINEE':
      return styles.statusDone;
    case 'EN_COURS':
      return styles.statusActive;
    default:
      return styles.statusPending;
  }
};

const TimelinePage = () => {
  const searchParams = useSearchParams();
  const procedureId = searchParams?.get('id');
  const [timeline, setTimeline] = useState<ProcedureTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentView, navigateTo } = useViewNavigator();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    if (!procedureId) {
      setError('Aucune procédure sélectionnée.');
      setLoading(false);
      return;
    }

    const fetchTimeline = async () => {
      try {
        setLoading(true);
        const response = await axios.get<ProcedureTimeline>(`${apiURL}/timeline/${procedureId}`);
        const sortedSteps = [...(response.data?.steps ?? [])].sort((a, b) => a.order - b.order);
        setTimeline({ ...response.data, steps: sortedSteps });
      } catch (err) {
        setError('Impossible de charger la timeline depuis la base.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTimeline();
  }, [apiURL, procedureId]);

  const steps = useMemo(() => timeline?.steps ?? [], [timeline]);
  const completedCount = useMemo(
    () => steps.filter(step => step.status === 'TERMINEE').length,
    [steps]
  );
  const activeStep = useMemo(
    () => steps.find(step => step.status === 'EN_COURS'),
    [steps]
  );

  const formatDurationToDHM = (duration: string | null) => {
    if (!duration) return 'En cours';

    const regex = /P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?/;
    const matches = duration.match(regex);

    if (!matches) return duration;

    const days = matches[1] ? parseInt(matches[1], 10) : 0;
    const hours = matches[2] ? parseInt(matches[2], 10) : 0;
    const minutes = matches[3] ? parseInt(matches[3], 10) : 0;

    const parts = [];
    if (days > 0) parts.push(`${days} jrs`);
    if (hours > 0) parts.push(`${hours} hrs`);
    if (minutes > 0) parts.push(`${minutes} min`);

    return parts.length > 0 ? parts.join(' ') : '0 min';
  };

  const formatHoursToDHM = (duration: string | null) => {
    if (!duration) return 'En cours';

    if (duration.includes('h') || duration.includes('m')) {
      const hoursMatch = duration.match(/(\d+)h/);
      const minutesMatch = duration.match(/(\d+)m/);

      const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
      const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;

      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;

      const parts = [];
      if (days > 0) parts.push(`${days} jrs`);
      if (remainingHours > 0) parts.push(`${remainingHours} hrs`);
      if (minutes > 0 || (hours === 0 && minutes === 0)) parts.push(`${minutes} min`);

      return parts.join(' ');
    }

    return duration;
  };

  const formatPlannedDuration = (duration: number | null) => {
    if (!duration) return 'N/A';
    return `${duration} jrs`;
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return 'En cours';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return 'En cours';

    return parsed.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: StepStatus) => {
    switch (status) {
      case 'TERMINEE':
        return <FiCheckCircle className={styles.completedIcon} />;
      case 'EN_COURS':
        return <FiClock className={styles.inProgressIcon} />;
      default:
        return <FiAlertTriangle className={styles.pendingIcon} />;
    }
  };

  const statusLabel = (status: StepStatus) => STATUS_LABEL[status] ?? status ?? 'Statut inconnu';

  if (loading) {
    return <div className={styles.loading}>Chargement de la timeline...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  if (!timeline) {
    return <div className={styles.error}>Aucune donnée de timeline disponible.</div>;
  }

  return (
    <div className={styles.appContainer}>
      <Navbar />
      <div className={styles.appContent}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles.mainContent}>
          <div className={styles.breadcrumb}>
            <span>GUNAM</span>
            <FiChevronRight className={styles.breadcrumbArrow} />
            <span>Timeline</span>
          </div>

          <div className={styles.container}>
            <div className={styles.header}>
              <h1>Timeline de la procédure</h1>
              <div className={styles.procedureSummary}>
                <h2>
                  {timeline.procedure.number} - {timeline.procedure.type}
                </h2>
                <div className={styles.dates}>
                  <span>
                    <FiCalendar /> Début: {formatDate(timeline.procedure.startDate)}
                  </span>
                  <span>
                    <FiCalendar /> Fin: {formatDate(timeline.procedure.endDate)}
                  </span>
                  {timeline.procedure.totalDuration && (
                    <span>
                      <FiClock /> Durée: {formatDurationToDHM(timeline.procedure.totalDuration)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.progressSummary}>
              <div className={styles.summaryCard}>
                <div>
                  <div className={styles.summaryLabel}>Étapes terminées</div>
                  <div className={styles.summaryValue}>
                    {completedCount} / {steps.length}
                  </div>
                </div>
                <FiCheckCircle className={styles.summaryIcon} />
              </div>
              <div className={styles.summaryCard}>
                <div>
                  <div className={styles.summaryLabel}>Étape en cours</div>
                  <div className={styles.summaryValue}>
                    {activeStep ? `#${activeStep.order} ${activeStep.name}` : 'Aucune'}
                  </div>
                </div>
                <FiClock className={styles.summaryIcon} />
              </div>
              <div className={styles.summaryCard}>
                <div>
                  <div className={styles.summaryLabel}>Statut procédure</div>
                  <div className={styles.summaryValue}>{timeline.procedure.status}</div>
                </div>
                <FiAlertTriangle className={styles.summaryIcon} />
              </div>
            </div>

            <div className={styles.timeline}>
              {steps.map((step, index) => {
                const isDone = step.status === 'TERMINEE';
                const isActive = step.status === 'EN_COURS';

                return (
                  <div key={step.id} className={styles.timelineItem}>
                    <div className={styles.markerColumn}>
                      <div
                        className={`${styles.timelineMarker} ${
                          isDone ? styles.markerDone : ''
                        } ${isActive ? styles.markerActive : ''}`}
                      >
                        {getStatusIcon(step.status)}
                      </div>
                      {index < steps.length - 1 && (
                        <div
                          className={`${styles.timelineConnector} ${
                            isDone || isActive ? styles.connectorActive : ''
                          }`}
                        />
                      )}
                    </div>

                    <div className={styles.timelineContent}>
                      <div className={styles.timelineHeaderRow}>
                        <div>
                          <h3>{step.name}</h3>
                          <div className={styles.stepMeta}>
                            Étape {step.order} · Durée prévue {formatPlannedDuration(step.plannedDuration)}
                          </div>
                        </div>
                        <span className={`${styles.statusBadge} ${statusToClass(step.status)}`}>
                          {statusLabel(step.status)}
                        </span>
                      </div>

                      <div className={styles.stepDetails}>
                        <div className={styles.timeRange}>
                          <span>Début: {formatDate(step.startDate)}</span>
                          <span>Fin: {formatDate(step.endDate)}</span>
                        </div>
                        <div className={styles.durationInfo}>
                          <span>Durée réelle: {formatHoursToDHM(step.actualDuration)}</span>
                          <span>
                            Retard: {step.delay ? formatHoursToDHM(step.delay) : 'Aucun'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={styles.demandsSection}>
              <h2>Demandes associées</h2>
              <div className={styles.demandsGrid}>
                {timeline.demands.map(demand => (
                  <div key={demand.id} className={styles.demandCard}>
                    <h3>{demand.code}</h3>
                    <p>Type: {demand.type}</p>
                    <p>Permis: {demand.permitType ?? '—'}</p>
                    <p>
                      Statut:{' '}
                      <span className={`${styles.statusBadge} ${statusToClass(demand.status)}`}>
                        {statusLabel(demand.status)}
                      </span>
                    </p>
                    <p>Soumis le: {formatDate(demand.submissionDate)}</p>
                    <p>Temps de traitement: {formatDurationToDHM(demand.processingTime)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default TimelinePage;
