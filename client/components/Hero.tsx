import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import heroSlide1Jpg from "@/src/assets/hero-slide-1.jpg";
import heroSlide2Jpg from "@/src/assets/hero-slide-2.jpg";
import heroSlide3Jpg from "@/src/assets/hero-slide-3.jpg";
import heroSlide4Jpg from "@/src/assets/hero-slide-4.jpg";
import heroSlide5Jpg from "@/src/assets/hero-slide-5.jpg";
import heroSlide6Jpg from "@/src/assets/hero-slide-6.jpg";
import heroFinJpg from "@/src/assets/hero-fin.jpg";
import heroSlide1Webp from "@/src/assets/hero-slide-1.webp";
import heroSlide2Webp from "@/src/assets/hero-slide-2.webp";
import heroSlide3Webp from "@/src/assets/hero-slide-3.webp";
import heroSlide4Webp from "@/src/assets/hero-slide-4.webp";
import heroSlide5Webp from "@/src/assets/hero-slide-5.webp";

import styles from "./Hero.module.css";

type Slide = {
  image: string;
  imageWebp?: string;
  title: string;
  highlight: string;
  subtitle: string;
  cta: string;
  ctaLink: string;
};

const slides: Slide[] = [
  {
    image: heroSlide1Jpg,
    imageWebp: heroSlide1Webp,
    title: "Bienvenue sur le Portail des",
    highlight: "Activites Minieres",
    subtitle:
      "Plateforme nationale de gestion des permis et licences minieres de l'Algerie. Simplifiez vos demarches en toute transparence.",
    cta: "Deposer une demande",
    ctaLink: "/Signup/page",
  },
  {
    image: heroSlide2Jpg,
    imageWebp: heroSlide2Webp,
    title: "Explorez les richesses",
    highlight: "geologiques de l'Algerie",
    subtitle:
      "Des montagnes du Hoggar aux plaines du Tell, decouvrez un patrimoine minier exceptionnel a travers notre carte interactive.",
    cta: "Explorer la carte",
    ctaLink: "/carte/carte_public",
  },
  {
    image: heroSlide3Jpg,
    imageWebp: heroSlide3Webp,
    title: "Technologie au service de",
    highlight: "l'investissement minier",
    subtitle:
      "POM: une plateforme moderne de suivi en temps reel, d'analyse geologique et de gestion numerique de vos permis.",
    cta: "Decouvrir POM",
    ctaLink: "/auth/login",
  },
  {
    image: heroSlide4Jpg,
    imageWebp: heroSlide4Webp,
    title: "Des ressources minerales",
    highlight: "d'une richesse inestimable",
    subtitle:
      "Or, fer, phosphate, zinc et bien plus. L'Algerie dispose d'un potentiel minier considerable qui n'attend que votre investissement.",
    cta: "Voir les opportunites",
    ctaLink: "/Signup/page",
  },
  {
    image: heroSlide5Jpg,
    imageWebp: heroSlide5Webp,
    title: "Exportez vers le monde avec",
    highlight: "confiance et efficacite",
    subtitle:
      "Des infrastructures portuaires modernes et des procedures simplifiees pour accompagner vos projets miniers a l'international.",
    cta: "Commencer maintenant",
    ctaLink: "/Signup/page",
  },
  {
    image: heroSlide6Jpg,
    title: "Pilotez vos operations minieres avec",
    highlight: "visibilite et securite",
    subtitle:
      "Suivez les activites sur site, structurez vos demarches administratives et avancez avec une vision claire de vos projets miniers.",
    cta: "Suivre mes demarches",
    ctaLink: "/auth/login",
  },
  {
    image: heroFinJpg,
    title: "Ouvrez la voie a vos projets",
    highlight: "souterrains strategiques",
    subtitle:
      "De l'exploration aux travaux en profondeur, accedez a un portail unique pour encadrer vos permis et vos investissements.",
    cta: "Voir les opportunites",
    ctaLink: "/Signup/page",
  },
];

