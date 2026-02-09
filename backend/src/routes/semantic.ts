import { Router, Request, Response } from "express";
import type { Router as IRouter } from "express";
import * as semanticService from "../services/semantic.service.js";

const router: IRouter = Router();

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
