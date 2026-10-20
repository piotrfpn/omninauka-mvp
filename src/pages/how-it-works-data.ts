export interface Capture {
  src: string;
  width: number;
  height: number;
  mobile?: { src: string; width: number; height: number };
  alt: string;
  caption: string;
  label: string;
}

export const captures: Record<string, Capture> = {
  analysis: {
    src: '/screenshots/analysis-demo.jpg',
    width: 1075,
    height: 625,
    mobile: { src: '/screenshots/analysis-mobile-demo.jpg', width: 358, height: 308 },
    alt: 'Analiza materiału: rozmowa z AI Tutorem, quiz i fiszki do pracy nad tematem.',
    caption: 'Rzeczywisty interfejs trybu demo. Treści przykładowe.',
    label: 'analizy materiału',
  },
  tutor: {
    src: '/screenshots/tutor-demo.jpg',
    width: 768,
    height: 600,
    mobile: { src: '/screenshots/tutor-mobile-demo.jpg', width: 390, height: 520 },
    alt: 'AI Tutor z tematem lekcji o komórce i pytaniem przygotowanym do wysłania.',
    caption: 'Widok przed wysłaniem pytania. Treść demonstracyjna.',
    label: 'AI Tutora',
  },
  quiz: {
    src: '/screenshots/quiz-feedback-demo.jpg',
    width: 736,
    height: 703,
    mobile: { src: '/screenshots/quiz-mobile-demo.jpg', width: 358, height: 720 },
    alt: 'Pytanie o mitochondrium, błędna odpowiedź i wyjaśnienie właściwej odpowiedzi.',
    caption: 'Rzeczywisty quiz demonstracyjny. Treść edukacyjna przykładowa.',
    label: 'quizu z wyjaśnieniem',
  },
  history: {
    src: '/screenshots/history-demo.jpg',
    width: 358,
    height: 265,
    alt: 'Lekcja o budowie komórki w historii z opcją Kontynuuj.',
    caption: 'Przykładowa lekcja z historii demo.',
    label: 'historii lekcji',
  },
};

export const capturesEn: Record<string, Capture> = {
  analysis: {
    src: '/screenshots/analysis-demo.jpg',
    width: 1075,
    height: 625,
    mobile: { src: '/screenshots/analysis-mobile-demo.jpg', width: 358, height: 308 },
    alt: 'Material analysis: dialogue with an AI Tutor, quiz, and flashcards for exploring a topic. Interface shown in Polish.',
    caption: 'Product demonstration shown in Polish. Illustrative learning content.',
    label: 'material analysis',
  },
  tutor: {
    src: '/screenshots/tutor-demo.jpg',
    width: 768,
    height: 600,
    mobile: { src: '/screenshots/tutor-mobile-demo.jpg', width: 390, height: 520 },
    alt: 'AI Tutor with a cell biology lesson topic and a question prepared to send. Interface shown in Polish.',
    caption: 'Product demonstration shown in Polish. Illustrative learning content.',
    label: 'AI Tutor',
  },
  quiz: {
    src: '/screenshots/quiz-feedback-demo.jpg',
    width: 736,
    height: 703,
    mobile: { src: '/screenshots/quiz-mobile-demo.jpg', width: 358, height: 720 },
    alt: 'Question about mitochondria, an incorrect answer, and feedback explaining the correct answer. Interface shown in Polish.',
    caption: 'Product demonstration shown in Polish. Illustrative learning content.',
    label: 'quiz and explanation',
  },
  history: {
    src: '/screenshots/history-demo.jpg',
    width: 358,
    height: 265,
    alt: 'Cell structure lesson in study history with a Continue option. Interface shown in Polish.',
    caption: 'Product demonstration shown in Polish. Illustrative learning content.',
    label: 'study history',
  },
};

export type Locale = 'pl' | 'en';

