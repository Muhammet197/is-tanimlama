// Tauri SQLite API — same interface as api.js but talks directly to local SQLite
import Database from '@tauri-apps/plugin-sql';

let _db = null;

async function getDb() {
  if (!_db) {
    _db = await Database.load('sqlite:is_tanimlama.db');
    // Enable foreign keys
    await _db.execute('PRAGMA foreign_keys = ON');
  }
  return _db;
}

export const api = {
  jobs: {
    list: async (params = {}) => {
      const db = await getDb();
      const { search, group_id, difficulty, status } = params;
      let sql = `
        SELECT j.*, g.name as group_name, g.color as group_color
        FROM jobs j
        LEFT JOIN groups_ g ON j.group_id = g.id
        WHERE 1=1
      `;
      const bindings = [];

      if (search) {
        sql += ` AND (j.title LIKE $1 OR j.responsible LIKE $2 OR j.notes LIKE $3)`;
        const s = `%${search}%`;
        bindings.push(s, s, s);
      }
      if (group_id) {
        sql += ` AND j.group_id = $${bindings.length + 1}`;
        bindings.push(Number(group_id));
      }
      if (difficulty) {
        sql += ` AND j.difficulty = $${bindings.length + 1}`;
        bindings.push(difficulty);
      }
      if (status) {
        sql += ` AND j.status = $${bindings.length + 1}`;
        bindings.push(status);
      }

      sql += ` ORDER BY j.updated_at DESC`;
      const jobs = await db.select(sql, bindings);

      // Add step count + parse JSON fields
      for (const j of jobs) {
        j.environments = JSON.parse(j.environments || '[]');
        j.prerequisites = JSON.parse(j.prerequisites || '[]');
        const rows = await db.select('SELECT COUNT(*) as count FROM steps WHERE job_id = $1', [j.id]);
        j.step_count = rows[0].count;
      }
      return jobs;
    },

    get: async (id) => {
      const db = await getDb();
      const rows = await db.select(`
        SELECT j.*, g.name as group_name, g.color as group_color
        FROM jobs j
        LEFT JOIN groups_ g ON j.group_id = g.id
        WHERE j.id = $1
      `, [Number(id)]);

      if (rows.length === 0) throw new Error('İş bulunamadı');
      const job = rows[0];

      job.environments = JSON.parse(job.environments || '[]');
      job.prerequisites = JSON.parse(job.prerequisites || '[]');
      job.steps = await db.select('SELECT * FROM steps WHERE job_id = $1 ORDER BY order_num', [Number(id)]);
      job.dependencies = await db.select(`
        SELECT d.*, j.title as to_job_title
        FROM dependencies d
        JOIN jobs j ON d.to_job_id = j.id
        WHERE d.from_job_id = $1
      `, [Number(id)]);
      job.dependent_by = await db.select(`
        SELECT d.*, j.title as from_job_title
        FROM dependencies d
        JOIN jobs j ON d.from_job_id = j.id
        WHERE d.to_job_id = $1
      `, [Number(id)]);
      job.history = await db.select('SELECT * FROM history WHERE job_id = $1 ORDER BY date DESC', [Number(id)]);

      return job;
    },

    create: async (data) => {
      const db = await getDb();
      const { title, responsible, group_id, period, estimated_duration, difficulty, environments, prerequisites, notes, steps } = data;

      const result = await db.execute(`
        INSERT INTO jobs (title, responsible, group_id, period, estimated_duration, difficulty, environments, prerequisites, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        title, responsible, group_id || null, period, estimated_duration, difficulty,
        JSON.stringify(environments || []),
        JSON.stringify(prerequisites || []),
        notes
      ]);

      const jobId = result.lastInsertId;

      if (steps && steps.length > 0) {
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          await db.execute(`
            INSERT INTO steps (job_id, order_num, title, environment, description, tip, warning, screenshot_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [jobId, i + 1, step.title, step.environment, step.description, step.tip, step.warning, step.screenshot_url || null]);
        }
      }

      await db.execute(`INSERT INTO history (job_id, date, person, note) VALUES ($1, date('now'), $2, 'İlk oluşturma')`,
        [jobId, responsible || 'Sistem']);

      return { id: jobId };
    },

    update: async (id, data) => {
      const db = await getDb();
      const { title, responsible, group_id, period, estimated_duration, difficulty, environments, prerequisites, notes, status, steps } = data;

      await db.execute(`
        UPDATE jobs SET title=$1, responsible=$2, group_id=$3, period=$4, estimated_duration=$5, difficulty=$6,
        environments=$7, prerequisites=$8, notes=$9, status=$10, updated_at=CURRENT_TIMESTAMP
        WHERE id=$11
      `, [
        title, responsible, group_id || null, period, estimated_duration, difficulty,
        JSON.stringify(environments || []),
        JSON.stringify(prerequisites || []),
        notes, status || 'aktif', Number(id)
      ]);

      if (steps) {
        await db.execute('DELETE FROM steps WHERE job_id = $1', [Number(id)]);
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          await db.execute(`
            INSERT INTO steps (job_id, order_num, title, environment, description, tip, warning, screenshot_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [Number(id), i + 1, step.title, step.environment, step.description, step.tip, step.warning, step.screenshot_url || null]);
        }
      }

      return { success: true };
    },

    delete: async (id) => {
      const db = await getDb();
      await db.execute('DELETE FROM jobs WHERE id = $1', [Number(id)]);
      return { success: true };
    },

    addHistory: async (id, data) => {
      const db = await getDb();
      const { date, person, note } = data;
      await db.execute('INSERT INTO history (job_id, date, person, note) VALUES ($1, $2, $3, $4)',
        [Number(id), date, person, note]);
      return { success: true };
    },
  },

  groups: {
    list: async () => {
      const db = await getDb();
      return db.select(`
        SELECT g.*, COUNT(j.id) as job_count
        FROM groups_ g
        LEFT JOIN jobs j ON j.group_id = g.id
        GROUP BY g.id
        ORDER BY g.name
      `);
    },

    create: async (data) => {
      const db = await getDb();
      const { name, description, color } = data;
      try {
        const result = await db.execute('INSERT INTO groups_ (name, description, color) VALUES ($1, $2, $3)',
          [name, description, color || '#3b82f6']);
        return { id: result.lastInsertId };
      } catch (e) {
        if (e.message && e.message.includes('UNIQUE')) {
          throw new Error('Bu grup zaten mevcut');
        }
        throw e;
      }
    },

    update: async (id, data) => {
      const db = await getDb();
      const { name, description, color } = data;
      await db.execute('UPDATE groups_ SET name=$1, description=$2, color=$3 WHERE id=$4',
        [name, description, color, Number(id)]);
      return { success: true };
    },

    delete: async (id) => {
      const db = await getDb();
      await db.execute('UPDATE jobs SET group_id = NULL WHERE group_id = $1', [Number(id)]);
      await db.execute('DELETE FROM groups_ WHERE id = $1', [Number(id)]);
      return { success: true };
    },
  },

  dependencies: {
    list: async () => {
      const db = await getDb();
      return db.select(`
        SELECT d.*,
          fj.title as from_job_title,
          tj.title as to_job_title
        FROM dependencies d
        JOIN jobs fj ON d.from_job_id = fj.id
        JOIN jobs tj ON d.to_job_id = tj.id
        ORDER BY d.id
      `);
    },

    create: async (data) => {
      const db = await getDb();
      const { from_job_id, to_job_id, type, description } = data;

      if (from_job_id === to_job_id) {
        throw new Error('Bir iş kendisine bağımlı olamaz');
      }

      const existing = await db.select(
        'SELECT id FROM dependencies WHERE from_job_id = $1 AND to_job_id = $2',
        [Number(from_job_id), Number(to_job_id)]
      );

      if (existing.length > 0) {
        throw new Error('Bu bağımlılık zaten mevcut');
      }

      const result = await db.execute(
        'INSERT INTO dependencies (from_job_id, to_job_id, type, description) VALUES ($1, $2, $3, $4)',
        [Number(from_job_id), Number(to_job_id), type || 'Sıralı', description]
      );
      return { id: result.lastInsertId };
    },

    delete: async (id) => {
      const db = await getDb();
      await db.execute('DELETE FROM dependencies WHERE id = $1', [Number(id)]);
      return { success: true };
    },
  },

  graph: {
    get: async () => {
      const db = await getDb();

      const jobs = await db.select(`
        SELECT j.*, g.name as group_name, g.color as group_color,
          (SELECT COUNT(*) FROM steps WHERE job_id = j.id) as step_count,
          (SELECT COUNT(*) FROM dependencies WHERE from_job_id = j.id) as out_deps,
          (SELECT COUNT(*) FROM dependencies WHERE to_job_id = j.id) as in_deps
        FROM jobs j
        LEFT JOIN groups_ g ON j.group_id = g.id
      `);

      const deps = await db.select('SELECT id, from_job_id, to_job_id, type, description FROM dependencies');
      const groups = await db.select('SELECT id, name, color FROM groups_ ORDER BY name');

      const edgeColors = { 'Girdi sağlar': '#10b981', 'Sıralı': '#3b82f6', 'Bilgi paylaşımı': '#f59e0b', 'Onay gerektirir': '#ef4444' };

      // Topological sort auto-layout
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

      return { nodes, edges, groups, responsibles };
    },
  },

  sessions: {
    list: async () => {
      const db = await getDb();
      const rows = await db.select(`
        SELECT ws.*, j.title as job_title, j.responsible, g.name as group_name, g.color as group_color,
          (SELECT COUNT(*) FROM steps WHERE job_id = ws.job_id) as total_steps
        FROM work_sessions ws
        JOIN jobs j ON ws.job_id = j.id
        LEFT JOIN groups_ g ON j.group_id = g.id
        WHERE ws.status IN ('active', 'paused')
        ORDER BY ws.started_at DESC
      `);
      rows.forEach(r => r.completed_steps = JSON.parse(r.completed_steps || '[]'));
      return rows;
    },

    create: async (data) => {
      const db = await getDb();
      const { job_id } = data;
      const existing = await db.select(
        "SELECT id FROM work_sessions WHERE job_id = $1 AND status IN ('active', 'paused')", [Number(job_id)]);
      if (existing.length > 0) throw new Error('Bu iş için zaten aktif bir oturum var');
      const result = await db.execute('INSERT INTO work_sessions (job_id) VALUES ($1)', [Number(job_id)]);
      return { id: result.lastInsertId };
    },

    update: async (id, data) => {
      const db = await getDb();
      const { status, current_step, completed_steps, pause_note } = data;
      let paused_at = null, completed_at = null;
      if (status === 'paused') paused_at = new Date().toISOString();
      if (status === 'completed') completed_at = new Date().toISOString();
      await db.execute(`
        UPDATE work_sessions SET status=$1, current_step=$2, completed_steps=$3, pause_note=$4, paused_at=$5, completed_at=$6
        WHERE id=$7
      `, [status, current_step, JSON.stringify(completed_steps || []), pause_note, paused_at, completed_at, Number(id)]);
      return { success: true };
    },

    resume: async (id) => {
      const db = await getDb();
      await db.execute("UPDATE work_sessions SET status='active', paused_at=NULL WHERE id=$1", [Number(id)]);
      return { success: true };
    },

    delete: async (id) => {
      const db = await getDb();
      await db.execute('DELETE FROM work_sessions WHERE id = $1', [Number(id)]);
      return { success: true };
    },
  },

  logs: {
    list: async (params = {}) => {
      const db = await getDb();
      const { job_id, person, search, date_from, date_to, limit: lim } = params;
      let sql = `
        SELECT h.*, j.title as job_title, g.name as group_name, g.color as group_color
        FROM history h
        JOIN jobs j ON h.job_id = j.id
        LEFT JOIN groups_ g ON j.group_id = g.id
        WHERE 1=1
      `;
      const bindings = [];

      if (job_id) {
        sql += ` AND h.job_id = $${bindings.length + 1}`;
        bindings.push(Number(job_id));
      }
      if (person) {
        sql += ` AND h.person = $${bindings.length + 1}`;
        bindings.push(person);
      }
      if (search) {
        sql += ` AND h.note LIKE $${bindings.length + 1}`;
        bindings.push(`%${search}%`);
      }
      if (date_from) {
        sql += ` AND h.date >= $${bindings.length + 1}`;
        bindings.push(date_from);
      }
      if (date_to) {
        sql += ` AND h.date <= $${bindings.length + 1}`;
        bindings.push(date_to);
      }

      sql += ` ORDER BY h.id DESC`;

      if (lim) {
        sql += ` LIMIT $${bindings.length + 1}`;
        bindings.push(Number(lim));
      } else {
        sql += ` LIMIT 200`;
      }

      return db.select(sql, bindings);
    },

    persons: async () => {
      const db = await getDb();
      return db.select('SELECT DISTINCT person FROM history ORDER BY person');
    },
  },
};
