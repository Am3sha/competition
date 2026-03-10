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

// دالة التحقق من اكتمال جميع الحقول
function validateAllFields() {
  const fields = {
    name: document.getElementById('name')?.value.trim(),
    phone: document.getElementById('phone')?.value.trim(),
    email: document.getElementById('email')?.value.trim(),
    coach: document.getElementById('coach')?.value,
    job: document.getElementById('job')?.value.trim(),
    proofType: document.getElementById('proofType')?.value,
    screenshots: typeof attachedFiles !== 'undefined' ? attachedFiles : (document.getElementById('fileInput')?.files || [])
  };

  const errors = [];

  // التحقق من الاسم
  if (!fields.name) {
    errors.push('الاسم الكامل مطلوب');
    document.getElementById('name')?.classList.add('error');
  } else {
    document.getElementById('name')?.classList.remove('error');
  }

  // التحقق من الموبايل
  if (!fields.phone) {
    errors.push('رقم الموبايل مطلوب');
    document.getElementById('phone')?.classList.add('error');
  } else {
    document.getElementById('phone')?.classList.remove('error');
  }

  // التحقق من الإيميل
  if (!fields.email) {
    errors.push('البريد الإلكتروني مطلوب');
    document.getElementById('email')?.classList.add('error');
  } else {
    document.getElementById('email')?.classList.remove('error');
  }

  // التحقق من الكوتش
  if (!fields.coach || fields.coach === '') {
    errors.push('اسم الكوتش مطلوب');
    document.getElementById('coach')?.classList.add('error');
  } else {
    document.getElementById('coach')?.classList.remove('error');
  }

  // التحقق من الشركة/الوظيفة
  if (!fields.job) {
    errors.push('اسم الشركة أو الوظيفة مطلوب');
    document.getElementById('job')?.classList.add('error');
  } else {
    document.getElementById('job')?.classList.remove('error');
  }

  // التحقق من نوع الإثبات
  if (!fields.proofType || fields.proofType === '' || fields.proofType === 'other') {
    errors.push('نوع الإثبات مطلوب (غير "آخر")');
    document.getElementById('proofType')?.classList.add('error');
  } else {
    document.getElementById('proofType')?.classList.remove('error');
  }

  // التحقق من رفع صورة على الأقل
  if (!fields.screenshots || fields.screenshots.length === 0) {
    errors.push('يجب رفع صورة إثبات واحدة على الأقل');
    document.getElementById('fileInput')?.parentElement.classList.add('error');
  } else {
    document.getElementById('fileInput')?.parentElement.classList.remove('error');
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
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
    phoneInput.addEventListener('input', function () {
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
    emailInput.addEventListener('input', function () {
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

  // إضافة التحقق الفوري للحقول الإلزامية
  const requiredFields = ['name', 'phone', 'email', 'coach', 'job', 'proofType', 'screenshots'];
  requiredFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('input', function () {
        if (this.value.trim() || (this.type === 'file' && this.files.length > 0)) {
          this.classList.remove('error');
        }
      });
      field.addEventListener('change', function () {
        if (this.value.trim() || (this.type === 'file' && this.files.length > 0)) {
          this.classList.remove('error');
        }
      });
    }
  });

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

    // التحقق من نوع التسجيل أولاً
    if (selectedTypes.size === 0) {
      showToast('❌ اختار نوع التسجيل الأول (تقديم أو انترفيو).', 'error');
      return;
    }

    // التحقق من اكتمال جميع الحقول
    const validation = validateAllFields();
    if (!validation.isValid) {
      // عرض أول خطأ فقط (أو كل الأخطاء)
      validation.errors.forEach(error => showToast(`❌ ${error}`, 'error'));

      // تمرير لأول حقل فيه خطأ
      const firstErrorField = document.querySelector('.error');
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
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

    if (typeof attachedFiles !== 'undefined' && attachedFiles.length > 0) {
      // Validate file count (max 3 files)
      if (attachedFiles.length > 3) {
        showToast('❌ يمكنك رفع 3 صور كحد أقصى فقط', 'error');
        return;
      }
      // Append all files to FormData
      attachedFiles.forEach((file, index) => {
        console.log(`Uploading file ${index + 1}: ${file.name}`);
        formData.append('screenshots', file);
      });
    } else {
      showToast('❌ يجب رفع صورة إثبات واحدة على الأقل', 'error');
      return;
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
      if (typeof resetFileList === 'function') resetFileList();
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

// ========== نظام رفع الصور المتقدم ==========
const MAX_FILES = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 ميجا
let attachedFiles = [];

// التعامل مع السحب والإفلات
window.handleDragOver = (e) => {
  e.preventDefault();
  e.stopPropagation();
  const dropzone = document.getElementById('dropzone');
  if (dropzone) dropzone.classList.add('drag-over');
};

window.handleDragLeave = (e) => {
  e.preventDefault();
  e.stopPropagation();
  const dropzone = document.getElementById('dropzone');
  if (dropzone) dropzone.classList.remove('drag-over');
};

window.handleDrop = (e) => {
  e.preventDefault();
  e.stopPropagation();
  const dropzone = document.getElementById('dropzone');
  if (dropzone) dropzone.classList.remove('drag-over');

  const files = Array.from(e.dataTransfer.files);
  processFiles(files);
};

// التعامل مع اختيار الملفات
window.handleFileSelect = (e) => {
  const files = Array.from(e.target.files);
  processFiles(files);
};

// معالجة الملفات المرفوعة
function processFiles(newFiles) {
  // إخفاء الرسائل السابقة
  hideMessages();

  // التحقق من إجمالي عدد الملفات
  if (attachedFiles.length + newFiles.length > MAX_FILES) {
    showWarning(`يمكنك رفع ${MAX_FILES} صور كحد أقصى فقط`);
    return;
  }

  // التحقق من كل ملف جديد
  const validFiles = [];
  for (const file of newFiles) {
    // التحقق من نوع الملف
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      showError(`الملف ${file.name} غير مدعوم. يرجى رفع صور أو PDF فقط`);
      continue;
    }

    // التحقق من الحجم
    if (file.size > MAX_FILE_SIZE) {
      showError(`الملف ${file.name} حجمه كبير (الحد الأقصى 5 ميجا)`);
      continue;
    }

    // التحقق من عدم تكرار الملف
    if (attachedFiles.some(f => f.name === file.name && f.size === file.size)) {
      showError(`الملف ${file.name} مكرر`);
      continue;
    }

    validFiles.push(file);
  }

  // إضافة الملفات الصالحة
  if (validFiles.length > 0) {
    attachedFiles = [...attachedFiles, ...validFiles];
    updateFileList();

    // تحديث حقل الإدخال الأصلي للتسليم مع الفورم
    updateOriginalFileInput();
  }
}

// تحديث قائمة الملفات المعروضة
function updateFileList() {
  const fileList = document.getElementById('fileList');
  if (!fileList) return;

  if (attachedFiles.length === 0) {
    fileList.innerHTML = '';
    fileList.classList.remove('active');
    return;
  }

  fileList.classList.add('active');

  fileList.innerHTML = attachedFiles.map((file, index) => `
    <div class="file-row" data-index="${index}">
      <div class="file-info">
        <span class="file-icon">${getFileIcon(file.type)}</span>
        <div class="file-details">
          <div class="file-name">${file.name}</div>
          <div class="file-size">${(file.size / 1024).toFixed(2)} KB</div>
        </div>
      </div>
      <button type="button" class="file-remove" onclick="removeFile(${index})" title="حذف">
        <span>✕</span>
      </button>
    </div>
  `).join('');
}

// الحصول على أيقونة حسب نوع الملف
function getFileIcon(mimeType) {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  return '📎';
}

// حذف ملف من القائمة
window.removeFile = (index) => {
  attachedFiles.splice(index, 1);
  updateFileList();
  updateOriginalFileInput();
};

// تحديث حقل الإدخال الأصلي
function updateOriginalFileInput() {
  const fileInput = document.getElementById('fileInput');
  if (!fileInput) return;

  // إنشاء كائن DataTransfer جديد
  const dataTransfer = new DataTransfer();

  attachedFiles.forEach(file => {
    dataTransfer.items.add(file);
  });

  // تحديث حقل الإدخال
  fileInput.files = dataTransfer.files;
}

// إظهار رسالة خطأ
function showError(message) {
  const uploadError = document.getElementById('uploadError');
  if (!uploadError) return;
  uploadError.textContent = message;
  uploadError.classList.remove('hidden');
  setTimeout(() => {
    uploadError.classList.add('hidden');
  }, 5000);
}

// إظهار رسالة تحذير
function showWarning(message) {
  const fileLimitWarning = document.getElementById('fileLimitWarning');
  if (!fileLimitWarning) return;
  fileLimitWarning.textContent = message;
  fileLimitWarning.classList.remove('hidden');
  setTimeout(() => {
    fileLimitWarning.classList.add('hidden');
  }, 5000);
}

// إخفاء جميع الرسائل
function hideMessages() {
  const uploadError = document.getElementById('uploadError');
  const fileLimitWarning = document.getElementById('fileLimitWarning');
  if (uploadError) uploadError.classList.add('hidden');
  if (fileLimitWarning) fileLimitWarning.classList.add('hidden');
}

// إعادة تعيين قائمة الملفات
window.resetFileList = () => {
  attachedFiles = [];
  updateFileList();
  const fileInput = document.getElementById('fileInput');
  if (fileInput) fileInput.value = '';
};