export const landingPl = {
  cta: {
    primary: 'Zobacz, jak działa',
    secondary: 'Zapytaj o udział w pilotażu',
  },
  hero: {
    label: 'Nauka na Twoich materiałach',
    headline: ['Zrozum temat.', 'Sprawdź, co już umiesz.'],
    description: 'Dodaj notatki lub materiał z lekcji. OmniNauka pomoże Ci go przeanalizować, porozmawiać z AI Tutorem i sprawdzić wiedzę w quizie.',
    note: 'Poznaj produkt bez zakładania konta. Dostęp do pilotażu jest kontrolowany.',
  },
  principles: ['Twoje materiały', 'Wyjaśnienia AI', 'Quiz z informacją zwrotną', 'Powrót do trudności'],
  steps: [
    { title: 'Dodaj materiał', text: 'Wybierz zdjęcie własnych notatek lub dokument z materiałem do nauki.' },
    { title: 'Wyjaśnij z AI', text: 'Zobacz analizę i zapytaj Tutora o to, co wymaga wyjaśnienia.' },
    { title: 'Sprawdź rozumienie', text: 'Odpowiedz na pytania quizu i przeczytaj informację zwrotną.' },
    { title: 'Wróć do trudności', text: 'Skorzystaj z wyjaśnień, fiszek i historii, aby wrócić do tematu.' },
  ],
  story: [
    { title: 'Najpierw: analiza i wybór aktywności', href: '#analiza' },
    { title: 'Potem: pytanie do Tutora', href: '#ai-tutor' },
    { title: 'Następnie: quiz i wyjaśnienie', href: '#powtorka' },
    { title: 'Na koniec: powrót z historii', href: '#historia' },
  ],
  benefits: [
    { title: 'Pracuj na tym, czego się uczysz', text: 'Zacznij od swoich materiałów, zamiast od pustego okna rozmowy.' },
    { title: 'Dopytaj o niejasny fragment', text: 'Nie musisz od razu znać odpowiedzi. Możesz zatrzymać się przy tym, co jest trudne.' },
    { title: 'Zauważ, co wymaga powtórki', text: 'Quiz i wyjaśnienie pomagają wybrać kolejny temat do przećwiczenia.' },
  ],
  sections: {
    how: { label: 'Jak działa OmniNauka', title: 'Cztery kroki do pracy nad tematem.' },
    story: {
      label: 'Jedna lekcja. Kolejne kroki.',
      title: 'Od „mam notatki” do „wiem, co powtórzyć”.',
      text: 'Na przykładzie budowy komórki zobacz drogę od analizy materiału do sprawdzenia wiedzy. Poniżej pokazujemy rzeczywisty interfejs z treścią demonstracyjną.',
    },
    student: { label: 'Dla ucznia', title: 'Twoje tempo. Twoje pytania.' },
    tutor: {
      label: 'AI Tutor',
      title: 'Niejasny fragment? Od niego zacznij rozmowę.',
      text: 'Materiał z lekcji daje rozmowie kontekst. Pytaj o pojęcia i zależności, proś o wyjaśnienie i sprawdzaj je w źródle.',
      note: 'AI może się mylić. Ważne informacje zweryfikuj w materiale lub z nauczycielem.',
    },
    review: {
      label: 'Quiz · błędy · powtórka',
      title: 'Błąd pokazuje, do czego wrócić.',
      text: 'Odpowiedź w quizie to punkt wyjścia. Przeczytaj wyjaśnienie, wróć do niejasnego pojęcia i przećwicz je ponownie.',
      note: 'Wyjaśnienia quizowe także wymagają krytycznego sprawdzania.',
    },
    history: {
      label: 'Historia nauki',
      title: 'Wróć do tematu. Nie do punktu wyjścia.',
      text: 'Historia zbiera lekcje w jednym miejscu. Odszukaj materiał i wybierz aktywność, od której chcesz kontynuować.',
    },
    parent: {
      label: 'Dla rodzica i opiekuna',
      title: 'Wsparcie nauki. Jasne zasady udziału.',
      text: 'OmniNauka wspiera pracę nad materiałem. Nie zastępuje nauczyciela ani rozmowy z opiekunem.',
    },
    safety: {
      label: 'AI i prywatność',
      title: 'Wiedz, z czego korzystasz.',
      paragraphs: [
        'Rozmawiasz z AI, która może popełniać błędy. OmniNauka służy do pracy nad rozumieniem materiału — nie zastępuje nauczyciela ani specjalistycznej pomocy.',
        'Korzystaj z własnych notatek i materiałów, które możesz udostępniać. Pomijaj dane wrażliwe i prywatne informacje. Prośby poza edukacyjnym zakresem i dotyczące niebezpiecznych treści podlegają ograniczeniom.',
        'Ta strona nie wymaga konta ani podawania danych.',
      ],
    },
    pilot: {
      label: 'Status produktu',
      title: 'Poznaj OmniNauka. O pilotaż zapytaj nas bezpośrednio.',
      text: 'OmniNauka jest rozwijana w kontrolowanym pilotażu. Dostęp nie jest otwarty. Kontakt nie oznacza automatycznego przyjęcia ani gwarancji terminu udziału.',
      note: 'Nie przesyłaj w zgłoszeniu danych dziecka ani materiałów do nauki.',
    },
    faq: { label: 'Pytania i odpowiedzi', title: 'Zanim zapytasz o pilotaż.' },
  },
  parentPoints: [
    { title: 'Udział opiekuna ma znaczenie', text: 'W pilotażu dostęp osoby niepełnoletniej wymaga udziału rodzica lub opiekuna zgodnie z zasadami PF-04.' },
    { title: 'Tylko materiały potrzebne do nauki', text: 'Nie dodawaj twarzy, nazwisk, kontaktów ani prywatnych informacji innych osób.' },
    { title: 'Bez obietnic bezbłędności', text: 'Odpowiedzi AI trzeba oceniać krytycznie. Ważne informacje warto sprawdzić wspólnie.' },
  ],
  reviewLoop: ['Odpowiedź', 'Informacja zwrotna', 'Trudność', 'Powtórka'],
  faq: [
    { question: 'Czym jest OmniNauka?', answer: 'To aplikacja do aktywnej nauki na własnych materiałach: analizy, rozmowy z AI Tutorem, quizów, fiszek i powrotu do lekcji.' },
    { question: 'Jak działa na moich materiałach?', answer: 'Dodajesz zdjęcie notatek lub dokument. Aplikacja analizuje materiał i udostępnia aktywności do pracy nad tematem. Jakość i poprawność rezultatu trzeba sprawdzać.' },
    { question: 'Czy AI może się mylić?', answer: 'Tak. Odpowiedzi, wyjaśnienia i pytania quizowe mogą zawierać błędy. Sprawdzaj ważne informacje w materiale lub z nauczycielem.' },
    { question: 'Czy OmniNauka odrabia zadania za ucznia?', answer: 'Celem jest rozumienie i samodzielna praca. Traktuj wyjaśnienia jako pomoc do nauki, a nie gotową pracę do oddania.' },
    { question: 'Dla kogo powstaje OmniNauka?', answer: 'Dla uczniów, którzy chcą pracować nad szkolnym materiałem, oraz opiekunów wspierających ich naukę. Udział w pilotażu wymaga wcześniejszego uzgodnienia.' },
    { question: 'Jak wygląda dostęp młodszych użytkowników?', answer: 'Dostęp nie jest otwarty. W PF-04 poniżej 13 lat umowę w imieniu dziecka zawiera przedstawiciel ustawowy. W wieku 13–17 lat wymagane jest zatwierdzenie opiekuna przed dostępem do funkcji nauki. Sam kontakt nie uruchamia udziału.' },
    { question: 'Czy mogę już dołączyć publicznie?', answer: 'Obecnie udział odbywa się w kontrolowanym pilotażu. Możesz zapytać o możliwość udziału; nie oznacza to automatycznego przyjęcia.' },
    { question: 'Na jakich urządzeniach działa?', answer: 'Z aplikacji można korzystać w przeglądarce na telefonie, tablecie i komputerze. Możliwość instalacji jako PWA zależy od urządzenia i przeglądarki.' },
  ],
};

