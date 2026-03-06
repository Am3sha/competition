// AUDIT: Leaderboard Display Logic
// 1. Fetches top performers from /api/leaderboard
// 2. Displays top 5 only (rest available via scrolling)
// 3. Sort order: points DESC, interviews DESC (tiebreaker)
// 4. Tie detection: Shows "تعادل ⚡" badge when player has same points & interviews as rank above
// 5. Auto-refresh every 30 seconds
// 6. Lock overlay if user hasn't registered yet

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

function initialsFromName(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] || '') + (parts[1][0] || '');
}

let countdownInterval;

function setupCountdown(endDateIso, status) {
  const statusEl = document.getElementById('competitionStatus');
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  const end = endDateIso ? new Date(endDateIso) : null;
  const isActive = status === 'running';

  function update() {
    const now = new Date();

    if (!end || Number.isNaN(end.getTime()) || now >= end) {
      ['days', 'hours', 'minutes', 'seconds'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = '00';
      });
      if (statusEl) {
        statusEl.textContent = 'التحدي منتهي، في انتظار إعلان الفائزين.';
      }
      return;
    }

    const diff = end - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    document.getElementById('days').textContent = String(days).padStart(2, '0');
    document.getElementById('hours').textContent = String(hours).padStart(2, '0');
    document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');

    if (statusEl) {
      statusEl.textContent = isActive
        ? 'المسابقة شغّالة، كل محاولة جديدة هتفرّق في ترتيبك!'
        : 'المسابقة موقوفة حاليًا — استنى إعلان من الكوتش.';
    }
  }

  update();
  countdownInterval = setInterval(update, 1000);
}

function renderStats(leaderboardResponse) {
  const totals = leaderboardResponse.totals || {};
  const statParticipants = document.getElementById('statParticipants');
  const statApplications = document.getElementById('statApplications');
  const statInterviews = document.getElementById('statInterviews');

  if (statParticipants) statParticipants.textContent = totals.participants ?? '--';
  if (statApplications) statApplications.textContent = totals.applications ?? '--';
  if (statInterviews) statInterviews.textContent = totals.interviews ?? '--';
}

function renderLeaderboard(leaderboardResponse) {
  const list = document.getElementById('leaderboardList');
  if (!list) return;

  list.innerHTML = '';

  const full = leaderboardResponse.leaderboard || [];
  const top5 = full.slice(0, 5);

  if (top5.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'لسه مفيش مشاركات مسجّلة. ابدأ التقديم دلوقتي! 🙌';
    list.appendChild(empty);
    return;
  }

  const maxPoints =
    top5.reduce((max, item) => (item.totalPoints > max ? item.totalPoints : max), 0) || 1;

  top5.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'lb-row';
    if (index === 0) row.classList.add('top1');
    if (index === 1) row.classList.add('top2');

    const rank = document.createElement('div');
    rank.className = 'lb-rank';
    rank.textContent = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1;

    const main = document.createElement('div');
    main.className = 'lb-main';

    const avatar = document.createElement('div');
    avatar.className = 'lb-avatar';
    avatar.textContent = initialsFromName(item.name);

    const text = document.createElement('div');
    text.className = 'lb-text';

    const nameRow = document.createElement('div');
    nameRow.style.display = 'flex';
    nameRow.style.alignItems = 'center';
    nameRow.style.gap = '6px';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = item.name;
    nameRow.appendChild(nameSpan);

    if (
      index > 0 &&
      top5[index - 1].totalPoints === item.totalPoints &&
      top5[index - 1].totalInterviews === item.totalInterviews
    ) {
      const tie = document.createElement('span');
      tie.className = 'lb-tie';
      tie.textContent = 'تعادل ⚡';
      nameRow.appendChild(tie);
    }

    const sub = document.createElement('div');
    sub.className = 'lb-sub';
    sub.textContent = `${item.totalApplications} تقديم · ${item.totalInterviews} انترفيو`;

    text.appendChild(nameRow);
    text.appendChild(sub);

    main.appendChild(avatar);
    main.appendChild(text);

    const meta = document.createElement('div');
    meta.className = 'lb-meta';

    const points = document.createElement('div');
    points.className = 'lb-points';
    points.textContent = `${item.totalPoints} نقطة`;

    const barWrap = document.createElement('div');
    barWrap.className = 'lb-bar-wrap';
    const bar = document.createElement('div');
    bar.className = 'lb-bar';
    const percentage = Math.round((item.totalPoints / maxPoints) * 100);
    requestAnimationFrame(() => {
      bar.style.width = `${percentage}%`;
    });
    barWrap.appendChild(bar);

    meta.appendChild(points);
    meta.appendChild(barWrap);

    row.appendChild(rank);
    row.appendChild(main);
    row.appendChild(meta);

    list.appendChild(row);
  });
}

async function loadCompetitionData() {
  try {
    const [settingsRes, leaderboardRes] = await Promise.all([
      fetch('/api/settings'),
      fetch('/api/leaderboard'),
    ]);

    const settingsJson = await settingsRes.json();
    const leaderboardJson = await leaderboardRes.json();

    const settings = settingsJson.settings || {};
    setupCountdown(settings.end_date, settings.status);
    renderStats(leaderboardJson);
    renderLeaderboard(leaderboardJson);
  } catch (err) {
    console.error(err);
    showToast('حصل خطأ في تحميل بيانات المسابقة.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const lockOverlay = document.getElementById('competitionLockOverlay');
  const registered = localStorage.getItem('comp_registered') === 'true';
  const admin = localStorage.getItem('adminLoggedIn') === 'true';

  if (!registered && !admin) {
    lockOverlay.classList.remove('hidden');
    return;
  }

  lockOverlay.classList.add('hidden');

  loadCompetitionData();
  setInterval(loadCompetitionData, 30000);
});

