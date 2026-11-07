import { useQuery } from "@tanstack/react-query";
import {
  ASSISTANT_MAX_MESSAGES,
  ASSISTANT_MESSAGE_MAX_LENGTH,
  type AssistantMessage,
  type AssistantSource,
} from "@tablaria/shared";
import { Loader2, Mic, MicOff, Send, Sparkles, Volume2, VolumeX } from "lucide-react";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useMatch } from "react-router";
import { FormAlert } from "@/components/form/FormAlert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import { assistantStatusQuery, useAskAssistant } from "./queries";
import {
  canListen,
  canSpeak,
  listen,
  noticePreference,
  speak,
  speakPreference,
  type SpeechRecognizer,
  stopSpeaking,
} from "./speech";

interface Turn extends AssistantMessage {
  sources?: AssistantSource[];
}

const SUGGESTIONS = ["suggestions.lowStock", "suggestions.biggestSupplier", "suggestions.total"] as const;

/**
 * The AI assistant (ADR-042): a button in the app's header and a side panel
 * to ask about the data. Offered only when the API has a model configured.
 */
export function Assistant() {
  const { t } = useTranslation("assistant");
  const status = useQuery(assistantStatusQuery);
  const [open, setOpen] = useState(false);
  // Kept here, so closing the panel or changing page keeps the conversation.
  const [turns, setTurns] = useState<Turn[]>([]);

  if (!status.data?.enabled) {
    return null;
  }

  return (
    <>
      <Button variant="outline" className="h-9" onClick={() => setOpen(true)}>
        <Sparkles aria-hidden="true" />
        {/* Only the icon on phones, where the header is short of room. */}
        <span className="sr-only sm:not-sr-only">{t("button")}</span>
      </Button>
      {open && (
        <AssistantPanel
          turns={turns}
          setTurns={setTurns}
          remaining={status.data.remaining}
          limit={status.data.limit}
          onClose={() => {
            stopSpeaking();
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function AssistantPanel({
  turns,
  setTurns,
  remaining,
  limit,
  onClose,
}: {
  turns: Turn[];
  setTurns: (update: (turns: Turn[]) => Turn[]) => void;
  remaining: number;
  limit: number;
  onClose: () => void;
}) {
  const { t } = useTranslation(["assistant", "common"]);
  const id = useId();
  const ask = useAskAssistant();
  const tableId = useMatch("/app/tables/:tableId/*")?.params.tableId;
  const [draft, setDraft] = useState("");
  const [noticeSeen, setNoticeSeen] = useState(noticePreference.read);
  const [speakAnswers, setSpeakAnswers] = useState(speakPreference.read);
  const [listening, setListening] = useState(false);
  const recognizer = useRef<SpeechRecognizer | null>(null);
  const log = useRef<HTMLDivElement>(null);

  // Keeps the latest message in view as the conversation grows.
  useEffect(() => {
    if (log.current) {
      log.current.scrollTop = log.current.scrollHeight;
    }
  }, [turns.length, ask.isPending]);

  // Stops listening if the panel closes mid-question.
  useEffect(() => () => recognizer.current?.stop(), []);

  const send = (question: string) => {
    const text = question.trim().slice(0, ASSISTANT_MESSAGE_MAX_LENGTH);
    if (!text || ask.isPending || remaining <= 0) {
      return;
    }
    const conversation: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(() => conversation);
    setDraft("");
    ask.mutate(
      {
        messages: conversation
          .slice(-ASSISTANT_MAX_MESSAGES)
          .map(({ role, content }) => ({ role, content })),
        tableId,
      },
      {
        onSuccess: (reply) => {
          setTurns((current) => [
            ...current,
            { role: "assistant", content: reply.message, sources: reply.sources },
          ]);
          if (speakAnswers) {
            speak(reply.message);
          }
        },
      },
    );
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send(draft);
  };

  const toggleListening = () => {
    if (listening) {
      recognizer.current?.stop();
      return;
    }
    stopSpeaking();
    setListening(true);
    // Hands-free: what is heard goes out as the question.
    recognizer.current = listen(send, () => setListening(false));
  };

  const errorMessage =
    ask.error instanceof ApiError && ask.error.status === 429
      ? t("errors.limit")
      : ask.error instanceof ApiError && ask.error.status === 503
        ? t("errors.busy")
        : ask.error && apiErrorMessage(ask.error);

  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        closeLabel={t("common:close")}
        className="data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="border-b border-border p-4 pr-12">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles aria-hidden="true" className="size-4 text-primary" />
              {t("title")}
            </SheetTitle>
            <SheetDescription>{t("remaining", { count: remaining, limit })}</SheetDescription>
          </div>

          {!noticeSeen ? (
            <div className="flex flex-1 flex-col gap-4 p-4">
              <p className="text-sm">{t("notice.body")}</p>
              <p className="text-sm text-muted-foreground">{t("notice.limits")}</p>
              <Button
                className="h-9 self-start"
                onClick={() => {
                  noticePreference.save();
                  setNoticeSeen(true);
                }}
              >
                {t("notice.accept")}
              </Button>
            </div>
          ) : (
            <>
              <div
                ref={log}
                role="log"
                aria-live="polite"
                aria-label={t("conversation")}
                className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
              >
                {turns.length === 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">{t("empty")}</p>
                    {SUGGESTIONS.map((key) => (
                      <Button
                        key={key}
                        variant="outline"
                        className="h-auto justify-start py-2 text-left whitespace-normal"
                        disabled={remaining <= 0}
                        onClick={() => send(t(key))}
                      >
                        {t(key)}
                      </Button>
                    ))}
                  </div>
                )}
                {turns.map((turn, index) => (
                  <div
                    key={index}
                    className={cn(
                      "max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap",
                      turn.role === "user"
                        ? "self-end bg-primary text-primary-foreground"
                        : "self-start bg-muted",
                    )}
                  >
                    <span className="sr-only">
                      {turn.role === "user" ? t("you") : t("assistantSaid")}
                    </span>
                    {turn.content}
                    {turn.sources && turn.sources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/60 pt-2">
                        <span className="text-xs text-muted-foreground">{t("sources")}</span>
                        {turn.sources.map((source) => (
                          <Link
                            key={`${source.tableId}:${source.recordId ?? ""}`}
                            to={
                              source.recordId
                                ? `/app/tables/${source.tableId}?record=${source.recordId}`
                                : `/app/tables/${source.tableId}`
                            }
                            className="max-w-full truncate rounded-md bg-background px-1.5 py-0.5 text-xs underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                          >
                            {source.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {ask.isPending && (
                  <p className="flex items-center gap-2 self-start text-sm text-muted-foreground">
                    <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
                    {t("thinking")}
                  </p>
                )}
                {errorMessage && <FormAlert>{errorMessage}</FormAlert>}
              </div>

              <form onSubmit={submit} className="flex flex-col gap-2 border-t border-border p-3">
                <label htmlFor={id} className="sr-only">
                  {t("question")}
                </label>
                <Textarea
                  id={id}
                  value={draft}
                  rows={2}
                  maxLength={ASSISTANT_MESSAGE_MAX_LENGTH}
                  placeholder={remaining > 0 ? t("placeholder") : t("errors.limit")}
                  disabled={remaining <= 0}
                  className="min-h-0 resize-none"
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    // Enter sends; Shift+Enter makes a new line.
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      send(draft);
                    }
                  }}
                />
                <div className="flex items-center gap-2">
                  {canListen() && (
                    <Button
                      type="button"
                      variant={listening ? "destructive" : "outline"}
                      size="icon"
                      className="size-9"
                      aria-label={listening ? t("stopListening") : t("listen")}
                      aria-pressed={listening}
                      title={listening ? t("stopListening") : t("listen")}
                      disabled={remaining <= 0 || ask.isPending}
                      onClick={toggleListening}
                    >
                      {listening ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
                    </Button>
                  )}
                  {canSpeak() && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      aria-label={t("speakAnswers")}
                      aria-pressed={speakAnswers}
                      title={t("speakAnswers")}
                      onClick={() => {
                        speakPreference.save(!speakAnswers);
                        setSpeakAnswers(!speakAnswers);
                        stopSpeaking();
                      }}
                    >
                      {speakAnswers ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
                    </Button>
                  )}
                  <Button
                    type="submit"
                    className="ml-auto h-9"
                    disabled={!draft.trim() || ask.isPending || remaining <= 0}
                    aria-busy={ask.isPending}
                  >
                    <Send aria-hidden="true" />
                    {t("send")}
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
