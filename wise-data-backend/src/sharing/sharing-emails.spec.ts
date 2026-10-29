import { escapeHtml, invitationEmail } from './sharing-emails';

describe('invitationEmail', () => {
  it('never turns a table name or an inviter into HTML', () => {
    const email = invitationEmail({
      inviter: 'ana@example.com',
      target: {
        type: 'table',
        name: '<img src=x onerror=alert(1)> & "más"',
        role: 'VIEWER',
      },
      url: 'https://wise-data.es/invitations?token=abc',
      days: 7,
    });

    expect(email.html).not.toContain('<img');
    expect(email.html).toContain(
      '&lt;img src=x onerror=alert(1)&gt; &amp; &quot;más&quot;',
    );
    expect(email.text).toContain('ver la tabla');
  });

  it('escapes every HTML special character', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });

  it('names the organization and the role for organization invitations', () => {
    const email = invitationEmail({
      inviter: 'ana@example.com',
      target: {
        type: 'organization',
        name: 'Ferretería <López>',
        role: 'ADMIN',
      },
      url: 'https://wise-data.es/invitations?token=abc',
      days: 7,
    });

    expect(email.text).toContain(
      'unirte a «Ferretería <López>» en WiseData como administrador',
    );
    expect(email.html).toContain('Ferretería &lt;López&gt;');
    expect(email.subject).toContain('organización');
  });
});
