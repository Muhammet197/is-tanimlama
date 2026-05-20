import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const deps = db.prepare(`
    SELECT d.*,
      fj.title as from_job_title,
      tj.title as to_job_title
    FROM dependencies d
    JOIN jobs fj ON d.from_job_id = fj.id
    JOIN jobs tj ON d.to_job_id = tj.id
    ORDER BY d.id
  `).all();
  res.json(deps);
});

router.post('/', (req, res) => {
  const { from_job_id, to_job_id, type, description } = req.body;

  if (from_job_id === to_job_id) {
    return res.status(400).json({ error: 'Bir iş kendisine bağımlı olamaz' });
  }

  const existing = db.prepare(
    'SELECT id FROM dependencies WHERE from_job_id = ? AND to_job_id = ?'
  ).get(from_job_id, to_job_id);

  if (existing) {
    return res.status(400).json({ error: 'Bu bağımlılık zaten mevcut' });
  }

  const result = db.prepare(
    'INSERT INTO dependencies (from_job_id, to_job_id, type, description) VALUES (?, ?, ?, ?)'
  ).run(from_job_id, to_job_id, type || 'Sıralı', description);

  res.status(201).json({ id: result.lastInsertRowid });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM dependencies WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
