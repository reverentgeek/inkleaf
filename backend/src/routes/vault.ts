import { Router, Request, Response, NextFunction } from "express";
import type { Router as IRouter } from "express";
import * as vaultService from "../services/vault.service.js";
import { connectEncryptedClient } from "../db/encryption.js";

const router: IRouter = Router();

let csfleReady = false;
let csfleError = "";

// Middleware: try to initialize CSFLE on first request
async function ensureCsfle(_req: Request, res: Response, next: NextFunction) {
  if (csfleReady) return next();

  try {
    await connectEncryptedClient();
    csfleReady = true;
    next();
  } catch (err) {
    csfleError =
      err instanceof Error ? err.message : "CSFLE initialization failed";
    console.warn("CSFLE not available:", csfleError);
    res.status(503).json({
      error: `CSFLE not configured: ${csfleError}`,
    });
  }
}

router.use(ensureCsfle);

router.get("/", async (_req: Request, res: Response) => {
  const notes = await vaultService.listVaultNotes();
  res.json(notes);
});

router.get("/:id", async (req: Request, res: Response) => {
  const note = await vaultService.getVaultNoteById(req.params.id as string);
  if (!note) {
    res.status(404).json({ error: "Vault note not found" });
    return;
  }
  res.json(note);
});

router.post("/", async (req: Request, res: Response) => {
  const note = await vaultService.createVaultNote(req.body);
  res.status(201).json(note);
});

router.put("/:id", async (req: Request, res: Response) => {
  const note = await vaultService.updateVaultNote(req.params.id as string, req.body);
  if (!note) {
    res.status(404).json({ error: "Vault note not found" });
    return;
  }
  res.json(note);
});

router.delete("/:id", async (req: Request, res: Response) => {
  const deleted = await vaultService.deleteVaultNote(req.params.id as string);
  if (!deleted) {
    res.status(404).json({ error: "Vault note not found" });
    return;
  }
  res.json({ success: true });
});

// Demo endpoint: show raw ciphertext via non-encrypted client
router.get("/:id/raw", async (req: Request, res: Response) => {
  const rawNote = await vaultService.getRawVaultNote(req.params.id as string);
  if (!rawNote) {
    res.status(404).json({ error: "Vault note not found" });
    return;
  }
  res.json(rawNote);
});

export default router;
