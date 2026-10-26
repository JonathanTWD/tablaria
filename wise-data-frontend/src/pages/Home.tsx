import Header from "@/components/header/Header";
import Hero from "@/components/home/Hero";
import {
  AboutSection,
  CallToAction,
  FeaturesSection,
  Footer,
} from "@/components/home/LandingSections";

const Home = () => {
  return (
    <div className="relative isolate min-h-dvh overflow-hidden bg-brand-navy text-brand-navy-foreground">
      <title>WiseData | Tu inventario en tablas hechas a tu medida</title>
      <Header />
      <main>
        <Hero />
        <FeaturesSection />
        <AboutSection />
        <CallToAction />
      </main>
      <Footer />
    </div>
  );
};

export default Home;
