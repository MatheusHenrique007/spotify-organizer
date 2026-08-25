import { Router } from 'express';
import { spotifyFetch } from '../lib/spotifyClient.js';
import { buildPlanFromSuggestions, filterSelectedOperations } from '../lib/planner.js';
import { executePlan } from '../lib/executor.js';
import { addHistoryEntry } from '../lib/historyStore.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const plansRouter = Router();

plansRouter.post(
  '/build',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { renameSuggestions = [], dedupeSuggestions = [], mergeCandidates = [] } = req.body;
    const plan = buildPlanFromSuggestions({ renameSuggestions, dedupeSuggestions, mergeCandidates });
    res.json({ plan });
  })
);

plansRouter.post(
  '/execute',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { plan, selectedOperationIds } = req.body;
    if (!plan || !Array.isArray(plan.operations)) {
      return res.status(400).json({ error: 'invalid_plan', message: 'plan.operations is required' });
    }

    const operations = selectedOperationIds
      ? filterSelectedOperations(plan, selectedOperationIds)
      : plan.operations;

    const profile = await spotifyFetch('/me');
    const results = await executePlan(operations, { userId: profile.id });

    const historyEntry = addHistoryEntry({
      planId: plan.id,
      operationCount: operations.length,
      results
    });

    res.json({ results, historyEntryId: historyEntry.id });
  })
);
