import { Router, Request, Response, NextFunction } from "express";
import type { Router as IRouter } from "express";
import * as semanticService from "../services/semantic.service.js";
import { isOnline } from "../services/sync.service.js";

const router: IRouter = Router();

// Semantic search as a user-facing mode is gone — /api/search now fuses text and
// vector results with $rankFusion. What's left here is "related notes", which is
// pure vector similarity against a stored note's own embedding and has no place
// in a query-driven fusion.
//
// Vector Search needs Atlas + a configured embedding provider (see
// services/embeddings.ts) and has no meaningful offline equivalent, so this
// fails fast with a clear error rather than degrading.
router.use((_req: Request, res: Response, next: NextFunction) => {
  if (!isOnline()) {
    res.status(503).json({
      error: "Related notes requires a connection",
      code: "OFFLINE",
    });
    return;
  }
  next();
});

router.get("/related/:noteId", async (req: Request, res: Response) => {
  const results = await semanticService.findRelatedNotes(req.params.noteId as string);
  res.json(results);
});

export default router;