export const Hero = () => {
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loadedSlides, setLoadedSlides] = useState<Set<number>>(new Set([0, 1]));

  const goTo = useCallback(
    (index: number) => {
      if (isTransitioning) return;
      setIsTransitioning(true);
      setCurrent(index);
      setTimeout(() => setIsTransitioning(false), 800);
    },
    [isTransitioning],
  );

  const next = useCallback(() => goTo((current + 1) % slides.length), [current, goTo]);
  const prev = useCallback(
    () => goTo((current - 1 + slides.length) % slides.length),
    [current, goTo],
  );

  useEffect(() => {
    const preload = document.createElement("link");
    preload.rel = "preload";
    preload.as = "image";
    preload.href = slides[0].imageWebp ?? slides[0].image;
    if (slides[0].imageWebp) {
      preload.type = "image/webp";
    }
    (preload as HTMLLinkElement & { fetchPriority?: string }).fetchPriority = "high";
    document.head.appendChild(preload);

    return () => {
      if (preload.parentNode) {
        preload.parentNode.removeChild(preload);
      }
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(next, 7000);
    return () => clearInterval(timer);
  }, [next]);

  useEffect(() => {
    const nextIndex = (current + 1) % slides.length;
    setLoadedSlides((previous) => {
      const updated = new Set(previous);
      updated.add(current);
      updated.add(nextIndex);
      return updated;
    });

    const preload = new Image();
    preload.src = slides[nextIndex].imageWebp ?? slides[nextIndex].image;
  }, [current]);

  return (
    <section className={styles.hero}>
      {slides.map((slide, i) => (
        <picture
          key={i}
          className={`${styles.slideBg} ${i === current ? styles.slideBgActive : ""}`}
        >
          {loadedSlides.has(i) ? (
            <>
              {slide.imageWebp ? (
                <source type="image/webp" srcSet={slide.imageWebp} />
              ) : null}
              <img
                src={slide.image}
                alt=""
                className={styles.slideBgImage}
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "auto"}
                decoding="async"
                aria-hidden="true"
              />
            </>
          ) : null}
        </picture>
      ))}

      <div className={styles.overlay} />

      <div className={`container ${styles.content}`}>
        <div className={styles.contentInner}>
          <div className={styles.badge}>
            <span className={styles.badgeDot} />
            <span className={styles.badgeText}>Portail National ANAM</span>
          </div>

          <div className={styles.textWrapper}>
            {slides.map((slide, i) => (
              <div
                key={i}
                className={`${styles.slideText} ${i === current ? styles.slideTextActive : ""}`}
              >
                <h1 className={styles.heading}>
                  {slide.title}{" "}
                  <span className={styles.headingHighlight}>{slide.highlight}</span>
                </h1>
                <p className={styles.subtitle}>{slide.subtitle}</p>
                <div className={styles.ctas}>
                  <Button size="lg" className="homePremiumSignupButton homePremiumButtonLg" asChild>
                    <a href={slide.ctaLink}>
                      {slide.cta}
                      <ArrowRight className="h-5 w-5" />
                    </a>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="homePremiumGhostButton homePremiumButtonLg"
                    asChild
                  >
                    <a href="/auth/login">Se connecter</a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        className={`${styles.navArrow} ${styles.navArrowLeft}`}
        onClick={prev}
        aria-label="Precedent"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        className={`${styles.navArrow} ${styles.navArrowRight}`}
        onClick={next}
        aria-label="Suivant"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      <div className={styles.dots}>
        {slides.map((_, i) => (
          <button
            key={i}
            className={`${styles.dot} ${i === current ? styles.dotActive : ""}`}
            onClick={() => goTo(i)}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>

      <div className={styles.progressBar}>
        <div className={styles.progressFill} key={current} />
      </div>

      <div className={styles.scrollIndicator}>
        <a href="/auth/login" className={styles.scrollLink}>
          <span className={styles.scrollText}>Defiler</span>
          <ChevronDown className="h-5 w-5" />
        </a>
      </div>

      <div className={styles.sideStats}>
        {[
          { value: "2380+", label: "Licences" },
          { value: "89Mrd", label: "Investissements" },
          { value: "69", label: "Wilayas" },
        ].map((stat) => (
          <div key={stat.label} className={styles.sideStatItem}>
            <div className={styles.sideStatValue}>{stat.value}</div>
            <div className={styles.sideStatLabel}>{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
};
