import React, { useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import {
  Search, Shield, ShieldOff, AlertTriangle, Loader2,
  User, Calendar, Crown, FileText, Activity, History
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AdminUserProfile {
  id: string;
  email: string;
  plan: 'free' | 'premium' | 'family';
  plan_expires_at: string | null;
  plan_updated_at: string | null;
  created_at?: string | null;
}

interface AdminPlanAction {
  id: string;
  created_at: string;
  action_type: string;
  admin_email: string;
  target_email: string;
  old_plan: string | null;
  new_plan: string | null;
  reason: string | null;
}

interface AdminUsageEvent {
  id: string;
  created_at: string;
  event_type: string;
  value: number;
  details: unknown;
}

interface AdminData {
  user: AdminUserProfile | null;
  auditLogs: AdminPlanAction[];
  usageEvents: AdminUsageEvent[];
}

type ActionType = 'activate_premium_30' | 'extend_premium_30' | 'activate_family_30' | 'set_free';

// ── Helpers ────────────────────────────────────────────────────────────────────

const FUNCTION_URL_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-plan-management`;

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    return new Intl.DateTimeFormat('pl-PL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

function getPlanLabel(plan: string): string {
  switch (plan) {
    case 'premium': return 'Premium';
    case 'family':  return 'Rodzinny';
    default:        return 'Darmowy';
  }
}

function isPlanExpired(plan: string, plan_expires_at: string | null): boolean {
  if (plan === 'free') return false;
  if (!plan_expires_at) return false;
  return new Date(plan_expires_at) <= new Date();
}

function getEffectivePlanLabel(plan: string, plan_expires_at: string | null): string {
  if (isPlanExpired(plan, plan_expires_at)) return 'Darmowy (plan wygasł)';
  return getPlanLabel(plan);
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user } = useAuth();

  // Search state
  const [searchEmail, setSearchEmail] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isForbidden, setIsForbidden] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Data state
  const [adminData, setAdminData] = useState<AdminData | null>(null);

  // Action state
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);
  const [reason, setReason] = useState('');

  // ── API call helper ────────────────────────────────────────────────────────

  const callAdminFunction = async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Brak tokenu sesji. Zaloguj się ponownie.');

    const response = await fetch(FUNCTION_URL_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (response.status === 403) {
      setIsForbidden(true);
      throw new Error('forbidden');
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  };

  // ── Search handler ─────────────────────────────────────────────────────────

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = searchEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      toast.error('Wpisz poprawny adres e-mail.');
      return;
    }

    setIsSearching(true);
    setAdminData(null);
    setNotFound(false);
    setIsForbidden(false);
    setReason('');

    try {
      const result = await callAdminFunction({ action: 'search_user', email });
      if (result.user) {
        setAdminData({
          user: result.user as AdminUserProfile,
          auditLogs: result.auditLogs as AdminPlanAction[] ?? [],
          usageEvents: result.usageEvents as AdminUsageEvent[] ?? []
        });
        setNotFound(false);
      } else {
        setAdminData(null);
        setNotFound(true);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'forbidden') {
        // Handled by state
      } else {
        toast.error(err instanceof Error ? err.message : 'Błąd wyszukiwania.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  // ── Action handler ─────────────────────────────────────────────────────────

  const handleAction = async (action: ActionType, label: string) => {
    if (!adminData?.user) return;

    const trimmedReason = reason.trim();
    if (trimmedReason.length < 3) {
      toast.error('Powód zmiany jest wymagany (minimum 3 znaki).');
      return;
    }

    if (action === 'set_free') {
      const confirmed = window.confirm(
        'Ta akcja ustawi konto użytkownika jako Free. Kontynuować?'
      );
      if (!confirmed) return;
    }

    setIsUpdatingPlan(true);

    try {
      const result = await callAdminFunction({
        action,
        userId: adminData.user.id,
        reason: trimmedReason,
      });

      if (result.success && result.user) {
        toast.success(`✓ ${label} — plan został zaktualizowany.`);

        // Refresh data to get new audit logs
        const refreshResult = await callAdminFunction({ action: 'search_user', email: adminData.user.email });
        if (refreshResult.user) {
          setAdminData({
            user: refreshResult.user as AdminUserProfile,
            auditLogs: refreshResult.auditLogs as AdminPlanAction[] ?? [],
            usageEvents: refreshResult.usageEvents as AdminUsageEvent[] ?? []
          });
        } else {
           setAdminData(prev => prev ? { ...prev, user: result.user as AdminUserProfile } : null);
        }

        setReason(''); // wyczyść powód po sukcesie
      } else {
        throw new Error('Nieoczekiwana odpowiedź z serwera.');
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'forbidden') {
        toast.error('Nie masz uprawnień administratora.');
      } else {
        toast.error(err instanceof Error ? err.message : 'Błąd podczas aktualizacji planu.');
      }
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300 pb-12">

      {/* Header */}
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Panel administratora</h1>
            <p className="text-sm text-muted-foreground">
              Zarządzanie użytkownikami, planami i audytem
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            Zalogowany jako: <strong>{user?.email}</strong>.
            Każda operacja jest zapisywana w logu audytowym.
          </span>
        </div>
      </header>

      {/* Forbidden state */}
      {isForbidden && (
        <div className="flex items-start gap-3 p-5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
          <ShieldOff className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300">
              Nie masz uprawnień administratora.
            </p>
            <p className="text-sm text-red-700 dark:text-red-400 mt-1">
              Twój adres e-mail nie jest na liście administratorów.
              Skontaktuj się z właścicielem projektu.
            </p>
          </div>
        </div>
      )}

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Wyszukaj użytkownika
          </CardTitle>
          <CardDescription>
            Wpisz dokładny adres e-mail, aby zobaczyć profil, plany i historię.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              id="admin-search-email"
              type="email"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              placeholder="email@uzytkownika.pl"
              autoComplete="off"
              className="flex-1"
            />
            <Button
              id="admin-search-btn"
              type="submit"
              disabled={isSearching}
              className="min-w-[120px]"
            >
              {isSearching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              Szukaj
            </Button>
          </form>

          {notFound && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-4">
              <User className="w-4 h-4" />
              Nie znaleziono użytkownika o podanym adresie e-mail.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Found User Section */}
      {adminData?.user && (() => {
        const foundUser = adminData.user;
        const expired = isPlanExpired(foundUser.plan, foundUser.plan_expires_at);
        const effectiveLabel = getEffectivePlanLabel(foundUser.plan, foundUser.plan_expires_at);
        const isFamily = foundUser.plan === 'family';

        return (
          <div className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* User Details Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <User className="w-5 h-5" />
                    Szczegóły użytkownika
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">E-mail</p>
                    <p className="font-medium break-all">{foundUser.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Status planu</p>
                    <div className="flex items-center gap-2">
                      <Badge variant={expired || foundUser.plan === 'free' ? 'secondary' : 'default'} className={foundUser.plan === 'premium' ? 'bg-indigo-600 hover:bg-indigo-600' : foundUser.plan === 'family' ? 'bg-violet-600 hover:bg-violet-600' : ''}>
                        {getPlanLabel(foundUser.plan)}
                        {expired && ' (wygasły)'}
                      </Badge>
                      {expired && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                          Efektywnie: {effectiveLabel}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> Ważny do
                      </p>
                      <p className={`text-sm font-medium ${expired ? 'text-red-600' : ''}`}>
                        {foundUser.plan_expires_at ? formatDate(foundUser.plan_expires_at) : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Ostatnia zmiana</p>
                      <p className="text-sm font-medium">
                        {formatDate(foundUser.plan_updated_at)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Plan Actions Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Crown className="w-5 h-5" />
                    Akcje planu
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex justify-between items-center">
                      <span className="flex items-center gap-1.5"><FileText className="w-4 h-4"/> Powód zmiany</span>
                      <span className={`text-xs ${reason.length > 500 ? 'text-red-500' : 'text-muted-foreground'}`}>{reason.length}/500</span>
                    </label>
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Wymagane: np. płatność ręczna, wsparcie, test (min. 3 znaki)"
                      className="resize-none"
                      rows={2}
                      maxLength={500}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="default"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={() => handleAction('activate_premium_30', 'Aktywuj Premium')}
                      disabled={isUpdatingPlan || reason.trim().length < 3}
                    >
                      Aktywuj Premium 30d
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleAction('extend_premium_30', 'Przedłuż Premium')}
                      disabled={isUpdatingPlan || reason.trim().length < 3}
                    >
                      Przedłuż Premium 30d
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleAction('activate_family_30', 'Aktywuj Family')}
                      disabled={isUpdatingPlan || reason.trim().length < 3}
                    >
                      Aktywuj Family 30d
                    </Button>

                    {isFamily ? (
                      <div className="col-span-1" title="Family plan downgrade requires cascade cleanup. (Sprint 24B)">
                        <Button
                          variant="destructive"
                          disabled={true}
                          className="w-full"
                        >
                          Ustaw Free
                        </Button>
                        <p className="text-[10px] text-muted-foreground mt-1 text-center leading-tight">
                          Zablokowane dla Family (Sprint 24B)
                        </p>
                      </div>
                    ) : (
                      <Button
                        variant="destructive"
                        onClick={() => handleAction('set_free', 'Ustaw Free')}
                        disabled={isUpdatingPlan || reason.trim().length < 3}
                      >
                        Ustaw Free
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Audit Logs Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <History className="w-5 h-5" />
                    Historia operacji (Ostatnie 10)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {adminData.auditLogs.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Akcja</TableHead>
                            <TableHead>Powód</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {adminData.auditLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(log.created_at)}</TableCell>
                              <TableCell className="text-xs font-medium">{log.action_type}</TableCell>
                              <TableCell className="text-xs">{log.reason || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Brak historii operacji.</p>
                  )}
                </CardContent>
              </Card>

              {/* Usage Events Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Activity className="w-5 h-5" />
                    Użycie AI (Ostatnie 10)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {adminData.usageEvents.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Zdarzenie</TableHead>
                            <TableHead>Wartość</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {adminData.usageEvents.map((evt) => (
                            <TableRow key={evt.id}>
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(evt.created_at)}</TableCell>
                              <TableCell className="text-xs font-medium">{evt.event_type}</TableCell>
                              <TableCell className="text-xs">{evt.value}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Brak zarejestrowanego użycia AI.</p>
                  )}
                </CardContent>
              </Card>
            </div>

          </div>
        );
      })()}
    </div>
  );
}
