import { Pool } from '@neondatabase/serverless';
import express from 'express';

const app = express();

// CORS — masaüstü uygulamasından veri aktarımı için
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

app.use(express.json());

function getPool() {
  return new Pool({ connectionString: process.env.DATABASE_URL });
}

// ---------- HEALTH ----------
app.get('/api/health', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT 1 as test');
    await pool.end();
    res.json({ status: 'ok', db: 'connected' });
  } catch (e) {
    res.json({ status: 'error', message: e.message, dbUrl: process.env.DATABASE_URL?.substring(0, 40) });
  }
});

// ---------- INIT ----------
app.post('/api/init', async (req, res) => {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS groups_ (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      color TEXT DEFAULT '#3b82f6',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      responsible TEXT,
      group_id INTEGER REFERENCES groups_(id) ON DELETE SET NULL,
      period TEXT,
      estimated_duration TEXT,
      difficulty TEXT,
      environments TEXT DEFAULT '[]',
      prerequisites TEXT DEFAULT '[]',
      notes TEXT,
      status TEXT DEFAULT 'aktif',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS steps (
      id SERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      order_num INTEGER NOT NULL,
      title TEXT NOT NULL,
      environment TEXT,
      description TEXT,
      tip TEXT,
      warning TEXT,
      screenshot_url TEXT
    )
  `);
  // Add screenshot_url column if table already exists
  await pool.query(`ALTER TABLE steps ADD COLUMN IF NOT EXISTS screenshot_url TEXT`).catch(() => {});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dependencies (
      id SERIAL PRIMARY KEY,
      from_job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      to_job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      type TEXT DEFAULT 'Sıralı',
      description TEXT
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS history (
      id SERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      person TEXT NOT NULL,
      note TEXT
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_sessions (
      id SERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'active',
      current_step INTEGER DEFAULT 0,
      completed_steps TEXT DEFAULT '[]',
      pause_note TEXT,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      paused_at TIMESTAMP,
      completed_at TIMESTAMP
    )
  `);
  // Users table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'editor',
      active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Add assigned_to column to jobs
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id)`).catch(() => {});
  // Comments table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      user_name TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Default admin user
  const admins = await pool.query("SELECT id FROM users WHERE username = 'admin'");
  if (admins.rows.length === 0) {
    const defaultHash = '9991ed489ce8a15455fc4a814a6c34843f0656cae16458f3593cb29b0eb5dfa4';
    await pool.query(
      "INSERT INTO users (username, password_hash, display_name, role) VALUES ('admin', $1, 'Yonetici', 'admin')",
      [defaultHash]
    );
  }
  res.json({ success: true, message: 'Tablolar oluşturuldu' });
});

// ---------- SEED ----------
app.post('/api/seed', async (req, res) => {
  const pool = getPool();
  await pool.query('DELETE FROM history');
  await pool.query('DELETE FROM dependencies');
  await pool.query('DELETE FROM steps');
  await pool.query('DELETE FROM jobs');
  await pool.query('DELETE FROM groups_');

  const g1 = await pool.query("INSERT INTO groups_ (name, description, color) VALUES ('Doküman İşlemleri', 'Word, PDF, doküman yükleme/indirme işlemleri', '#3b82f6') RETURNING id");
  const g2 = await pool.query("INSERT INTO groups_ (name, description, color) VALUES ('Raporlama', 'Dönemsel ve anlık raporlama işlemleri', '#10b981') RETURNING id");
  const g3 = await pool.query("INSERT INTO groups_ (name, description, color) VALUES ('Arşiv', 'Arşivleme ve yedekleme işlemleri', '#f59e0b') RETURNING id");

  const j1 = await pool.query(
    `INSERT INTO jobs (title, responsible, group_id, period, estimated_duration, difficulty, environments, prerequisites, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    ['Doküman Hazırlama ve Onay Süreci', 'Ahmet', g1.rows[0].id, '3 ayda bir', '~2 saat', 'Orta',
     JSON.stringify(['Microsoft Word', 'DMS (Web Uygulaması)', 'E-posta']),
     JSON.stringify(['DMS erişim yetkisi', 'Word şablon dosyasının güncel versiyonu', 'Onay verecek kişilerin listesi']),
     'Her çeyrekte şablon güncellenebilir. DMS\'e aynı anda birden fazla dosya yükleme.']
  );

  const steps = [
    ['Word Şablon Dosyasını Aç', 'Dosya Gezgini + Microsoft Word', 'C:\\Paylaşılan\\Şablonlar\\Dönemsel_Rapor_Şablonu.docx dosya yoluna git ve dosyayı aç.', 'Dosyanın son güncel versiyonunu kullandığından emin ol.', null],
    ['Dokümanı Standartlara Göre Doldur', 'Microsoft Word', 'Başlık, tarih, hazırlayan, özet, detaylar ve sonuç bölümlerini sırasıyla doldur.', null, 'Tablo formatını bozma. Hücreleri birleştirme veya satır ekleme/çıkarma yapma.'],
    ['Web Uygulamasına Yükle', 'Web Tarayıcı (DMS)', 'dms.sirket.com → Doküman Yükle → Kategori: Dönemsel Raporlar → Dönem seç → Dosya seç → Yükle', 'Yükleme sonrası sistem bir doküman numarası verecek. Bu numarayı not al.', null],
    ['Dokümanı İşlemlerden Geçir', 'Web Tarayıcı (DMS)', 'Doküman detay sayfası → İşlem Başlat → Format Kontrolü → İçerik Doğrulama → Sonucu kontrol et', null, 'Format kontrolü başarısız olursa genellikle tablo formatı bozulmuştur.'],
    ['Dokümanı İndir', 'Web Tarayıcı (DMS)', 'İşlemler tamamlandıktan sonra durum İşlem Tamamlandı olacak → İndir → PDF formatında indirilecek', null, null],
    ['Onay Al', 'E-posta + DMS', 'DMS → Onaya Gönder → Birim Yöneticisi seç → Açıklama yaz → Gönder', 'Onay 3 iş günü içinde gelmezse hatırlatma e-postası gönder.', null]
  ];
  for (let i = 0; i < steps.length; i++) {
    await pool.query(
      'INSERT INTO steps (job_id, order_num, title, environment, description, tip, warning) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [j1.rows[0].id, i + 1, ...steps[i]]
    );
  }

  const j2 = await pool.query(
    `INSERT INTO jobs (title, responsible, group_id, period, estimated_duration, difficulty, environments, prerequisites, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    ['Dönemsel Rapor Hazırlama', 'Ahmet', g2.rows[0].id, '3 ayda bir', '~3 saat', 'Karmaşık',
     JSON.stringify(['Excel', 'Power BI', 'E-posta']),
     JSON.stringify(['Onaylı dokümanlar hazır olmalı', 'Veri kaynakları güncel olmalı']),
     'Rapor formatı yıllık olarak güncellenir.']
  );

  const j3 = await pool.query(
    `INSERT INTO jobs (title, responsible, group_id, period, estimated_duration, difficulty, environments, prerequisites, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    ['Arşivleme Süreci', 'Mehmet', g3.rows[0].id, 'Aylık', '~30 dakika', 'Kolay',
     JSON.stringify(['DMS (Web Uygulaması)', 'Dosya Sunucusu']),
     JSON.stringify(['Onaylı dokümanlar mevcut olmalı']),
     'Arşivleme sonrası kontrol listesini doldur.']
  );

  await pool.query('INSERT INTO dependencies (from_job_id, to_job_id, type, description) VALUES ($1,$2,$3,$4)',
    [j1.rows[0].id, j2.rows[0].id, 'Girdi sağlar', 'Onaylı doküman rapor için girdi oluşturur']);
  await pool.query('INSERT INTO dependencies (from_job_id, to_job_id, type, description) VALUES ($1,$2,$3,$4)',
    [j1.rows[0].id, j3.rows[0].id, 'Sıralı', 'Onaylı doküman arşive taşınır']);

  await pool.query("INSERT INTO history (job_id, date, person, note) VALUES ($1, '2026-05-20', 'Ahmet', 'İlk oluşturma')", [j1.rows[0].id]);
  await pool.query("INSERT INTO history (job_id, date, person, note) VALUES ($1, '2026-05-20', 'Ahmet', 'İlk oluşturma')", [j2.rows[0].id]);
  await pool.query("INSERT INTO history (job_id, date, person, note) VALUES ($1, '2026-05-20', 'Mehmet', 'İlk oluşturma')", [j3.rows[0].id]);

  res.json({ success: true, message: 'Seed tamamlandı' });
});

