import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { blocksCachedData, affectedQueryRoots, notifyApiWrite, onApiWrite, refreshProtected } from '../packages/api-client/src/refresh-policy';
import { request } from '../packages/api-client/src/client';
import { installDataSync, eligible } from '../packages/ui/src/data-sync';
const wait = () => new Promise(resolve => setTimeout(resolve, 350));

test('feature writes invalidate dependent views across all portal roles', () => {
  const cases: [string, string[]][] = [
    ['/courses/c/enrolments', ['courses','people','attendance','grades']],
    ['/units/u/progress', ['content','courses','dashboard']],
    ['/classes/c/attendance/import', ['attendance','classes','reports']],
    ['/assignments/a/submission/final', ['assignments','grades','dashboard']],
    ['/quiz-attempts/a/marks/q', ['quiz-attempts','quizzes','grades']],
    ['/courses/c/gradebook/cells', ['grades','reports']],
    ['/question-banks/b/import', ['quizzes']],
    ['/users/u/roles', ['people','auth','courses']],
    ['/imports/i/commit', ['people','courses']],
    ['/forum/posts/p', ['forum']],
    ['/me/teams-invitation/check', ['teams-setup']],
    ['/me/notifications/read-all', ['notifications']],
  ];
  for (const [path, roots] of cases) for (const root of roots) assert.ok(affectedQueryRoots(path).includes(root), `${path}: ${root}`);
  for (const path of ['/auth/logout','/recordings/r/position','/quiz-attempts/a/answers/q','/assignments/a/submission/draft','/imports/preview']) assert.deepEqual(affectedQueryRoots(path), []);
  assert.equal(refreshProtected(['quizzes','attempts','q']), false);
});

test('HTTP success including empty responses emits writes, failed requests and reads do not', async () => {
  const original = globalThis.fetch;
  const events: string[][] = [];
  const stop = onApiWrite(roots => events.push(roots));
  try {
    globalThis.fetch = async () => new Response(null, {status:204});
    await request('/users/u', {method:'DELETE'});
    await request('/users');
    assert.equal(events.length, 1);
    globalThis.fetch = async () => new Response('{}', {status:403});
    await assert.rejects(request('/users', {method:'POST'}));
    assert.equal(events.length, 1);
  } finally { stop(); globalThis.fetch = original; }
});

test('active affected queries refetch once; inactive queries become stale; unrelated data stays unchanged', async () => {
  const qc = new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
  let calls = 0;
  const key = ['assignments','list',{page:3,search:'exam'}];
  qc.setQueryData(key, {version:0});
  qc.setQueryData(['grades','inactive'], []);
  qc.setQueryData(['forum'], []);
  const observer = new QueryObserver(qc, {queryKey:key, queryFn:async()=>({version:++calls})});
  const unobserve = observer.subscribe(()=>{});
  const stop = installDataSync(qc);
  try {
    notifyApiWrite('/assignments/a/submission/final');
    notifyApiWrite('/assignments/a/submission/final');
    await wait();
    assert.equal(calls,1);
    assert.deepEqual(qc.getQueryData(key),{version:1});
    assert.equal(qc.getQueryState(['grades','inactive'])?.isInvalidated,true);
    assert.equal(qc.getQueryState(['forum'])?.isInvalidated,false);
    assert.deepEqual(observer.getCurrentQuery().queryKey,key);
    notifyApiWrite('/assignments/a');
    await qc.invalidateQueries({queryKey:key}); // existing feature callback
    await wait();
    assert.equal(calls,2); // no redundant fallback fetch
  } finally { stop(); unobserve(); qc.clear(); }
});

test('ongoing attempts and playback stay protected; submitted results can refresh', () => {
  const qc=new QueryClient();
  qc.setQueryData(['quiz-attempts','a'], {state:'in_progress'});
  const query=qc.getQueryCache().find({queryKey:['quiz-attempts','a']})!;
  assert.equal(eligible(query),false);
  qc.setQueryData(['quiz-attempts','a'], {state:'submitted'});
  assert.equal(eligible(query),true);
  qc.setQueryData(['recordings','r','position'],{positionSeconds:30});
  assert.equal(eligible(qc.getQueryCache().find({queryKey:['recordings','r','position']})!),false);
  qc.clear();
});

test('unmount removes the listener and pending work',async()=>{
 const qc=new QueryClient(); qc.setQueryData(['people'],[]);
 const stop=installDataSync(qc); stop(); notifyApiWrite('/users/u'); await wait();
 assert.equal(qc.getQueryState(['people'])?.isInvalidated,false); qc.clear();
});

test('a read already in flight cannot hide a newly completed write', async()=>{
 const qc=new QueryClient({defaultOptions:{queries:{retry:false}}});
 let resolve!: (value:number)=>void; let calls=0;
 const observer=new QueryObserver(qc,{queryKey:['people'],queryFn:()=>++calls===1 ? new Promise<number>(r=>{resolve=r;}) : Promise.resolve(2)});
 const unobserve=observer.subscribe(()=>{}); const stop=installDataSync(qc);
 try {
   notifyApiWrite('/users/u'); await wait(); resolve(1); await wait();
   assert.equal(qc.getQueryData(['people']),2); assert.equal(calls,2);
 } finally {stop();unobserve();qc.clear();}
});

test('transient errors can retain data but revoked access and removed records cannot',()=>{
 assert.equal(blocksCachedData(new Error('offline')),false);
 assert.equal(blocksCachedData({status:502}),false);
 for (const status of [401,403,404,410]) assert.equal(blocksCachedData({status}),true);
});
