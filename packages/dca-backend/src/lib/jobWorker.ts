import * as Sentry from '@sentry/node';
import consola from 'consola';

import { createAgenda, getAgenda } from './agenda/agendaClient';
import { executeDCASwapJobDef } from './agenda/jobs';
import { defineEmailPayJobs } from './agenda/jobs/emailpay';
import { pkpWalletManager } from './services/pkpWalletManager';
import { gmailPoller } from './services/gmailPoller';

// Function to create and configure a new agenda instance
export async function startWorker() {
  await createAgenda();

  const agenda = getAgenda();

  // Define DCA job
  agenda.define(executeDCASwapJobDef.jobName, async (job: executeDCASwapJobDef.JobType) =>
    Sentry.withIsolationScope(async (scope) => {
      // TODO: add job-aware logic such as cool-downs in case of repeated failures here

      try {
        await executeDCASwapJobDef.processJob(job, scope);
      } catch (err) {
        scope.captureException(err);
        const error = err as Error;
        // If we get an error we know is non-transient (the user must fix the state), disable the job
        // The user can re-enable it after resolving the fatal error.
        if (
          error?.message?.includes('Not enough balance') ||
          error?.message?.includes('insufficient funds') ||
          error?.message?.includes('gas too low') ||
          error?.message?.includes('out of gas')
        ) {
          consola.log(`Disabling job due to fatal error: ${error.message}`);
          job.disable();
          await job.save();
          throw new Error(`DCA schedule disabled due to fatal error: ${error.message}`);
        }
        // Other errors just bubble up to the job doc
        throw err;
      } finally {
        Sentry.flush(2000);
      }
    })
  );

  // Define EmailPay jobs
  defineEmailPayJobs(agenda);

  // Initialize EmailPay services if env vars are set
  try {
    if (process.env.GMAIL_CLIENT_ID && process.env.HOT_WALLET_PRIVATE_KEY) {
      await pkpWalletManager.initialize();
      await gmailPoller.initialize();
      
      // Schedule Gmail polling every 30 seconds
      await agenda.every('30 seconds', 'emailpay-poll-gmail');
      consola.success('[EmailPay] Services initialized and Gmail polling scheduled');
    } else {
      consola.warn('[EmailPay] Services not initialized - missing GMAIL_CLIENT_ID or HOT_WALLET_PRIVATE_KEY');
    }
  } catch (error) {
    consola.error('[EmailPay] Failed to initialize services:', error);
  }

  return agenda;
}
