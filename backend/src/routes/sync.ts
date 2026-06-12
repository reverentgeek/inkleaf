import { Router, Request, Response } from "express";
import type { Router as IRouter } from "express";
import { getSyncStatus, syncNow } from "../services/sync.service.js";

const router: IRouter = Router();

router.get("/", (_req: Request, res: Response) => {
  res.json(getSyncStatus());
});

router.post("/now", async (_req: Request, res: Response) => {
  await syncNow();
  res.json(getSyncStatus());
});

export default router;
