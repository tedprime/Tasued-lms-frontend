import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@tasued/api-client';
import { Card, buttonClasses } from '@tasued/ui';
import { useSession } from '../app/session';

export function TeamsSetupCard({ settings = false }: { settings?: boolean }) {
  const { user } = useSession();
  const client = useQueryClient();
  const [checked, setChecked] = useState(false);
  const key = ['teams-setup', user.id];
  const q = useQuery({ queryKey: key, queryFn: () => api.auth.teamsSetup(), refetchInterval: query => query.state.data?.status === 'connected' ? false : 20000 });
  const check = useMutation({ mutationFn: () => api.auth.checkTeamsSetup(), onSuccess: data => { client.setQueryData(key, data); setChecked(true); } });
  const state = q.data;
  if (!settings && state?.status === 'connected') return null;
  return <Card className="mb-6 border-primary-200">
    <div className="space-y-3 p-5 sm:p-6" aria-live="polite">
      <h2 className="font-headline text-lg font-bold text-primary-500">{state?.status === 'connected' ? 'Microsoft Teams connected' : 'Complete your Microsoft Teams setup'}</h2>
      {q.isPending ? <p className="text-sm text-neutral-600">Checking your Teams setup…</p> : q.isError ? <p role="alert" className="text-sm text-red-700">Could not load Teams setup. {errorMessage(q.error)}</p> : <>
        <p className="text-sm leading-relaxed text-neutral-600">{state?.status === 'connected' ? 'Microsoft has confirmed your guest invitation is accepted. You can join your scheduled classes from the LMS.' : state?.status === 'preparing' ? 'We are preparing your invitation. You can continue using your LMS while this completes.' : state?.status === 'unavailable' ? 'Your Teams invitation is not available yet. Contact your LMS administrator for help; your courses remain available.' : 'Accept your invitation to join TASFUED live classes through TedPrime’s Microsoft Teams environment. Use the email address registered with your LMS account.'}</p>
        {state?.status !== 'connected' && <div className="flex flex-wrap gap-3">
          {state?.invitationUrl && <a href={state.invitationUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className={buttonClasses()}>Accept Teams invitation<span className="sr-only"> (opens Microsoft in a new tab)</span></a>}
          <button type="button" className={buttonClasses('outline')} disabled={check.isPending} onClick={() => check.mutate()}>{check.isPending ? 'Checking…' : state?.status === 'action_required' && !state.invitationUrl ? 'Get invitation link' : 'Check status'}</button>
        </div>}
        {state?.status === 'action_required' && <p className="text-xs text-neutral-500">After accepting on Microsoft’s page, return here and select Check status.</p>}
      </>}
      {q.isError && <button type="button" className={buttonClasses('outline')} onClick={() => void q.refetch()}>Retry</button>}
      {check.isError && <p role="alert" className="text-sm text-red-700">{errorMessage(check.error)}</p>}
      {checked && state?.status === 'action_required' && <p className="text-sm text-neutral-600">Microsoft has not confirmed acceptance yet. Complete the invitation and check again in a moment.</p>}
    </div>
  </Card>;
}
