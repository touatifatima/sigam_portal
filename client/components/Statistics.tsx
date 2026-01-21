import { useEffect, useState, useRef } from "react";
import { FileCheck, Factory, TrendingUp, Search, Gem } from "lucide-react";
import styles from "./Statistics.module.css";

interface StatItemProps {
  icon: React.ReactNode;
  value: number;
  suffix?: string;
  label: string;
  delay: number;
}

const StatItem = ({ icon, value, suffix = "", label, delay }: StatItemProps) => {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const timeout = setTimeout(() => {
      const duration = 2000;
      const steps = 60;
      const increment = value / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;
        if (current >= value) {
          setCount(value);
          clearInterval(timer);
        } else {
          setCount(Math.floor(current));
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }, delay);

    return () => clearTimeout(timeout);
  }, [isVisible, value, delay]);

  return (
    <div
      ref={ref}
      className={`${styles.statItem} ${
        isVisible ? styles.statItemVisible : styles.statItemHidden
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className={styles.statCard}>
        <div className={styles.iconWrapper}>
          <div className={styles.icon}>{icon}</div>
        </div>
        <div className={styles.value}>
          {count.toLocaleString()}
          <span className={styles.valueSuffix}>{suffix}</span>
        </div>
        <div className={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
};

export const Statistics = () => {
  const stats = [
    { icon: <FileCheck className="h-8 w-8" />, value: 2380, label: "Licences minières", delay: 0 },
    { icon: <Factory className="h-8 w-8" />, value: 2873, label: "Sites miniers", delay: 100 },
    { icon: <TrendingUp className="h-8 w-8" />, value: 89, suffix: " Mrd", label: "Valeur des investissements", delay: 200 },
    { icon: <Search className="h-8 w-8" />, value: 608, label: "Licences d'exploration", delay: 300 },
    { icon: <Gem className="h-8 w-8" />, value: 10, label: "Minéraux stratégiques", delay: 400 },
  ];

  return (
    <section id="stats" className={styles.section}>
      {/* Background Pattern */}
      <div className={styles.backgroundPattern}>
        <div className={styles.dotPattern} />
      </div>

      <div className={`container ${styles.container}`}>
        {/* Section Header */}
        <div className={styles.header}>
          <span className={styles.label}>
            Le secteur minier en chiffres
          </span>
          <h2 className={styles.title}>
            Des solutions innovantes pour{" "}
            <span className={styles.titleHighlight}>votre investissement</span>
          </h2>
          <p className={styles.description}>
            Nous contribuons à accélérer vos procédures d'obtention de licences minières 
            grâce à des solutions numériques fluides et fiables.
          </p>
        </div>

        {/* Stats Grid */}
        <div className={styles.grid}>
          {stats.map((stat) => (
            <StatItem key={stat.label} {...stat} />
          ))}
        </div>
      </div>
    </section>
  );
};