// ---------- JOBS ----------
app.get('/api/jobs', async (req, res) => {
  const pool = getPool();
  const { search, group_id, difficulty, status } = req.query;
  let sql = `SELECT j.*, g.name as group_name, g.color as group_color FROM jobs j LEFT JOIN groups_ g ON j.group_id = g.id WHERE 1=1`;
  const params = [];
  let n = 1;

  if (search) {
    sql += ` AND (j.title ILIKE $${n} OR j.responsible ILIKE $${n} OR j.notes ILIKE $${n})`;
    params.push(`%${search}%`);
    n++;
  }
  if (group_id) { sql += ` AND j.group_id = $${n}`; params.push(group_id); n++; }
  if (difficulty) { sql += ` AND j.difficulty = $${n}`; params.push(difficulty); n++; }
  if (status) { sql += ` AND j.status = $${n}`; params.push(status); n++; }
  sql += ` ORDER BY j.updated_at DESC`;

  const { rows: jobs } = await pool.query(sql, params);

  for (const j of jobs) {
    j.environments = JSON.parse(j.environments || '[]');
    j.prerequisites = JSON.parse(j.prerequisites || '[]');
    const sc = await pool.query('SELECT COUNT(*) as count FROM steps WHERE job_id = $1', [j.id]);
    j.step_count = parseInt(sc.rows[0].count);
  }
  res.json(jobs);
});

