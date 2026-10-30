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

const TABLE_ROLE_TEXT = { VIEWER: 'ver', EDITOR: 'ver y editar' } as const;
const ORGANIZATION_ROLE_TEXT = {
  VIEWER: 'lector',
  EDITOR: 'editor',
  ADMIN: 'administrador',
} as const;

export interface InvitationEmail {
  inviter: string;
  target:
    | { type: 'table'; name: string; role: keyof typeof TABLE_ROLE_TEXT }
    | {
        type: 'organization';
        name: string;
        role: keyof typeof ORGANIZATION_ROLE_TEXT;
      };
  url: string;
  days: number;
}

export function invitationEmail({
  inviter,
  target,
  url,
  days,
}: InvitationEmail): Omit<MailMessage, 'to'> {
  // Both names come from other users: escaped in the HTML, plain in the text.
  const sentence = (name: string) =>
    target.type === 'table'
      ? `te invita a ${TABLE_ROLE_TEXT[target.role]} la tabla «${name}» en Tablaria.`
      : `te invita a unirte a «${name}» en Tablaria como ${ORGANIZATION_ROLE_TEXT[target.role]}.`;
  const expiry = `La invitación caduca en ${days} días. Si no esperabas este mensaje, puedes ignorarlo.`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;line-height:1.5;color:#111">
<h2 style="margin:0 0 16px">Tablaria</h2>
<p>${escapeHtml(inviter)} ${sentence(escapeHtml(target.name))}</p>
<p>${expiry}</p>
<p><a href="${url}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#3024ff;color:#ffffff;text-decoration:none;font-weight:600">Ver la invitación</a></p>
<p style="color:#555;font-size:13px">Si el botón no funciona, copia este enlace en tu navegador:<br>${url}</p>
</div>`;
  return {
    // Subjects are plain text, but the inviter still comes from another user.
    subject:
      target.type === 'table'
        ? `${inviter} te ha compartido una tabla en Tablaria`
        : `${inviter} te invita a una organización en Tablaria`,
    text: `${inviter} ${sentence(target.name)}

Abre este enlace para verla:
${url}

${expiry}`,
    html,
  };
}
