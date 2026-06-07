import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { ShieldOff, Loader2, ArrowLeft, Filter, Inbox, CheckCircle2, Circle, AlertCircle, Clock, Mail, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Textarea } from '../../components/ui/textarea';

interface SupportTicket {
  id: string;
  created_at: string;
  user_email_snapshot: string;
  plan_snapshot: string | null;
  category: string;
  subject: string;
  status: 'new' | 'in_progress' | 'resolved' | 'closed';
  handled_at: string | null;
  message?: string;
  admin_note?: string;
  handled_by?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  payment_premium: 'Płatność / Premium',
  technical_problem: 'Problem techniczny',
  ai_tutor_analysis: 'AI Tutor',
  account_login: 'Logowanie',
  parent_consent: 'Zgoda rodzica',
  other: 'Inne'
};

const STATUS_LABELS: Record<string, string> = {
  new: 'Nowe',
  in_progress: 'W toku',
  resolved: 'Rozwiązane',
  closed: 'Zamknięte'
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  new: <AlertCircle className="w-3.5 h-3.5 mr-1" />,
  in_progress: <Clock className="w-3.5 h-3.5 mr-1" />,
  resolved: <CheckCircle2 className="w-3.5 h-3.5 mr-1" />,
  closed: <Circle className="w-3.5 h-3.5 mr-1" />
};