app.get('/api/jobs/:id', async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT j.*, g.name as group_name, g.color as group_color FROM jobs j LEFT JOIN groups_ g ON j.group_id = g.id WHERE j.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'İş bulunamadı' });

  const job = rows[0];
  job.environments = JSON.parse(job.environments || '[]');
  job.prerequisites = JSON.parse(job.prerequisites || '[]');
  job.steps = (await pool.query('SELECT * FROM steps WHERE job_id = $1 ORDER BY order_num', [job.id])).rows;
  job.dependencies = (await pool.query(
    `SELECT d.*, j.title as to_job_title FROM dependencies d JOIN jobs j ON d.to_job_id = j.id WHERE d.from_job_id = $1`, [job.id]
  )).rows;
  job.dependent_by = (await pool.query(
    `SELECT d.*, j.title as from_job_title FROM dependencies d JOIN jobs j ON d.from_job_id = j.id WHERE d.to_job_id = $1`, [job.id]
  )).rows;
  job.history = (await pool.query('SELECT * FROM history WHERE job_id = $1 ORDER BY date DESC', [job.id])).rows;
  job.comments = (await pool.query('SELECT * FROM comments WHERE job_id = $1 ORDER BY created_at DESC', [job.id])).rows;
  res.json(job);
});

app.post('/api/jobs', async (req, res) => {
  const pool = getPool();
  const { title, responsible, group_id, period, estimated_duration, difficulty, environments, prerequisites, notes, steps, assigned_to } = req.body;

  const { rows } = await pool.query(
    `INSERT INTO jobs (title, responsible, group_id, period, estimated_duration, difficulty, environments, prerequisites, notes, assigned_to)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [title, responsible, group_id || null, period, estimated_duration, difficulty,
     JSON.stringify(environments || []), JSON.stringify(prerequisites || []), notes, assigned_to || null]
  );
  const jobId = rows[0].id;

  if (steps && steps.length > 0) {
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      await pool.query(
        'INSERT INTO steps (job_id, order_num, title, environment, description, tip, warning, screenshot_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [jobId, i + 1, s.title, s.environment, s.description, s.tip, s.warning, s.screenshot_url || null]
      );
    }
  }

  await pool.query("INSERT INTO history (job_id, date, person, note) VALUES ($1, CURRENT_DATE, $2, 'İlk oluşturma')",
    [jobId, responsible || 'Sistem']);

  res.status(201).json({ id: jobId });
});

app.put('/api/jobs/:id', async (req, res) => {
  const pool = getPool();
  const { title, responsible, group_id, period, estimated_duration, difficulty, environments, prerequisites, notes, status, steps, assigned_to } = req.body;

  await pool.query(
    `UPDATE jobs SET title=$1, responsible=$2, group_id=$3, period=$4, estimated_duration=$5, difficulty=$6,
     environments=$7, prerequisites=$8, notes=$9, status=$10, assigned_to=$11, updated_at=CURRENT_TIMESTAMP WHERE id=$12`,
    [title, responsible, group_id || null, period, estimated_duration, difficulty,
     JSON.stringify(environments || []), JSON.stringify(prerequisites || []), notes, status || 'aktif', assigned_to || null, req.params.id]
  );

  if (steps) {
    await pool.query('DELETE FROM steps WHERE job_id = $1', [req.params.id]);
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      await pool.query(
        'INSERT INTO steps (job_id, order_num, title, environment, description, tip, warning, screenshot_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [req.params.id, i + 1, s.title, s.environment, s.description, s.tip, s.warning, s.screenshot_url || null]
      );
    }
  }
  res.json({ success: true });
});

app.delete('/api/jobs/:id', async (req, res) => {
  const pool = getPool();
  await pool.query('DELETE FROM jobs WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

app.post('/api/jobs/:id/history', async (req, res) => {
  const pool = getPool();
  const { date, person, note } = req.body;
  await pool.query('INSERT INTO history (job_id, date, person, note) VALUES ($1,$2,$3,$4)', [req.params.id, date, person, note]);
  res.status(201).json({ success: true });
});

// ---------- GROUPS ----------
app.get('/api/groups', async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT g.*, COUNT(j.id) as job_count FROM groups_ g LEFT JOIN jobs j ON j.group_id = g.id GROUP BY g.id ORDER BY g.name
  `);
  res.json(rows);
});

