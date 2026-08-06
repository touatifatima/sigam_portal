import styles from "./BrandLoader.module.css";

type BrandLoaderProps = {
  label?: string;
  fullScreen?: boolean;
  compact?: boolean;
};

const loadingLogo = "/loading-gold.png?v=1";

export function BrandLoader({ fullScreen = false, compact = false }: BrandLoaderProps) {
  return (
    <div className={fullScreen ? styles.fullScreen : styles.wrap} role="status" aria-live="polite">
      <div className={`${styles.card} ${compact ? styles.compact : ""}`}>
        <div className={styles.logoStage}>
          <span className={styles.logoGlow} aria-hidden="true" />
          <img className={styles.logo} src={loadingLogo} alt="" draggable={false} />
          <span
            className={styles.logoShine}
            style={{ ["--logo-mask" as string]: `url("${loadingLogo}")` }}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}

export default BrandLoader;
