import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import {
  Search, Shield, ShieldOff, AlertTriangle, Loader2,
  User, Calendar, Crown, FileText, Activity, History, Users, Inbox
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import {
  AlertDialog,

  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';

// ── Types ──────────────────────────────────────────────────────────────────────

interface AdminUserProfile {
  id: string;
  email: string;
  name?: string;
  plan: 'free' | 'premium' | 'family';
  plan_expires_at: string | null;
  plan_updated_at: string | null;
  created_at?: string | null;
  user_role?: string;
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

interface AdminChild {
  id: string;
  status: string;
  child_user_id: string | null;
  child_email: string;
  display_name: string;
  created_at: string;
  plan: string;
  account_status: string;
}

interface AdminConsent {
  id: string;
  consent_status: string;
  child_user_id: string;
  parent_email: string;
  last_email_sent_at: string | null;
  email_send_count: number | null;
  email_last_status: string | null;
  email_last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface AdminData {
  user: AdminUserProfile | null;
  auditLogs: AdminPlanAction[];
  usageEvents: AdminUsageEvent[];
  familyChildren: AdminChild[];
  parentalConsents: AdminConsent[];
}

type ActionType = 'extend_premium_30' | 'extend_family_30' | 'set_free';

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

  // Admin Check State
  const [isAdminChecked, setIsAdminChecked] = useState(false);
  const [isForbidden, setIsForbidden] = useState(false);
  const [newTicketsCount, setNewTicketsCount] = useState(0);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<AdminUserProfile[] | null>(null);

  // Data state
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Action state
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);
  const [reason, setReason] = useState('');

  // Modal State
  const [actionModal, setActionModal] = useState<{ isOpen: boolean; action: ActionType | null; label: string }>({
    isOpen: false,
    action: null,
    label: '',
  });

  // ── Initial Check ─────────────────────────────────────────────────────────

  useEffect(() => {
    let isMounted = true;
    if (!user) {
      setIsForbidden(true);
      setIsAdminChecked(true);
      return;
    }

    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (isMounted) { setIsForbidden(true); setIsAdminChecked(true); }
          return;
        }

        const response = await fetch(FUNCTION_URL_BASE, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'check_admin' }),
        });

        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            setIsForbidden(!data.isAdmin);
            if (data.isAdmin) {
              try {
                const countRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-inbox`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ action: 'count_new_tickets' }),
                });
                if (countRes.ok) {
                  const countData = await countRes.json();
                  if (isMounted) setNewTicketsCount(countData.count || 0);
                }
              } catch (e) {
                console.error('Błąd pobierania licznika zgłoszeń', e);
              }
            }
          }
        } else {
          if (isMounted) setIsForbidden(true);
        }
      } catch {
        if (isMounted) setIsForbidden(true);
      } finally {
        if (isMounted) setIsAdminChecked(true);
      }
    };

    check();

    return () => { isMounted = false; };
  }, [user]);

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
    const q = searchQuery.trim();
    if (q.length < 3) {
      toast.error('Wpisz minimum 3 znaki.');
      return;
    }

    setIsSearching(true);
    setAdminData(null);
    setSearchResults(null);

    try {
      const result = await callAdminFunction({ action: 'search_user', query: q });
      setSearchResults(result.users || []);
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

  // ── User Selection ─────────────────────────────────────────────────────────

  const handleSelectUser = async (userId: string) => {
    setIsLoadingDetails(true);
    setAdminData(null);
    setReason('');

    try {
      const result = await callAdminFunction({ action: 'get_user_details', userId });
      setAdminData({
        user: result.user as AdminUserProfile,
        auditLogs: result.auditLogs as AdminPlanAction[] ?? [],
        usageEvents: result.usageEvents as AdminUsageEvent[] ?? [],
        familyChildren: result.familyChildren as AdminChild[] ?? [],
        parentalConsents: result.parentalConsents as AdminConsent[] ?? []
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'forbidden') {
        // handled
      } else {
        toast.error(err instanceof Error ? err.message : 'Błąd pobierania danych.');
      }
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // ── Action handler ─────────────────────────────────────────────────────────

  const handleOpenActionModal = (action: ActionType, label: string) => {
    if (!adminData?.user) return;
    setActionModal({ isOpen: true, action, label });
  };

  const confirmAction = async () => {
    if (!adminData?.user || !actionModal.action) return;

    const action = actionModal.action;
    const label = actionModal.label;
    const trimmedReason = reason.trim();

    if (trimmedReason.length < 3) {
      toast.error('Powód zmiany jest wymagany (minimum 3 znaki).');
      return;
    }

    setIsUpdatingPlan(true);
    setActionModal({ isOpen: false, action: null, label: '' });

    try {
      const result = await callAdminFunction({
        action,
        userId: adminData.user.id,
        reason: trimmedReason,
      });

      if (result.success && result.user) {
        toast.success(`✓ ${label} — plan został zaktualizowany.`);
        // Refresh full user data
        await handleSelectUser(adminData.user.id);
        setReason('');
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

  const handleResendConsent = async (consentId: string) => {
    if (!adminData?.user) return;

    const trimmedReason = reason.trim();
    if (trimmedReason.length < 3) {
      toast.error('Powód zmiany jest wymagany (minimum 3 znaki).');
      return;
    }

    setIsUpdatingPlan(true);

    try {
      const result = await callAdminFunction({
        action: 'resend_parent_consent_email',
        consentId,
        reason: trimmedReason,
      });

      if (result.success) {
        toast.success(`✓ E-mail zgody został wysłany ponownie.`);
        await handleSelectUser(adminData.user.id);
        setReason('');
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'forbidden') {
        toast.error('Nie masz uprawnień administratora.');
      } else {
        toast.error(err instanceof Error ? err.message : 'Błąd podczas wysyłania zgody.');
      }
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!isAdminChecked) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isForbidden) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300 pb-12 mt-8">
        <div className="flex items-start gap-3 p-5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
          <ShieldOff className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300">
              Brak dostępu do panelu administratora
            </p>
            <p className="text-sm text-red-700 dark:text-red-400 mt-1">
              Ta strona jest przeznaczona wyłącznie dla wyznaczonych administratorów systemu.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300 pb-12">

      {/* Header */}
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">Panel administratora</h1>
            <p className="text-sm text-muted-foreground">
              Zarządzanie użytkownikami, planami i audytem
            </p>
          </div>
          <Button asChild variant="outline" className="gap-2 relative">
            <Link to="/app/admin/support">
              <Inbox className="w-4 h-4" />
              Skrzynka zgłoszeń (Support)
              {newTicketsCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-sm">
                  {newTicketsCount}
                </span>
              )}
            </Link>
          </Button>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            Zalogowany jako: <strong>{user?.email}</strong>.
            Każda operacja jest zapisywana w logu audytowym.
          </span>
        </div>
      </header>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Wyszukaj użytkownika
          </CardTitle>
          <CardDescription>
            Szukaj po fragmencie e-maila lub nazwy (minimum 3 znaki).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              id="admin-search-query"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="np. tomek@gmail.com lub tomek"
              autoComplete="off"
              className="flex-1"
            />
            <Button
              id="admin-search-btn"
              type="submit"
              disabled={isSearching || searchQuery.trim().length < 3}
              className="min-w-[120px]"
            >
              {isSearching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              Szukaj
            </Button>
          </form>

          {searchResults && searchResults.length === 0 && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-4">
              <User className="w-4 h-4" />
              Brak wyników. Sprawdź wpisaną frazę.
            </p>
          )}

          {searchResults && searchResults.length > 0 && (
            <div className="mt-6 overflow-x-auto">
              <h4 className="text-sm font-semibold mb-3">
                Wyniki wyszukiwania ({searchResults.length})
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail / Nazwa</TableHead>
                    <TableHead>Rola</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Utworzono</TableHead>
                    <TableHead className="text-right">Akcja</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{u.email}</div>
                        {u.name && <div className="text-xs text-muted-foreground">{u.name}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {u.user_role || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {getPlanLabel(u.plan)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(u.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleSelectUser(u.id)}
                          disabled={isLoadingDetails}
                        >
                          {isLoadingDetails ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Wybierz'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Found User Section */}
      {adminData?.user && (() => {
        const foundUser = adminData.user;
        const expired = isPlanExpired(foundUser.plan, foundUser.plan_expires_at);
        const effectiveLabel = getEffectivePlanLabel(foundUser.plan, foundUser.plan_expires_at);

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
                    {foundUser.name && <p className="text-xs text-muted-foreground">{foundUser.name}</p>}
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
                      placeholder="Wymagane (min. 3 znaki)"
                      className="resize-none"
                      rows={2}
                      maxLength={500}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="default"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={() => handleOpenActionModal('extend_premium_30', 'Przedłuż Premium +30 dni')}
                      disabled={isUpdatingPlan || reason.trim().length < 3}
                    >
                      Premium +30 dni
                    </Button>
                    <Button
                      variant="default"
                      className="bg-violet-600 hover:bg-violet-700 text-white"
                      onClick={() => handleOpenActionModal('extend_family_30', 'Przedłuż Family +30 dni')}
                      disabled={isUpdatingPlan || reason.trim().length < 3}
                    >
                      Family +30 dni
                    </Button>

                    <Button
                      variant="destructive"
                      onClick={() => handleOpenActionModal('set_free', 'Ustaw Free')}
                      disabled={isUpdatingPlan || reason.trim().length < 3}
                      className="col-span-2"
                    >
                      Ustaw Free
                    </Button>
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* Family & Consents Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="w-5 h-5" />
                  Family i zgody rodzicielskie
                </CardTitle>
                <CardDescription>
                  Podgląd relacji parent-child oraz statusów zgód na przetwarzanie danych.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {adminData.familyChildren.length === 0 && adminData.parentalConsents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Brak powiązanych dzieci lub zgód rodzicielskich dla tego użytkownika.</p>
                ) : (
                  <div className="space-y-6">
                    {/* Sekcja Dzieci */}
                    {adminData.familyChildren.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          Dzieci powiązane z tym kontem <Badge variant="outline">{adminData.familyChildren.length}</Badge>
                        </h4>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Imię</TableHead>
                                <TableHead>E-mail</TableHead>
                                <TableHead>Status Konta</TableHead>
                                <TableHead>Relacja</TableHead>
                                <TableHead>Plan</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {adminData.familyChildren.map((child) => (
                                <TableRow key={child.id}>
                                  <TableCell className="text-xs font-medium">{child.display_name}</TableCell>
                                  <TableCell className="text-xs">{child.child_email}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                                      {child.account_status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={child.status === 'active' || child.status === 'linked' ? 'default' : 'secondary'} className="text-[10px]">
                                      {child.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-[10px]">
                                      {child.plan}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {/* Sekcja Zgód */}
                    {adminData.parentalConsents.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          Zgody na przetwarzanie danych (RODO) <Badge variant="outline">{adminData.parentalConsents.length}</Badge>
                        </h4>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Status Zgody</TableHead>
                                <TableHead>E-mail Rodzica</TableHead>
                                <TableHead>Wysłane e-maile</TableHead>
                                <TableHead>Ostatnia wysyłka</TableHead>
                                <TableHead>Status E-mail</TableHead>
                                <TableHead className="text-right">Akcje</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {adminData.parentalConsents.map((consent) => (
                                <TableRow key={consent.id}>
                                  <TableCell>
                                    <Badge variant={consent.consent_status === 'approved' ? 'default' : 'secondary'} className={consent.consent_status === 'approved' ? 'bg-green-600 hover:bg-green-700 text-white' : 'text-[10px]'}>
                                      {consent.consent_status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs">{consent.parent_email}</TableCell>
                                  <TableCell className="text-xs text-center">{consent.email_send_count || 0}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{formatDate(consent.last_email_sent_at)}</TableCell>
                                  <TableCell>
                                    {consent.email_last_status && (
                                      <Badge variant="outline" className={`text-[10px] ${consent.email_last_status === 'success' ? 'text-green-600 border-green-200' : 'text-red-600 border-red-200'}`}>
                                        {consent.email_last_status}
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {consent.consent_status === 'pending' && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleResendConsent(consent.id)}
                                        disabled={isUpdatingPlan || reason.trim().length < 3}
                                      >
                                        Wyślij ponownie
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <p className="text-xs text-muted-foreground mt-3">
                          Link zgody zostanie wysłany ponownie na e-mail rodzica. Token nie jest pokazywany w panelu administratora. Wymaga podania powodu w formularzu powyżej.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Audit Logs Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <History className="w-5 h-5" />
                    Historia operacji (Ostatnie 20)
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
                    Użycie AI (Ostatnie 20)
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

            {/* Action Modal */}
            <AlertDialog open={actionModal.isOpen} onOpenChange={(isOpen) => { if(!isOpen) setActionModal({ isOpen: false, action: null, label: '' }); }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Potwierdzenie zmiany planu</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3 mt-4 text-sm text-foreground">
                      <div className="grid grid-cols-2 gap-2 bg-muted p-3 rounded-lg">
                        <span className="text-muted-foreground">Użytkownik:</span>
                        <span className="font-medium text-right">{foundUser.email}</span>
                        <span className="text-muted-foreground">Aktualny plan:</span>
                        <span className="font-medium text-right">{getPlanLabel(foundUser.plan)}</span>
                        <span className="text-muted-foreground">Ważny do:</span>
                        <span className="font-medium text-right">{foundUser.plan_expires_at ? formatDate(foundUser.plan_expires_at) : '—'}</span>
                      </div>

                      {actionModal.action === 'set_free' && (
                        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg border border-red-200 dark:border-red-800">
                          <AlertTriangle className="w-4 h-4 inline mr-2" />
                          <strong>Uwaga!</strong> Ta operacja natychmiastowo zmieni plan użytkownika na <strong>Darmowy</strong> i wyczyści całkowicie datę wygaśnięcia.
                        </div>
                      )}

                      {(actionModal.action === 'extend_premium_30' || actionModal.action === 'extend_family_30') && (
                        <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 p-3 rounded-lg border border-green-200 dark:border-green-800">
                          Operacja bezpiecznie <strong>przedłuży plan o 30 dni</strong> (od dzisiaj lub od obecnej daty wygaśnięcia, zależy co jest późniejsze).
                        </div>
                      )}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Anuluj</AlertDialogCancel>
                  <Button
                    onClick={confirmAction}
                    disabled={isUpdatingPlan}
                    variant={actionModal.action === 'set_free' ? 'destructive' : 'default'}
                  >
                    {actionModal.action === 'set_free' ? 'Tak, ustaw Free' : `Tak, przedłuż o 30 dni`}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

          </div>
        );
      })()}
    </div>
  );
}
