import type { User, AnalysisResult, DashboardSummary, StudySession, SubjectProgress } from '../types';

export const mockUser: User = {
  id: 'user-001',
  email: 'student@omninauka.pl',
  name: 'Kacper',
  avatar: '/avatars/student.png',
  createdAt: new Date('2024-01-15'),
  plan: 'premium',
};

export const mockAnalysisResults: AnalysisResult[] = [
  {
    id: 'analysis-001',
    subject: 'Biologia',
    topic: 'Budowa komórki - organelle',
    confidence: 0.94,
    keyConcepts: [
      { id: 'kc-001', term: 'Mitochondrium', definition: 'Organellum odpowiedzialne za produkcję ATP w procesie fosforylacji oksydacyjnej', category: 'concept' },
      { id: 'kc-002', term: 'Jądro komórkowe', definition: 'Struktura zawierająca DNA, kontrolująca aktywność komórki', category: 'concept' },
      { id: 'kc-003', term: 'Chloroplast', definition: 'Organellum roślinne, miejsce fotosyntezy', category: 'concept' },
      { id: 'kc-004', term: 'Błona komórkowa', definition: 'Warstwa otaczająca cytoplazmę, kontroluje transport substancji', category: 'concept' },
      { id: 'kc-005', term: 'Rybosom', definition: 'Miejsce syntezy białek', category: 'concept' },
    ],
    flashcards: [
      { id: 'fc-001', front: 'Mitochondrium', back: 'Elektrownia komórki - produkuje ATP w procesie fosforylacji oksydacyjnej', difficulty: 'medium' },
      { id: 'fc-002', front: 'Jądro komórkowe', back: 'Kontroluje aktywność komórki, zawiera DNA', difficulty: 'easy' },
      { id: 'fc-003', front: 'Chloroplast', back: 'Organellum roślinne, miejsce fotosyntezy - zamiana światła na energię chemiczną', difficulty: 'medium' },
      { id: 'fc-004', front: 'Fotosynteza', back: 'Proces przekształcania CO2 i H2O w glukozę przy użyciu światła', difficulty: 'hard' },
      { id: 'fc-005', front: 'Błona komórkowa', back: 'Półprzepuszczalna warstwa otaczająca cytoplazmę', difficulty: 'easy' },
    ],
    quizQuestions: [
      {
        id: 'qq-001',
        type: 'single_choice',
        question: 'Które organellum nazywane jest "elektrownią komórki"?',
        options: ['Jądro komórkowe', 'Mitochondrium', 'Chloroplast', 'Rybosom'],
        correctAnswer: 1,
        explanation: 'Mitochondrium produkuje ATP, czyli główne źródło energii dla komórki.',
        difficulty: 'easy',
      },
      {
        id: 'qq-002',
        type: 'single_choice',
        question: 'Gdzie zachodzi fotosynteza w komórce roślinnej?',
        options: ['W mitochondriach', 'W jądrze', 'W chloroplastach', 'W rybosomach'],
        correctAnswer: 2,
        explanation: 'Fotosynteza zachodzi w chloroplastach, które zawierają chlorofil.',
        difficulty: 'easy',
      },
      {
        id: 'qq-003',
        type: 'true_false',
        question: 'Rybosomy odpowiadają za syntezę białek w komórce.',
        correctAnswer: 0,
        explanation: 'Rybosomy są miejscem, w którym powstają białka na podstawie informacji z mRNA.',
        difficulty: 'medium',
      },
    ],
    summary: 'Materiał obejmuje podstawowe organelle komórkowe: mitochondrium, jądro, chloroplasty, błonę komórkową i rybosomy. Kluczowe jest zrozumienie funkcji każdego organellum.',
    createdAt: new Date(),
    sourceFileId: 'file-001',
  },
  {
    id: 'analysis-002',
    subject: 'Historia',
    topic: 'II Wojna Światowa - wybuch i pierwsze kampanie',
    confidence: 0.91,
    keyConcepts: [
      { id: 'kc-101', term: '1 września 1939', definition: 'Data wybuchu II wojny światowej - atak Niemiec na Polskę', category: 'date' },
      { id: 'kc-102', term: 'Blitzkrieg', definition: 'Taktyka wojenna "błyskawicznej wojny" użyta przez Niemcy', category: 'concept' },
      { id: 'kc-103', term: 'Adolf Hitler', definition: 'Führer Niemiec, inicjator wojny', category: 'person' },
      { id: 'kc-104', term: 'Układ Ribbentrop-Mołotow', definition: 'Pakt między Niemcami a ZSRR z 23 sierpnia 1939', category: 'event' },
      { id: 'kc-105', term: 'Obóz koncentracyjny', definition: 'Miejsce przetrzymywania i eksterminacji przez nazistów', category: 'concept' },
    ],
    flashcards: [
      { id: 'fc-101', front: '1 września 1939', back: 'Wybuch II wojny światowej - atak Niemiec na Polskę', difficulty: 'easy' },
      { id: 'fc-102', front: 'Blitzkrieg', back: 'Taktyka "błyskawicznej wojny" - szybkie uderzenie pancerno-piechoty z powietrznym wsparciem', difficulty: 'medium' },
      { id: 'fc-103', front: 'Układ Ribbentrop-Mołotow', back: 'Pakt niemiecko-sowiecki z 23.08.1939 - nieagresja i podział stref wpływów', difficulty: 'hard' },
    ],
    quizQuestions: [
      {
        id: 'qq-101',
        type: 'single_choice',
        question: 'Kiedy wybuchła II wojna światowa?',
        options: ['1 września 1938', '1 września 1939', '3 września 1939', '1 września 1940'],
        correctAnswer: 1,
        explanation: 'II wojna światowa wybuchła 1 września 1939 roku atakiem Niemiec na Polskę.',
        difficulty: 'easy',
      },
      {
        id: 'qq-102',
        type: 'single_choice',
        question: 'Jak nazywała się taktyka "błyskawicznej wojny"?',
        options: ['Schlieffenplan', 'Blitzkrieg', 'Operation Barbarossa', 'Manhattan Project'],
        correctAnswer: 1,
        explanation: 'Blitzkrieg to niemiecka taktyka szybkiego uderzenia łączącego piechotę, czołgi i lotnictwo.',
        difficulty: 'medium',
      },
    ],
    summary: 'II wojna światowa rozpoczęła się 1 września 1939 atakiem Niemiec na Polskę. Niemcy zastosowały taktykę Blitzkrieg, opartą na szybkich uderzeniach pancerno-powietrznych.',
    createdAt: new Date(),
    sourceFileId: 'file-002',
  },
];

