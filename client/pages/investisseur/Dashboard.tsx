import { useAuthStore } from '@/src/store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

export default function Dashboard() {
  const { auth, logout, isLoaded } = useAuthStore();
  const navigate = useNavigate();
  const hasRole = (roleName: string) =>
    (auth.role ?? '').toLowerCase() === roleName.toLowerCase();

  if (!isLoaded) {
    return (
      <div className="dashboard-page flex items-center justify-center min-h-screen">
        Chargement...
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="dashboard-page">

      {/* Header */}
      <header className="dashboard-header">
        <div className="header-container">
          <h1 className="logo">SIGAM Portail</h1>

          <div className="user-info">
            <span className="user-name">
              {auth.username ?? auth.email ?? 'Utilisateur'}
            </span>
            <button className="btn-outline" onClick={handleLogout}>
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="main-container">

        {/* Welcome */}
        <div className="welcome-box">
          <h2 className="welcome-title">
            Bienvenue, {auth.username ?? auth.email ?? 'Utilisateur'}
          </h2>
          <p className="welcome-role">
            Rôle(s) :
            <span className="role-value">{auth.role ?? 'Non défini'}</span>
          </p>
        </div>

        {/* Cards */}
        <div className="cards-grid">

          {/* Investor / Operator */}
          {(hasRole('investisseur') || hasRole('operateur')) && (
            <>
              <DashboardCard
                title="Mes Entreprises"
                desc="Gérer vos entreprises et actionnaires"
                onClick={() => {}}
              />

              <DashboardCard
                title="Mes Demandes"
                desc="Soumettre et suivre vos demandes"
                onClick={() => navigate('/investisseur/DemandesList')}
              />

              <DashboardCard
                title="Mes Permis"
                desc="Consulter vos permis délivrés"
                onClick={() => {}}
              />

              <DashboardCard
                title="Procédures"
                desc="Suivre vos procédures en cours"
                onClick={() => {}}
              />

              <DashboardCard
                title="Paiements"
                desc="Gérer vos factures et paiements"
                onClick={() => {}}
              />

              <DashboardCard
                title="Documents"
                desc="Consulter vos documents déposés"
                onClick={() => {}}
              />
            </>
          )}

          {/* Admin */}
          {hasRole('admin') && (
            <>
              <DashboardCard title="Gestion Utilisateurs" desc="Gérer les utilisateurs et rôles" />
              <DashboardCard title="Gestion Demandes" desc="Valider et gérer les demandes" />
              <DashboardCard title="Gestion Permis" desc="Administrer les permis miniers" />
              <DashboardCard title="Tableau de bord" desc="Statistiques et analyses" />
              <DashboardCard title="Notifications" desc="Gérer les notifications système" />
              <DashboardCard title="Logs & Audit" desc="Consulter l'historique des actions" />
            </>
          )}
        </div>
      </main>
    </div>
  );
}


type DashboardCardProps = {
  title: string;
  desc: string;
  onClick?: () => void;
};

function DashboardCard({ title, desc, onClick }: DashboardCardProps) {
  return (
    <div className="dash-card">
      <div className="card-header">
        <h3>{title}</h3>
        <p>{desc}</p>
      </div>

      <div className="card-content">
        <button className="btn-primary" onClick={onClick ?? (() => {})}>
          Accéder
        </button>
      </div>
    </div>
  );
}