// ====== Authentication ======
function updateLogoutButton() {
  const logoutBtn = document.getElementById('logoutBtn');
  const isLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
  
  if (logoutBtn) {
    logoutBtn.style.display = isLoggedIn ? 'flex' : 'none';
  }
}

function logout() {
  if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
    localStorage.removeItem('adminLoggedIn');
    localStorage.removeItem('comp_registered');
    
    document.getElementById('adminMain').style.display = 'none';
    document.getElementById('adminLoginOverlay').style.display = 'flex';
    
    updateLogoutButton();
    showToast('✅ تم تسجيل الخروج بنجاح', 'success');
  }
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.textContent = type === 'success' ? '✅' : '⚠️';

  const msg = document.createElement('span');
  msg.className = 'toast-message';
  msg.textContent = message;

  const close = document.createElement('button');
  close.className = 'toast-close';
  close.textContent = '×';
  close.addEventListener('click', () => {
    if (container.contains(toast)) container.removeChild(toast);
  });

  toast.appendChild(icon);
  toast.appendChild(msg);
  toast.appendChild(close);
  container.appendChild(toast);

  setTimeout(() => {
    if (container.contains(toast)) {
      container.removeChild(toast);
    }
  }, 2500);
}

function formatDateTime(iso) {
  if (!iso) return 'غير معروف';
  const d = new Date(iso);
  return d.toLocaleString('ar-EG', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

// ============ EXPORT FUNCTIONS ============

function downloadCSV(data, filename = 'submissions.csv') {
  const headers = [
    'الرقم',
    'الاسم',
    'الموبايل',
    'الإيميل',
    'الكوتش',
    'الشركة',
    'النوع',
    'الإثبات',
    'التقديمات',
    'الانترفيوهات',
    'النقاط',
    'التاريخ',
  ];

  const escapeCsv = (value) => {
    if (value == null) return '';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = [headers.join(',')];
  data.forEach((participant, idx) => {
    rows.push(
      [
        idx + 1,
        participant.name,
        participant.phone || '',
        participant.email || '',
        participant.coach || '',
        participant.job || '',
        participant.type || '',
        participant.proof_type || '',
        participant.totalApplications || 0,
        participant.totalInterviews || 0,
        participant.totalPoints || 0,
        participant.created_at || '',
      ]
        .map(escapeCsv)
        .join(',')
    );
  });

  const csvContent = '\uFEFF' + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv; charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

function downloadExcel(data, filename = 'submissions.xlsx') {
  // Simple CSV format that Excel can open natively
  const headers = [
    'الرقم',
    'الاسم',
    'الموبايل',
    'الإيميل',
    'الكوتش',
    'الشركة',
    'النوع',
    'الإثبات',
    'التقديمات',
    'الانترفيوهات',
    'النقاط',
    'التاريخ',
  ];

  const escapeCsv = (value) => {
    if (value == null) return '';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = [headers.join('\t')];
  data.forEach((participant, idx) => {
    rows.push(
      [
        idx + 1,
        participant.name,
        participant.phone || '',
        participant.email || '',
        participant.coach || '',
        participant.job || '',
        participant.type || '',
        participant.proof_type || '',
        participant.totalApplications || 0,
        participant.totalInterviews || 0,
        participant.totalPoints || 0,
        participant.created_at || '',
      ]
        .map(escapeCsv)
        .join('\t')
    );
  });

  const excelContent = rows.join('\n');
  const blob = new Blob([excelContent], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

// ============ CLOUD STORAGE SYNC ============

async function uploadToCloud(allSubmissions, currentSettings) {
  try {
    showToast('⏳ جاري الرفع للأونلاين...', 'success');
    const res = await fetch('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissions: allSubmissions,
        settings: currentSettings,
      }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('✅ تم حفظ البيانات على Supabase!', 'success');
      return true;
    } else {
      showToast('❌ فشل الرفع للأونلاين', 'error');
      return false;
    }
  } catch (err) {
    console.error('Upload error', err);
    showToast('❌ خطأ في الرفع للأونلاين', 'error');
    return false;
  }
}

async function downloadFromCloud() {
  try {
    showToast('⏳ جاري التحميل من الأونلاين...', 'success');
    const res = await fetch('/api/sync/pull');
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('✅ تم جلب البيانات من Supabase!', 'success');
      return data.data;
    } else {
      showToast('❌ فشل التحميل من الأونلاين', 'error');
      return null;
    }
  } catch (err) {
    console.error('Download error', err);
    showToast('❌ خطأ في التحميل من الأونلاين', 'error');
    return null;
  }
}

// ============ RENDER FUNCTIONS ============

let currentSettings = null;
let allSubmissions = [];
let allParticipants = [];

function renderSettingsInfo(settings) {
  const info = document.getElementById('adminCompetitionInfo');
  const dot = document.getElementById('statusDot');
  if (!info || !dot) return;

  if (!settings) {
    info.textContent = 'لم يتم تهيئة إعدادات المسابقة بعد.';
    dot.className = 'status-dot stopped';
    return;
  }

  const start = settings.start_date ? formatDateTime(settings.start_date) : 'غير محدد';
  const end = settings.end_date ? formatDateTime(settings.end_date) : 'غير محدد';
  const active = settings.status === 'running';

  info.textContent = active
    ? `المسابقة شغّالة ✅ — من ${start} إلى ${end}`
    : `المسابقة موقوفة ⛔ — من ${start} إلى ${end}`;

  dot.className = 'status-dot ' + (active ? 'active' : 'stopped');
}

function buildTypeBadge(type, points) {
  const span = document.createElement('span');
  span.className = 'type-badge';
  const t = type || '';
  if (t === 'apply') {
    span.classList.add('apply');
    span.textContent = '📋 تقديم +1';
  } else if (t === 'interview') {
    span.classList.add('interview');
    span.textContent = '🎯 انترفيو +5';
  } else if (t === 'apply + interview') {
    span.classList.add('both');
    span.textContent = '📋 + 🎯 = ' + (points || 6);
  } else {
    span.textContent = 'نوع غير محدد';
  }
  return span;
}

function renderDashboardStats() {
  const totalParticipants = allParticipants.length;
  const totalSubmissions = allSubmissions.length;
  const totalApplies = allSubmissions.filter(s => s.type === 'apply' || s.type === 'apply + interview').length;
  const totalInterviews = allSubmissions.filter(s => s.type === 'interview' || s.type === 'apply + interview').length;

  document.getElementById('dashTotalParticipants').textContent = totalParticipants;
  document.getElementById('dashTotalSubmissions').textContent = totalSubmissions;
  document.getElementById('dashTotalApplies').textContent = totalApplies;
  document.getElementById('dashTotalInterviews').textContent = totalInterviews;
}

function renderParticipantsTable(filterText = '') {
  const tbody = document.getElementById('participantsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  let filtered = allParticipants;
  if (filterText) {
    const lower = filterText.toLowerCase();
    filtered = allParticipants.filter(
      p =>
        p.name.toLowerCase().includes(lower) ||
        (p.phone && p.phone.includes(lower)) ||
        (p.email && p.email.toLowerCase().includes(lower))
    );
  }

  filtered.forEach((participant, idx) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="row-number">${idx + 1}</td>
      <td>${participant.name || '-'}</td>
      <td>${participant.phone || '-'}</td>
      <td>${participant.email || '-'}</td>
      <td>${participant.coach || '-'}</td>
      <td>${participant.job || '-'}</td>
      <td>${participant.totalApplications || 0}</td>
      <td>${participant.totalInterviews || 0}</td>
      <td><strong>${participant.totalPoints || 0}</strong></td>
      <td class="row-action">
        <button class="btn-sm-delete" onclick="deleteParticipant('${participant.name.replace(/'/g, "\\'")}')">حذف</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function renderSubmissionsTable(filterText = '') {
  const tbody = document.getElementById('submissionsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  let filtered = allSubmissions;
  if (filterText) {
    const lower = filterText.toLowerCase();
    filtered = allSubmissions.filter(
      s =>
        s.name.toLowerCase().includes(lower) ||
        (s.phone && s.phone.includes(lower)) ||
        (s.email && s.email.toLowerCase().includes(lower))
    );
  }

  filtered.forEach((submission, idx) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="row-number">${idx + 1}</td>
      <td>${submission.name || '-'}</td>
      <td>${submission.type || '-'}</td>
      <td>${submission.job || '-'}</td>
      <td>${submission.coach || '-'}</td>
      <td>${submission.proof_type || '-'}</td>
      <td>${formatDateTime(submission.created_at)}</td>
      <td><strong>${submission.points || 0}</strong></td>
    `;
    tbody.appendChild(row);
  });
}

function renderRecords(list) {
  const container = document.getElementById('adminRecordsList');
  if (!container) return;
  container.innerHTML = '';

  if (!list || list.length === 0) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'لا توجد تسجيلات حتى الآن.';
    container.appendChild(p);
    return;
  }

  list.forEach((s) => {
    const card = document.createElement('div');
    card.className = 'record-card';

    const header = document.createElement('div');
    header.className = 'record-header';

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '8px';

    const avatar = document.createElement('div');
    avatar.className = 'lb-avatar';
    avatar.textContent = (s.name || '?')
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2);

    const title = document.createElement('div');
    title.innerHTML = `<strong>${s.name || 'بدون اسم'}</strong><br /><span class="muted small">${formatDateTime(
      s.created_at
    )}</span>`;

    left.appendChild(avatar);
    left.appendChild(title);

    const badge = buildTypeBadge(s.type, s.points);

    header.appendChild(left);
    header.appendChild(badge);

    const meta = document.createElement('div');
    meta.className = 'record-meta';
    const pills = [
      { icon: '📱', label: s.phone || '-' },
      { icon: '✉️', label: s.email || '-' },
      { icon: '👤', label: s.coach || '-' },
      { icon: '🏢', label: s.job || '-' },
    ];
    pills.forEach((p) => {
      const span = document.createElement('span');
      span.className = 'record-pill';
      span.textContent = `${p.icon} ${p.label}`;
      meta.appendChild(span);
    });

    const screenshotsWrap = document.createElement('div');
    screenshotsWrap.className = 'record-screenshots';
    (s.screenshot_urls || []).forEach((url) => {
      const img = document.createElement('img');
      img.className = 'record-screenshot';
      img.src = url;
      img.alt = 'إثبات';
      img.addEventListener('click', () => {
        window.open(url, '_blank');
      });
      screenshotsWrap.appendChild(img);
    });

    const footer = document.createElement('div');
    footer.className = 'record-footer';
    const del = document.createElement('button');
    del.className = 'btn-danger';
    del.textContent = '🗑 حذف التسجيل';
    del.addEventListener('click', async () => {
      if (!confirm('متأكد إنك عايز تحذف هذا التسجيل؟')) return;
      try {
        const res = await fetch(`/api/submissions/${s.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok || !data.success) {
          showToast('فشل حذف التسجيل.', 'error');
          return;
        }
        showToast('تم حذف التسجيل.', 'success');
        loadAdminData();
      } catch (err) {
        console.error(err);
        showToast('حصل خطأ أثناء حذف التسجيل.', 'error');
      }
    });
    footer.appendChild(del);

    card.appendChild(header);
    card.appendChild(meta);
    if ((s.screenshot_urls || []).length > 0) {
      card.appendChild(screenshotsWrap);
    }
    card.appendChild(footer);

    container.appendChild(card);
  });
}

function renderSettingsParticipants(list) {
  const container = document.getElementById('settingsParticipantsList');
  if (!container) return;
  container.innerHTML = '';

  if (!list || list.length === 0) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'لا يوجد مشاركون حاليًا.';
    container.appendChild(p);
    return;
  }

  const participants = Array.from(list).sort((a, b) => b.totalPoints - a.totalPoints);

  participants.forEach((p) => {
    const row = document.createElement('div');
    row.className = 'lb-row';

    const avatar = document.createElement('div');
    avatar.className = 'lb-avatar';
    avatar.textContent = (p.name || '?')
      .split(/\s+/)
      .map((x) => x[0])
      .join('')
      .slice(0, 2);

    const main = document.createElement('div');
    main.className = 'lb-main';
    main.style.justifyContent = 'space-between';

    const text = document.createElement('div');
    text.className = 'lb-text';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = p.name;
    const sub = document.createElement('div');
    sub.className = 'lb-sub';
    sub.textContent = `كوتش: ${p.coach || '-'} · ${p.totalApplications} تقديم · ${p.totalInterviews} انترفيو`;
    text.appendChild(nameSpan);
    text.appendChild(sub);

    const meta = document.createElement('div');
    meta.className = 'lb-meta';
    const pts = document.createElement('div');
    pts.className = 'lb-points';
    pts.textContent = `${p.totalPoints} نقطة`;

    const del = document.createElement('button');
    del.className = 'btn-danger';
    del.textContent = '🗑 حذف المشارك';
    del.addEventListener('click', async () => {
      if (!confirm('سيتم حذف كل تسجيلات هذا المشارك، متأكد؟')) return;
      await deleteParticipant(p.name);
    });

    meta.appendChild(pts);
    meta.appendChild(del);

    main.appendChild(text);
    main.appendChild(meta);

    row.appendChild(avatar);
    row.appendChild(main);

    container.appendChild(row);
  });
}

async function deleteParticipant(participantName) {
  try {
    const submissions = allSubmissions.filter(s => s.name === participantName);
    for (const subm of submissions) {
      await fetch(`/api/submissions/${subm.id}`, { method: 'DELETE' });
    }
    showToast('تم حذف المشارك وكل تسجيلاته.', 'success');
    loadAdminData();
  } catch (err) {
    console.error(err);
    showToast('حصل خطأ أثناء حذف المشارك.', 'error');
  }
}

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    currentSettings = data.settings || null;
    renderSettingsInfo(currentSettings);
    updateTimeDisplay(currentSettings);
  } catch (err) {
    console.error(err);
    showToast('حصل خطأ في تحميل إعدادات المسابقة.', 'error');
  }
}

