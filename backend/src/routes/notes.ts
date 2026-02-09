import { Router, Request, Response } from "express";
import type { Router as IRouter } from "express";
import * as notesService from "../services/notes.service.js";

const router: IRouter = Router();

router.get("/", async (req: Request, res: Response) => {
  const notebookId = req.query.notebookId as string | undefined;
  const notes = await notesService.listNotes(notebookId);
  res.json(notes);
});

router.get("/:id", async (req: Request, res: Response) => {
  const note = await notesService.getNoteById(req.params.id as string);
  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  res.json(note);
});

router.post("/", async (req: Request, res: Response) => {
  const note = await notesService.createNote(req.body);
  res.status(201).json(note);
});

router.put("/:id", async (req: Request, res: Response) => {
  const note = await notesService.updateNote(req.params.id as string, req.body);
  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  res.json(note);
});

router.delete("/:id", async (req: Request, res: Response) => {
  const deleted = await notesService.deleteNote(req.params.id as string);
  if (!deleted) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  res.json({ success: true });
});

export default router;
