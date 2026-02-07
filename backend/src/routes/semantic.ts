import { Router, Request, Response, NextFunction } from "express";
import type { Router as IRouter } from "express";
import * as semanticService from "../services/semantic.service.js";

const router: IRouter = Router();

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const q = req.query.q as string;
    if (!q) {
      res.status(400).json({ error: "Query parameter 'q' is required" });
      return;
    }
    const results = await semanticService.semanticSearch(q);
    res.json(results);
  }),
);

router.get(
  "/related/:noteId",
  asyncHandler(async (req, res) => {
    const results = await semanticService.findRelatedNotes(req.params.noteId as string);
    res.json(results);
  }),
);

export default router;
