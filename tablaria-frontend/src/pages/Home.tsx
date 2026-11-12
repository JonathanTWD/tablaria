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
import { PageMeta } from "@/features/seo/PageMeta";
import { faqPage, softwareApplication, webSite } from "@/features/seo/structured-data";
import { useTranslation } from "react-i18next";
import { FAQ_QUESTIONS } from "@/features/landing/faq-questions";

const Home = () => {
  const { t } = useTranslation("landing");
  const description = t("meta.description");
  return (
    <div data-smooth-scroll className="min-h-dvh bg-background text-foreground">
      <PageMeta
        title={t("meta.title")}
        description={description}
        path="/"
        structuredData={[
          webSite(),
          softwareApplication(description),
          faqPage(
            FAQ_QUESTIONS.map((question) => ({
              question: t(`faq.items.${question}.question`),
              answer: t(`faq.items.${question}.answer`),
            })),
          ),
        ]}
      />
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
