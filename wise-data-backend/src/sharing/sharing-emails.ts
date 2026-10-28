import type { MailMessage } from '../mail/mailer';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Table names and emails are user input: they must never become HTML. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

const ROLE_TEXT = { VIEWER: 'ver', EDITOR: 'ver y editar' } as const;

export function invitationEmail({
  inviter,
  tableName,
  role,
  url,
  days,
}: {
  inviter: string;
  tableName: string;
  role: keyof typeof ROLE_TEXT;
  url: string;
  days: number;
}): Omit<MailMessage, 'to'> {
  const summary = `${inviter} te invita a ${ROLE_TEXT[role]} la tabla «${tableName}» en WiseData.`;
  const expiry = `La invitación caduca en ${days} días. Si no esperabas este mensaje, puedes ignorarlo.`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;line-height:1.5;color:#111">
<h2 style="margin:0 0 16px">WiseData</h2>
<p>${escapeHtml(inviter)} te invita a ${ROLE_TEXT[role]} la tabla «${escapeHtml(tableName)}» en WiseData.</p>
<p>${expiry}</p>
<p><a href="${url}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#3024ff;color:#ffffff;text-decoration:none;font-weight:600">Ver la invitación</a></p>
<p style="color:#555;font-size:13px">Si el botón no funciona, copia este enlace en tu navegador:<br>${url}</p>
</div>`;
  return {
    // Subjects are plain text, but the name still comes from another user.
    subject: `${inviter} te ha compartido una tabla en WiseData`,
    text: `${summary}\n\nAbre este enlace para verla:\n${url}\n\n${expiry}`,
    html,
  };
}
