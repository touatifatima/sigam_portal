import { useEffect, useState, useRef } from "react";
import { FileCheck, Factory, TrendingUp, Search, Gem } from "lucide-react";

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
      className={`relative group transition-all duration-500 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="flex flex-col items-center text-center p-8 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/30 hover:bg-card transition-all duration-300 hover:shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
          <div className="text-primary">{icon}</div>
        </div>
        <div className="text-4xl md:text-5xl font-bold text-foreground mb-2">
          {count.toLocaleString()}
          <span className="text-primary">{suffix}</span>
        </div>
        <div className="text-muted-foreground font-medium">{label}</div>
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
    <section id="stats" className="py-24 bg-gradient-to-b from-background to-muted/30 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
          backgroundSize: "40px 40px"
        }} />
      </div>

      <div className="container relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="text-primary font-semibold text-sm uppercase tracking-widest mb-4 block">
            Le secteur minier en chiffres
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Des solutions innovantes pour{" "}
            <span className="text-primary">votre investissement</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Nous contribuons à accélérer vos procédures d'obtention de licences minières 
            grâce à des solutions numériques fluides et fiables.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {stats.map((stat, index) => (
            <StatItem key={stat.label} {...stat} />
          ))}
        </div>
      </div>
    </section>
  );
};