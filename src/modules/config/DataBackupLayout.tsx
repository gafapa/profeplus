import { NavLink, Outlet } from "react-router-dom";

export function DataBackupLayout() {
  return <div className="data-backup-layout">
    <header className="ai-settings-heading">
      <h1>Datos y copias de seguridad</h1>
      <p>Crea copias cifradas, restaura tus datos y comprueba la base de datos. Elige archivos de este dispositivo o tu cuenta de Nextcloud.</p>
    </header>
    <nav className="data-backup-navigation" aria-label="Ubicación de las copias">
      <NavLink end to="/config/database" className={({ isActive }) => `section-tab ${isActive ? "active" : ""}`}>En este dispositivo</NavLink>
      <NavLink to="/config/database/nextcloud" className={({ isActive }) => `section-tab ${isActive ? "active" : ""}`}>Nextcloud</NavLink>
    </nav>
    <Outlet />
  </div>;
}
