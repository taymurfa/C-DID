'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { getCurrentUser, login, User } from '@/lib/auth';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/AppLayout';
import { OKRDetailView } from '@/components/modal/OKRDetailView';
import { ShortcutHelp } from '@/components/shared/ShortcutHelp';
import { api, Objective, KeyResult } from '@/lib/api';
import { useViewRole } from '@/lib/ViewRoleContext';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Link2, HelpCircle, Share2, Send } from 'lucide-react';

export default function ObjectiveDetailPage() {
  const { effectiveRole, userForPermissions } = useViewRole();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [objective, setObjective] = useState<Objective | null>(null);
  const [keyResults, setKeyResults] = useState<KeyResult[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [shareLinkUrl, setShareLinkUrl] = useState<string | null>(null);
  const [shareCreating, setShareCreating] = useState(false);
  const [postingUpdate, setPostingUpdate] = useState(false);
  const [ancestors, setAncestors] = useState<Array<{ _id: string; title: string }>>([]);
  const loadingRef = useRef(false);
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const tabFromUrl = searchParams.get('tab');

  const persistDetailTabToUrl = useCallback(
    (tab: 'overview' | 'progress' | 'updates' | 'history' | 'dependencies' | 'files') => {
      const q = new URLSearchParams(searchParams.toString());
      q.set('tab', tab);
      router.replace(`/okrs/${id}?${q.toString()}`, { scroll: false });
    },
    [router, id, searchParams]
  );

  useEffect(() => {
    loadUser();
  }, []);

  const loadObjective = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const data = await api.getObjective(id);
      if (data && typeof data === 'object' && 'unchanged' in data) return;
      setObjective(data as Objective);
    } catch (err) {
      console.error('Failed to load objective:', err);
      router.push('/okrs');
    } finally {
      loadingRef.current = false;
    }
  }, [id, router]);

  const loadKeyResults = useCallback(async () => {
    try {
      const data = await api.getKeyResults(id);
      setKeyResults(data);
    } catch {
      setKeyResults([]);
    }
  }, [id]);

  useEffect(() => {
    if (user && id) {
      loadObjective();
      loadKeyResults();
    }
  }, [user, id, loadObjective, loadKeyResults]);

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      try {
        const chain = await api.getObjectiveAncestors(id);
        setAncestors(chain || []);
      } catch {
        setAncestors([]);
      }
    })();
  }, [user, id]);

  // Presence: register view, heartbeat, leave on unmount
  useEffect(() => {
    if (!id || !user) return;
    let mounted = true;
    const tick = async () => {
      try {
        const res = await api.postView(id, { userName: user.name || user.email || undefined });
        if (mounted) setViewerCount(res.count);
      } catch {
        if (mounted) setViewerCount(0);
      }
    };
    tick();
    const heartbeat = setInterval(tick, 28000);
    return () => {
      mounted = false;
      clearInterval(heartbeat);
      api.leaveView(id).catch(() => {});
    };
  }, [id, user]);

  // Live polling: every 60s, and only when tab is visible (avoid spamming backend in background)
  useEffect(() => {
    if (!id || !objective) return;
    const since = objective.updatedAt ?? undefined;
    const poll = async () => {
      if (loadingRef.current || typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const objResult = await api.getObjective(id, since ? { since } : undefined);
        if (objResult && typeof objResult === 'object' && 'unchanged' in objResult) return;
        const obj = objResult as Objective;
        const krs = await api.getKeyResults(id);
        setObjective(obj);
        setKeyResults(krs);
      } catch {
        // ignore
      }
    };
    const interval = setInterval(poll, 60000);
    const onVisible = () => { poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [id, objective?.updatedAt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (shortcutHelpOpen) setShortcutHelpOpen(false);
        else router.push('/okrs');
      }
      const isHelpKey = e.key === '?' || (e.key === '/' && e.shiftKey);
      if (isHelpKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setShortcutHelpOpen((open) => !open);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, shortcutHelpOpen]);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        await login();
        return;
      }
      setUser(currentUser);
    } catch (error) {
      console.error('Error loading user:', error);
      await login();
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !user) {
    return (
      <AppLayout title="Objective" description="View and manage objective details">
        <div className="text-center text-muted-foreground">Loading...</div>
      </AppLayout>
    );
  }

  if (!objective) return null;

  return (
    <AppLayout
      title={objective.title}
      description={`${objective.level} objective`}
    >
      <div className="space-y-4">
        {ancestors.length > 1 && (
          <div className="text-sm text-muted-foreground">
            {ancestors.map((a, idx) => {
              const isLast = idx === ancestors.length - 1;
              return (
                <span key={a._id}>
                  {!isLast ? (
                    <>
                      <Link href={`/okrs/${a._id}`} className="hover:underline text-foreground/80">
                        {a.title}
                      </Link>
                      <span className="mx-2">/</span>
                    </>
                  ) : (
                    <span className="text-foreground">{a.title}</span>
                  )}
                </span>
              );
            })}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/my-okrs">Back to My OKRs</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/okrs">Back to OKRs</Link>
          </Button>
          {objective.level === 'strategic' && objective._id && (
            <Button variant="outline" asChild>
              <Link href={`/okrs/tree/${objective._id}`}>Roll-up view</Link>
            </Button>
          )}
          {id && (
            <>
              <Button
                variant="outline"
                size="icon"
                disabled={shareCreating}
                onClick={async () => {
                  setShareCreating(true);
                  try {
                    const res = await api.createShareLink(id);
                    setShareLinkUrl(res.url);
                    await navigator.clipboard.writeText(res.url);
                  } catch (e) {
                    console.error('Create share link failed', e);
                  } finally {
                    setShareCreating(false);
                  }
                }}
                aria-label="Create shareable link"
                title="Create shareable link (copy to clipboard)"
              >
                <Share2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={postingUpdate}
                onClick={async () => {
                  if (!id) return;
                  setPostingUpdate(true);
                  try {
                    await api.postUpdateToChannel(id);
                    alert('Update posted to your configured channel.');
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'Failed to post update');
                  } finally {
                    setPostingUpdate(false);
                  }
                }}
                aria-label="Post update to Slack/Teams"
                title="Post update to Slack/Teams"
              >
                <Send className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/okrs/${id}`;
                  navigator.clipboard.writeText(url).then(() => {}).catch(() => {});
                }}
                aria-label="Copy link"
                title="Copy link"
              >
                <Link2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShortcutHelpOpen(true)}
                aria-label="Keyboard shortcuts"
                title="Shortcuts (?)"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            </>
          )}
          {viewerCount > 1 && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              {viewerCount - 1} other{viewerCount - 1 !== 1 ? 's' : ''} viewing
            </span>
          )}
          {shareLinkUrl && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Share link copied.</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShareLinkUrl(null)}
                aria-label="Dismiss"
              >
                Dismiss
              </Button>
            </div>
          )}
        </div>
        <ShortcutHelp open={shortcutHelpOpen} onClose={() => setShortcutHelpOpen(false)} />
        <OKRDetailView
          objective={objective}
          keyResults={keyResults}
          onObjectiveUpdate={setObjective}
          onKeyResultsUpdate={() => {
            loadKeyResults();
          }}
          user={userForPermissions ?? user}
          effectiveRole={effectiveRole}
          viewerCount={viewerCount}
          urlTab={tabFromUrl}
          onPersistTabToUrl={persistDetailTabToUrl}
        />
      </div>
    </AppLayout>
  );
}
