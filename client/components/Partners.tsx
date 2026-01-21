import styles from "./Partners.module.css";

const partners = [
  { name: "Ministere de l'Energie et des Mines", short: "Mdl" },
  { name: "ANAM", short: "A" },
  { name: "ORGM", short: "O" },
  { name: "ENOF", short: "E" },
  { name: "Sonatrach", short: "S" },
];

export const Partners = () => {
  return (
    <section className={styles.section}>
      <div className="container">
        <div className={styles.header}>
          <span className={styles.label}>
            Organismes gouvernementaux de soutien
          </span>
          <h2 className={styles.title}>Partenaires du secteur minier</h2>
        </div>

        <div className={styles.grid}>
          {partners.map((partner) => (
            <div key={partner.name} className={styles.partnerItem}>
              <div className={styles.partnerContent}>
                <div className={styles.partnerLogo}>
                  <span className={styles.partnerInitials}>{partner.short}</span>
                </div>
                <span className={styles.partnerName}>{partner.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
