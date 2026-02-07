import { Router, Request, Response, NextFunction } from "express";
import type { Router as IRouter } from "express";
import * as searchService from "../services/search.service.js";

const router: IRouter = Router();

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = req.query.q as string;
    if (!q) {
      res.status(400).json({ error: "Query parameter 'q' is required" });
      return;
    }
    const tags = req.query.tags
      ? (req.query.tags as string).split(",").map((t) => t.trim())
      : undefined;
    const results = await searchService.searchNotes(q, tags);
    res.json(results);
  }),
);

router.get(
  "/autocomplete",
  asyncHandler(async (req, res) => {
    const q = req.query.q as string;
    if (!q) {
      res.json([]);
      return;
    }
    const results = await searchService.autocompleteNotes(q);
    res.json(results);
  }),
);

export default router;