export const mockStudySessions: StudySession[] = [
  {
    id: 'session-001',
    userId: 'user-001',
    analysisId: 'analysis-001',
    analysis: mockAnalysisResults[0],
    status: 'completed',
    startedAt: new Date(Date.now() - 86400000 * 2),
    completedAt: new Date(Date.now() - 86400000 * 2 + 1800000),
    totalTimeMinutes: 30,
  },
  {
    id: 'session-002',
    userId: 'user-001',
    analysisId: 'analysis-002',
    analysis: mockAnalysisResults[1],
    status: 'completed',
    startedAt: new Date(Date.now() - 86400000),
    completedAt: new Date(Date.now() - 86400000 + 2400000),
    totalTimeMinutes: 40,
  },
];

export const mockSubjectProgress: SubjectProgress[] = [
  {
    subject: 'Biologia',
    totalSessions: 12,
    averageScore: 82,
    totalTimeMinutes: 420,
    lastStudiedAt: new Date(Date.now() - 86400000 * 2),
    masteryLevel: 'intermediate',
  },
  {
    subject: 'Historia',
    totalSessions: 8,
    averageScore: 75,
    totalTimeMinutes: 280,
    lastStudiedAt: new Date(Date.now() - 86400000),
    masteryLevel: 'intermediate',
  },
  {
    subject: 'Chemia',
    totalSessions: 5,
    averageScore: 68,
    totalTimeMinutes: 150,
    lastStudiedAt: new Date(Date.now() - 86400000 * 5),
    masteryLevel: 'beginner',
  },
];

export const mockDashboardSummary: DashboardSummary = {
  totalStudySessions: 25,
  totalStudyTimeMinutes: 850,
  averageScore: 75,
  currentStreak: 3,
  longestStreak: 7,
  recentSessions: mockStudySessions,
  subjectProgress: mockSubjectProgress,
  recentUploads: [],
};

// Helper to get random analysis for demo
export function getDemoAnalysis(subject?: string): AnalysisResult {
  if (subject) {
    const found = mockAnalysisResults.find(a => a.subject.toLowerCase() === subject.toLowerCase());
    if (found) return { ...found, id: `analysis-${Date.now()}`, createdAt: new Date() };
  }
  const random = mockAnalysisResults[Math.floor(Math.random() * mockAnalysisResults.length)];
  return { ...random, id: `analysis-${Date.now()}`, createdAt: new Date() };
}
