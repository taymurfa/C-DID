'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Copy, Check, Loader2 } from 'lucide-react';

export function IntegrationsSection() {
  const [config, setConfig] = useState<{
    webhookUrlMasked?: string | null;
    channelType?: string | null;
    channelDisplayName?: string | null;
    configured: boolean;
  } | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channelType, setChannelType] = useState<'slack' | 'teams'>('slack');
  const [channelDisplayName, setChannelDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [incomingUrl, setIncomingUrl] = useState<string | null>(null);
  const [incomingCopied, setIncomingCopied] = useState(false);
  const searchParams = useSearchParams();
  const googleStatus = searchParams?.get('google');
  const googleErrorReason = searchParams?.get('reason') ?? null;
  const googleEmailStatus = searchParams?.get('google_email');
  const googleEmailErrorReason = searchParams?.get('reason') ?? null;

  useEffect(() => {
    api
      .getOutgoingConfig()
      .then(setConfig)
      .catch(() => setConfig({ configured: false }));
    api
      .getIncomingWebhookUrl()
      .then((u) => setIncomingUrl(u?.url ?? null))
      .catch(() => setIncomingUrl(null));
  }, []);

  const copyIncoming = () => {
    if (!incomingUrl) return;
    navigator.clipboard.writeText(incomingUrl).then(() => {
      setIncomingCopied(true);
      setTimeout(() => setIncomingCopied(false), 2000);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.saveOutgoingConfig({
        webhookUrl: webhookUrl.trim(),
        channelType,
        channelDisplayName: channelDisplayName.trim() || undefined,
      });
      setMessage({ type: 'success', text: 'Webhook saved.' });
      setWebhookUrl('');
      const next = await api.getOutgoingConfig();
      setConfig(next);
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      await api.testOutgoingWebhook();
      setMessage({ type: 'success', text: 'Test message sent to your channel.' });
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Integrations</h2>
      <p className="text-sm text-muted-foreground">
        Webhooks, Slack, Teams, and Google Slides. Connect external tools and export OKRs.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Post Update to Slack / Teams</CardTitle>
          <CardDescription>
            When you submit, approve, or reject an OKR, we can post a message to your channel. Add an Incoming Webhook URL below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config?.configured && (
            <p className="text-sm text-muted-foreground">
              We will POST to: <code className="bg-muted px-1 rounded">{config.webhookUrlMasked ?? '…'}</code>
              {config.channelDisplayName && ` (${config.channelDisplayName})`}
            </p>
          )}
          <div className="grid gap-2">
            <Label htmlFor="webhook">Webhook URL</Label>
            <Input
              id="webhook"
              type="url"
              placeholder="https://hooks.slack.com/... or https://outlook.office.com/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Channel type</Label>
            <Select value={channelType} onValueChange={(v) => setChannelType(v as 'slack' | 'teams')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="slack">Slack</SelectItem>
                <SelectItem value="teams">Microsoft Teams</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="channelName">Channel name (optional)</Label>
            <Input
              id="channelName"
              placeholder="e.g. #okr-updates"
              value={channelDisplayName}
              onChange={(e) => setChannelDisplayName(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save webhook
            </Button>
            {config?.configured && (
              <Button variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Test message
              </Button>
            )}
          </div>
          {message && (
            <p className={message.type === 'error' ? 'text-destructive text-sm' : 'text-sm text-green-600'}>
              {message.text}
            </p>
          )}
        </CardContent>
      </Card>

      {googleStatus === 'connected' && (
        <p className="text-sm text-green-600 bg-green-50 dark:bg-green-950 p-3 rounded">Google account connected. You can export OKRs to Google Slides from the Dashboard.</p>
      )}
      {googleStatus === 'error' && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span>Google connection failed.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const { url } = await api.getGoogleAuthUrl();
                  window.location.href = url;
                } catch (e) {
                  alert(e instanceof Error ? e.message : 'Failed to get auth URL');
                }
              }}
            >
              Try again
            </Button>
          </div>
          {googleErrorReason && (
            <p className="text-xs font-mono text-muted-foreground break-all" title="Error from backend (dev only)">
              {(() => {
                try {
                  return decodeURIComponent(googleErrorReason);
                } catch {
                  return googleErrorReason;
                }
              })()}
            </p>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Export to Google Slides</CardTitle>
          <CardDescription>
            Connect your Google account to export OKRs as a presentation. After connecting, use the &quot;Google Slides&quot; button on the Dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={async () => {
              try {
                const { url } = await api.getGoogleAuthUrl();
                window.location.href = url;
              } catch (e) {
                alert(e instanceof Error ? e.message : 'Failed to get auth URL');
              }
            }}
          >
            Connect Google account
          </Button>
        </CardContent>
      </Card>

      {googleEmailStatus === 'connected' && (
        <p className="text-sm text-green-600 bg-green-50 dark:bg-green-950 p-3 rounded">
          Gmail connected. You’ll receive OKR reminder emails and OKR-change alerts from your own Gmail account.
        </p>
      )}
      {googleEmailStatus === 'error' && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span>Gmail connection failed.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const { url } = await api.getGoogleEmailAuthUrl();
                  window.location.href = url;
                } catch (e) {
                  alert(e instanceof Error ? e.message : 'Failed to get auth URL');
                }
              }}
            >
              Try again
            </Button>
          </div>
          {googleEmailErrorReason && (
            <p className="text-xs font-mono text-muted-foreground break-all" title="Error from backend (dev only)">
              {(() => {
                try {
                  return decodeURIComponent(googleEmailErrorReason);
                } catch {
                  return googleEmailErrorReason;
                }
              })()}
            </p>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Email reminders (Gmail)</CardTitle>
          <CardDescription>
            Connect Gmail so we can send automated OKR update reminders and alert you when there are significant OKR changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={async () => {
              try {
                const { url } = await api.getGoogleEmailAuthUrl();
                window.location.href = url;
              } catch (e) {
                alert(e instanceof Error ? e.message : 'Failed to get auth URL');
              }
            }}
          >
            Connect Gmail
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Incoming webhook URL</CardTitle>
          <CardDescription>
            Use this URL in Zapier, Make, or other automation tools to send data into this app. Keep the token secret.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {incomingUrl ? (
            <div className="flex items-center gap-2">
              <Input readOnly value={incomingUrl} className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={copyIncoming} title="Copy">
                {incomingCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading your webhook URL…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