// ==== Advanced Time Controls ====
function updateTimeDisplay(settings) {
  if (!settings) return;
  
  const startDateDisp = document.getElementById('startDateDisplay');
  const endDateDisp = document.getElementById('endDateDisplay');
  const daysDisp = document.getElementById('daysRemaining');
  const statusDisp = document.getElementById('statusDisplay');
  
  if (!startDateDisp) return; // not on settings tab yet/element missing
  
  const startDate = new Date(settings.start_date);
  const endDate = new Date(settings.end_date);
  const now = new Date();
  
  const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
  
  startDateDisp.textContent = startDate.toLocaleDateString('ar-EG');
  endDateDisp.textContent = endDate.toLocaleDateString('ar-EG');
  daysDisp.textContent = daysRemaining > 0 ? daysRemaining : 'انتهت';
  statusDisp.textContent = settings.status === 'running' ? 'شغالة ✅' : 'موقوفة ⛔';
}

async function setDuration(days) {
  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'set_duration',
        days: days 
      })
    });
    
    const data = await response.json();
    if (data.success) {
      showToast(`✅ تم تعيين مدة المسابقة لـ ${days} يوم`, 'success');
      loadSettings();
      
      document.querySelectorAll('.duration-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.days == days) {
          btn.classList.add('active');
        }
      });
    } else {
      showToast('⚠️ فشل تعيين المدة', 'error');
    }
  } catch (error) {
    showToast('⚠️ خطأ في الاتصال', 'error');
  }
}

