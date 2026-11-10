import { ArrowUpRight, Eye, Link2, Mic, RotateCcw, Sparkles, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const POINTS: { key: "readOnly" | "voice" | "sources"; icon: LucideIcon }[] = [
  { key: "readOnly", icon: Eye },
  { key: "voice", icon: Mic },
  { key: "sources", icon: Link2 },
];

/** Timeline of the scripted conversation, in milliseconds. */
const MS_PER_QUESTION_CHAR = 32;
const THINKING_MS = 1600;
const MS_PER_ANSWER_CHAR = 14;
const TICK_MS = 40;

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Plays the conversation once it scrolls into view. It starts at the end, as
 * the prerendered page shows it (ADR-050): crawlers, reduced motion and
 * browsers without IntersectionObserver read the whole conversation. With
 * motion it rewinds just before coming into view, then plays.
 */
function usePlayback(total: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(total);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;
    // Below the fold until the visitor scrolls: rewinding half a screen early is never seen.
    const rewind = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setElapsed(0);
          rewind.disconnect();
        }
      },
      { rootMargin: "0px 0px 50% 0px" },
    );
    const play = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setPlaying(true);
          play.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    rewind.observe(element);
    play.observe(element);
    return () => {
      rewind.disconnect();
      play.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const started = performance.now();
    const timer = window.setInterval(() => {
      const now = Math.min(performance.now() - started, total);
      setElapsed(now);
      if (now >= total) {
        setPlaying(false);
        window.clearInterval(timer);
      }
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [playing, total]);

  const replay = () => {
    setElapsed(0);
    setPlaying(true);
  };

  return { ref, elapsed, done: elapsed >= total, replay };
}

export function AssistantShowcase() {
  const { t } = useTranslation("landing");
  const question = t("assistantShowcase.question");
  const answer = t("assistantShowcase.answer");
  const sources = t("assistantShowcase.sources", { returnObjects: true });

  const questionEnd = question.length * MS_PER_QUESTION_CHAR;
  const thinkingEnd = questionEnd + THINKING_MS;
  const total = thinkingEnd + answer.length * MS_PER_ANSWER_CHAR;
  const { ref, elapsed, done, replay } = usePlayback(total);

  const questionShown = question.slice(0, Math.floor(elapsed / MS_PER_QUESTION_CHAR));
  const thinking = elapsed >= questionEnd && elapsed < thinkingEnd;
  const answerShown = answer.slice(0, Math.max(Math.floor((elapsed - thinkingEnd) / MS_PER_ANSWER_CHAR), 0));

  return (
    <section
      id="asistente"
      aria-labelledby="asistente-title"
      className="scroll-mt-16 border-t border-border bg-secondary/50"
    >
      <div className="mx-auto grid max-w-landing gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:gap-16">
        <div data-reveal>
          <p className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Sparkles aria-hidden="true" className="size-4" />
            {t("assistantShowcase.eyebrow")}
          </p>
          <h2
            id="asistente-title"
            className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-balance sm:text-5xl 2xl:text-landing-title"
          >
            {t("assistantShowcase.title")}
          </h2>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">{t("assistantShowcase.description")}</p>
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ key, icon: Icon }) => (
              <li key={key} className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <span className="pt-1">{t(`assistantShowcase.points.${key}`)}</span>
              </li>
            ))}
          </ul>
        </div>

        <figure data-reveal className="relative">
          {/* The animation is for the eyes; screen readers get the whole exchange at once. */}
          <figcaption className="sr-only">
            {t("assistantShowcase.panelLabel")}: «{question}» {answer}
          </figcaption>
          <div
            ref={ref}
            aria-hidden="true"
            className="rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-[0_24px_48px_-28px_rgb(21_22_58/0.35)] sm:p-6"
          >
            <div className="flex items-center gap-2 border-b border-border pb-3 text-sm font-medium">
              <Sparkles className="size-4 text-primary" />
              {t("assistantShowcase.eyebrow")}
              <kbd className="ml-auto rounded border border-border px-1.5 py-0.5 font-sans text-xs text-muted-foreground">
                Ctrl K
              </kbd>
            </div>

            {/* Fixed height: the panel doesn't grow while the answer is typed. */}
            <div className="flex min-h-[19rem] flex-col gap-4 pt-4 sm:min-h-[13rem]">
              <p
                className={cn(
                  "max-w-[85%] self-end rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground",
                  questionShown.length === 0 && "invisible",
                )}
              >
                {questionShown || question}
              </p>

              {thinking && (
                <p className="w-fit animate-shimmer bg-[linear-gradient(90deg,var(--muted-foreground)_40%,var(--foreground)_50%,var(--muted-foreground)_60%)] bg-[length:200%_100%] bg-clip-text text-sm text-transparent">
                  {t("assistantShowcase.thinking")}
                </p>
              )}

              {answerShown.length > 0 && (
                <div className="max-w-[92%] text-sm leading-6">
                  <p>{answerShown}</p>
                  <ul
                    className={cn(
                      "mt-3 flex flex-wrap gap-1.5 transition-opacity duration-500",
                      done ? "opacity-100" : "opacity-0",
                    )}
                  >
                    {sources.map((source) => (
                      <li
                        key={source}
                        className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground"
                      >
                        {source}
                        <ArrowUpRight className="size-3" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-4 flex h-10 items-center gap-2 rounded-lg border border-input px-3 text-sm text-muted-foreground">
              <span className="flex-1">{t("assistantShowcase.placeholder")}</span>
              <Mic className="size-4" />
            </div>
          </div>

          {/* Always rendered, so the focus stays on it while the example replays. */}
          <button
            type="button"
            aria-disabled={!done}
            onClick={() => done && replay()}
            className={cn(
              "mt-4 inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground transition-opacity focus-visible:outline-2 focus-visible:outline-ring",
              done ? "hover:text-foreground" : "cursor-default opacity-40",
            )}
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            {t("assistantShowcase.replay")}
          </button>
        </figure>
      </div>
    </section>
  );
}
