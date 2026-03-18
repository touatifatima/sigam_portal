'use client';

import Link from 'next/link';
import { FiClock, FiHome } from 'react-icons/fi';
import styles from './account-pending.module.css';

export default function AccountPendingPage() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <FiClock />
        </div>

        <h1 className={styles.title}>Compte en attente de validation</h1>

        <p className={styles.message}>
          Desole, votre compte est en attente de validation. L&apos;administration ANAM
          doit encore verifier et confirmer l&apos;identification de votre entreprise.
          Si cela fait plus d&apos;une semaine, contactez-nous a <strong>pom@anam.dz</strong>.
          Merci de votre patience.
        </p>

      

        <Link href="/" className={styles.homeBtn}>
          <FiHome />
          Retour a l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
