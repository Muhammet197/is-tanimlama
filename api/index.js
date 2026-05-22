import { Pool } from '@neondatabase/serverless';
import express from 'express';

const app = express();
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
      warning TEXT
    )
  `);
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
  res.json(job);
});

app.post('/api/jobs', async (req, res) => {
  const pool = getPool();
  const { title, responsible, group_id, period, estimated_duration, difficulty, environments, prerequisites, notes, steps } = req.body;

  const { rows } = await pool.query(
    `INSERT INTO jobs (title, responsible, group_id, period, estimated_duration, difficulty, environments, prerequisites, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [title, responsible, group_id || null, period, estimated_duration, difficulty,
     JSON.stringify(environments || []), JSON.stringify(prerequisites || []), notes]
  );
  const jobId = rows[0].id;

  if (steps && steps.length > 0) {
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      await pool.query(
        'INSERT INTO steps (job_id, order_num, title, environment, description, tip, warning) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [jobId, i + 1, s.title, s.environment, s.description, s.tip, s.warning]
      );
    }
  }

  await pool.query("INSERT INTO history (job_id, date, person, note) VALUES ($1, CURRENT_DATE, $2, 'İlk oluşturma')",
    [jobId, responsible || 'Sistem']);

  res.status(201).json({ id: jobId });
});

app.put('/api/jobs/:id', async (req, res) => {
  const pool = getPool();
  const { title, responsible, group_id, period, estimated_duration, difficulty, environments, prerequisites, notes, status, steps } = req.body;

  await pool.query(
    `UPDATE jobs SET title=$1, responsible=$2, group_id=$3, period=$4, estimated_duration=$5, difficulty=$6,
     environments=$7, prerequisites=$8, notes=$9, status=$10, updated_at=CURRENT_TIMESTAMP WHERE id=$11`,
    [title, responsible, group_id || null, period, estimated_duration, difficulty,
     JSON.stringify(environments || []), JSON.stringify(prerequisites || []), notes, status || 'aktif', req.params.id]
  );

  if (steps) {
    await pool.query('DELETE FROM steps WHERE job_id = $1', [req.params.id]);
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      await pool.query(
        'INSERT INTO steps (job_id, order_num, title, environment, description, tip, warning) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [req.params.id, i + 1, s.title, s.environment, s.description, s.tip, s.warning]
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

export default app;
