export function generateConsentEmailHtml(profileName: string, consentLink: string, appBaseUrl: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #fcfcfc;">
      <h1 style="color: #4F46E5; text-align: center; margin-bottom: 30px;">OmniNauka</h1>
      <p style="font-size: 16px; color: #333;">Dzień dobry,</p>
      <p style="font-size: 16px; color: #333; line-height: 1.5;">
        Twoje dziecko, <strong>${profileName}</strong>, utworzyło konto w aplikacji edukacyjnej <strong>OmniNauka</strong>.
      </p>
      <p style="font-size: 16px; color: #333; line-height: 1.5;">
        OmniNauka to bezpieczna platforma wspomagająca naukę z wykorzystaniem sztucznej inteligencji (AI). Aplikacja oferuje:
      </p>
      <ul style="font-size: 15px; color: #444; line-height: 1.6;">
        <li><strong>AI Tutor</strong>: interaktywne rozmowy o materiale szkolnym, pomagające zrozumieć trudne zagadnienia,</li>
        <li><strong>Analiza materiałów</strong>: pomoc w porządkowaniu notatek i dokumentów (PDF/DOCX/zdjęcia),</li>
        <li><strong>Personalizacja</strong>: dostosowanie tempa i stylu nauki do indywidualnych potrzeb ucznia.</li>
      </ul>
      <p style="font-size: 16px; color: #333; line-height: 1.5;">
        Zgodnie z przepisami RODO, aby umożliwić osobie poniżej 16 roku życia korzystanie z zaawansowanych funkcji AI, wymagana jest wyraźna zgoda rodzica lub opiekuna prawnego.
      </p>
      <div style="text-align: center; margin: 35px 0;">
        <a href="${consentLink}" style="background-color: #4F46E5; color: white; padding: 16px 32px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.2);">Potwierdzam zgodę i odblokowuję konto</a>
      </div>
      <p style="color: #666; font-size: 14px; text-align: center; font-style: italic;">Link wygaśnie za 7 dni. Jeśli nie znasz tej sprawy, możesz zignorować tę wiadomość.</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
      <p style="color: #999; font-size: 12px; text-align: center; line-height: 1.4;">
        PFConsulting Piotr Fiszer<br/>
        ul. Promienista 114, 60-142 Poznań, Polska<br/>
        <a href="${appBaseUrl}/regulamin" style="color: #4F46E5; text-decoration: none;">Regulamin</a> | <a href="${appBaseUrl}/polityka-prywatnosci" style="color: #4F46E5; text-decoration: none;">Polityka Prywatności</a>
      </p>
    </div>
  `;
}