export const landingEn = {
  cta: {
    primary: 'See how it works',
    secondary: 'Ask about the pilot',
  },
  hero: {
    label: 'Learn from your own materials',
    headline: ['Understand the topic.', 'Find out what you already know.'],
    description: 'Upload your notes or learning materials. OmniNauka helps you explore the content, ask questions with an AI Tutor, and check your understanding through quizzes.',
    note: 'Explore the product without creating an account. Pilot access is controlled.',
  },
  principles: ['Your materials', 'AI explanations', 'Quiz with feedback', 'Review problem areas'],
  steps: [
    { title: 'Upload materials', text: 'Choose a photo of your own notes or a document with your study material.' },
    { title: 'Explore with AI', text: 'Review the analysis and ask the Tutor about anything that needs clarification.' },
    { title: 'Check understanding', text: 'Answer quiz questions and review clear, detailed feedback.' },
    { title: 'Review problem areas', text: 'Use explanations, flashcards, and history to return to challenging concepts.' },
  ],
  story: [
    { title: 'First: analysis and activity selection', href: '#analiza' },
    { title: 'Next: ask the Tutor a question', href: '#ai-tutor' },
    { title: 'Then: quiz and explanation', href: '#powtorka' },
    { title: 'Finally: return from study history', href: '#historia' },
  ],
  benefits: [
    { title: 'Work with what you are actually studying', text: 'Start with your own lesson materials instead of a blank chat window.' },
    { title: 'Ask about unclear passages', text: 'You do not need to know all the answers right away. Pause and unpack what feels difficult.' },
    { title: 'Notice what needs review', text: 'Quizzes and targeted explanations help you choose what topic to practice next.' },
  ],
  sections: {
    how: { label: 'How OmniNauka works', title: 'Four steps to master any topic.' },
    story: {
      label: 'One lesson. Next steps.',
      title: 'From “I have notes” to “I know what to review”.',
      text: 'Using a cell biology lesson as an example, see the journey from material analysis to knowledge verification. Below we show the actual interface with illustrative demonstration content.',
    },
    student: { label: 'For students', title: 'Your pace. Your questions.' },
    tutor: {
      label: 'AI Tutor',
      title: 'Unclear passage? Start your conversation right there.',
      text: 'Your lesson material provides context for the dialogue. Ask about concepts and connections, request explanations, and verify them in your source notes.',
      note: 'AI can make mistakes. Always verify important information against your materials or with a teacher.',
    },
    review: {
      label: 'Quiz · mistakes · review',
      title: 'A mistake shows you what to revisit.',
      text: 'A quiz answer is a starting point. Read the feedback, return to the challenging concept, and practice it again.',
      note: 'Quiz explanations also require critical review.',
    },
    history: {
      label: 'Study history',
      title: 'Return to the topic. Not to square one.',
      text: 'Study history gathers your lessons in one place. Find your material and pick the activity you want to continue with.',
    },
    parent: {
      label: 'For parents & guardians',
      title: 'Learning support. Clear participation rules.',
      text: 'OmniNauka supports working through school material. It does not replace a teacher or conversations with a parent or guardian.',
    },
    safety: {
      label: 'AI & privacy',
      title: 'Know what you are using.',
      paragraphs: [
        'You are interacting with AI, which can make mistakes. OmniNauka is designed to support topic comprehension — it does not replace a teacher or professional guidance.',
        'Use your own notes and materials that you have the right to share. Avoid sensitive data and private personal information. Requests outside the educational scope or involving harmful content are restricted.',
        'This website does not require an account or submitting personal data.',
      ],
    },
    pilot: {
      label: 'Product status',
      title: 'Explore OmniNauka. Inquire about the pilot directly.',
      text: 'OmniNauka is being developed in a controlled pilot. Access is not publicly open. Inquiring does not guarantee admission or a specific start date.',
      note: "Do not include children's personal information or learning materials in your inquiry.",
    },
    faq: { label: 'Questions & answers', title: 'Before you ask about the pilot.' },
  },
  parentPoints: [
    { title: 'Parental involvement matters', text: 'In the pilot, minor access requires parent or guardian participation in accordance with PF-04 principles.' },
    { title: 'Only materials needed for study', text: 'Do not upload faces, names, contact details, or private information of others.' },
    { title: 'No promises of flawlessness', text: 'AI responses must be evaluated critically. Important facts should be reviewed together.' },
  ],
  reviewLoop: ['Answer', 'Feedback', 'Problem area', 'Review'],
  faq: [
    { question: 'What is OmniNauka?', answer: 'It is an active learning application for studying with your own materials: document analysis, conversations with an AI Tutor, quizzes, flashcards, and lesson review.' },
    { question: 'How does it work with my materials?', answer: 'You upload a photo of your notes or a study document. The application analyzes the material and provides activities to work through the topic. Quality and accuracy should always be reviewed.' },
    { question: 'Can AI make mistakes?', answer: 'Yes. Answers, explanations, and quiz questions can contain errors. Always check important information against your source material or consult a teacher.' },
    { question: 'Does OmniNauka do homework for students?', answer: 'The goal is genuine understanding and independent work. Treat AI explanations as a study aid, not as finished work to submit.' },
    { question: 'Who is OmniNauka built for?', answer: 'For students who want to engage with their school subjects, and parents or guardians supporting their learning. Pilot participation requires prior agreement.' },
    { question: 'How is access handled for younger users?', answer: 'Access is not publicly open. Under the PF-04 framework, for users under 13, a legal guardian enters into the pilot agreement on the child\'s behalf. For ages 13–17, guardian approval is required before learning features can be accessed. Contact alone does not grant access.' },
    { question: 'Can I join publicly right now?', answer: 'Participation is currently conducted within a controlled pilot. You may inquire about availability; this does not mean automatic admission.' },
    { question: 'What devices does it work on?', answer: 'You can use the application in modern browsers on phones, tablets, and computers. PWA installation depends on your device and browser capabilities.' },
  ],
};

