import { Router, Request, Response, NextFunction } from "express";
import type { Router as IRouter } from "express";
import * as semanticService from "../services/semantic.service.js";
import { isOnline } from "../services/sync.service.js";

const router: IRouter = Router();

// Semantic search needs Atlas Vector Search + OpenAI embeddings — there is
// no meaningful offline equivalent, so fail fast with a clear error.
router.use((_req: Request, res: Response, next: NextFunction) => {
  if (!isOnline()) {
    res.status(503).json({
      error: "Semantic search requires a connection",
      code: "OFFLINE",
    });
    return;
  }
  next();
});

router.get("/search", async (req: Request, res: Response) => {
  const q = req.query.q as string;
  if (!q) {
    res.status(400).json({ error: "Query parameter 'q' is required" });
    return;
  }
  const results = await semanticService.semanticSearch(q);
  res.json(results);
});

router.get("/related/:noteId", async (req: Request, res: Response) => {
  const results = await semanticService.findRelatedNotes(req.params.noteId as string);
  res.json(results);
});

export default router;