export default function AdminSupportInboxPage() {
  const { user } = useAuth();

  const [isAdminChecked, setIsAdminChecked] = useState(false);
  const [isForbidden, setIsForbidden] = useState(false);

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  
  const [adminNote, setAdminNote] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  const handleCopyEmail = () => {
    if (!selectedTicket) return;
    navigator.clipboard.writeText(selectedTicket.user_email_snapshot);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyTemplate = () => {
    if (!selectedTicket) return;
    const text = `Do: ${selectedTicket.user_email_snapshot}\n\nTemat: OmniNauka — odpowiedź na zgłoszenie ${selectedTicket.id.split('-')[0]}\n\nDzień dobry,\n\ndziękujemy za zgłoszenie w OmniNauka.\n\n`;
    navigator.clipboard.writeText(text);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2000);
  };

  useEffect(() => {
    let isMounted = true;
    if (!user) {
      setIsForbidden(true);
      setIsAdminChecked(true);
      return;
    }

    const checkAdminAndLoad = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (isMounted) { setIsForbidden(true); setIsAdminChecked(true); }
          return;
        }

        // We can just try to load tickets. The endpoint will 403 if not admin.
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-inbox`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ action: 'list_tickets', status: statusFilter || undefined })
        });

        if (res.status === 403) {
          if (isMounted) setIsForbidden(true);
        } else if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setIsForbidden(false);
            setTickets(data.tickets || []);
          }
        } else {
           if (isMounted) setIsForbidden(true);
        }
      } catch {
        if (isMounted) setIsForbidden(true);
      } finally {
        if (isMounted) {
          setIsAdminChecked(true);
          setIsLoading(false);
        }
      }
    };

    checkAdminAndLoad();
    return () => { isMounted = false; };
  }, [user, statusFilter]);

  const loadTicketDetails = async (ticketId: string) => {
    setIsLoadingDetails(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-inbox`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'get_ticket_details', ticketId })
      });

      if (!res.ok) {
        throw new Error('Błąd pobierania szczegółów.');
      }

      const data = await res.json();
      setSelectedTicket(data.ticket);
      setAdminNote(data.ticket.admin_note || '');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Błąd');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedTicket) return;
    setIsUpdating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-inbox`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'update_ticket',
          ticketId: selectedTicket.id,
          status: newStatus,
          admin_note: adminNote
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Błąd aktualizacji.');
      }

      const data = await res.json();
      toast.success('Zgłoszenie zaktualizowane.');
      
      // Update local state
      setSelectedTicket(data.ticket);
      setTickets(prev => prev.map(t => t.id === data.ticket.id ? { ...t, status: data.ticket.status as any, handled_at: data.ticket.handled_at } : t));

    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Błąd');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedTicket) return;
    setIsUpdating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-inbox`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'update_ticket',
          ticketId: selectedTicket.id,
          admin_note: adminNote
        })
      });

      if (!res.ok) throw new Error('Błąd zapisu notatki.');
      toast.success('Notatka zapisana.');
      const data = await res.json();
      setSelectedTicket(data.ticket);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Błąd');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isAdminChecked) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (isForbidden) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300 pb-12 mt-8">
        <div className="flex items-start gap-3 p-5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
          <ShieldOff className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300">Brak dostępu do panelu administratora</p>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
  };

  const newCount = tickets.filter(t => t.status === 'new').length;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300 pb-12">
      <header>
        <Link to="/app/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Wróć do Panelu Głównego
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
            <Inbox className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Support Inbox</h1>
            <p className="text-sm text-muted-foreground">
              Skrzynka zgłoszeń użytkowników
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Lewa kolumna - Lista */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  Zgłoszenia 
                  {newCount > 0 && <Badge variant="destructive">{newCount} nowe</Badge>}
                </CardTitle>
                <div className="flex items-center gap-2 text-sm">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <select
                    className="border rounded px-2 py-1 bg-background text-foreground"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">Wszystkie (Ostatnie 50)</option>
                    <option value="new">Nowe</option>
                    <option value="in_progress">W toku</option>
                    <option value="resolved">Rozwiązane</option>
                    <option value="closed">Zamknięte</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
              ) : tickets.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">Brak zgłoszeń w tej kategorii.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Użytkownik / Kategoria</TableHead>
                        <TableHead>Temat</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tickets.map(ticket => (
                        <TableRow 
                          key={ticket.id} 
                          className={`cursor-pointer transition-colors ${selectedTicket?.id === ticket.id ? 'bg-muted/50' : 'hover:bg-muted/20'} ${ticket.status === 'new' ? 'font-medium' : ''}`}
                          onClick={() => loadTicketDetails(ticket.id)}
                        >
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${STATUS_COLORS[ticket.status]}`}>
                              {STATUS_ICONS[ticket.status]}
                              {STATUS_LABELS[ticket.status]}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                            {formatDate(ticket.created_at)}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{ticket.user_email_snapshot}</div>
                            <div className="text-xs text-muted-foreground">{CATEGORY_LABELS[ticket.category] || ticket.category}</div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {ticket.subject}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">Otwórz</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Prawa kolumna - Szczegóły */}
        <div className="lg:col-span-1">
          {isLoadingDetails ? (
            <Card className="h-[500px] flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </Card>
          ) : selectedTicket ? (
            <Card className="sticky top-6">
              <CardHeader className="pb-4 border-b">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className="font-mono text-[10px]">{selectedTicket.id.split('-')[0]}</Badge>
                  <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${STATUS_COLORS[selectedTicket.status]}`}>
                    {STATUS_ICONS[selectedTicket.status]}
                    {STATUS_LABELS[selectedTicket.status]}
                  </span>
                </div>
                <CardTitle className="text-lg leading-tight whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{selectedTicket.subject}</CardTitle>
                <CardDescription>
                  Od: <span className="break-all [overflow-wrap:anywhere]">{selectedTicket.user_email_snapshot}</span> <br />
                  Data: {formatDate(selectedTicket.created_at)}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-6">
                
                {/* Metadane */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 p-3 rounded-lg">
                  <div>
                    <span className="text-muted-foreground block">Kategoria</span>
                    <span className="font-medium">{CATEGORY_LABELS[selectedTicket.category] || selectedTicket.category}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Plan w momencie zgłoszenia</span>
                    <span className="font-medium capitalize">{selectedTicket.plan_snapshot || 'Brak'}</span>
                  </div>
                </div>

                {/* Treść */}
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Treść wiadomości</h4>
                  <div className="p-4 bg-background border rounded-lg text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-w-full overflow-hidden leading-relaxed">
                    {selectedTicket.message}
                  </div>
                </div>

                {/* Notatka Admina */}
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Notatka wewnętrzna (tylko dla adminów)</h4>
                  <Textarea 
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="Wpisz np. 'Rozwiązane mailowo 07.06'"
                    rows={3}
                    className="text-sm resize-none mb-2"
                  />
                  <Button variant="secondary" size="sm" onClick={handleSaveNote} disabled={isUpdating}>
                    {isUpdating ? 'Zapisywanie...' : 'Zapisz notatkę'}
                  </Button>
                </div>

                {/* Akcje kontaktu */}
                <div className="pt-4 border-t">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Kontakt z użytkownikiem</h4>
                  <div className="flex flex-col gap-3">
                    <Button size="default" variant="default" className="gap-2 w-full sm:w-auto self-start" asChild>
                      <a 
                        href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(selectedTicket.user_email_snapshot)}&su=${encodeURIComponent(`OmniNauka — odpowiedź na zgłoszenie ${selectedTicket.id.split('-')[0]}`)}&body=${encodeURIComponent(`Dzień dobry,\n\ndziękujemy za zgłoszenie w OmniNauka.\n\n`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Mail className="w-4 h-4" />
                        Otwórz Gmail
                      </a>
                    </Button>
                    
                    <div className="flex flex-wrap gap-2 items-center">
                      <Button size="sm" variant="secondary" className="gap-2" asChild>
                        <a href={`mailto:${selectedTicket.user_email_snapshot}?subject=${encodeURIComponent(`OmniNauka — odpowiedź na zgłoszenie ${selectedTicket.id.split('-')[0]}`)}&body=${encodeURIComponent(`Dzień dobry,\n\ndziękujemy za zgłoszenie w OmniNauka.\n\n`)}`}>
                          <Mail className="w-4 h-4" />
                          Odpowiedz w aplikacji pocztowej
                        </a>
                      </Button>
                      <span className="text-[10px] text-muted-foreground ml-1">
                        Jeśli ten przycisk nie działa, użyj Gmaila albo skopiuj e-mail.
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-1">
                      <Button size="sm" variant="outline" className="gap-2" onClick={handleCopyEmail}>
                        <Copy className="w-4 h-4" />
                        {copied ? 'Skopiowano' : 'Kopiuj e-mail'}
                      </Button>
                      <Button size="sm" variant="outline" className="gap-2" onClick={handleCopyTemplate}>
                        <Copy className="w-4 h-4" />
                        {copiedTemplate ? 'Skopiowano' : 'Kopiuj temat i treść'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Akcje statusu */}
                <div className="pt-4 border-t">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Zmień status</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTicket.status !== 'new' && (
                      <Button size="sm" variant="outline" onClick={() => handleUpdateStatus('new')} disabled={isUpdating}>Oznacz jako Nowe</Button>
                    )}
                    {selectedTicket.status !== 'in_progress' && (
                      <Button size="sm" variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => handleUpdateStatus('in_progress')} disabled={isUpdating}>W toku</Button>
                    )}
                    {selectedTicket.status !== 'resolved' && (
                      <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleUpdateStatus('resolved')} disabled={isUpdating}>Rozwiązane</Button>
                    )}
                  </div>
                  {selectedTicket.handled_by && (
                    <p className="text-[10px] text-muted-foreground mt-3">
                      Ostatnia akcja: {selectedTicket.handled_by} ({formatDate(selectedTicket.handled_at)})
                    </p>
                  )}
                </div>

              </CardContent>
            </Card>
          ) : (
            <Card className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
              Wybierz zgłoszenie z listy, aby zobaczyć szczegóły.
            </Card>
          )}
        </div>

      </div>
    </div>
  );
}