export const navigation = [
  { label: 'Jak działa', href: '#jak-dziala' },
  { label: 'Dla ucznia', href: '#dla-ucznia' },
  { label: 'Dla rodzica', href: '#dla-rodzica' },
  { label: 'AI i prywatność', href: '#bezpieczenstwo' },
];

export const navigationEn = [
  { label: 'How it works', href: '#jak-dziala' },
  { label: 'For students', href: '#dla-ucznia' },
  { label: 'For parents', href: '#dla-rodzica' },
  { label: 'AI & privacy', href: '#bezpieczenstwo' },
];

export const legalDocuments = [
  { label: 'Prywatność strony', href: 'https://www.omninauka.eu/prywatnosc-strony/', isExternal: true },
  { label: 'Prywatność aplikacji', href: '/polityka-prywatnosci', isExternal: false },
  { label: 'Polityka cookies', href: '/polityka-cookies', isExternal: false },
  { label: 'Zasady pilotażu PF-04', href: 'https://www.omninauka.eu/pf04/', isExternal: true },
  { label: 'Regulamin aplikacji', href: '/regulamin', isExternal: false },
  { label: 'Ograniczenia AI', href: '/ai-disclaimer', isExternal: false },
  { label: 'Zgłaszanie naruszeń', href: '/polityka-zglaszania-naruszen', isExternal: false },
];

export const legalDocLabelsEn: Record<string, string> = {
  'https://www.omninauka.eu/prywatnosc-strony/': 'Website privacy notice',
  '/polityka-prywatnosci': 'App privacy policy',
  '/polityka-cookies': 'Cookies policy',
  'https://www.omninauka.eu/pf04/': 'PF-04 pilot information',
  '/regulamin': 'Terms of service',
  '/ai-disclaimer': 'AI limitations & disclaimer',
  '/polityka-zglaszania-naruszen': 'Content & violation reporting',
};
