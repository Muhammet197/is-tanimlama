import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const jobs = db.prepare(`
    SELECT j.*, g.name as group_name, g.color as group_color,
      (SELECT COUNT(*) FROM steps WHERE job_id = j.id) as step_count,
      (SELECT COUNT(*) FROM dependencies WHERE from_job_id = j.id) as out_deps,
      (SELECT COUNT(*) FROM dependencies WHERE to_job_id = j.id) as in_deps
    FROM jobs j
    LEFT JOIN groups_ g ON j.group_id = g.id
  `).all();

  const deps = db.prepare('SELECT id, from_job_id, to_job_id, type, description FROM dependencies').all();
  const groups = db.prepare('SELECT id, name, color FROM groups_ ORDER BY name').all();

  const edgeColors = { 'Girdi sağlar': '#10b981', 'Sıralı': '#3b82f6', 'Bilgi paylaşımı': '#f59e0b', 'Onay gerektirir': '#ef4444' };

  // Auto-layout: topological sort left-to-right
  const adjList = {};
  const inDegree = {};
  jobs.forEach(j => { adjList[j.id] = []; inDegree[j.id] = 0; });
  deps.forEach(d => {
    if (adjList[d.from_job_id]) adjList[d.from_job_id].push(d.to_job_id);
    if (inDegree[d.to_job_id] !== undefined) inDegree[d.to_job_id]++;
  });

  const layers = [];
  const visited = new Set();
  let queue = Object.keys(inDegree).filter(id => inDegree[id] === 0).map(Number);
  while (queue.length > 0) {
    layers.push([...queue]);
    queue.forEach(id => visited.add(id));
    const next = [];
    queue.forEach(id => {
      (adjList[id] || []).forEach(child => {
        inDegree[child]--;
        if (inDegree[child] === 0 && !visited.has(child)) next.push(child);
      });
    });
    queue = next;
  }
  // Add any unvisited (isolated) nodes
  const isolated = jobs.filter(j => !visited.has(j.id)).map(j => j.id);
  if (isolated.length) layers.push(isolated);

  const posMap = {};
  layers.forEach((layer, col) => {
    const offsetY = -(layer.length - 1) * 90;
    layer.forEach((id, row) => {
      posMap[id] = { x: col * 320 + 50, y: offsetY + row * 180 + 200 };
    });
  });

  const responsibles = [...new Set(jobs.map(j => j.responsible).filter(Boolean))];

  const nodes = jobs.map(job => ({
    id: String(job.id),
    data: {
      label: job.title, difficulty: job.difficulty, status: job.status,
      group: job.group_name, groupId: job.group_id, color: job.group_color || '#3b82f6',
      responsible: job.responsible, period: job.period,
      estimatedDuration: job.estimated_duration,
      stepCount: parseInt(job.step_count),
      environments: JSON.parse(job.environments || '[]'),
      outDeps: parseInt(job.out_deps), inDeps: parseInt(job.in_deps)
    },
    position: posMap[job.id] || { x: 0, y: 0 },
    type: 'jobNode'
  }));

  const edges = deps.map(d => ({
    id: `e${d.id}`, depId: d.id,
    source: String(d.from_job_id), target: String(d.to_job_id),
    label: d.type, type: 'smoothstep', animated: true,
    data: { type: d.type, description: d.description },
    style: { stroke: edgeColors[d.type] || '#6b7280', strokeWidth: 2 },
    markerEnd: { type: 'arrowclosed', color: edgeColors[d.type] || '#6b7280' }
  }));

  res.json({ nodes, edges, groups, responsibles });
});

export default router;
