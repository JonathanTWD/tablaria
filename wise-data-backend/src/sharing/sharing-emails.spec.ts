import { escapeHtml, invitationEmail } from './sharing-emails';

describe('invitationEmail', () => {
  it('never turns a table name or an inviter into HTML', () => {
    const email = invitationEmail({
      inviter: 'ana@example.com',
      tableName: '<img src=x onerror=alert(1)> & "más"',
      role: 'VIEWER',
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
});
