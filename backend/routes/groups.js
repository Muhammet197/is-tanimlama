import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const groups = db.prepare(`
    SELECT g.*, COUNT(j.id) as job_count
    FROM groups_ g
    LEFT JOIN jobs j ON j.group_id = g.id
    GROUP BY g.id
    ORDER BY g.name
  `).all();
  res.json(groups);
});

router.post('/', (req, res) => {
  const { name, description, color } = req.body;
  try {
    const result = db.prepare('INSERT INTO groups_ (name, description, color) VALUES (?, ?, ?)')
      .run(name, description, color || '#3b82f6');
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Bu grup zaten mevcut' });
    }
    throw e;
  }
});

router.put('/:id', (req, res) => {
  const { name, description, color } = req.body;
  db.prepare('UPDATE groups_ SET name=?, description=?, color=? WHERE id=?')
    .run(name, description, color, req.params.id);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('UPDATE jobs SET group_id = NULL WHERE group_id = ?').run(req.params.id);
  db.prepare('DELETE FROM groups_ WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