async function setCustomEndDate() {
  const dateInput = document.getElementById('customEndDate');
  if (!dateInput.value) {
    showToast('❌ اختر تاريخ أولاً', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'set_end_date',
        end_date: dateInput.value 
      })
    });
    
    const data = await response.json();
    if (data.success) {
      showToast('✅ تم تعيين تاريخ الانتهاء', 'success');
      loadSettings();
    } else {
      showToast('⚠️ فشل تعيين التاريخ', 'error');
    }
  } catch (error) {
    showToast('⚠️ خطأ في الاتصال', 'error');
  }
}

async function resetToDefault() {
  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'reset_to_default' 
      })
    });
    
    const data = await response.json();
    if (data.success) {
      showToast('✅ تم إعادة التعيين لـ 30 يوم', 'success');
      loadSettings();
      
      document.querySelectorAll('.duration-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.days == 30) {
          btn.classList.add('active');
        }
      });
    } else {
      showToast('⚠️ فشل إعادة التعيين', 'error');
    }
  } catch (error) {
    showToast('⚠️ خطأ في الاتصال', 'error');
  }
}


async function loadSubmissions() {
  try {
    const res = await fetch('/api/submissions');
    const data = await res.json();
    allSubmissions = data.submissions || [];

    // Build participants map
    const map = new Map();
    allSubmissions.forEach((s) => {
      const key = (s.name || '').trim();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          name: s.name,
          phone: s.phone || '',
          email: s.email || '',
          coach: s.coach || '',
          job: s.job || '',
          totalPoints: 0,
          totalApplications: 0,
          totalInterviews: 0,
          submissions: [],
        });
      }
      const entry = map.get(key);
      entry.totalPoints += s.points || 0;
      if (s.type === 'apply') {
        entry.totalApplications += 1;
      } else if (s.type === 'interview') {
        entry.totalInterviews += 1;
      } else if (s.type === 'apply + interview') {
        entry.totalApplications += 1;
        entry.totalInterviews += 1;
      }
      entry.submissions.push(s);
    });

    allParticipants = Array.from(map.values());

    renderDashboardStats();
    renderParticipantsTable();
    renderSubmissionsTable();
    renderRecords(allSubmissions);
    renderSettingsParticipants(allParticipants);
  } catch (err) {
    console.error(err);
    showToast('حصل خطأ في تحميل التسجيلات.', 'error');
  }
}

