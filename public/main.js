const grid = document.getElementById('grid');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const modalOverlay = document.getElementById('modalOverlay');
const modalVideo = document.getElementById('modalVideo');
const modalTitle = document.getElementById('modalTitle');
const closeModal = document.getElementById('closeModal');

let debounceTimer = null;

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('ka-GE', { year: 'numeric', month: 'short', day: 'numeric' });
}

async function loadVideos(query = '') {
  const res = await fetch('/api/videos?q=' + encodeURIComponent(query));
  const videos = await res.json();
  renderGrid(videos);
}

function renderGrid(videos) {
  grid.innerHTML = '';
  if (!videos.length) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  for (const v of videos) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img class="thumb" src="${v.thumbUrl}" alt="${escapeHtml(v.title)}">
      <div class="info">
        <div class="title">${escapeHtml(v.title)}</div>
        <div class="date">${formatDate(v.createdAt)}</div>
      </div>
    `;
    card.addEventListener('click', () => openPlayer(v));
    grid.appendChild(card);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function openPlayer(video) {
  modalTitle.textContent = video.title;
  modalVideo.src = video.videoUrl;
  modalOverlay.classList.remove('hidden');
  modalVideo.play().catch(() => {});
}

function closePlayer() {
  modalOverlay.classList.add('hidden');
  modalVideo.pause();
  modalVideo.src = '';
}

closeModal.addEventListener('click', closePlayer);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closePlayer();
});

searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => loadVideos(searchInput.value.trim()), 250);
});

loadVideos();
