import { Router } from "express";
import { desc, eq } from 'drizzle-orm';
import { commentary } from '../db/schema.js';
import { db } from '../db/db.js';
import { matchIdParamSchema } from '../validation/matches.js';
import { createCommentarySchema, listCommentaryQuerySchema } from '../validation/commentary.js';

const MAX_LIMIT = 100;

export const commentaryRouter = Router({ mergeParams: true });

commentaryRouter.get('/', async (req, res) => {
    const paramsResult = matchIdParamSchema.safeParse(req.params);

    if (!paramsResult.success) {
        return res.status(400).json({ error: 'Invalid match ID.', details: paramsResult.error.issues });
    }

    const queryResult = listCommentaryQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
        return res.status(400).json({ error: 'Invalid query parameters.', details: queryResult.error.issues });
    }

    try {
        const { id: matchId } = paramsResult.data;
        const { limit = MAX_LIMIT } = queryResult.data;

        const safeLimit = Math.min(limit, MAX_LIMIT);

        const results = await db
            .select()
            .from(commentary)
            .where(eq(commentary.matchId, matchId))
            .orderBy(desc(commentary.createdAt))
            .limit(safeLimit);

        res.status(200).json({ data: results });
    } catch (error) {
        console.error('Failed to fetch commentary:', error);
        res.status(500).json({ error: 'Failed to fetch commentary.' });
    }
});

commentaryRouter.post('/', async (req, res) => {
  const paramsResult = matchIdParamSchema.safeParse(req.params);
  if (!paramsResult.success) {
    return res.status(400).json({ error: 'Invalid match id.', details: paramsResult.error.issues });
  }

  const normalizedBody = {
    ...req.body,
    minute: req.body.minute ?? req.body.minutes,
  };

  const bodyResult = createCommentarySchema.safeParse(normalizedBody);
  if (!bodyResult.success) {
    return res.status(400).json({ error: 'Invalid commentary payload.', details: bodyResult.error.issues });
  }

  try {
    const {
      minute,
      sequence = 0,
      period = '',
      eventType = '',
      actor = '',
      team = '',
      message,
      metadata = {},
      tags = [],
    } = bodyResult.data;

    const [result] = await db.insert(commentary).values({
      matchId: paramsResult.data.id,
      minute,
      sequence,
      period,
      eventType,
      actor,
      team,
      message,
      metadata,
      tags,
    }).returning();

    if(res.app.locals.broadcastCommentary) {
        res.app.locals.broadcastCommentary(result.matchId, result);
    }

    return res.status(201).json({ data: result });
  } catch (error) {
    console.error('Failed to create commentary:', error);
    res.status(500).json({ error: 'Failed to create commentary.' });
  }
});

