'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api, type Objective, type Comment, type WorkflowEvent } from '@/lib/api';
import { MessageSquare, GitBranch, User, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

const ACTIVITY_PREVIEW = 5;

interface UpdatesTabProps {
  objective: Objective;
  readOnly?: boolean;
  /** When >0 and this tab is active, periodically refetch comments and workflow (soft real-time). */
  refreshIntervalMs?: number;
}

type FeedItem =
  | { type: 'comment'; id: string; authorId: string; body: string; createdAt: string }
  | { type: 'workflow'; id: string; fromStatus: string; toStatus: string; actorId: string; reason?: string; timestamp: string };

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function displayActor(id: string) {
  if (!id) return 'Someone';
  if (id.includes('|')) return id.split('|').pop() ?? id;
  return id.slice(0, 8) + '…';
}

export function UpdatesTab({ objective, readOnly, refreshIntervalMs = 0 }: UpdatesTabProps) {
  const objectiveId = objective._id;
  const [comments, setComments] = useState<Comment[]>([]);
  const [workflow, setWorkflow] = useState<WorkflowEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBody, setNewBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!objectiveId) return;
      if (!silent) setLoading(true);
      try {
        const [c, w] = await Promise.all([
          api.getComments(objectiveId),
          api.getWorkflowHistory(objectiveId),
        ]);
        setComments(c);
        setWorkflow(w);
      } catch (e) {
        console.error(e);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [objectiveId]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    if (!objectiveId || refreshIntervalMs <= 0) return;
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      load(true);
    }, refreshIntervalMs);
    return () => clearInterval(id);
  }, [objectiveId, refreshIntervalMs, load]);

  const feed: FeedItem[] = [
    ...comments.map((x) => ({
      type: 'comment' as const,
      id: x._id ?? '',
      authorId: x.authorId,
      body: x.body,
      createdAt: x.createdAt,
    })),
    ...workflow.map((x) => ({
      type: 'workflow' as const,
      id: x._id ?? '',
      fromStatus: x.fromStatus,
      toStatus: x.toStatus,
      actorId: x.actorId,
      reason: x.reason,
      timestamp: x.timestamp,
    })),
  ].sort((a, b) => {
    const tA = a.type === 'comment' ? a.createdAt : a.timestamp;
    const tB = b.type === 'comment' ? b.createdAt : b.timestamp;
    return new Date(tB).getTime() - new Date(tA).getTime();
  });

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objectiveId || !newBody.trim() || submitting) return;
    setSubmitting(true);
    try {
      await api.createComment(objectiveId, newBody.trim());
      setNewBody('');
      await load();
      toast.success('Comment posted');
    } catch (e) {
      console.error(e);
      toast.error('Could not post comment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Updates</CardTitle>
          <p className="text-sm text-muted-foreground">
            Comments and status changes in chronological order. Activity refreshes periodically while this tab is open.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!readOnly && (
            <form onSubmit={handleAddComment} className="flex flex-col sm:flex-row gap-2">
              <textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Add a comment..."
                rows={2}
                className="flex-1 min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={submitting}
              />
              <Button type="submit" disabled={submitting || !newBody.trim()} className="min-h-[44px] shrink-0 touch-manipulation">
                {submitting ? 'Sending…' : 'Comment'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : feed.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments or status changes yet.</p>
          ) : (
            <>
              <ul className="space-y-4">
                {(showAllActivity ? feed : feed.slice(0, ACTIVITY_PREVIEW)).map((item) => (
                  <li key={`${item.type}-${item.id}`} className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      {item.type === 'comment' ? (
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {displayActor(item.type === 'comment' ? item.authorId : item.actorId)}
                        </span>
                        <span className="text-muted-foreground">
                          {formatDate(item.type === 'comment' ? item.createdAt : item.timestamp)}
                        </span>
                      </div>
                      {item.type === 'comment' ? (
                        <p className="mt-1 text-sm break-words">{item.body}</p>
                      ) : (
                        <p className="mt-1 text-sm">
                          Status: <span className="font-medium">{item.fromStatus}</span> →{' '}
                          <span className="font-medium">{item.toStatus}</span>
                          {item.reason && (
                            <span className="text-muted-foreground"> — {item.reason}</span>
                          )}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {feed.length > ACTIVITY_PREVIEW && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 min-h-[44px] touch-manipulation"
                  onClick={() => setShowAllActivity((v) => !v)}
                >
                  {showAllActivity ? (
                    <>Show less <ChevronUp className="h-4 w-4 ml-1" /></>
                  ) : (
                    <>Show more ({feed.length - ACTIVITY_PREVIEW} more) <ChevronDown className="h-4 w-4 ml-1" /></>
                  )}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
