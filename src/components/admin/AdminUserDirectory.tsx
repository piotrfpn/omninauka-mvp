import { useEffect, useState } from 'react';
import { Loader2, Search, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

type BusinessType = 'parent' | 'child_under_13' | 'student' | 'unknown';
interface DirectoryUser {
  userId: string; email: string | null; name: string | null; createdAt: string | null;
  businessType: BusinessType; rawUserRole: string | null; ageBand: string | null; accountStatus: string | null;
  ownPlan: string | null; effectivePlan: string; planSource: string; planExpiresAt: string | null;
  sourcePlanExpiresAt: string | null; parent: { userId: string; name: string | null; email: string | null } | null;
  linkedChildrenCount: number; pendingChildrenCount: number; relationStatus: string | null;
}
interface DirectoryResponse {
  users: DirectoryUser[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  summary: { totalProfiles: number; parents: number; childrenUnder13: number; unknownRoleProfiles: number };
}
interface AccountIssue {
  issueType: 'missing_profile' | 'unknown_role'; userId: string; email: string | null;
  name?: string | null; createdAt: string | null; lastSignInAt?: string | null;
}
interface IssuesResponse {
  issues: AccountIssue[];
  summary: { missingProfiles: number; unknownRoleProfiles: number; totalIssues: number };
  scanTruncated: boolean;
}
interface Props {
  callAdminFunction: (body: Record<string, unknown>) => Promise<unknown>;
  onSelectUser: (userId: string) => void;
}

const typeLabels: Record<BusinessType, string> = {
  parent: 'Rodzic', child_under_13: 'Dziecko <13', student: 'Uczeń', unknown: 'Nieokreślony',
};
// Matches the existing AccountStatus contract; unknown values remain visible.
const statusLabels: Record<string, { label: string; tone: string }> = {
  active: { label: 'Aktywne', tone: 'text-emerald-700 dark:text-emerald-400' },
  parent_approved: { label: 'Zgoda rodzica zatwierdzona', tone: 'text-emerald-700 dark:text-emerald-400' },
  pending_parent_consent: { label: 'Oczekuje na zgodę rodzica', tone: 'text-amber-700 dark:text-amber-400' },
  pending_parent_preapproval: { label: 'Oczekuje na połączenie z rodzicem', tone: 'text-amber-700 dark:text-amber-400' },
  expired_pending_preapproval: { label: 'Oczekiwanie wygasło', tone: 'text-muted-foreground' },
  suspended: { label: 'Zawieszone', tone: 'text-destructive' },
  parent_withdrawn: { label: 'Zgoda rodzica cofnięta', tone: 'text-destructive' },
};
const planLabels: Record<string, string> = { free: 'Darmowy', premium: 'Premium', family: 'Rodzinny' };

function dateLabel(value: string | null) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleDateString('pl-PL') : '—';
}
function UserIdentity({ user }: { user: { name?: string | null; email: string | null } }) {
  return <div className="min-w-0 break-words"><p className="font-medium">{user.name?.trim() || user.email || 'Bez nazwy'}</p>
    {user.name?.trim() && <p className="text-xs text-muted-foreground break-all">{user.email || '—'}</p>}</div>;
}
function Status({ value }: { value: string | null }) {
  const known = value ? statusLabels[value] : null;
  return <Badge variant="outline" className={`whitespace-normal ${known?.tone ?? 'text-muted-foreground'}`}>{known?.label ?? value ?? '—'}</Badge>;
}
function Plan({ user }: { user: DirectoryUser }) {
  const expired = ['premium', 'family'].includes(user.ownPlan ?? '') && user.effectivePlan === 'free'
    && user.planExpiresAt !== null && Number.isFinite(Date.parse(user.planExpiresAt));
  return <div><p>{planLabels[user.effectivePlan] ?? user.effectivePlan}</p>
    {user.planSource === 'parent_family' && <p className="text-xs text-muted-foreground">od rodzica</p>}
    <p className="text-xs text-muted-foreground">Własny: {planLabels[user.ownPlan ?? ''] ?? user.ownPlan ?? '—'}</p>
    {expired && user.effectivePlan === 'free' && <p className="text-xs text-muted-foreground">własny plan wygasł</p>}</div>;
}
function Relation({ user }: { user: DirectoryUser }) {
  if (user.businessType === 'parent') return <div className="text-xs"><p>Połączone: {user.linkedChildrenCount}</p><p>Oczekujące: {user.pendingChildrenCount}</p></div>;
  if (user.businessType === 'child_under_13') return <span>{user.parent ? `Rodzic: ${user.parent.name || user.parent.email || 'Bez nazwy'}` : 'Brak powiązania'}</span>;
  return <span>—</span>;
}

export default function AdminUserDirectory({ callAdminFunction, onSelectUser }: Props) {
  const [searchDraft, setSearchDraft] = useState('');
  const [criteria, setCriteria] = useState({ search: '', typeFilter: 'all', ownPlanFilter: 'all', statusFilter: 'all', page: 1 });
  const [mode, setMode] = useState<'directory' | 'attention'>('directory');
  const [directory, setDirectory] = useState<DirectoryResponse | null>(null);
  const [attention, setAttention] = useState<IssuesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [attentionLoading, setAttentionLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attentionError, setAttentionError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const result = await callAdminFunction({ action: 'list_users', ...criteria, pageSize: 25 }) as DirectoryResponse;
        if (!cancelled) setDirectory(result);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [callAdminFunction, criteria, retry]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setAttentionLoading(true);
      setAttentionError(false);
      try {
        const result = await callAdminFunction({ action: 'list_account_issues' }) as IssuesResponse;
        if (!cancelled) setAttention(result);
      } catch {
        if (!cancelled) setAttentionError(true);
      } finally {
        if (!cancelled) setAttentionLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [callAdminFunction, retry]);

  const updateFilter = (key: 'typeFilter' | 'ownPlanFilter' | 'statusFilter', value: string) => {
    setCriteria(previous => ({ ...previous, [key]: value, page: 1 }));
  };
  const summary = directory?.summary;
  const busy = mode === 'directory' ? loading : attentionLoading;
  const failed = mode === 'directory' ? error : attentionError;
  const details = (userId: string) => <Button variant="outline" className="min-h-11" onClick={() => onSelectUser(userId)}>Szczegóły</Button>;

  return <section className="space-y-5" aria-label="Katalog użytkowników">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Profile użytkowników</p><p className="text-2xl font-semibold">{summary?.totalProfiles ?? '—'}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Rodzice</p><p className="text-2xl font-semibold">{summary?.parents ?? '—'}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Dzieci &lt;13</p><p className="text-2xl font-semibold">{summary?.childrenUnder13 ?? '—'}</p></CardContent></Card>
      <Button variant="outline" className="h-auto min-h-24 justify-start p-4 text-left whitespace-normal" onClick={() => setMode('attention')} aria-pressed={mode === 'attention'}>
        <div><p>Wymaga uwagi {attention?.scanTruncated && '⚠'}</p><p className="text-2xl font-semibold">{attentionLoading || attentionError ? '—' : attention?.summary.totalIssues ?? '—'}</p></div>
      </Button>
    </div>

    {mode === 'attention' ? <div className="space-y-4">
      <Button variant="outline" className="min-h-11" onClick={() => setMode('directory')}>Powrót do profili</Button>
      <h2 className="text-lg font-semibold">Problemy danych / kont wymagające sprawdzenia</h2>
      {attention?.scanTruncated && <p role="status" className="text-sm text-amber-700 dark:text-amber-400 flex gap-2"><AlertTriangle className="h-5 w-5 shrink-0" />Wynik może być niepełny — osiągnięto limit skanowania.</p>}
      {attention && !attentionLoading && !attentionError && <p className="text-sm text-muted-foreground">Brak profilu: {attention.summary.missingProfiles} · Nieokreślona rola: {attention.summary.unknownRoleProfiles}{attention.scanTruncated ? ' (wynik częściowy)' : ''}</p>}
    </div> : <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={event => {
      event.preventDefault();
      setCriteria(previous => ({ ...previous, search: searchDraft.trim(), page: 1 }));
    }}>
      <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap gap-2">
        <label htmlFor="directory-search" className="sr-only">Szukaj po nazwie lub e-mailu</label>
        <Input id="directory-search" className="flex-1 min-w-40 min-h-11" maxLength={100} value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="Szukaj po nazwie lub e-mailu" />
        <Button type="submit" className="min-h-11"><Search className="h-4 w-4 mr-2" />Szukaj</Button>
      </div>
      <label className="text-sm space-y-1">Typ użytkownika<select className="flex w-full min-h-11 rounded-md border bg-background px-3" value={criteria.typeFilter} onChange={event => updateFilter('typeFilter', event.target.value)}>
        <option value="all">Wszystkie typy</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label className="text-sm space-y-1">Plan własny<select className="flex w-full min-h-11 rounded-md border bg-background px-3" value={criteria.ownPlanFilter} onChange={event => updateFilter('ownPlanFilter', event.target.value)}>
        <option value="all">Wszystkie plany</option>{Object.entries(planLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label className="text-sm space-y-1">Status konta<select className="flex w-full min-h-11 rounded-md border bg-background px-3" value={criteria.statusFilter} onChange={event => updateFilter('statusFilter', event.target.value)}>
        <option value="all">Wszystkie statusy</option>{Object.entries(statusLabels).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
    </form>}

    {busy ? <div role="status" className="flex justify-center items-center gap-2 py-12"><Loader2 className="h-5 w-5 animate-spin" />Ładuję użytkowników...</div>
      : failed ? <div role="alert" className="space-y-3 py-8 text-center"><p>Nie udało się pobrać listy użytkowników. Spróbuj ponownie za chwilę.</p><Button variant="outline" onClick={() => setRetry(previous => previous + 1)}>Spróbuj ponownie</Button></div>
      : mode === 'attention' ? <div className="space-y-3">
        {!attention?.issues.length && <p className="text-center py-10 text-muted-foreground">Brak kont wymagających uwagi.</p>}
        {attention?.issues.map(issue => <Card key={`${issue.issueType}:${issue.userId}`}><CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div><UserIdentity user={issue} /><p className="text-sm text-muted-foreground">{issue.issueType === 'missing_profile' ? 'Brak profilu' : 'Nieokreślona rola'} · Utworzono: {dateLabel(issue.createdAt)}</p>
            {issue.issueType === 'missing_profile' && <p className="text-xs text-muted-foreground">Ostatnie logowanie: {dateLabel(issue.lastSignInAt ?? null)}</p>}</div>
          {issue.issueType === 'unknown_role' && details(issue.userId)}
        </CardContent></Card>)}
      </div> : <>
        {!directory?.users.length ? <p className="text-center py-10 text-muted-foreground">{directory?.summary.totalProfiles === 0 ? 'Brak profili użytkowników.' : 'Brak użytkowników spełniających kryteria.'}</p> : <>
          <div className="hidden md:block rounded-lg border [&_[data-slot=table-container]]:overflow-visible">
            <Table className="table-fixed"><TableHeader><TableRow>
              <TableHead className="w-1/5">Użytkownik</TableHead><TableHead>Typ</TableHead><TableHead>Status</TableHead><TableHead>Plan</TableHead><TableHead>Relacja</TableHead><TableHead>Utworzono</TableHead><TableHead>Akcja</TableHead>
            </TableRow></TableHeader><TableBody>{directory.users.map(user => <TableRow key={user.userId} className="[&>td]:whitespace-normal [&>td]:break-words">
              <TableCell><UserIdentity user={user} /></TableCell><TableCell><Badge variant="outline" className="whitespace-normal">{typeLabels[user.businessType]}</Badge></TableCell>
              <TableCell><Status value={user.accountStatus} /></TableCell><TableCell><Plan user={user} /></TableCell><TableCell><Relation user={user} /></TableCell><TableCell className="text-xs">{dateLabel(user.createdAt)}</TableCell><TableCell>{details(user.userId)}</TableCell>
            </TableRow>)}</TableBody></Table>
          </div>
          <div className="md:hidden space-y-3">{directory.users.map(user => <Card key={user.userId}><CardContent className="p-4 space-y-3">
            <UserIdentity user={user} /><div className="flex flex-wrap gap-2"><Badge variant="outline">{typeLabels[user.businessType]}</Badge><Status value={user.accountStatus} /></div>
            <Plan user={user} /><div className="text-sm break-words"><Relation user={user} /></div><p className="text-xs text-muted-foreground">Utworzono: {dateLabel(user.createdAt)}</p>{details(user.userId)}
          </CardContent></Card>)}</div>
        </>}
        <nav aria-label="Strony katalogu" className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="outline" className="min-h-11" disabled={criteria.page <= 1} onClick={() => setCriteria(previous => ({ ...previous, page: previous.page - 1 }))}>Poprzednia</Button>
          <span className="text-sm">Strona {criteria.page} z {Math.max(1, directory?.pagination.totalPages ?? 1)}</span>
          <Button variant="outline" className="min-h-11" disabled={criteria.page >= (directory?.pagination.totalPages ?? 0)} onClick={() => setCriteria(previous => ({ ...previous, page: previous.page + 1 }))}>Następna</Button>
        </nav>
      </>}
  </section>;
}
