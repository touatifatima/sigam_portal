// components/ConfigurationPanel.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import styles from './ConfigurationPanel.module.css';
import TitresMiniers from './TitresMiniers';
import TaxeSuperficiaireDroit from './TaxeSuperficiaireDroit';
import Substances from './Substances';
import StatutsJuridiques from './StatutsJuridiques';
import AdminLocations from './AdminLocations';
import PhasesEtapes from './PhasesEtapes';
import TypePermisProcedures from './TypePermisProcedures';
import NavbarConfigSection from './NavbarConfigSection';
import Navbar from '../navbar/Navbar';
import Sidebar from '../sidebar/Sidebar';
import { useViewNavigator } from '@/src/hooks/useViewNavigator';

interface Tab {
  id: string;
  label: string;
}

const tabs: Tab[] = [
  { id: 'titres-miniers', label: 'Titres miniers' },
  { id: 'substances', label: 'Substances / redevances' },
  { id: 'taxe-superficiaire', label: 'Taxe superficiaire / produit' },
  { id: 'zones-exclusion', label: "Zones d'exclusion" },
  { id: 'loc-adm', label: 'Locations' },
  { id: 'statuts-juridiques', label: 'Statuts juridiques' },
  { id: 'phases-etapes', label: 'Phases / etapes' },
  { id: 'permis-procedures', label: 'Procedures par permis' },
  { id: 'navbar-config', label: 'Configuration Navbar' },
];

type ConfigurationPanelProps = {
  forcedTab?: string;
};

const isKnownTab = (value?: string): boolean =>
  tabs.some((tab) => tab.id === String(value || '').trim());

const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({ forcedTab }) => {
  const router = useRouter();
  const initialTab = useMemo(() => {
    if (isKnownTab(forcedTab)) return String(forcedTab);
    return tabs[0].id;
  }, [forcedTab]);
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const { currentView, navigateTo } = useViewNavigator('Configurations');

  useEffect(() => {
    if (!isKnownTab(forcedTab)) return;
    setActiveTab(String(forcedTab));
  }, [forcedTab]);

  useEffect(() => {
    if (isKnownTab(forcedTab)) return;
    if (!router.isReady) return;

    const queryTab = Array.isArray(router.query.tab)
      ? router.query.tab[0]
      : router.query.tab;

    if (isKnownTab(queryTab)) {
      setActiveTab(String(queryTab));
    }
  }, [forcedTab, router.isReady, router.query.tab]);

const handleTabChange = (tabId: string) => {
    if (tabId === activeTab) return;
    setActiveTab(tabId);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'titres-miniers':
        return (
          <div className={styles.contentPlaceholder}>
            <TitresMiniers />
          </div>
        );
      case 'substances':
        return (
          <div className={styles.contentPlaceholder}>
            <Substances />
          </div>
        );
      case 'taxe-superficiaire':
        return (
          <div className={styles.contentPlaceholder}>
            <TaxeSuperficiaireDroit />
          </div>
        );
      case 'zones-exclusion':
        return <div className={styles.contentPlaceholder}></div>;
      case 'loc-adm':
        return (
          <div className={styles.contentPlaceholder}>
            <AdminLocations />
          </div>
        );
      case 'statuts-juridiques':
        return (
          <div className={styles.contentPlaceholder}>
            <StatutsJuridiques />
          </div>
        );
      case 'phases-etapes':
        return (
          <div className={styles.contentPlaceholder}>
            <PhasesEtapes />
          </div>
        );
      case 'permis-procedures':
        return (
          <div className={styles.contentPlaceholder}>
            <TypePermisProcedures />
          </div>
        );
      case 'navbar-config':
        return (
          <div className={styles.contentPlaceholder}>
            <NavbarConfigSection />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles['app-container']}>
      <Navbar />
      <div className={styles['app-content']}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles['main-content']}>
          <div className={styles.panelContainer}>
            <header className={styles.titleBar}>Configuration</header>
            <nav className={styles.tabBar}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`${styles.tabButton} ${activeTab === tab.id ? styles.activeTab : ''}`}
                  onClick={() => handleTabChange(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
            <main className={styles.contentArea}>{renderContent()}</main>
            <footer className={styles.footer}>
              <button className={styles.closeButton}>Fermer</button>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ConfigurationPanel;
