import db from './db.js';

db.prepare('DELETE FROM history').run();
db.prepare('DELETE FROM dependencies').run();
db.prepare('DELETE FROM steps').run();
db.prepare('DELETE FROM jobs').run();
db.prepare('DELETE FROM groups_').run();

const g1 = db.prepare("INSERT INTO groups_ (name, description, color) VALUES (?, ?, ?)")
  .run('Doküman İşlemleri', 'Word, PDF, doküman yükleme/indirme işlemleri', '#3b82f6');
const g2 = db.prepare("INSERT INTO groups_ (name, description, color) VALUES (?, ?, ?)")
  .run('Raporlama', 'Dönemsel ve anlık raporlama işlemleri', '#10b981');
const g3 = db.prepare("INSERT INTO groups_ (name, description, color) VALUES (?, ?, ?)")
  .run('Arşiv', 'Arşivleme ve yedekleme işlemleri', '#f59e0b');

const j1 = db.prepare(`
  INSERT INTO jobs (title, responsible, group_id, period, estimated_duration, difficulty, environments, prerequisites, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'Doküman Hazırlama ve Onay Süreci', 'Ahmet', g1.lastInsertRowid,
  '3 ayda bir', '~2 saat', 'Orta',
  JSON.stringify(['Microsoft Word', 'DMS (Web Uygulaması)', 'E-posta']),
  JSON.stringify(['DMS erişim yetkisi', 'Word şablon dosyasının güncel versiyonu', 'Onay verecek kişilerin listesi']),
  'Her çeyrekte şablon güncellenebilir. DMS\'e aynı anda birden fazla dosya yükleme.'
);

const steps1 = [
  { title: 'Word Şablon Dosyasını Aç', environment: 'Dosya Gezgini + Microsoft Word', description: 'C:\\Paylaşılan\\Şablonlar\\Dönemsel_Rapor_Şablonu.docx dosya yoluna git ve dosyayı aç.', tip: 'Dosyanın son güncel versiyonunu kullandığından emin ol. Sağ tıkla → Özellikler → "Değiştirilme tarihi"ni kontrol et.', warning: null },
  { title: 'Dokümanı Standartlara Göre Doldur', environment: 'Microsoft Word', description: 'Başlık alanına "Dönemsel Değerlendirme Raporu - [Yıl] Q[Çeyrek]" formatında yaz. Tarih, hazırlayan, özet, detaylar ve sonuç bölümlerini sırasıyla doldur.', tip: null, warning: 'Tablo formatını bozma. Hücreleri birleştirme veya satır ekleme/çıkarma yapma.' },
  { title: 'Web Uygulamasına Yükle', environment: 'Web Tarayıcı (DMS)', description: 'dms.sirket.com adresine git → "Doküman Yükle" → Kategori: Dönemsel Raporlar → Dönem seç → Dosya seç → Yükle', tip: 'Yükleme sonrası sistem bir doküman numarası verecek. Bu numarayı not al.', warning: null },
  { title: 'Dokümanı İşlemlerden Geçir', environment: 'Web Tarayıcı (DMS)', description: 'Doküman detay sayfası → "İşlem Başlat" → "Format Kontrolü" (otomatik) → "İçerik Doğrulama" → Sonucu kontrol et', tip: null, warning: 'Format kontrolü başarısız olursa genellikle tablo formatı bozulmuştur.' },
  { title: 'Dokümanı İndir', environment: 'Web Tarayıcı (DMS)', description: 'İşlemler tamamlandıktan sonra durum "İşlem Tamamlandı" olacak → "İndir" → PDF formatında indirilecek → Damga ve işlem numarası kontrolü yap', tip: null, warning: null },
  { title: 'Onay Al', environment: 'E-posta + DMS', description: 'DMS → "Onaya Gönder" → Birim Yöneticisi seç → Açıklama yaz → Gönder. Onay 3 iş günü içinde gelmezse hatırlatma gönder.', tip: 'Onay 3 iş günü içinde gelmezse hatırlatma e-postası gönder.', warning: null }
];

const insertStep = db.prepare('INSERT INTO steps (job_id, order_num, title, environment, description, tip, warning) VALUES (?, ?, ?, ?, ?, ?, ?)');
steps1.forEach((s, i) => insertStep.run(j1.lastInsertRowid, i + 1, s.title, s.environment, s.description, s.tip, s.warning));

const j2 = db.prepare(`
  INSERT INTO jobs (title, responsible, group_id, period, estimated_duration, difficulty, environments, prerequisites, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'Dönemsel Rapor Hazırlama', 'Ahmet', g2.lastInsertRowid,
  '3 ayda bir', '~3 saat', 'Karmaşık',
  JSON.stringify(['Excel', 'Power BI', 'E-posta']),
  JSON.stringify(['Onaylı dokümanlar hazır olmalı', 'Veri kaynakları güncel olmalı']),
  'Rapor formatı yıllık olarak güncellenir.'
);

const j3 = db.prepare(`
  INSERT INTO jobs (title, responsible, group_id, period, estimated_duration, difficulty, environments, prerequisites, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'Arşivleme Süreci', 'Mehmet', g3.lastInsertRowid,
  'Aylık', '~30 dakika', 'Kolay',
  JSON.stringify(['DMS (Web Uygulaması)', 'Dosya Sunucusu']),
  JSON.stringify(['Onaylı dokümanlar mevcut olmalı']),
  'Arşivleme sonrası kontrol listesini doldur.'
);

db.prepare('INSERT INTO dependencies (from_job_id, to_job_id, type, description) VALUES (?, ?, ?, ?)')
  .run(j1.lastInsertRowid, j2.lastInsertRowid, 'Girdi sağlar', 'Onaylı doküman rapor için girdi oluşturur');
db.prepare('INSERT INTO dependencies (from_job_id, to_job_id, type, description) VALUES (?, ?, ?, ?)')
  .run(j1.lastInsertRowid, j3.lastInsertRowid, 'Sıralı', 'Onaylı doküman arşive taşınır');

db.prepare("INSERT INTO history (job_id, date, person, note) VALUES (?, '2026-05-20', 'Ahmet', 'İlk oluşturma')")
  .run(j1.lastInsertRowid);
db.prepare("INSERT INTO history (job_id, date, person, note) VALUES (?, '2026-05-20', 'Ahmet', 'İlk oluşturma')")
  .run(j2.lastInsertRowid);
db.prepare("INSERT INTO history (job_id, date, person, note) VALUES (?, '2026-05-20', 'Mehmet', 'İlk oluşturma')")
  .run(j3.lastInsertRowid);

console.log('Seed tamamlandı: 3 grup, 3 iş, 6 adım, 2 bağımlılık eklendi.');
