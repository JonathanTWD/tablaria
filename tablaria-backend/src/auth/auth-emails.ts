import type { MailMessage } from '../mail/mailer';

type AuthEmail = Omit<MailMessage, 'to'>;

function layout(paragraphs: string[], action?: { label: string; url: string }) {
  const actionHtml = action
    ? `<p><a href="${action.url}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#3024ff;color:#ffffff;text-decoration:none;font-weight:600">${action.label}</a></p>
<p style="color:#555;font-size:13px">Si el botón no funciona, copia este enlace en tu navegador:<br>${action.url}</p>`
    : '';
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;line-height:1.5;color:#111">
<h2 style="margin:0 0 16px">Tablaria</h2>
${paragraphs.map((text) => `<p>${text}</p>`).join('\n')}
${actionHtml}
</div>`;
}

export function verificationEmail(url: string): AuthEmail {
  return {
    subject: 'Confirma tu email en Tablaria',
    text: `Confirma tu email para activar tu cuenta de Tablaria:\n\n${url}\n\nEl enlace caduca en 24 horas. Si no has creado una cuenta, ignora este mensaje.`,
    html: layout(
      [
        'Confirma tu email para activar tu cuenta de Tablaria.',
        'El enlace caduca en 24 horas. Si no has creado una cuenta, ignora este mensaje.',
      ],
      { label: 'Confirmar email', url },
    ),
  };
}

export function passwordResetEmail(url: string): AuthEmail {
  return {
    subject: 'Restablece tu contraseña de Tablaria',
    text: `Hemos recibido una solicitud para restablecer tu contraseña:\n\n${url}\n\nEl enlace caduca en 1 hora. Si no lo has solicitado, ignora este mensaje: tu contraseña no cambiará.`,
    html: layout(
      [
        'Hemos recibido una solicitud para restablecer tu contraseña.',
        'El enlace caduca en 1 hora. Si no lo has solicitado, ignora este mensaje: tu contraseña no cambiará.',
      ],
      { label: 'Restablecer contraseña', url },
    ),
  };
}

export function accountExistsEmail(loginUrl: string): AuthEmail {
  return {
    subject: 'Ya tienes una cuenta en Tablaria',
    text: `Alguien ha intentado registrarse con este email, pero ya tienes una cuenta. Inicia sesión aquí:\n\n${loginUrl}\n\nSi has olvidado tu contraseña, puedes restablecerla desde la pantalla de inicio de sesión. Si no has sido tú, ignora este mensaje.`,
    html: layout(
      [
        'Alguien ha intentado registrarse con este email, pero ya tienes una cuenta.',
        'Si has olvidado tu contraseña, puedes restablecerla desde la pantalla de inicio de sesión. Si no has sido tú, ignora este mensaje.',
      ],
      { label: 'Iniciar sesión', url: loginUrl },
    ),
  };
}