async function toggleCompetition() {
  const action = currentSettings && currentSettings.status === 'running' ? 'stop' : 'start';
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast('⚠️ فشل تحديث إعدادات التحدي.', 'error');
      return;
    }
    currentSettings = data.settings;
    renderSettingsInfo(currentSettings);
    showToast(
      action === 'stop' ? '⏸ المسابقة اتوقّفت!' : '✅ المسابقة اتشغّلت من جديد!',
      'success'
    );
  } catch (err) {
    console.error(err);
    showToast('⚠️ حصل خطأ أثناء تحديث الإعدادات.', 'error');
  }
}

async function extendCompetition() {
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'extend' }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast('⚠️ فشل تمديد المسابقة.', 'error');
      return;
    }
    currentSettings = data.settings;
    renderSettingsInfo(currentSettings);
    showToast('✅ المسابقة اتمدّدت 7 أيام!', 'success');
  } catch (err) {
    console.error(err);
    showToast('⚠️ حصل خطأ أثناء تمديد المسابقة.', 'error');
  }
}

async function loadAdminData() {
  await Promise.all([loadSettings(), loadSubmissions()]);
}

// ============ TAB SWITCHING ============

function switchTab(tabName) {
  document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.admin-tab-btn').forEach(el => el.classList.remove('active'));

  const tabContent = document.getElementById(`tab-${tabName}`);
  const tabBtn = document.querySelector(`.admin-tab-btn[data-tab="${tabName}"]`);

  if (tabContent) tabContent.classList.add('active');
  if (tabBtn) tabBtn.classList.add('active');
}

