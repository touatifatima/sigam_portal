import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Statistics } from "@/components/Statistics";
import { Services } from "@/components/Services";
import { HowItWorks } from "@/components/HowItWorks";
import { News } from "@/components/News";
import { Partners } from "@/components/Partners";
import { CallToAction } from "@/components/CallToAction";
import { Footer } from "@/components/Footer";
import styles from "./Home.module.css";
const Index = () => {
  return (
    <div className={`${styles.homePage} min-h-screen`}>
      <Header />
      <Hero />
      <Statistics />
      <Services />
      <HowItWorks />
      <News />
      <Partners />
      <CallToAction />
      <Footer />
    </div>
  );
};

export default Index;
