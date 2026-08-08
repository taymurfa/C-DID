'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api, type Objective } from '@/lib/api';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Send, RotateCcw } from 'lucide-react';

type Status = 'draft' | 'in_review' | 'approved' | 'rejected';

interface WorkflowActionsProps {
  objective: Objective;
  onUpdate: (updated: Objective) => void;
  onError?: (message: string) => void;
  canSubmit?: boolean;
  canApproveReject?: boolean;
  canResubmit?: boolean;
  canReopen?: boolean;
}

export function WorkflowActions({
  objective,
  onUpdate,
  onError,
  canSubmit = true,
  canApproveReject = true,
  canResubmit = true,
  canReopen = false,
}: WorkflowActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const status = (objective.status as Status) ?? 'draft';

  const run = async (action: () => Promise<Objective>, label: string) => {
    setLoading(label);
    try {
      const updated = await action();
      onUpdate(updated);
      return updated;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Action failed';
      onError?.(msg);
      toast.error(msg);
      throw e;
    } finally {
      setLoading(null);
    }
  };

  const hasAnyWorkflowPermission =
    (status === 'draft' && canSubmit) ||
    (status === 'in_review' && canApproveReject) ||
    (status === 'rejected' && canResubmit) ||
    ((status === 'approved' || status === 'rejected') && canReopen);

  const handleSubmit = () => {
    if (!objective._id) return;
    run(() => api.submitObjective(objective._id!), 'Submit').then(() => {
      toast.success('Submitted for Review', {
        description: 'Your objective has been submitted to leadership for approval.',
      });
    });
  };

  const handleApprove = () => {
    if (!objective._id) return;
    run(() => api.approveObjective(objective._id!), 'Approve').then(() => {
      toast.success('Objective Approved', {
        description: 'The objective has been approved and is now active.',
      });
    });
  };

  const handleRejectClick = () => setShowRejectModal(true);
  const handleRejectConfirm = () => {
    if (!rejectReason.trim()) {
      toast.error('Comment Required', { description: 'Please provide a reason for rejection.' });
      return;
    }
    if (!objective._id) return;
    run(() => api.rejectObjective(objective._id!, rejectReason.trim()), 'Reject')
      .then(() => {
        toast.error('Objective Rejected', {
          description: 'The objective has been rejected and returned to the owner.',
        });
        setShowRejectModal(false);
        setRejectReason('');
      })
      .catch(() => {});
  };

  const handleResubmit = () => {
    if (!objective._id) return;
    run(() => api.resubmitObjective(objective._id!), 'Resubmit').then(() => {
      toast.success('Objective Resubmitted', {
        description: 'The objective has been resubmitted for review.',
      });
    });
  };

  const handleReopenClick = () => setShowReopenModal(true);
  const handleReopenConfirm = () => {
    if (!reopenReason.trim()) {
      toast.error('Comment Required', { description: 'Please provide a reason for reopening.' });
      return;
    }
    if (!objective._id) return;
    run(() => api.reopenObjective(objective._id!, reopenReason.trim()), 'Reopen')
      .then(() => {
        toast.info('Objective Reopened', {
          description: 'The objective has been reopened and returned to draft status.',
        });
        setShowReopenModal(false);
        setReopenReason('');
      })
      .catch(() => {});
  };

  if (status === 'approved' && !canReopen) {
    return (
      <span className="text-sm text-muted-foreground">Approved</span>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-wrap">
        <div className="text-sm text-muted-foreground space-y-1 min-w-0 flex-1">
          <p className="font-medium text-foreground capitalize">Status: {status.replace(/_/g, ' ')}</p>
          {!hasAnyWorkflowPermission && (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed">
              You do not have permission to change workflow from this state. Owners can submit or resubmit; department
              leaders and admins can approve or reject. Ask an admin if your role should include workflow actions.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {status === 'draft' && canSubmit && (
            <Button
              size="sm"
              disabled={!!loading}
              className="min-h-[44px] min-w-[44px] touch-manipulation"
              onClick={handleSubmit}
            >
              <Send className="h-4 w-4 mr-1.5" />
              {loading === 'Submit' ? 'Submitting…' : 'Submit for Review'}
            </Button>
          )}
          {status === 'in_review' && canApproveReject && (
            <>
              <Button
                size="sm"
                disabled={!!loading}
                className="min-h-[44px] min-w-[44px] touch-manipulation"
                onClick={handleApprove}
              >
                <CheckCircle className="h-4 w-4 mr-1.5" />
                {loading === 'Approve' ? 'Approving…' : 'Approve'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!!loading}
                className="min-h-[44px] min-w-[44px] touch-manipulation text-destructive border-destructive/50 hover:bg-destructive/10"
                onClick={handleRejectClick}
              >
                <XCircle className="h-4 w-4 mr-1.5" />
                {loading === 'Reject' ? 'Rejecting…' : 'Reject'}
              </Button>
            </>
          )}
          {status === 'rejected' && canResubmit && (
            <Button
              size="sm"
              disabled={!!loading}
              className="min-h-[44px] min-w-[44px] touch-manipulation"
              onClick={handleResubmit}
            >
              {loading === 'Resubmit' ? 'Resubmitting…' : 'Resubmit'}
            </Button>
          )}
          {(status === 'approved' || status === 'rejected') && canReopen && (
            <Button
              size="sm"
              variant="outline"
              disabled={!!loading}
              className="min-h-[44px] min-w-[44px] touch-manipulation"
              onClick={handleReopenClick}
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              {loading === 'Reopen' ? 'Reopening…' : 'Reopen'}
            </Button>
          )}
        </div>
      </div>

      {/* Reject confirmation modal */}
      {showRejectModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowRejectModal(false)}
        >
          <div
            className="bg-card border rounded-xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Reject Objective</h3>
                <p className="text-sm text-muted-foreground">
                  Please provide a reason for rejecting this objective. The owner will be notified.
                </p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                Reason for Rejection <span className="text-destructive">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                rows={4}
                placeholder="Explain why this objective is being rejected..."
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!rejectReason.trim() || !!loading}
                onClick={handleRejectConfirm}
              >
                {loading === 'Reject' ? 'Rejecting…' : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen confirmation modal */}
      {showReopenModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowReopenModal(false)}
        >
          <div
            className="bg-card border rounded-xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <RotateCcw className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Reopen Objective</h3>
                <p className="text-sm text-muted-foreground">
                  This will return the objective to draft status. Please provide a reason.
                </p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                Reason for Reopening <span className="text-destructive">*</span>
              </label>
              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                rows={4}
                placeholder="Explain why this objective is being reopened..."
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowReopenModal(false);
                  setReopenReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={!reopenReason.trim() || !!loading}
                onClick={handleReopenConfirm}
              >
                {loading === 'Reopen' ? 'Reopening…' : 'Confirm Reopen'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
