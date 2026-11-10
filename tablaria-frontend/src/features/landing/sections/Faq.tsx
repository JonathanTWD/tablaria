import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FAQ_QUESTIONS } from "@/features/landing/faq-questions";

export function Faq() {
  const { t } = useTranslation("landing");

  return (
    <section id="preguntas" aria-labelledby="preguntas-title" className="scroll-mt-16 border-t border-border">
      <div className="mx-auto grid max-w-landing gap-10 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <h2
          id="preguntas-title"
          className="text-3xl font-semibold tracking-[-0.025em] sm:text-5xl 2xl:text-landing-title"
        >
          {t("faq.title")}
        </h2>
        <div className="border-t border-foreground/15">
          {FAQ_QUESTIONS.map((question) => (
            <details key={question} className="group border-b border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-md py-5 text-lg font-medium focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                {t(`faq.items.${question}.question`)}
                <Plus
                  aria-hidden="true"
                  className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-45 motion-reduce:transition-none"
                />
              </summary>
              <p className="max-w-prose pb-6 leading-7 text-muted-foreground">
                {t(`faq.items.${question}.answer`)}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
