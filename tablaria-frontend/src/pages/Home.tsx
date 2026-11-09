import { AssistantShowcase } from "@/features/landing/sections/AssistantShowcase";
import { Comparison } from "@/features/landing/sections/Comparison";
import { Faq } from "@/features/landing/sections/Faq";
import { FeatureGrid } from "@/features/landing/sections/FeatureGrid";
import { FinalCta } from "@/features/landing/sections/FinalCta";
import { HeroSection } from "@/features/landing/sections/HeroSection";
import { HowItWorks } from "@/features/landing/sections/HowItWorks";
import { SiteFooter } from "@/features/landing/sections/SiteFooter";
import { SiteHeader } from "@/features/landing/sections/SiteHeader";
import { UseCases } from "@/features/landing/sections/UseCases";

const Home = () => {
  return (
    <div data-smooth-scroll className="min-h-dvh bg-background text-foreground">
      <title>Tablaria | Tu inventario en tablas hechas a tu medida</title>
      <SiteHeader />
      <main>
        <HeroSection />
        <HowItWorks />
        <FeatureGrid />
        <AssistantShowcase />
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
