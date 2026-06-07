import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { HelpCircle, AlertTriangle, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';

const CATEGORIES = [
  { id: 'payment_premium', label: 'Płatność / Premium' },
  { id: 'technical_problem', label: 'Problem techniczny' },
  { id: 'ai_tutor_analysis', label: 'AI Tutor / analiza materiału' },
  { id: 'account_login', label: 'Konto / logowanie' },
  { id: 'parent_consent', label: 'Zgoda rodzica' },
  { id: 'other', label: 'Inne' },
];

export default function SupportPage() {
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) {
      toast.error('Wybierz kategorię zgłoszenia.');
      return;
    }

    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (trimmedSubject.length < 5) {
      toast.error('Temat musi mieć co najmniej 5 znaków.');
      return;
    }
    if (trimmedSubject.length > 120) {
      toast.error('Temat nie może przekraczać 120 znaków.');
      return;
    }
    if (trimmedMessage.length < 10) {
      toast.error('Wiadomość musi mieć co najmniej 10 znaków.');
      return;
    }
    if (trimmedMessage.length > 2000) {
      toast.error('Wiadomość nie może przekraczać 2000 znaków.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Brak sesji. Zaloguj się ponownie.');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-inbox`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'submit_ticket',
          category,
          subject: trimmedSubject,
          message: trimmedMessage,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Wystąpił błąd podczas wysyłania zgłoszenia.');
      }

      setIsSuccess(true);
      toast.success('Zgłoszenie wysłane pomyślnie!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto py-12 animate-in fade-in duration-300">
        <Card className="border-green-100 dark:border-green-900/30 shadow-md">
          <CardContent className="pt-10 pb-10 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center mb-2">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Zgłoszenie wysłane!</h2>
            <p className="text-muted-foreground max-w-md">
              Zgłoszenie zostało wysłane. Zespół OmniNauka skontaktuje się z Tobą mailowo, jeśli będzie to potrzebne.
            </p>
            <div className="pt-6">
              <Button asChild variant="outline">
                <Link to="/app/dashboard">Wróć na pulpit</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12 animate-in fade-in duration-300">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pomoc i kontakt</h1>
            <p className="text-sm text-muted-foreground">
              Masz problem z kontem lub aplikacją? Wyślij zgłoszenie do naszego zespołu.
            </p>
          </div>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Nowe zgłoszenie</CardTitle>
          <CardDescription>
            Opisz dokładnie swój problem. Odpowiedź otrzymasz na swój e-mail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Kategoria zgłoszenia</label>
              <select
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                <option value="" disabled>-- Wybierz kategorię --</option>
                {CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Temat</label>
              <Input
                placeholder="Krótki opis problemu (np. Brak dostępu do Premium)"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={120}
                required
              />
              <p className="text-xs text-muted-foreground text-right">{subject.length}/120</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Wiadomość</label>
              <Textarea
                placeholder="Opisz problem, błąd lub podaj szczegóły..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                maxLength={2000}
                required
              />
              <p className="text-xs text-muted-foreground text-right">{message.length}/2000</p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 p-4 rounded-lg border border-amber-200 dark:border-amber-800 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="text-sm leading-relaxed">
                <strong>Uwaga:</strong> Nie wpisuj haseł, kodów dostępu ani pełnych danych płatniczych. 
                Nasz zespół nigdy o nie nie poprosi wprost.
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Wysyłanie...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Wyślij zgłoszenie
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground pt-4 border-t border-border mt-6">
              Informacje o przetwarzaniu danych osobowych znajdziesz w{' '}
              <Link to="/polityka-prywatnosci" target="_blank" className="underline hover:text-foreground">Polityce Prywatności</Link>.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
