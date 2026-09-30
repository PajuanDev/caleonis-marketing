import { proxyActivities } from '@temporalio/workflow';
import type { CaleonisStudioActivity } from '../activities/caleonis-studio.activity';
const render = proxyActivities<CaleonisStudioActivity>({ startToCloseTimeout: '4 minutes', scheduleToCloseTimeout: '10 minutes', taskQueue: 'caleoniscreative', retry: { maximumAttempts: 1 } });
const reconcile = proxyActivities<CaleonisStudioActivity>({ startToCloseTimeout: '30 seconds', taskQueue: 'main', retry: { maximumAttempts: 3 } });
export async function caleonisNativeImageWorkflow(org: string, runId: string) {
  // Only IDs go into Temporal; provider keys, reference bytes and brand briefs remain on the server.
  try { await render.caleonisRenderImage(org, runId); }
  catch { await reconcile.caleonisImageInterrupted(org, runId); }
}
