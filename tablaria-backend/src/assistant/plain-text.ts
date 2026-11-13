/**
 * Removes the Markdown marks models add even when told to answer in plain
 * text: the panel and the speech both show the reply as it comes, so
 * `**Ferrotool**` would read with its asterisks. Single `*` and `_` stay,
 * since they appear in real values (references like `REF_01`, `5 * 3`).
 */
export function toPlainText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '');
}
