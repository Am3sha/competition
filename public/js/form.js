// AUDIT: Form Validation Summary
// Client-side validation ensures:
// 1. Registration type selected (apply and/or interview)
// 2. Proof type is NOT 'other' (blocked submission)
// 3. Required fields: name, registration_types, proof_type
// 4. Optional fields: phone, email validated by browser
// 5. Screenshots uploaded (max 5MB per file by multer)
// Server-side validation adds: email format check, phone format check, name length limit

// Toast helper
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
    container.removeChild(toast);
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

// Handle competition link lock
function updateCompetitionLinkLock() {
  const link = document.getElementById('competitionLink');
  if (!link) return;
  const unlocked = localStorage.getItem('comp_registered') === 'true';
  if (unlocked) {
    link.classList.remove('locked');
  } else {
    link.classList.add('locked');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateCompetitionLinkLock();

  const typeButtons = Array.from(
    document.querySelectorAll('.type-toggle-group .type-card')
  );
  const form = document.getElementById('submissionForm');
  const proofTypeSelect = document.getElementById('proofType');
  const proofError = document.getElementById('proofError');
  const uploadGroup = document.getElementById('uploadGroup');

  const selectedTypes = new Set();

  typeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = btn.getAttribute('data-type');
      if (selectedTypes.has(t)) {
        selectedTypes.delete(t);
        btn.classList.remove('active');
      } else {
        selectedTypes.add(t);
        btn.classList.add('active');
      }
    });
  });

  proofTypeSelect.addEventListener('change', () => {
    const val = proofTypeSelect.value;
    if (val === 'other') {
      proofError.classList.remove('hidden');
      uploadGroup.classList.add('hidden');
    } else {
      proofError.classList.add('hidden');
      uploadGroup.classList.remove('hidden');
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (selectedTypes.size === 0) {
      showToast('اختار نوع التسجيل الأول (تقديم أو انترفيو).', 'error');
      return;
    }

    if (proofTypeSelect.value === 'other') {
      showToast('نوع الإثبات المختار غير مقبول، عدّل الاختيار.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('name', document.getElementById('name').value.trim());
    formData.append('phone', document.getElementById('phone').value.trim());
    formData.append('email', document.getElementById('email').value.trim());
    formData.append('coach', document.getElementById('coach').value);
    formData.append('job', document.getElementById('job').value.trim());
    formData.append('proof_type', proofTypeSelect.value);
    formData.append('registration_types', JSON.stringify(Array.from(selectedTypes)));

    const fileInput = document.getElementById('screenshots');
    if (fileInput && fileInput.files) {
      Array.from(fileInput.files).forEach((file) => {
        formData.append('screenshots', file);
      });
    }

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast('حصل خطأ أثناء التسجيل، حاول تاني.', 'error');
        return;
      }

      showToast('تم تسجيل المحاولة بنجاح! 👏');
      form.reset();
      selectedTypes.clear();
      typeButtons.forEach((b) => b.classList.remove('active'));
      proofError.classList.add('hidden');
      uploadGroup.classList.remove('hidden');

      localStorage.setItem('comp_registered', 'true');
      updateCompetitionLinkLock();
    } catch (err) {
      console.error(err);
      showToast('حصل خطأ في الاتصال بالسيرفر.', 'error');
    }
  });
});

