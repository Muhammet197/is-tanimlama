// ─── Markdown Export (AI-friendly format) ───────────────

export function generateJobMarkdown(job) {
  const lines = [];

  // YAML Frontmatter
  lines.push('---');
  lines.push(`baslik: "${job.title}"`);
  if (job.responsible) lines.push(`sorumlu: ${job.responsible}`);
  if (job.group_name) lines.push(`grup: ${job.group_name}`);
  if (job.difficulty) lines.push(`zorluk: ${job.difficulty}`);
  if (job.period) lines.push(`periyot: ${job.period}`);
  if (job.estimated_duration) lines.push(`tahmini_sure: ${job.estimated_duration}`);
  lines.push(`durum: ${job.status || 'aktif'}`);
  if (job.environments?.length > 0) {
    lines.push(`ortamlar: [${job.environments.join(', ')}]`);
  }
  if (job.dependencies?.length > 0) {
    lines.push(`bagimliliklari_tetikler: [${job.dependencies.map(d => d.to_job_title).join(', ')}]`);
  }
  if (job.dependent_by?.length > 0) {
    lines.push(`bagimli_oldugu: [${job.dependent_by.map(d => d.from_job_title).join(', ')}]`);
  }
  lines.push('---');
  lines.push('');

  // Prerequisites
  if (job.prerequisites?.length > 0) {
    lines.push('## On Kosullar');
    job.prerequisites.forEach(p => lines.push(`- [ ] ${p}`));
    lines.push('');
  }

  // Steps
  if (job.steps?.length > 0) {
    lines.push(`## Adimlar`);
    lines.push('');
    job.steps.forEach(step => {
      const num = step.order_num || step.step_order;
      lines.push(`### Adim ${num}: ${step.title}`);
      if (step.environment) lines.push(`- **Ortam:** ${step.environment}`);
      if (step.description) lines.push(`- **Talimat:** ${step.description}`);
      if (step.tip) lines.push(`- **Ipucu:** ${step.tip}`);
      if (step.warning) lines.push(`- **Uyari:** ${step.warning}`);
      if (step.screenshot_url) lines.push(`- **Ekran Goruntusu:** ![${step.title}](${step.screenshot_url})`);
      lines.push('');
    });
  }

  // Checklist
  if (job.steps?.length > 0) {
    lines.push('## Kontrol Listesi');
    job.steps.forEach(step => {
      lines.push(`- [ ] Adim ${step.order_num || step.step_order}: ${step.title}`);
    });
    lines.push('- [ ] Is tamamlandi ve onaylandi');
    lines.push('');
  }

  // Dependencies
  if (job.dependencies?.length > 0 || job.dependent_by?.length > 0) {
    lines.push('## Bagimliliklar');
    if (job.dependencies?.length > 0) {
      lines.push('### Bu is tamamlaninca:');
      job.dependencies.forEach(d => {
        lines.push(`- [[${d.to_job_title}]] - ${d.type}${d.description ? ': ' + d.description : ''}`);
      });
    }
    if (job.dependent_by?.length > 0) {
      lines.push('### Bu is sunlara bagimli:');
      job.dependent_by.forEach(d => {
        lines.push(`- [[${d.from_job_title}]] - ${d.type}${d.description ? ': ' + d.description : ''}`);
      });
    }
    lines.push('');
  }

  // Notes
  if (job.notes) {
    lines.push('## Notlar');
    lines.push(job.notes);
    lines.push('');
  }

  // History
  if (job.history?.length > 0) {
    lines.push('## Gecmis');
    lines.push('| Tarih | Yapan | Not |');
    lines.push('|-------|-------|-----|');
    job.history.forEach(h => {
      lines.push(`| ${h.date} | ${h.person} | ${h.note} |`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Bulk Markdown (Obsidian vault structure) ───────────

export function generateAnaSayfa(jobs, groups) {
  const lines = [];
  lines.push('---');
  lines.push('baslik: Is Tanimlama - Ana Sayfa');
  lines.push(`olusturma_tarihi: ${new Date().toISOString().split('T')[0]}`);
  lines.push(`toplam_is: ${jobs.length}`);
  lines.push(`toplam_grup: ${groups.length}`);
  lines.push('---');
  lines.push('');
  lines.push('# Is Tanimlama Sistemi');
  lines.push('');
  lines.push('## Isler');
  jobs.forEach(j => {
    lines.push(`- [[${j.title}]] (${j.responsible || 'Atanmamis'}) - ${j.difficulty || 'Belirsiz'}`);
  });
  lines.push('');
  lines.push('## Gruplar');
  groups.forEach(g => {
    lines.push(`- **${g.name}**: ${g.description || ''} (${g.job_count || 0} is)`);
  });
  lines.push('');
  return lines.join('\n');
}

export function generateGroupMarkdown(group, jobs) {
  const lines = [];
  lines.push('---');
  lines.push(`grup_adi: "${group.name}"`);
  lines.push(`renk: "${group.color || '#3b82f6'}"`);
  lines.push('---');
  lines.push('');
  lines.push(`# ${group.name}`);
  if (group.description) lines.push(`\n${group.description}`);
  lines.push('');
  lines.push('## Bu Gruptaki Isler');
  const groupJobs = jobs.filter(j => j.group_id === group.id);
  if (groupJobs.length > 0) {
    groupJobs.forEach(j => lines.push(`- [[${j.title}]]`));
  } else {
    lines.push('_Bu grupta henuz is yok._');
  }
  lines.push('');
  return lines.join('\n');
}

// ─── PDF Print HTML ─────────────────────────────────────

export function generatePrintHTML(job) {
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${job.title}</title>
<style>
body{font-family:'Segoe UI',Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1e293b;line-height:1.6}
h1{font-size:24px;border-bottom:2px solid #e2e8f0;padding-bottom:8px}
h2{font-size:18px;margin-top:28px;color:#334155;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
.meta{display:flex;gap:8px;margin:12px 0;flex-wrap:wrap}
.badge{padding:2px 10px;border-radius:12px;font-size:12px;display:inline-block}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
.info-item{padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0}
.info-label{font-size:11px;color:#64748b;text-transform:uppercase;font-weight:600}
.info-value{font-size:15px;font-weight:600;margin-top:4px}
.step{padding:16px 16px 16px 56px;border:1px solid #e2e8f0;border-radius:8px;margin:12px 0;position:relative;page-break-inside:avoid}
.step-num{position:absolute;left:14px;top:16px;width:30px;height:30px;background:#3b82f6;color:#fff;border-radius:50%;text-align:center;line-height:30px;font-weight:700;font-size:13px}
.step-title{font-weight:600;font-size:15px}
.step-env{color:#3b82f6;font-size:12px;margin:4px 0;font-weight:500}
.step-desc{margin:8px 0;line-height:1.7;white-space:pre-wrap}
.tip{background:#f0fdf4;border-left:3px solid #10b981;padding:8px 12px;font-size:13px;margin:8px 0;border-radius:4px;color:#166534}
.warning{background:#fef2f2;border-left:3px solid #ef4444;padding:8px 12px;font-size:13px;margin:8px 0;border-radius:4px;color:#991b1b}
.step-img{max-width:100%;border-radius:6px;border:1px solid #e2e8f0;margin:8px 0}
.dep{padding:8px 12px;background:#f8fafc;border-radius:6px;margin:4px 0;font-size:14px}
.footer{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center}
@media print{body{padding:20px} .step{break-inside:avoid}}
</style></head><body>`;

  html += `<h1>${job.title}</h1>`;
  html += '<div class="meta">';
  if (job.difficulty) {
    const bg = job.difficulty === 'Kolay' ? '#d1fae5' : job.difficulty === 'Orta' ? '#fef3c7' : '#fee2e2';
    const fg = job.difficulty === 'Kolay' ? '#065f46' : job.difficulty === 'Orta' ? '#92400e' : '#991b1b';
    html += `<span class="badge" style="background:${bg};color:${fg}">${job.difficulty}</span>`;
  }
  if (job.group_name) html += `<span class="badge" style="background:#dbeafe;color:#1e40af">${job.group_name}</span>`;
  html += `<span class="badge" style="background:#f1f5f9;color:#475569">${job.status}</span>`;
  html += '</div>';

  html += '<div class="info-grid">';
  html += `<div class="info-item"><div class="info-label">Sorumlu</div><div class="info-value">${job.responsible || '-'}</div></div>`;
  html += `<div class="info-item"><div class="info-label">Periyot</div><div class="info-value">${job.period || '-'}</div></div>`;
  html += `<div class="info-item"><div class="info-label">Tahmini Sure</div><div class="info-value">${job.estimated_duration || '-'}</div></div>`;
  html += `<div class="info-item"><div class="info-label">Zorluk</div><div class="info-value">${job.difficulty || '-'}</div></div>`;
  html += '</div>';

  if (job.environments?.length > 0) {
    html += '<h2>Ortamlar</h2><div>';
    html += job.environments.map(e => `<span class="badge" style="background:#f1f5f9;color:#475569;margin:2px">${e}</span>`).join(' ');
    html += '</div>';
  }

  if (job.steps?.length > 0) {
    html += `<h2>Adimlar (${job.steps.length})</h2>`;
    job.steps.forEach(step => {
      html += '<div class="step">';
      html += `<span class="step-num">${step.order_num || step.step_order}</span>`;
      html += `<div class="step-title">${step.title}</div>`;
      if (step.environment) html += `<div class="step-env">${step.environment}</div>`;
      if (step.description) html += `<div class="step-desc">${step.description}</div>`;
      if (step.tip) html += `<div class="tip">Ipucu: ${step.tip}</div>`;
      if (step.warning) html += `<div class="warning">Dikkat: ${step.warning}</div>`;
      if (step.screenshot_url) html += `<img class="step-img" src="${step.screenshot_url}" alt="${step.title}" />`;
      html += '</div>';
    });
  }

  if (job.dependencies?.length > 0 || job.dependent_by?.length > 0) {
    html += '<h2>Bagimliliklar</h2>';
    if (job.dependencies?.length > 0) {
      html += '<p style="font-weight:600;font-size:14px">Bu is tamamlaninca baslatilabilir:</p>';
      job.dependencies.forEach(d => html += `<div class="dep">→ ${d.to_job_title} <span style="color:#64748b">(${d.type})</span></div>`);
    }
    if (job.dependent_by?.length > 0) {
      html += '<p style="font-weight:600;font-size:14px;margin-top:12px">Bu is sunlara bagimli:</p>';
      job.dependent_by.forEach(d => html += `<div class="dep">← ${d.from_job_title} <span style="color:#64748b">(${d.type})</span></div>`);
    }
  }

  if (job.notes) {
    html += `<h2>Notlar</h2><p style="white-space:pre-wrap">${job.notes}</p>`;
  }

  html += `<div class="footer">Is Tanimlama - Operasyonel Runbook Sistemi | Olusturulma: ${new Date().toLocaleDateString('tr-TR')}</div>`;
  html += '</body></html>';
  return html;
}

// ─── CSV Export ─────────────────────────────────────────

function escapeCsv(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function generateJobsCsv(jobs) {
  const headers = ['ID', 'Baslik', 'Sorumlu', 'Grup', 'Zorluk', 'Periyot', 'Tahmini Sure', 'Durum', 'Adim Sayisi', 'Olusturulma'];
  const rows = jobs.map(j => [
    j.id, j.title, j.responsible || '', j.group_name || '', j.difficulty || '',
    j.period || '', j.estimated_duration || '', j.status || '', j.step_count || 0,
    j.created_at ? new Date(j.created_at).toLocaleDateString('tr-TR') : ''
  ]);
  return [headers, ...rows].map(r => r.map(escapeCsv).join(',')).join('\n');
}

export function generateLogsCsv(logs) {
  const headers = ['ID', 'Tarih', 'Is', 'Grup', 'Kisi', 'Not'];
  const rows = logs.map(l => [
    l.id, l.date, l.job_title || '', l.group_name || '', l.person, l.note || ''
  ]);
  return [headers, ...rows].map(r => r.map(escapeCsv).join(',')).join('\n');
}

export function generateJobDetailCsv(job) {
  const lines = [];
  // Job info
  lines.push(['Bilgi', 'Deger'].map(escapeCsv).join(','));
  lines.push(['Baslik', job.title].map(escapeCsv).join(','));
  lines.push(['Sorumlu', job.responsible || ''].map(escapeCsv).join(','));
  lines.push(['Grup', job.group_name || ''].map(escapeCsv).join(','));
  lines.push(['Zorluk', job.difficulty || ''].map(escapeCsv).join(','));
  lines.push(['Periyot', job.period || ''].map(escapeCsv).join(','));
  lines.push(['Tahmini Sure', job.estimated_duration || ''].map(escapeCsv).join(','));
  lines.push(['Durum', job.status || ''].map(escapeCsv).join(','));
  lines.push('');

  // Steps
  if (job.steps?.length > 0) {
    lines.push(['Adim No', 'Baslik', 'Ortam', 'Aciklama', 'Ipucu', 'Uyari'].map(escapeCsv).join(','));
    job.steps.forEach(s => {
      lines.push([s.order_num, s.title, s.environment || '', s.description || '', s.tip || '', s.warning || ''].map(escapeCsv).join(','));
    });
    lines.push('');
  }

  // History
  if (job.history?.length > 0) {
    lines.push(['Tarih', 'Kisi', 'Not'].map(escapeCsv).join(','));
    job.history.forEach(h => {
      lines.push([h.date, h.person, h.note || ''].map(escapeCsv).join(','));
    });
  }

  return lines.join('\n');
}

// ─── Enhanced PDF Report ────────────────────────────────

export function generateDetailedPDF(job) {
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${job.title} - Detayli Rapor</title>
<style>
body{font-family:'Segoe UI',Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px 40px 60px;color:#1e293b;line-height:1.6;font-size:14px}
.cover{text-align:center;padding:60px 0 40px;border-bottom:3px solid #3b82f6;margin-bottom:30px}
.cover h1{font-size:28px;color:#1e293b;margin-bottom:8px}
.cover .subtitle{font-size:15px;color:#64748b;margin-bottom:20px}
.cover .meta-line{font-size:12px;color:#94a3b8}
h2{font-size:17px;margin-top:28px;color:#1e40af;border-bottom:2px solid #e2e8f0;padding-bottom:6px;text-transform:uppercase;letter-spacing:0.5px}
.badge{padding:3px 12px;border-radius:12px;font-size:11px;font-weight:600;display:inline-block;margin:2px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0}
.info-item{padding:14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0}
.info-label{font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:0.5px}
.info-value{font-size:15px;font-weight:600;margin-top:4px}
.step{padding:16px 16px 16px 56px;border:1px solid #e2e8f0;border-radius:8px;margin:10px 0;position:relative;page-break-inside:avoid}
.step-num{position:absolute;left:14px;top:16px;width:30px;height:30px;background:#3b82f6;color:#fff;border-radius:50%;text-align:center;line-height:30px;font-weight:700;font-size:13px}
.step-title{font-weight:600;font-size:15px}
.step-env{color:#3b82f6;font-size:12px;margin:4px 0;font-weight:500}
.step-desc{margin:8px 0;line-height:1.7;white-space:pre-wrap}
.tip{background:#f0fdf4;border-left:3px solid #10b981;padding:8px 12px;font-size:12px;margin:6px 0;border-radius:4px;color:#166534}
.warning{background:#fef2f2;border-left:3px solid #ef4444;padding:8px 12px;font-size:12px;margin:6px 0;border-radius:4px;color:#991b1b}
.step-img{max-width:100%;border-radius:6px;border:1px solid #e2e8f0;margin:8px 0}
.dep{padding:8px 12px;background:#f8fafc;border-radius:6px;margin:4px 0;font-size:13px;border:1px solid #e2e8f0}
table{width:100%;border-collapse:collapse;margin:10px 0;font-size:13px}
th{background:#f1f5f9;padding:8px 12px;text-align:left;font-weight:600;border:1px solid #e2e8f0;font-size:11px;text-transform:uppercase}
td{padding:8px 12px;border:1px solid #e2e8f0}
tr:nth-child(even){background:#f8fafc}
.checklist{list-style:none;padding:0}
.checklist li{padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
.checklist li:before{content:"\\2610  ";color:#94a3b8}
.footer{margin-top:40px;padding-top:16px;border-top:2px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}
.page-break{page-break-before:always}
@media print{body{padding:20px} .step{break-inside:avoid} .page-break{break-before:page}}
</style></head><body>`;

  // Cover
  html += '<div class="cover">';
  html += `<h1>${job.title}</h1>`;
  html += `<div class="subtitle">Operasyonel Runbook - Detayli Rapor</div>`;
  html += '<div style="margin:12px 0">';
  if (job.difficulty) {
    const bg = job.difficulty === 'Kolay' ? '#d1fae5' : job.difficulty === 'Orta' ? '#fef3c7' : '#fee2e2';
    const fg = job.difficulty === 'Kolay' ? '#065f46' : job.difficulty === 'Orta' ? '#92400e' : '#991b1b';
    html += `<span class="badge" style="background:${bg};color:${fg}">${job.difficulty}</span>`;
  }
  if (job.group_name) html += `<span class="badge" style="background:#dbeafe;color:#1e40af">${job.group_name}</span>`;
  html += `<span class="badge" style="background:#f1f5f9;color:#475569">${job.status}</span>`;
  html += '</div>';
  html += `<div class="meta-line">Rapor tarihi: ${new Date().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}</div>`;
  html += '</div>';

  // Info grid
  html += '<h2>Genel Bilgiler</h2>';
  html += '<div class="info-grid">';
  html += `<div class="info-item"><div class="info-label">Sorumlu</div><div class="info-value">${job.responsible || '-'}</div></div>`;
  html += `<div class="info-item"><div class="info-label">Periyot</div><div class="info-value">${job.period || '-'}</div></div>`;
  html += `<div class="info-item"><div class="info-label">Tahmini Sure</div><div class="info-value">${job.estimated_duration || '-'}</div></div>`;
  html += `<div class="info-item"><div class="info-label">Zorluk</div><div class="info-value">${job.difficulty || '-'}</div></div>`;
  html += `<div class="info-item"><div class="info-label">Adim Sayisi</div><div class="info-value">${job.steps?.length || 0}</div></div>`;
  html += `<div class="info-item"><div class="info-label">Durum</div><div class="info-value">${job.status || '-'}</div></div>`;
  html += '</div>';

  // Environments
  if (job.environments?.length > 0) {
    html += '<h2>Kullanilan Ortamlar</h2><div>';
    html += job.environments.map(e => `<span class="badge" style="background:#f1f5f9;color:#475569;margin:2px">${e}</span>`).join(' ');
    html += '</div>';
  }

  // Prerequisites
  if (job.prerequisites?.length > 0) {
    html += '<h2>On Kosullar</h2><ul class="checklist">';
    job.prerequisites.forEach(p => html += `<li>${p}</li>`);
    html += '</ul>';
  }

  // Steps
  if (job.steps?.length > 0) {
    html += `<h2>Adimlar (${job.steps.length})</h2>`;
    job.steps.forEach(step => {
      html += '<div class="step">';
      html += `<span class="step-num">${step.order_num || step.step_order}</span>`;
      html += `<div class="step-title">${step.title}</div>`;
      if (step.environment) html += `<div class="step-env">${step.environment}</div>`;
      if (step.description) html += `<div class="step-desc">${step.description}</div>`;
      if (step.tip) html += `<div class="tip">Ipucu: ${step.tip}</div>`;
      if (step.warning) html += `<div class="warning">Dikkat: ${step.warning}</div>`;
      if (step.screenshot_url && !step.screenshot_url.startsWith('data:')) {
        html += `<img class="step-img" src="${step.screenshot_url}" alt="${step.title}" />`;
      }
      html += '</div>';
    });

    // Checklist
    html += '<h2>Kontrol Listesi</h2><ul class="checklist">';
    job.steps.forEach(s => html += `<li>Adim ${s.order_num}: ${s.title}</li>`);
    html += '<li>Is tamamlandi ve onaylandi</li></ul>';
  }

  // Dependencies
  if (job.dependencies?.length > 0 || job.dependent_by?.length > 0) {
    html += '<h2>Bagimliliklar</h2>';
    if (job.dependencies?.length > 0) {
      html += '<p style="font-weight:600;font-size:13px;margin-bottom:6px">Bu is tamamlaninca baslatilabilir:</p>';
      job.dependencies.forEach(d => html += `<div class="dep">&rarr; ${d.to_job_title} <span style="color:#64748b">(${d.type})</span></div>`);
    }
    if (job.dependent_by?.length > 0) {
      html += '<p style="font-weight:600;font-size:13px;margin-top:14px;margin-bottom:6px">Bu is sunlara bagimli:</p>';
      job.dependent_by.forEach(d => html += `<div class="dep">&larr; ${d.from_job_title} <span style="color:#64748b">(${d.type})</span></div>`);
    }
  }

  // Notes
  if (job.notes) {
    html += `<h2>Notlar</h2><p style="white-space:pre-wrap;background:#f8fafc;padding:14px;border-radius:8px;border:1px solid #e2e8f0">${job.notes}</p>`;
  }

  // History
  if (job.history?.length > 0) {
    html += '<h2>Degisiklik Gecmisi</h2>';
    html += '<table><thead><tr><th>Tarih</th><th>Kisi</th><th>Detay</th></tr></thead><tbody>';
    job.history.forEach(h => html += `<tr><td>${h.date}</td><td>${h.person}</td><td>${h.note}</td></tr>`);
    html += '</tbody></table>';
  }

  html += `<div class="footer">Is Tanimlama Sistemi &mdash; Operasyonel Runbook &mdash; ${new Date().toLocaleDateString('tr-TR')}</div>`;
  html += '</body></html>';
  return html;
}

// ─── Download helper ────────────────────────────────────

export function downloadFile(content, filename, mimeType = 'text/markdown;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
