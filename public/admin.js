const loginBox = document.getElementById('loginBox');
const adminContent = document.getElementById('adminContent');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const loginMsg = document.getElementById('loginMsg');
const logoutBtn = document.getElementById('logoutBtn');

const uploadTitle = document.getElementById('uploadTitle');
const uploadFile = document.getElementById('uploadFile');
const uploadBtn = document.getElementById('uploadBtn');
const uploadMsg = document.getElementById('uploadMsg');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const adminList = document.getElementById('adminList');

function setMsg(el, text, type) {
  el.textContent = text;
  el.className = 'msg ' + (type || '');
}

async function checkAuth() {
  const res = await fetch('/api/admin/check');
  const data = await res.json();
  if (data.isAdmin) {
    loginBox.style.display = 'none';
    adminContent.style.display = 'block';
    logoutBtn.style.display = 'inline-block';
    loadAdminVideos();
  } else {
    loginBox.style.display = 'block';
    adminContent.style.display = 'none';
    logoutBtn.style.display = 'none';
  }
}

loginBtn.addEventListener('click', async () => {
  const password = passwordInput.value;
  if (!password) return;
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  const data = await res.json();
  if (res.ok) {
    passwordInput.value = '';
    setMsg(loginMsg, '', '');
    checkAuth();
  } else {
    setMsg(loginMsg, data.error || 'შეცდომა', 'error');
  }
});

passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' });
  checkAuth();
});

uploadBtn.addEventListener('click', () => {
  const title = uploadTitle.value.trim();
  const file = uploadFile.files[0];
  if (!title) return setMsg(uploadMsg, 'შეიყვანე ვიდეოს სახელი', 'error');
  if (!file) return setMsg(uploadMsg, 'აირჩიე ვიდეო ფაილი', 'error');

  const formData = new FormData();
  formData.append('title', title);
  formData.append('video', file);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/admin/upload');

  progressBar.style.display = 'block';
  progressFill.style.width = '0%';
  uploadBtn.disabled = true;
  setMsg(uploadMsg, 'იტვირთება...', '');

  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      progressFill.style.width = pct + '%';
    }
  });

  xhr.onload = () => {
    uploadBtn.disabled = false;
    progressBar.style.display = 'none';
    if (xhr.status >= 200 && xhr.status < 300) {
      setMsg(uploadMsg, 'ატვირთულია წარმატებით!', 'success');
      uploadTitle.value = '';
      uploadFile.value = '';
      loadAdminVideos();
    } else {
      try {
        const data = JSON.parse(xhr.responseText);
        setMsg(uploadMsg, data.error || 'შეცდომა ატვირთვისას', 'error');
      } catch {
        setMsg(uploadMsg, 'შეცდომა ატვირთვისას', 'error');
      }
    }
  };

  xhr.onerror = () => {
    uploadBtn.disabled = false;
    progressBar.style.display = 'none';
    setMsg(uploadMsg, 'ქსელის შეცდომა', 'error');
  };

  xhr.send(formData);
});

async function loadAdminVideos() {
  const res = await fetch('/api/videos');
  const videos = (await res.json()).sort((a, b) => b.createdAt - a.createdAt);
  adminList.innerHTML = '';
  if (!videos.length) {
    adminList.innerHTML = '<div class="msg">ჯერ არცერთი ვიდეო არ არის ატვირთული</div>';
    return;
  }
  for (const v of videos) {
    const row = document.createElement('div');
    row.className = 'admin-video-row';
    row.innerHTML = `
      <img src="${v.thumbUrl}" alt="">
      <div class="meta">
        <input type="text" value="${escapeAttr(v.title)}" data-id="${v.id}" class="renameInput">
      </div>
      <div class="actions">
        <button class="btn btn-primary saveBtn" data-id="${v.id}">შენახვა</button>
        <button class="btn btn-danger deleteBtn" data-id="${v.id}">წაშლა</button>
      </div>
    `;
    adminList.appendChild(row);
  }

  document.querySelectorAll('.saveBtn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const input = document.querySelector(`.renameInput[data-id="${id}"]`);
      const title = input.value.trim();
      if (!title) return;
      const res = await fetch(`/api/admin/videos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      if (res.ok) loadAdminVideos();
    });
  });

  document.querySelectorAll('.deleteBtn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (!confirm('ნამდვილად გინდა ამ ვიდეოს წაშლა?')) return;
      const res = await fetch(`/api/admin/videos/${id}`, { method: 'DELETE' });
      if (res.ok) loadAdminVideos();
    });
  });
}

function escapeAttr(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

checkAuth();
