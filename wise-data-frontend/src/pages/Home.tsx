import { Comparison } from "@/features/landing/sections/Comparison";
import { Faq } from "@/features/landing/sections/Faq";
import { FinalCta } from "@/features/landing/sections/FinalCta";
import { HeroSection } from "@/features/landing/sections/HeroSection";
import { HowItWorks } from "@/features/landing/sections/HowItWorks";
import { SiteFooter } from "@/features/landing/sections/SiteFooter";
import { SiteHeader } from "@/features/landing/sections/SiteHeader";
import { UseCases } from "@/features/landing/sections/UseCases";

const Home = () => {
  return (
    <div data-smooth-scroll className="min-h-dvh bg-background text-foreground">
      <title>WiseData | Tu inventario en tablas hechas a tu medida</title>
      <SiteHeader />
      <main>
        <HeroSection />
        <HowItWorks />
        <Comparison />
        <UseCases />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
};

export default Home;
