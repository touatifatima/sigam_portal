import styles from "@/pages/cadastre/CadastreDashboard.module.css";

const EXPERIENCE_BUILDER_URL =
  "https://sig.anam.dz/portal/apps/experiencebuilder/experience?id=fc56f54b45264df2a5f4e07fd2462664";

export function CadastreHeroMap() {
  return (
    <iframe
      src={EXPERIENCE_BUILDER_URL}
      title="Carte ArcGIS - Apercu cadastre national"
      className={styles.heroVisualMap}
      allowFullScreen
    />
  );
}

export default CadastreHeroMap;