app.post('/api/groups', async (req, res) => {
  const pool = getPool();
  const { name, description, color } = req.body;
  try {
    const { rows } = await pool.query('INSERT INTO groups_ (name, description, color) VALUES ($1,$2,$3) RETURNING id', [name, description, color || '#3b82f6']);
    res.status(201).json({ id: rows[0].id });
  } catch (e) {
    if (e.message.includes('unique') || e.message.includes('duplicate')) {
      return res.status(400).json({ error: 'Bu grup zaten mevcut' });
    }
    throw e;
  }
});

app.put('/api/groups/:id', async (req, res) => {
  const pool = getPool();
  const { name, description, color } = req.body;
  await pool.query('UPDATE groups_ SET name=$1, description=$2, color=$3 WHERE id=$4', [name, description, color, req.params.id]);
  res.json({ success: true });
});

app.delete('/api/groups/:id', async (req, res) => {
  const pool = getPool();
  await pool.query('UPDATE jobs SET group_id = NULL WHERE group_id = $1', [req.params.id]);
  await pool.query('DELETE FROM groups_ WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// ---------- DEPENDENCIES ----------
app.get('/api/dependencies', async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT d.*, fj.title as from_job_title, tj.title as to_job_title
    FROM dependencies d JOIN jobs fj ON d.from_job_id = fj.id JOIN jobs tj ON d.to_job_id = tj.id ORDER BY d.id
  `);
  res.json(rows);
});

app.post('/api/dependencies', async (req, res) => {
  const pool = getPool();
  const { from_job_id, to_job_id, type, description } = req.body;
  if (from_job_id === to_job_id) return res.status(400).json({ error: 'Bir iş kendisine bağımlı olamaz' });

  const existing = await pool.query('SELECT id FROM dependencies WHERE from_job_id = $1 AND to_job_id = $2', [from_job_id, to_job_id]);
  if (existing.rows.length > 0) return res.status(400).json({ error: 'Bu bağımlılık zaten mevcut' });

  const { rows } = await pool.query('INSERT INTO dependencies (from_job_id, to_job_id, type, description) VALUES ($1,$2,$3,$4) RETURNING id',
    [from_job_id, to_job_id, type || 'Sıralı', description]);
  res.status(201).json({ id: rows[0].id });
});

app.delete('/api/dependencies/:id', async (req, res) => {
  const pool = getPool();
  await pool.query('DELETE FROM dependencies WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// ---------- GRAPH ----------
app.get('/api/graph', async (req, res) => {
  const pool = getPool();
  const { rows: jobs } = await pool.query(`
    SELECT j.*, g.name as group_name, g.color as group_color,
      (SELECT COUNT(*) FROM steps WHERE job_id = j.id) as step_count,
      (SELECT COUNT(*) FROM dependencies WHERE from_job_id = j.id) as out_deps,
      (SELECT COUNT(*) FROM dependencies WHERE to_job_id = j.id) as in_deps
    FROM jobs j LEFT JOIN groups_ g ON j.group_id = g.id
  `);
  const { rows: deps } = await pool.query('SELECT id, from_job_id, to_job_id, type, description FROM dependencies');
  const { rows: groups } = await pool.query('SELECT id, name, color FROM groups_ ORDER BY name');

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

// ---------- WORK SESSIONS ----------
app.get('/api/sessions', async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query(`
    SELECT ws.*, j.title as job_title, j.responsible, g.name as group_name, g.color as group_color,
      (SELECT COUNT(*) FROM steps WHERE job_id = ws.job_id) as total_steps
    FROM work_sessions ws
    JOIN jobs j ON ws.job_id = j.id
    LEFT JOIN groups_ g ON j.group_id = g.id
    WHERE ws.status IN ('active', 'paused')
    ORDER BY ws.started_at DESC
  `);
  rows.forEach(r => r.completed_steps = JSON.parse(r.completed_steps || '[]'));
  res.json(rows);
});

app.post('/api/sessions', async (req, res) => {
  const pool = getPool();
  const { job_id } = req.body;
  // Check if there's already an active/paused session for this job
  const { rows: existing } = await pool.query(
    "SELECT id FROM work_sessions WHERE job_id = $1 AND status IN ('active', 'paused')", [job_id]);
  if (existing.length > 0) return res.status(400).json({ error: 'Bu iş için zaten aktif bir oturum var' });
  const { rows } = await pool.query(
    'INSERT INTO work_sessions (job_id) VALUES ($1) RETURNING id', [job_id]);
  res.status(201).json({ id: rows[0].id });
});

app.put('/api/sessions/:id', async (req, res) => {
  const pool = getPool();
  const { status, current_step, completed_steps, pause_note } = req.body;
  let paused_at = null, completed_at = null;
  if (status === 'paused') paused_at = new Date().toISOString();
  if (status === 'completed') completed_at = new Date().toISOString();
  await pool.query(`
    UPDATE work_sessions SET status=$1, current_step=$2, completed_steps=$3, pause_note=$4, paused_at=$5, completed_at=$6
    WHERE id=$7
  `, [status, current_step, JSON.stringify(completed_steps || []), pause_note, paused_at, completed_at, req.params.id]);
  res.json({ success: true });
});

app.put('/api/sessions/:id/resume', async (req, res) => {
  const pool = getPool();
  await pool.query("UPDATE work_sessions SET status='active', paused_at=NULL WHERE id=$1", [req.params.id]);
  res.json({ success: true });
});

app.delete('/api/sessions/:id', async (req, res) => {
  const pool = getPool();
  await pool.query('DELETE FROM work_sessions WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// ---------- LOGS (central activity log) ----------
app.get('/api/logs', async (req, res) => {
  const pool = getPool();
  const { job_id, person, search, date_from, date_to, limit: lim } = req.query;
  let sql = `
    SELECT h.*, j.title as job_title, g.name as group_name, g.color as group_color
    FROM history h
    JOIN jobs j ON h.job_id = j.id
    LEFT JOIN groups_ g ON j.group_id = g.id
    WHERE 1=1
  `;
  const params = [];
  if (job_id) { params.push(Number(job_id)); sql += ` AND h.job_id = $${params.length}`; }
  if (person) { params.push(person); sql += ` AND h.person = $${params.length}`; }
  if (search) { params.push(`%${search}%`); sql += ` AND h.note LIKE $${params.length}`; }
  if (date_from) { params.push(date_from); sql += ` AND h.date >= $${params.length}`; }
  if (date_to) { params.push(date_to); sql += ` AND h.date <= $${params.length}`; }
  sql += ` ORDER BY h.id DESC`;
  params.push(Number(lim) || 200);
  sql += ` LIMIT $${params.length}`;

  const { rows } = await pool.query(sql, params);
  await pool.end();
  res.json(rows);
});

app.get('/api/logs/persons', async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query('SELECT DISTINCT person FROM history ORDER BY person');
  await pool.end();
  res.json(rows);
});

// ---------- COMMENTS ----------
app.get('/api/jobs/:id/comments', async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query('SELECT * FROM comments WHERE job_id = $1 ORDER BY created_at DESC', [req.params.id]);
  await pool.end();
  res.json(rows);
});

app.post('/api/jobs/:id/comments', async (req, res) => {
  const pool = getPool();
  const { user_id, user_name, text } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO comments (job_id, user_id, user_name, text) VALUES ($1,$2,$3,$4) RETURNING *',
    [req.params.id, user_id || null, user_name, text]
  );
  await pool.end();
  res.status(201).json(rows[0]);
});

app.delete('/api/comments/:id', async (req, res) => {
  const pool = getPool();
  await pool.query('DELETE FROM comments WHERE id = $1', [req.params.id]);
  await pool.end();
  res.json({ success: true });
});

// ---------- BACKUP ----------
app.get('/api/backup/export', async (req, res) => {
  const pool = getPool();
  const groups = (await pool.query('SELECT * FROM groups_ ORDER BY id')).rows;
  const jobs = (await pool.query('SELECT * FROM jobs ORDER BY id')).rows;
  const steps = (await pool.query('SELECT * FROM steps ORDER BY job_id, order_num')).rows;
  const dependencies = (await pool.query('SELECT * FROM dependencies ORDER BY id')).rows;
  const history = (await pool.query('SELECT * FROM history ORDER BY id')).rows;
  const users = (await pool.query('SELECT id, username, password_hash, display_name, role, active, created_at FROM users ORDER BY id')).rows;
  const comments = (await pool.query('SELECT * FROM comments ORDER BY id')).rows;
  const sessions = (await pool.query('SELECT * FROM work_sessions ORDER BY id')).rows;
  await pool.end();
  res.json({
    _format: 'is-tanimlama-full-backup',
    _version: '2.0',
    _date: new Date().toISOString(),
    groups, jobs, steps, dependencies, history, users, comments, sessions
  });
});

app.post('/api/backup/import', async (req, res) => {
  const pool = getPool();
  const data = req.body;
  try {
    await pool.query('DELETE FROM comments');
    await pool.query('DELETE FROM work_sessions');
    await pool.query('DELETE FROM history');
    await pool.query('DELETE FROM dependencies');
    await pool.query('DELETE FROM steps');
    await pool.query('DELETE FROM jobs');
    await pool.query('DELETE FROM groups_');
    await pool.query('DELETE FROM users');

    for (const g of (data.groups || [])) {
      await pool.query('INSERT INTO groups_ (id, name, description, color, created_at) VALUES ($1,$2,$3,$4,$5)',
        [g.id, g.name, g.description, g.color, g.created_at]);
    }
    for (const j of (data.jobs || [])) {
      await pool.query('INSERT INTO jobs (id, title, responsible, group_id, period, estimated_duration, difficulty, environments, prerequisites, notes, status, assigned_to, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
        [j.id, j.title, j.responsible, j.group_id, j.period, j.estimated_duration, j.difficulty, j.environments, j.prerequisites, j.notes, j.status, j.assigned_to, j.created_at, j.updated_at]);
    }
    for (const s of (data.steps || [])) {
      await pool.query('INSERT INTO steps (id, job_id, order_num, title, environment, description, tip, warning, screenshot_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [s.id, s.job_id, s.order_num, s.title, s.environment, s.description, s.tip, s.warning, s.screenshot_url]);
    }
    for (const d of (data.dependencies || [])) {
      await pool.query('INSERT INTO dependencies (id, from_job_id, to_job_id, type, description) VALUES ($1,$2,$3,$4,$5)',
        [d.id, d.from_job_id, d.to_job_id, d.type, d.description]);
    }
    for (const h of (data.history || [])) {
      await pool.query('INSERT INTO history (id, job_id, date, person, note) VALUES ($1,$2,$3,$4,$5)',
        [h.id, h.job_id, h.date, h.person, h.note]);
    }
    for (const u of (data.users || [])) {
      await pool.query('INSERT INTO users (id, username, password_hash, display_name, role, active, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [u.id, u.username, u.password_hash, u.display_name, u.role, u.active, u.created_at]);
    }
    for (const c of (data.comments || [])) {
      await pool.query('INSERT INTO comments (id, job_id, user_id, user_name, text, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
        [c.id, c.job_id, c.user_id, c.user_name, c.text, c.created_at]);
    }
    for (const ws of (data.sessions || [])) {
      await pool.query('INSERT INTO work_sessions (id, job_id, status, current_step, completed_steps, pause_note, started_at, paused_at, completed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [ws.id, ws.job_id, ws.status, ws.current_step, ws.completed_steps, ws.pause_note, ws.started_at, ws.paused_at, ws.completed_at]);
    }
    await pool.end();
    res.json({ success: true });
  } catch (e) {
    await pool.end();
    res.status(500).json({ error: e.message });
  }
});

// ---------- USERS ----------
app.get('/api/users', async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query('SELECT id, username, display_name, role, active, created_at FROM users ORDER BY id');
  await pool.end();
  res.json(rows);
});

app.get('/api/users/:id', async (req, res) => {
  const pool = getPool();
  const { rows } = await pool.query('SELECT id, username, display_name, role, active, created_at FROM users WHERE id = $1', [req.params.id]);
  await pool.end();
  if (!rows[0]) return res.status(404).json({ error: 'Kullanici bulunamadi' });
  res.json(rows[0]);
});

app.post('/api/users/login', async (req, res) => {
  const pool = getPool();
  const { username, password_hash } = req.body;
  const { rows } = await pool.query(
    'SELECT id, username, display_name, role, active FROM users WHERE username = $1 AND password_hash = $2',
    [username, password_hash]
  );
  await pool.end();
  if (rows.length === 0) return res.json({ error: 'Kullanici adi veya sifre hatali' });
  if (!rows[0].active) return res.json({ error: 'Bu hesap devre disi birakilmis' });
  res.json(rows[0]);
});

app.post('/api/users', async (req, res) => {
  const pool = getPool();
  const { username, password_hash, display_name, role } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (username, password_hash, display_name, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [username, password_hash, display_name, role || 'editor']
    );
    await pool.end();
    res.status(201).json({ id: rows[0].id });
  } catch (e) {
    if (e.message.includes('unique') || e.message.includes('duplicate')) {
      return res.status(400).json({ error: 'Bu kullanici adi zaten mevcut' });
    }
    throw e;
  }
});

app.put('/api/users/:id', async (req, res) => {
  const pool = getPool();
  const { display_name, role, active, password_hash } = req.body;
  if (password_hash) {
    await pool.query(
      'UPDATE users SET display_name=$1, role=$2, active=$3, password_hash=$4 WHERE id=$5',
      [display_name, role, active !== undefined ? active : 1, password_hash, req.params.id]
    );
  } else {
    await pool.query(
      'UPDATE users SET display_name=$1, role=$2, active=$3 WHERE id=$4',
      [display_name, role, active !== undefined ? active : 1, req.params.id]
    );
  }
  await pool.end();
  res.json({ success: true });
});

app.put('/api/users/:id/password', async (req, res) => {
  const pool = getPool();
  const { password_hash } = req.body;
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, req.params.id]);
  await pool.end();
  res.json({ success: true });
});

app.delete('/api/users/:id', async (req, res) => {
  const pool = getPool();
  const admins = await pool.query("SELECT id FROM users WHERE role = 'admin' AND active = 1");
  const user = await pool.query('SELECT role FROM users WHERE id = $1', [req.params.id]);
  if (user.rows[0]?.role === 'admin' && admins.rows.length <= 1) {
    await pool.end();
    return res.status(400).json({ error: 'Son yonetici silinemez' });
  }
  await pool.query('UPDATE jobs SET assigned_to = NULL WHERE assigned_to = $1', [req.params.id]);
  await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  await pool.end();
  res.json({ success: true });
});

export default app;
