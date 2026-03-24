import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import styles from "./Home.module.css";

const Statistics = lazy(() =>
  import("@/components/Statistics").then((mod) => ({ default: mod.Statistics })),
);
const Services = lazy(() =>
  import("@/components/Services").then((mod) => ({ default: mod.Services })),
);
const HowItWorks = lazy(() =>
  import("@/components/HowItWorks").then((mod) => ({ default: mod.HowItWorks })),
);
const News = lazy(() => import("@/components/News").then((mod) => ({ default: mod.News })));
const Partners = lazy(() =>
  import("@/components/Partners").then((mod) => ({ default: mod.Partners })),
);
const CallToAction = lazy(() =>
  import("@/components/CallToAction").then((mod) => ({ default: mod.CallToAction })),
);
const Footer = lazy(() =>
  import("@/components/Footer").then((mod) => ({ default: mod.Footer })),
);

const DeferredSection = ({
  children,
  minHeight = 240,
  rootMargin = "280px",
  sectionId,
}: {
  children: ReactNode;
  minHeight?: number;
  rootMargin?: string;
  sectionId?: string;
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const markerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!markerRef.current || isVisible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(markerRef.current);
    return () => observer.disconnect();
  }, [isVisible, rootMargin]);

  return (
    <div
      id={sectionId}
      ref={markerRef}
      style={{ minHeight: isVisible ? undefined : minHeight }}
    >
      {isVisible ? children : null}
    </div>
  );
};

const Index = () => {
  return (
    <div className={`${styles.homePage} min-h-screen`}>
      <Header />
      <Hero />
      <section className={styles.mapAccessBar}>
        <div className={styles.mapAccessContent}>
          <p className={styles.mapAccessText}>
            Consulter la carte publique des permis via Experience Builder.
          </p>
          <Link href="/carte/carte_public" className={styles.mapAccessLink}>
            <span className={styles.mapAccessLinkLabel}>Acceder a la Carte Publique</span>
            <span className={styles.mapAccessLinkArrow}>
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </Link>
        </div>
      </section>
      <Suspense fallback={null}>
        <Statistics />
      </Suspense>
      <DeferredSection minHeight={620} sectionId="services">
        <Suspense fallback={null}>
          <Services />
        </Suspense>
      </DeferredSection>
      <DeferredSection minHeight={520}>
        <Suspense fallback={null}>
          <HowItWorks />
        </Suspense>
      </DeferredSection>
      <DeferredSection minHeight={680} sectionId="actualites">
        <Suspense fallback={null}>
          <News />
        </Suspense>
      </DeferredSection>
      <DeferredSection minHeight={320}>
        <Suspense fallback={null}>
          <Partners />
        </Suspense>
      </DeferredSection>
      <DeferredSection minHeight={360}>
        <Suspense fallback={null}>
          <CallToAction />
        </Suspense>
      </DeferredSection>
      <DeferredSection minHeight={420}>
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      </DeferredSection>
    </div>
  );
};

export default Index;