// ============ DOMContentLoaded ============

document.addEventListener('DOMContentLoaded', () => {
  const loginOverlay = document.getElementById('adminLoginOverlay');
  const adminMain = document.getElementById('adminMain');
  const loginBtn = document.getElementById('adminLoginBtn');
  const passwordInput = document.getElementById('adminPassword');

  const toggleBtn = document.getElementById('toggleCompetitionBtn');
  const extendBtn = document.getElementById('extendBtn');
  const downloadCsvBtn = document.getElementById('downloadCsvBtn');
  const downloadExcelBtn = document.getElementById('downloadExcelBtn');
  const syncUploadBtn = document.getElementById('syncUploadBtn');
  const syncDownloadBtn = document.getElementById('syncDownloadBtn');
  const openSheetsBtn = document.getElementById('openSheetsBtn');
  const searchInput = document.getElementById('participantSearchInput');

  // Tab buttons
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');
      switchTab(tabName);
    });
  });

  // Search
  searchInput.addEventListener('input', (e) => {
    const filterText = e.target.value;
    renderParticipantsTable(filterText);
    renderSubmissionsTable(filterText);
  });

  // AUDIT: Export now calls server endpoints for aggregated data
  // Server returns: CSV with all participants aggregated by name
  // Column order: الاسم | الموبايل | الإيميل | الكوتش | الشركة/الوظيفة | النوع | التقديمات | الانترفيوهات | النقاط | الوقت
  downloadCsvBtn.addEventListener('click', () => {
    // Redirect to server endpoint for aggregated data
    window.location.href = '/api/export';
  });

  downloadExcelBtn.addEventListener('click', () => {
    // Redirect to server endpoint for formatted Excel
    window.location.href = '/api/export/excel';
  });

  // Sync buttons
  syncUploadBtn.addEventListener('click', () => {
    uploadToCloud(allSubmissions, currentSettings);
  });

  syncDownloadBtn.addEventListener('click', async () => {
    const backup = await downloadFromCloud();
    if (backup && confirm('هل تريد استبدال البيانات الحالية بالبيانات من السحابة؟')) {
      allSubmissions = backup.submissions || [];
      currentSettings = backup.settings || null;
      await loadAdminData();
    }
  });

  openSheetsBtn.addEventListener('click', () => {
    window.open('https://sheets.google.com', '_blank');
  });

  // Competition controls
  toggleBtn.addEventListener('click', toggleCompetition);
  extendBtn.addEventListener('click', extendCompetition);

  // Advanced Time controls
  document.querySelectorAll('.duration-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setDuration(parseInt(btn.dataset.days));
    });
  });
  
  const customDateBtn = document.getElementById('setCustomDateBtn');
  if (customDateBtn) {
    customDateBtn.addEventListener('click', setCustomEndDate);
  }
  
  const resetBtn = document.getElementById('resetToDefaultBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetToDefault);
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  async function doLogin() {
    const val = passwordInput.value.trim();
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: val })
      });
      
      const data = await response.json();
      
      if (data.success) {
        localStorage.setItem('adminLoggedIn', 'true');
        localStorage.setItem('comp_registered', 'true');
        loginOverlay.style.display = 'none';
        adminMain.style.display = 'block';
        updateLogoutButton();
        loadAdminData();
        showToast('✅ مرحباً بك في لوحة الإدارة', 'success');
      } else {
        showToast('❌ كلمة السر غلط!', 'error');
      }
    } catch (error) {
      showToast('❌ خطأ في الاتصال بالسيرفر', 'error');
    }
  }

  loginBtn.addEventListener('click', doLogin);
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doLogin();
    }
  });

  const isLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
  if (!isLoggedIn) {
    loginOverlay.style.display = 'flex';
    adminMain.style.display = 'none';
  } else {
    loginOverlay.style.display = 'none';
    adminMain.style.display = 'block';
    loadAdminData();
  }
  
  updateLogoutButton();
});


