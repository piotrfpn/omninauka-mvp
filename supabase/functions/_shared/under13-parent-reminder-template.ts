/** Fixed UTC deadline and generic content: identical output for every retry. */
export function under13ParentReminderTemplate(deadline: string, appBaseUrl: string) {
  const base = new URL(appBaseUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('Invalid application origin');
  }
  const date = new Date(deadline);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid deadline');
  const fixedDeadline = date.toISOString().replace('T', ' ').replace('.000Z', ' UTC').replace('Z', ' UTC');
  const cta = new URL('/app/parent', base).href;
  const subject = 'Przypomnienie: dokończ powiązanie konta w OmniNauka';
  const text = [
    'Powiązanie konta dziecka z Twoim kontem rodzica/opiekuna nie zostało jeszcze ukończone.',
    `Termin powiązania: ${fixedDeadline}. Po jego upływie konto nie będzie mogło zostać aktywowane.`,
    'Otwórz Panel Rodzica i sprawdź, czy oczekujące powiązanie nadal jest obecne.',
    'Jeśli nadal oczekuje, poproś dziecko o ponowne zalogowanie do OmniNauka na konto utworzone dla wskazanego wcześniej adresu e-mail. Powiązanie wykona chroniony proces w aplikacji.',
    'Jeśli konto jest już powiązane, nie musisz nic robić.',
    'Oczekujące upoważnienie możesz anulować w Panelu Rodzica po zalogowaniu.',
    `Panel Rodzica: ${cta}`,
  ].join('\n\n');
  const escape = (value: string) => value.replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
  const html = text.split('\n\n').slice(0, -1).map(part => `<p>${escape(part)}</p>`).join('') +
    `<p><a href="${escape(cta)}">Otwórz Panel Rodzica</a></p>`;
  return { subject, text, html };
}
