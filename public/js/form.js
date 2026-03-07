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

// ====== Input Validation & Formatting ======
function validatePhone(phone) {
  const cleanPhone = phone.replace(/[\s\-]/g, '');
  const phoneRegex = /^01[0-2|5]{1}[0-9]{8}$/;
  return phoneRegex.test(cleanPhone);
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function formatPhone(input) {
  let value = input.value.replace(/\D/g, '');
  if (value.length > 0) {
    if (value.length <= 4) {
      input.value = value;
    } else if (value.length <= 7) {
      input.value = value.slice(0, 4) + '-' + value.slice(4);
    } else {
      input.value = value.slice(0, 4) + '-' + value.slice(4, 7) + '-' + value.slice(7, 11);
    }
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

  const phoneInput = document.getElementById('phone');
  if (phoneInput) {
    phoneInput.addEventListener('input', function() {
      formatPhone(this);
      const phone = this.value.replace(/\D/g, '');
      const phoneError = document.getElementById('phoneError');
      if (phone.length > 0 && !validatePhone(phone)) {
        if (!phoneError) {
          const error = document.createElement('div');
          error.id = 'phoneError';
          error.className = 'error-message';
          error.textContent = '❌ رقم الموبايل غير صحيح (مثال: 010-1234-5678)';
          this.parentNode.appendChild(error);
        }
        this.style.borderColor = '#ef4444';
      } else {
        if (phoneError) phoneError.remove();
        this.style.borderColor = 'rgba(255,255,255,0.1)';
      }
    });
  }

  const emailInput = document.getElementById('email');
  if (emailInput) {
    emailInput.addEventListener('input', function() {
      const email = this.value;
      const emailError = document.getElementById('emailError');
      if (email.length > 0 && !validateEmail(email)) {
        if (!emailError) {
          const error = document.createElement('div');
          error.id = 'emailError';
          error.className = 'error-message';
          error.textContent = '❌ البريد الإلكتروني غير صحيح';
          this.parentNode.appendChild(error);
        }
        this.style.borderColor = '#ef4444';
      } else {
        if (emailError) emailError.remove();
        this.style.borderColor = 'rgba(255,255,255,0.1)';
      }
    });
  }

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

    const phone = document.getElementById('phone').value.replace(/\D/g, '');
    if (phone.length > 0 && !validatePhone(phone)) {
      showToast('❌ رقم الموبايل غير صحيح', 'error');
      return;
    }

    const email = document.getElementById('email').value.trim();
    if (email.length > 0 && !validateEmail(email)) {
      showToast('❌ البريد الإلكتروني غير صحيح', 'error');
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

