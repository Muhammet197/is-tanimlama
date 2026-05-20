import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const jobs = db.prepare(`
    SELECT j.id, j.title, j.difficulty, j.status, j.group_id, g.name as group_name, g.color as group_color
    FROM jobs j
    LEFT JOIN groups_ g ON j.group_id = g.id
  `).all();

  const dependencies = db.prepare(`
    SELECT d.id, d.from_job_id, d.to_job_id, d.type, d.description
    FROM dependencies d
  `).all();

  const nodes = jobs.map((job, i) => ({
    id: String(job.id),
    data: {
      label: job.title,
      difficulty: job.difficulty,
      status: job.status,
      group: job.group_name,
      color: job.group_color || '#3b82f6'
    },
    position: { x: (i % 4) * 280, y: Math.floor(i / 4) * 160 },
    type: 'jobNode'
  }));

  const edges = dependencies.map(dep => ({
    id: `e${dep.id}`,
    source: String(dep.from_job_id),
    target: String(dep.to_job_id),
    label: dep.type,
    type: 'smoothstep',
    animated: true,
    style: { stroke: getEdgeColor(dep.type) }
  }));

  res.json({ nodes, edges });
});

function getEdgeColor(type) {
  switch (type) {
    case 'Girdi sağlar': return '#10b981';
    case 'Sıralı': return '#3b82f6';
    case 'Bilgi paylaşımı': return '#f59e0b';
    case 'Onay gerektirir': return '#ef4444';
    default: return '#6b7280';
  }
}

export default router;
