import { Router, Request, Response, NextFunction } from "express";
import type { Router as IRouter } from "express";
import * as notesService from "../services/notes.service.js";

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
    const notebookId = req.query.notebookId as string | undefined;
    const notes = await notesService.listNotes(notebookId);
    res.json(notes);
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const note = await notesService.getNoteById(req.params.id as string);
    if (!note) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    res.json(note);
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const note = await notesService.createNote(req.body);
    res.status(201).json(note);
  }),
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const note = await notesService.updateNote(req.params.id as string, req.body);
    if (!note) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    res.json(note);
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const deleted = await notesService.deleteNote(req.params.id as string);
    if (!deleted) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    res.json({ success: true });
  }),
);

export default router;
