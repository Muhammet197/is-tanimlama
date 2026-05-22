import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const { search, group_id, difficulty, status } = req.query;
  let sql = `
    SELECT j.*, g.name as group_name, g.color as group_color
    FROM jobs j
    LEFT JOIN groups_ g ON j.group_id = g.id
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    sql += ` AND (j.title LIKE ? OR j.responsible LIKE ? OR j.notes LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  if (group_id) {
    sql += ` AND j.group_id = ?`;
    params.push(group_id);
  }
  if (difficulty) {
    sql += ` AND j.difficulty = ?`;
    params.push(difficulty);
  }
  if (status) {
    sql += ` AND j.status = ?`;
    params.push(status);
  }

  sql += ` ORDER BY j.updated_at DESC`;
  const jobs = db.prepare(sql).all(...params);

  jobs.forEach(j => {
    j.environments = JSON.parse(j.environments || '[]');
    j.prerequisites = JSON.parse(j.prerequisites || '[]');
    const stepCount = db.prepare('SELECT COUNT(*) as count FROM steps WHERE job_id = ?').get(j.id);
    j.step_count = stepCount.count;
  });

  res.json(jobs);
});

router.get('/:id', (req, res) => {
  const job = db.prepare(`
    SELECT j.*, g.name as group_name, g.color as group_color
    FROM jobs j
    LEFT JOIN groups_ g ON j.group_id = g.id
    WHERE j.id = ?
  `).get(req.params.id);

  if (!job) return res.status(404).json({ error: 'İş bulunamadı' });

  job.environments = JSON.parse(job.environments || '[]');
  job.prerequisites = JSON.parse(job.prerequisites || '[]');
  job.steps = db.prepare('SELECT * FROM steps WHERE job_id = ? ORDER BY order_num').all(req.params.id);
  job.dependencies = db.prepare(`
    SELECT d.*, j.title as to_job_title
    FROM dependencies d
    JOIN jobs j ON d.to_job_id = j.id
    WHERE d.from_job_id = ?
  `).all(req.params.id);
  job.dependent_by = db.prepare(`
    SELECT d.*, j.title as from_job_title
    FROM dependencies d
    JOIN jobs j ON d.from_job_id = j.id
    WHERE d.to_job_id = ?
  `).all(req.params.id);
  job.history = db.prepare('SELECT * FROM history WHERE job_id = ? ORDER BY date DESC').all(req.params.id);

  res.json(job);
});

router.post('/', (req, res) => {
  const { title, responsible, group_id, period, estimated_duration, difficulty, environments, prerequisites, notes, steps } = req.body;

  const result = db.prepare(`
    INSERT INTO jobs (title, responsible, group_id, period, estimated_duration, difficulty, environments, prerequisites, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title, responsible, group_id || null, period, estimated_duration, difficulty,
    JSON.stringify(environments || []),
    JSON.stringify(prerequisites || []),
    notes
  );

  const jobId = result.lastInsertRowid;

  if (steps && steps.length > 0) {
    const insertStep = db.prepare(`
      INSERT INTO steps (job_id, order_num, title, environment, description, tip, warning, screenshot_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    steps.forEach((step, i) => {
      insertStep.run(jobId, i + 1, step.title, step.environment, step.description, step.tip, step.warning, step.screenshot_url || null);
    });
  }

  db.prepare(`INSERT INTO history (job_id, date, person, note) VALUES (?, date('now'), ?, 'İlk oluşturma')`)
    .run(jobId, responsible || 'Sistem');

  res.status(201).json({ id: jobId });
});

router.put('/:id', (req, res) => {
  const { title, responsible, group_id, period, estimated_duration, difficulty, environments, prerequisites, notes, status, steps } = req.body;

  db.prepare(`
    UPDATE jobs SET title=?, responsible=?, group_id=?, period=?, estimated_duration=?, difficulty=?,
    environments=?, prerequisites=?, notes=?, status=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    title, responsible, group_id || null, period, estimated_duration, difficulty,
    JSON.stringify(environments || []),
    JSON.stringify(prerequisites || []),
    notes, status || 'aktif', req.params.id
  );

  if (steps) {
    db.prepare('DELETE FROM steps WHERE job_id = ?').run(req.params.id);
    const insertStep = db.prepare(`
      INSERT INTO steps (job_id, order_num, title, environment, description, tip, warning, screenshot_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    steps.forEach((step, i) => {
      insertStep.run(req.params.id, i + 1, step.title, step.environment, step.description, step.tip, step.warning, step.screenshot_url || null);
    });
  }

  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.post('/:id/history', (req, res) => {
  const { date, person, note } = req.body;
  db.prepare('INSERT INTO history (job_id, date, person, note) VALUES (?, ?, ?, ?)')
    .run(req.params.id, date, person, note);
  res.status(201).json({ success: true });
});

export default router;
