import { Navigate } from "react-router-dom";

export default function InvestisseurPermisRedirect() {
  return <Navigate to="/operateur/permisdashboard/mes-permis" replace />;
}
