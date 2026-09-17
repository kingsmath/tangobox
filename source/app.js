/* ================= 데이터 ================= */
const DATA = window.TANGO_DATA;
const INFO = window.TANGO_INFO || {orchestras:{}, songs:{}};
const TANDA_INDEX = {}, SONG_INDEX = {}, SONG_TANDA = {};
['tango','vals','milonga'].forEach(g => (DATA[g]||[]).forEach(t => {
  TANDA_INDEX[t.id] = t;
  t.songs.forEach(s => { SONG_INDEX[s.id] = s; SONG_TANDA[s.id] = t; });
}));
const findTanda = id => TANDA_INDEX[id];
const allTandas = () => [...DATA.tango, ...DATA.vals, ...DATA.milonga];

const DEFAULT_CORTINAS = [
  {id:'__c1', title:'The Beatles \u2014 Ob-La-Di, Ob-La-Da',        videoId:'_J9NpHKrKMw'},
  {id:'__c2', title:'Chet Baker \u2014 I Fall in Love Too Easily',  videoId:'3zrSoHgAAWo'},
  {id:'__c5', title:'Stan Getz \u2014 The Girl from Ipanema',       videoId:'s61-e29Vr6Q'},
  {id:'__c6', title:'Marcos Valle & Stacey Kent \u2014 So Nice',    videoId:'0OSHbfQxeyU'},
  {id:'__c7', title:'Buena Vista Social Club \u2014 Dos Gardenias', videoId:'fugRvM6s5fc'},
  {id:'__c8', title:'최유리 \u2014 생각을 멈추다 보면',                videoId:'35w8SrlepLc'},
  {id:'__c9', title:'백예린 \u2014 Antifreeze',                      videoId:'F_ZNIXPcuig'}
];
const FADE_SEC = 5;

/* ================= 저장소 ================= */
const LS = {
  videoMap:'tangoDJ.videoMap',   // 직접 바꾼 곡만 저장 (나머지는 데이터 내장값)
  cortinas:'tangoDJ.cortinas',
  settings:'tangoDJ.settings'
};
function lsGet(k, fb){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; }catch(e){ return fb; } }
function lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){ toast('브라우저 저장에 실패했습니다.'); } }

let videoMap = lsGet(LS.videoMap, {});
let cortinas = lsGet(LS.cortinas, null);
if(!cortinas){ cortinas = DEFAULT_CORTINAS.map(c => Object.assign({}, c)); lsSet(LS.cortinas, cortinas); }
let settings = lsGet(LS.settings, {cortinaSeconds:30});

function builtinVideos(songId){
  const s = SONG_INDEX[songId];
  return s ? [s.v].concat(s.alts || []).filter(Boolean) : [];
}
function getVideo(songId){
  if(videoMap[songId]) return videoMap[songId];
  const b = builtinVideos(songId);
  return b.length ? b[0] : '';
}
function videoCandidates(songId){
  const out = [], seen = {};
  [videoMap[songId]].concat(builtinVideos(songId)).forEach(v => { if(v && !seen[v]){ seen[v]=1; out.push(v); } });
  return out;
}
function setVideo(songId, vid){
  if(vid) videoMap[songId] = vid; else delete videoMap[songId];
  lsSet(LS.videoMap, videoMap);
}
const cortinaPool = () => cortinas.length ? cortinas : DEFAULT_CORTINAS;

/* ================= 유틸 ================= */
let _uid = 0;
const uid = () => 'u' + (_uid++) + Math.random().toString(36).slice(2,6);
const genreLabel = g => ({tango:'탱고', vals:'발스', milonga:'밀롱가'})[g] || g;
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = s => { s = Math.floor(s||0); return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0'); };
const isInstrumental = t => !t.singer || t.singer === '-' || /instrumental|연주곡/i.test(t.singer);
const isMixed = t => /[가-힣]/.test(t.orchestra);

/** 혼합 딴따는 "곡명 — 오케스트라" 형태라 곡별로 악단이 다르다. */
function orchestraOf(tanda, song){
  if(!isMixed(tanda)) return tanda.orchestra;
  const bits = String(song && song.title || '').split(/\s*[—–]\s*/);
  return bits.length >= 2 ? bits[bits.length-1].trim() : tanda.orchestra;
}
/** 해설을 찾을 때 쓰는 곡 제목 (오케스트라 표기·괄호 제거) */
function songKey(song){
  return String(song.title).split(/\s*[—–]\s*/)[0].replace(/\([^)]*\)/g, '').trim();
}
const songInfo  = song => INFO.songs[songKey(song)] || '';
const songTitle = song => (INFO.titles || {})[songKey(song)] || '';
/** 위키미디어에서 받아 둔 인물·악단 사진 */
const photoOf = name => (INFO.photos || {})[name] || null;

function avatarTag(name, cls){
  const ph = photoOf(name);
  return ph ? '<img class="' + cls + '" src="' + esc(ph.file) + '" alt="' + esc(name) +
              '" loading="lazy" decoding="async">' : '';
}
/** 사진 출처 표기 (CC 라이선스는 저작자 표시가 필요하다) */
function photoCredit(ph){
  const bits = ['사진 · 위키미디어 공용'];
  if(ph.author)  bits.push(ph.author);
  if(ph.license) bits.push(ph.license);
  const txt = esc(bits.join(' · '));
  return ph.page ? '<a href="' + esc(ph.page) + '" target="_blank" rel="noopener">' + txt + '</a>' : txt;
}

function orchInfo(tanda, song){
  const name = orchestraOf(tanda, song);
  return INFO.orchestras[name] || INFO.orchestras[tanda.orchestra] || null;
}

function extractVideoId(input){
  if(!input) return '';
  input = String(input).trim();
  if(/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  try{
    const url = new URL(input);
    if(url.hostname.includes('youtu.be')) return url.pathname.slice(1,12);
    const v = url.searchParams.get('v');
    if(v) return v.slice(0,11);
    const m = url.pathname.match(/\/(embed|shorts|v)\/([a-zA-Z0-9_-]{11})/);
    if(m) return m[2];
  }catch(e){}
  const m2 = input.match(/[a-zA-Z0-9_-]{11}/);
  return m2 ? m2[0] : '';
}
const todotangoUrl = song => (INFO.links || {})[songKey(song)] || '';
function lyricsLink(song, label){
  const u = todotangoUrl(song);
  return u ? '<a href="' + u + '" target="_blank" rel="noopener">' + label + '</a>' : '';
}

function toast(msg){
  const wrap = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => { el.style.transition='opacity .4s'; el.style.opacity='0'; setTimeout(()=>el.remove(), 400); }, 3600);
}

/* ================= 프로그램 생성 ================= */
/** filters 를 앞에서부터 시도하며, 조건에 맞는 딴따를 무작위로 하나 고른다. */
function pick(genre, filters, used){
  if(typeof filters === 'function') filters = [filters];
  for(const f of filters){
    const pool = DATA[genre].filter(t => !used.has(t.id) && f(t));
    if(pool.length) return pool[Math.floor(Math.random() * pool.length)];
  }
  for(const f of filters){
    const pool = DATA[genre].filter(t => f(t));
    if(pool.length) return pool[Math.floor(Math.random() * pool.length)];
  }
  return DATA[genre][Math.floor(Math.random() * DATA[genre].length)];
}
/** 같은 악단·같은 가수·비슷한 분위기의 곡을 모아 need 곡짜리 딴따를 만든다.
 *  taken 에 든 곡(이미 오늘 프로그램에 쓴 곡)은 건너뛴다. */
function expandSongs(tanda, need, taken){
  taken = taken || {};
  const seen = {}, byTitle = {}, songs = [];
  const add = song => {
    const k = songKey(song).toLowerCase();
    if(seen[song.id] || byTitle[k] || taken[song.id] || taken['t:' + k]) return;
    songs.push(song); seen[song.id] = 1; byTitle[k] = 1;
  };
  for(const song of tanda.songs){ add(song); if(songs.length >= need) return songs; }
  const sameVoice = o => (isInstrumental(o) === isInstrumental(tanda)) &&
                         (isInstrumental(tanda) || o.singer === tanda.singer);
  const steps = [
    o => o.orchestra === tanda.orchestra && sameVoice(o) &&
         Math.abs(o.axis1 - tanda.axis1) <= 1 && Math.abs(o.axis2 - tanda.axis2) <= 1,
    o => o.orchestra === tanda.orchestra && sameVoice(o),
    o => o.orchestra === tanda.orchestra
  ];
  for(const ok of steps){
    for(const o of DATA[tanda.genre]){
      if(o.id === tanda.id || !ok(o)) continue;
      for(const song of o.songs){
        add(song);
        if(songs.length >= need) return songs;
      }
    }
  }
  return songs;
}
const canFill = (t, need, taken) => expandSongs(t, need, taken).length >= need;

const mkTanda = (t, count, role, taken) =>
  ({id:uid(), kind:'tanda', tandaId:t.id, count, role,
    songIds:expandSongs(t, count, taken).map(s => s.id)});
function mkCortina(sec){
  const pool = cortinaPool();
  return {id:uid(), kind:'cortina', cortinaId: pool[Math.floor(Math.random()*pool.length)].id, seconds: sec};
}

function buildProgram(mode, sets, cortinaSec){
  const used = new Set(), slots = [];
  const taken = {};                       // 오늘 이미 쓴 곡 (곡 id + 제목)
  let setOrch = new Set();                // 한 세트 안에서 이미 쓴 악단
  const push = (t, n, role) => {
    const slot = mkTanda(t, n, role, taken);
    slot.songIds.forEach(id => {
      taken[id] = 1;
      taken['t:' + songKey(SONG_INDEX[id]).toLowerCase()] = 1;
    });
    setOrch.add(t.orchestra);
    slots.push(slot);
    if(cortinaSec > 0) slots.push(mkCortina(cortinaSec));
  };
  const fresh = t => !setOrch.has(t.orchestra);
  for(let s = 0; s < sets; s++){
    setOrch = new Set();
    if(mode === 'practice'){
      let prev = null;
      ['tango','tango','tango','vals','tango','tango','tango','milonga'].forEach(g => {
        const t = pick(g, [x => canFill(x, 2, taken) && fresh(x),
                           x => canFill(x, 2, taken) && x.orchestra !== prev,
                           x => canFill(x, 2, taken)], used);
        used.add(t.id); prev = t.orchestra; push(t, 2, null);
      });
    } else if(mode === 'random'){
      let prev = null;
      ['tango','tango','vals','tango','tango','milonga'].forEach(g => {
        const need = g === 'tango' ? 4 : 3;
        const t = pick(g, [x => canFill(x, need, taken) && fresh(x),
                           x => canFill(x, need, taken) && x.orchestra !== prev,
                           x => canFill(x, need, taken)], used);
        used.add(t.id); prev = t.orchestra; push(t, need, null);
      });
    } else {
      // 로맨틱 → 리드미컬 → 발스 → 화려 → 조용 → 밀롱가 (탱고는 모두 4곡)
      // 한 세트 안에서는 같은 악단이 두 번 나오지 않게 하고, 곡도 겹치지 않게 한다.
      const mood = (axis, dir, need) => [
        t => t[axis] * dir >= 1 && canFill(t, need, taken) && fresh(t),
        t => t[axis] * dir >= 1 && canFill(t, need, taken),
        t => canFill(t, need, taken) && fresh(t),
        t => canFill(t, need, taken)
      ];
      const t1 = pick('tango', mood('axis1',  1, 4), used); used.add(t1.id); push(t1, 4, '로맨틱');
      const t2 = pick('tango', mood('axis1', -1, 4), used); used.add(t2.id); push(t2, 4, '리드미컬');
      const tv = pick('vals',  [t => canFill(t, 3, taken) && fresh(t),
                                t => canFill(t, 3, taken)], used); used.add(tv.id); push(tv, 3, null);
      const t3 = pick('tango', mood('axis2',  1, 4), used); used.add(t3.id); push(t3, 4, '화려');
      const t4 = pick('tango', mood('axis2', -1, 4), used); used.add(t4.id); push(t4, 4, '조용');
      const tm = pick('milonga', [t => canFill(t, 3, taken) && fresh(t),
                                  t => canFill(t, 3, taken)], used); used.add(tm.id); push(tm, 3, null);
    }
  }
  return slots;
}

/* ================= 프로그램 상태 ================= */
let programSlots = [];
let pos = null;                       // {slotId, songIdx} — 슬롯을 가리키므로 재생 중에 목록을 고쳐도 따라간다

const slotIdx = id => programSlots.findIndex(s => s.id === id);
const slotById = id => programSlots.find(s => s.id === id);
const slotSongs = slot => (slot.songIds || []).map(id => SONG_INDEX[id]).filter(Boolean);
function resolveCortina(slot){
  const pool = cortinaPool();
  return pool.find(c => c.id === slot.cortinaId) || pool[Math.floor(Math.random()*pool.length)];
}

function nextPos(p){
  if(!p) return programSlots.length ? {slotId:programSlots[0].id, songIdx:0} : null;
  const i = slotIdx(p.slotId);
  if(i < 0) return programSlots.length ? {slotId:programSlots[0].id, songIdx:0} : null;
  const slot = programSlots[i];
  if(slot.kind === 'tanda' && p.songIdx + 1 < slotSongs(slot).length)
    return {slotId:slot.id, songIdx:p.songIdx + 1};
  return i + 1 < programSlots.length ? {slotId:programSlots[i+1].id, songIdx:0} : null;
}
function prevPos(p){
  if(!p) return null;
  const i = slotIdx(p.slotId);
  if(i < 0) return null;
  if(programSlots[i].kind === 'tanda' && p.songIdx > 0) return {slotId:p.slotId, songIdx:p.songIdx - 1};
  if(i === 0) return {slotId:p.slotId, songIdx:0};
  const prev = programSlots[i-1];
  return {slotId:prev.id, songIdx: prev.kind === 'tanda' ? Math.max(0, slotSongs(prev).length - 1) : 0};
}

function itemAt(p){
  if(!p) return null;
  const slot = slotById(p.slotId);
  if(!slot) return null;
  if(slot.kind === 'cortina'){
    const c = resolveCortina(slot);
    return {kind:'cortina', slot, cortina:c, seconds:slot.seconds || 30, videoId:c ? c.videoId : ''};
  }
  const tanda = findTanda(slot.tandaId);
  const songs = slotSongs(slot);
  const song = songs[p.songIdx];
  if(!song) return null;
  return {kind:'song', slot, tanda, song, index:p.songIdx, total:songs.length, videoId:getVideo(song.id)};
}

/* ================= 프로그램 화면 ================= */
function renderProgram(){
  const list = document.getElementById('program-list');
  const empty = document.getElementById('no-program-msg');
  list.innerHTML = '';
  if(!programSlots.length){ empty.style.display = 'block'; document.getElementById('program-summary').textContent = ''; return; }
  empty.style.display = 'none';

  let n = 0;
  programSlots.forEach(slot => {
    const playingHere = pos && pos.slotId === slot.id;
    if(slot.kind === 'cortina'){
      const c = resolveCortina(slot);
      const div = document.createElement('div');
      div.className = 'cort' + (playingHere ? ' playing' : '');
      div.innerHTML = '<span>코르티나 · ' + slot.seconds + '초</span>' +
                      '<span class="note" style="font-size:12px">' + esc(c ? c.title : '') + '</span>';
      list.appendChild(div);
      return;
    }
    n++;
    const t = findTanda(slot.tandaId);
    const songs = slotSongs(slot);
    const div = document.createElement('div');
    div.className = 'tanda' + (playingHere ? ' playing' : '');
    div.dataset.slotId = slot.id;
    div.innerHTML =
      '<div class="no">' + n + '</div>' +
      '<div class="body">' +
        '<div class="l1">' +
          '<span class="g ' + t.genre + '">' + genreLabel(t.genre) + (slot.role ? ' · ' + slot.role : '') + '</span>' +
          '<span class="orch">' + esc(t.orchestra) + '</span>' +
          '<span class="note">' + (isInstrumental(t) ? '연주곡' : esc(t.singer)) + '</span>' +
        '</div>' +
        '<div class="songs">' +
          songs.map((s, i) => '<span class="' + (playingHere && pos.songIdx === i ? 'cur' : '') + '">' +
            esc(songKey(s)) + '</span>').join(' · ') +
        '</div>' +
      '</div>' +
      '<div class="acts">' +
        '<select class="swap"><option value="">교체…</option>' +
          DATA[t.genre].filter(x => x.id !== t.id)
            .map(x => '<option value="' + x.id + '">' +
              esc(x.name === x.orchestra ? x.orchestra : x.orchestra + ' — ' + x.name) + '</option>').join('') +
        '</select>' +
        '<button class="btn icon up" title="위로">▲</button>' +
        '<button class="btn icon down" title="아래로">▼</button>' +
        '<button class="btn icon here" title="여기부터 재생">▶</button>' +
        '<button class="btn icon del" title="빼기">✕</button>' +
      '</div>';

    div.querySelector('.swap').addEventListener('change', e => {
      if(!e.target.value) return;
      slot.tandaId = e.target.value;
      slot.songIds = expandSongs(findTanda(slot.tandaId), slot.count).map(x => x.id);
      if(pos && pos.slotId === slot.id) playAt({slotId:slot.id, songIdx:0});
      else renderProgram();
    });
    div.querySelector('.up').addEventListener('click', () => moveSlot(slot.id, -1));
    div.querySelector('.down').addEventListener('click', () => moveSlot(slot.id, 1));
    div.querySelector('.here').addEventListener('click', () => playAt({slotId:slot.id, songIdx:0}));
    div.querySelector('.del').addEventListener('click', () => removeSlot(slot.id));
    list.appendChild(div);
  });

  const add = document.createElement('div');
  add.className = 'addrow';
  add.innerHTML =
    '<span class="note">딴따 추가</span>' +
    '<select id="add-genre"><option value="tango">탱고</option><option value="vals">발스</option><option value="milonga">밀롱가</option></select>' +
    '<button class="btn sm" id="add-btn">＋ 맨 뒤에 추가</button>';
  add.querySelector('#add-btn').addEventListener('click', () => {
    const g = add.querySelector('#add-genre').value;
    const used = new Set(programSlots.filter(s => s.kind === 'tanda').map(s => s.tandaId));
    const need = g === 'tango' ? 4 : 3;
    const t = pick(g, x => canFill(x, need), used);   // 손으로 추가할 때는 조건을 느슨하게
    const sec = parseInt(document.getElementById('cortina-seconds-input').value, 10) || 0;
    if(sec > 0) programSlots.push(mkCortina(sec));
    programSlots.push(mkTanda(t, need, null));
    renderProgram();
    toast(t.orchestra + ' 딴따를 뒤에 넣었습니다.');
  });
  list.appendChild(add);

  document.getElementById('program-summary').textContent = n + '개 딴따';
}

function moveSlot(slotId, dir){
  const tandaSlots = programSlots.filter(s => s.kind === 'tanda');
  const i = tandaSlots.findIndex(s => s.id === slotId), j = i + dir;
  if(j < 0 || j >= tandaSlots.length) return;
  const a = tandaSlots[i], b = tandaSlots[j];
  [a.tandaId, b.tandaId] = [b.tandaId, a.tandaId];
  [a.count, b.count]     = [b.count, a.count];
  [a.role, b.role]       = [b.role, a.role];
  if(pos && (pos.slotId === a.id || pos.slotId === b.id)){
    const other = pos.slotId === a.id ? b : a;
    pos = {slotId:other.id, songIdx:pos.songIdx};   // 곡은 그대로 따라간다
  }
  renderProgram();
}

function removeSlot(slotId){
  const i = slotIdx(slotId);
  if(i < 0) return;
  const wasPlaying = pos && pos.slotId === slotId;
  programSlots.splice(i, 1);
  // 딴따를 빼면 짝지어 있던 코르티나도 같이 정리한다
  if(programSlots[i] && programSlots[i].kind === 'cortina') programSlots.splice(i, 1);
  else if(i > 0 && !programSlots[i] && programSlots[i-1] && programSlots[i-1].kind === 'cortina')
    programSlots.splice(i - 1, 1);

  if(!wasPlaying){ renderProgram(); return; }
  if(programSlots[i]) playAt({slotId:programSlots[i].id, songIdx:0});   // 그 자리에 온 딴따로 이어간다
  else stop();
}

/* ================= 플레이어 ================= */
let ytPlayer = null, ytReady = false, pendingPos = null;
let isPaused = true, cortinaTimer = null, cortinaStart = null, baseVolume = 100, fading = false;

function onYouTubeIframeAPIReady(){
  ytPlayer = new YT.Player('yt-player', {
    playerVars:{autoplay:0, controls:1, rel:0, playsinline:1, modestbranding:1},
    events:{
      onReady: () => { ytReady = true; if(pendingPos){ const p = pendingPos; pendingPos = null; playAt(p); } },
      onStateChange: e => {
        if(e.data === YT.PlayerState.ENDED){
          const it = itemAt(pos);
          if(it && it.kind === 'song') next();
        } else if(e.data === YT.PlayerState.PLAYING){ isPaused = false; syncToggle(); }
        else if(e.data === YT.PlayerState.PAUSED){ isPaused = true; syncToggle(); }
      },
      onError: e => onPlayError(e && e.data)
    }
  });
}

function setNow(title, sub){
  document.getElementById('now-title').textContent = title;
  document.getElementById('now-sub').textContent = sub;
}
function syncToggle(){ document.getElementById('btn-toggle').textContent = isPaused ? '▶' : '⏸'; }

function clearCortina(){
  clearTimeout(cortinaTimer); cortinaTimer = null; cortinaStart = null;
  if(fading && ytPlayer && ytPlayer.setVolume){ ytPlayer.setVolume(baseVolume); }
  fading = false;
}

function playAt(p){
  clearCortina();
  const item = itemAt(p);
  if(!item){ stop(); return; }
  pos = p;
  renderProgram();
  renderInfo(item);

  if(!ytReady || !ytPlayer || !ytPlayer.loadVideoById){
    pendingPos = p;
    setNow('유튜브 플레이어 준비 중…', '잠시만 기다려주세요');
    return;
  }

  if(item.kind === 'cortina'){
    setNow('코르티나 — ' + (item.cortina ? item.cortina.title : ''), item.seconds + '초 후 다음 딴따');
    if(item.videoId){
      isPaused = false;
      baseVolume = (ytPlayer.getVolume && ytPlayer.getVolume()) || 100;
      ytPlayer.setVolume(baseVolume);
      ytPlayer.loadVideoById(item.videoId);
    } else if(ytPlayer.stopVideo) ytPlayer.stopVideo();
    cortinaStart = Date.now();
    cortinaTimer = setTimeout(next, item.seconds * 1000);
    syncToggle();
    return;
  }

  if(!item.videoId){
    toast('영상이 없어 건너뜁니다: ' + songKey(item.song));
    next(); return;
  }
  isPaused = false;
  ytPlayer.loadVideoById(item.videoId);
  setNow(orchestraOf(item.tanda, item.song) + ' — ' + songKey(item.song),
         genreLabel(item.tanda.genre) + ' · ' + (item.index + 1) + '/' + item.total + '곡');
  syncToggle();
}

function next(){
  const p = nextPos(pos);
  if(!p){ finish(); return; }
  playAt(p);
}
function prev(){
  const p = prevPos(pos);
  if(p) playAt(p);
}
function toggle(){
  if(!ytPlayer || !pos){
    if(programSlots.length) playAt(nextPos(null));
    return;
  }
  if(isPaused){ ytPlayer.playVideo(); if(cortinaStart){ cortinaStart = Date.now(); restartCortinaTimer(); } }
  else { ytPlayer.pauseVideo(); clearTimeout(cortinaTimer); cortinaTimer = null; }
}
function restartCortinaTimer(){
  const item = itemAt(pos);
  if(!item || item.kind !== 'cortina') return;
  clearTimeout(cortinaTimer);
  cortinaTimer = setTimeout(next, item.seconds * 1000);
}
function stop(){
  clearCortina();
  pos = null;
  if(ytPlayer && ytPlayer.stopVideo) ytPlayer.stopVideo();
  setNow('재생 대기 중', '프로그램을 만들고 ▶ 를 눌러주세요');
  document.getElementById('progress').style.width = '0';
  isPaused = true; syncToggle();
  renderProgram();
  document.getElementById('infobox').innerHTML = '';
}
function finish(){ toast('프로그램이 끝났습니다. 수고하셨습니다!'); stop(); }

/** 영상이 막혔으면 같은 곡의 다음 후보로 갈아탄다. */
function onPlayError(code){
  const item = itemAt(pos);
  if(code === 153 || code === 101 || code === 150){
    if(location.protocol === 'file:'){
      document.getElementById('filewarn').hidden = false;
      toast('파일을 직접 열면 유튜브가 재생을 막습니다. «탱고DJ 실행.bat» 으로 열어주세요.');
      stop(); return;
    }
  }
  if(!item || item.kind !== 'song'){ next(); return; }
  const list = videoCandidates(item.song.id);
  const nx = list[list.indexOf(item.videoId) + 1];
  if(nx){
    setVideo(item.song.id, nx);
    toast('재생할 수 없는 영상이라 다른 영상으로 바꿉니다.');
    ytPlayer.loadVideoById(nx);
    return;
  }
  toast('재생할 수 없어 다음 곡으로 넘어갑니다: ' + songKey(item.song));
  next();
}

/* 진행바 · 코르티나 페이드아웃 */
setInterval(() => {
  const item = itemAt(pos);
  if(!item) return;
  let pct = 0;
  if(item.kind === 'song' && ytPlayer && ytPlayer.getDuration){
    const d = ytPlayer.getDuration() || 0, c = ytPlayer.getCurrentTime() || 0;
    pct = d > 0 ? c / d * 100 : 0;
    if(d > 0){
      document.getElementById('now-sub').textContent =
        genreLabel(item.tanda.genre) + ' · ' + (item.index+1) + '/' + item.total + '곡 · ' + fmt(c) + ' / ' + fmt(d);
    }
  } else if(item.kind === 'cortina' && cortinaStart && !isPaused){
    const elapsed = (Date.now() - cortinaStart) / 1000;
    const left = Math.max(0, item.seconds - elapsed);
    pct = Math.min(100, elapsed / item.seconds * 100);
    document.getElementById('now-sub').textContent = Math.ceil(left) + '초 후 다음 딴따';
    if(ytPlayer && ytPlayer.setVolume){
      if(left <= FADE_SEC){ fading = true; ytPlayer.setVolume(Math.max(0, Math.round(baseVolume * left / FADE_SEC))); }
      else if(fading){ fading = false; ytPlayer.setVolume(baseVolume); }
    }
  }
  document.getElementById('progress').style.width = pct + '%';
}, 250);

/* ================= 오른쪽 해설 패널 ================= */
/** 오른쪽 칸이 화면보다 길면, 아래가 화면 바닥에 닿는 위치에서 멈추게 한다. */
function syncSideStick(){
  const side = document.querySelector('.side');
  const ws = document.getElementById('workspace');
  if(!side || (ws && ws.classList.contains('offscreen'))) return;
  if(!window.matchMedia('(min-width:1041px)').matches){ side.style.top = ''; return; }
  const TOP = 86, GAP = 24;
  const h = side.getBoundingClientRect().height;
  side.style.top = (h + TOP + GAP > window.innerHeight)
    ? Math.round(window.innerHeight - h - GAP) + 'px'
    : TOP + 'px';
}

function renderInfo(item){
  const box = document.getElementById('infobox');
  if(!item){ box.innerHTML = ''; return; }
  if(item.kind === 'cortina'){
    box.innerHTML =
      '<div class="blk"><h3>코르티나</h3>' +
      '<div class="name">' + esc(item.cortina ? item.cortina.title : '') + '</div>' +
      '<p>딴따와 딴따 사이에 트는 짧은 곡입니다. 탱고가 아닌 곡을 트는 것이 관습인데, ' +
      '“이제 파트너를 바꾸세요”라는 신호이기 때문입니다. ' +
      '마지막 ' + FADE_SEC + '초 동안 볼륨이 서서히 줄어듭니다.</p></div>';
    syncSideStick();
    return;
  }
  const t = item.tanda, song = item.song;
  const prof = orchInfo(t, song);
  const desc = songInfo(song);
  box.innerHTML =
    '<div class="blk">' +
      '<h3>악단</h3>' +
      '<div class="who">' + avatarTag(orchestraOf(t, song), 'ava') +
        '<div><div class="name">' + esc(orchestraOf(t, song)) + '</div>' +
        (prof && prof.tag ? '<div class="tagline">' + esc(prof.tag) + '</div>' : '') +
        '</div></div>' +
      (prof ? '<p>' + esc(prof.text) + '</p>' : '<p class="none">이 악단의 소개는 아직 준비되지 않았습니다.</p>') +
      (prof && prof.singers ? '<div class="meta">주요 가수 · ' + esc(prof.singers) + '</div>' : '') +
      (isInstrumental(t) ? '' : '<div class="meta">이 딴따의 가수 · ' + esc(t.singer) + '</div>') +
    '</div>' +
    '<div class="blk">' +
      '<h3>곡</h3>' +
      '<div class="name">' + esc(songKey(song)) + '</div>' +
      (desc ? '<p>' + esc(desc) + '</p>'
            : songTitle(song) ? '<p>제목은 “' + esc(songTitle(song)) + '”라는 뜻입니다.</p>'
                              : '<p class="none">이 곡의 해설은 아직 준비되지 않았습니다.</p>') +
      (lyricsLink(song, 'todotango에서 자세한 정보 보기 →')
        ? '<p class="meta">' + lyricsLink(song, 'todotango에서 자세한 정보 보기 →') + '</p>' : '') +
    '</div>';
  syncSideStick();
}

/* ================= 곡목록 (악단 단위) ================= */

/** 딴따를 흩어 악단별로 모은다. 혼합 딴따는 곡마다 실제 악단으로 나눈다. */
function orchestraGroups(){
  const map = {};
  allTandas().forEach(t => {
    t.songs.forEach(song => {
      const name = orchestraOf(t, song);
      const g = map[name] || (map[name] = {name, byGenre:{}, total:0});
      const list = g.byGenre[t.genre] || (g.byGenre[t.genre] = []);
      if(list.some(x => x.song.title === song.title)) return;   // 같은 제목은 한 번만
      list.push({song, tanda:t});
      g.total++;
    });
  });
  return Object.keys(map).map(k => map[k]);
}
const GROUPS = orchestraGroups().sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

function renderLibrary(){
  const genre = document.getElementById('filter-genre').value;
  const q = document.getElementById('filter-search').value.trim().toLowerCase();
  const wrap = document.getElementById('lib-list');
  wrap.innerHTML = '';

  let shown = 0, songCount = 0;
  GROUPS.forEach(group => {
    // 장르 · 검색어로 걸러 낸 곡만 남긴다
    const hitName = group.name.toLowerCase().includes(q);
    const view = {};
    ['tango','vals','milonga'].forEach(g => {
      if(genre !== 'all' && genre !== g) return;
      const list = (group.byGenre[g] || []).filter(x =>
        !q || hitName || x.song.title.toLowerCase().includes(q));
      if(list.length) view[g] = list;
    });
    const n = Object.keys(view).reduce((a, g) => a + view[g].length, 0);
    if(!n) return;
    shown++; songCount += n;
    wrap.appendChild(renderGroup(group, view, n));
  });

  document.getElementById('lib-count').textContent = shown + '개 악단 · ' + songCount + '곡';
  if(!shown) wrap.innerHTML = '<div class="empty">검색 결과가 없습니다.</div>';
}

function renderGroup(group, view, n){
  const item = document.createElement('div');
  item.className = 'item';
  const prof = INFO.orchestras[group.name];
  const genres = Object.keys(view);

  item.innerHTML =
    '<div class="head">' +
      avatarTag(group.name, 'avatar') +
      genres.map(g => '<span class="g ' + g + '">' + genreLabel(g) + '</span>').join('') +
      '<span><b>' + esc(group.name) + '</b></span>' +
      (prof && prof.tag ? '<span class="note">' + esc(prof.tag) + '</span>' : '') +
      '<span class="cnt">' + n + '곡</span>' +
    '</div>' +
    '<div class="bd">' +
      (function(){
        const ph = photoOf(group.name);
        const fig = ph ? '<figure><img src="' + esc(ph.file) + '" alt="' + esc(group.name) +
                         '" loading="lazy" decoding="async">' +
                         '<figcaption>' + photoCredit(ph) + '</figcaption></figure>' : '';
        const body = prof
          ? '<p>' + esc(prof.text) + '</p>' +
            (prof.singers ? '<div class="meta">주요 가수 · ' + esc(prof.singers) + '</div>' : '')
          : '<p class="note">이 악단의 소개는 아직 준비되지 않았습니다.</p>';
        return '<div class="profile">' + fig + '<div class="ptxt">' + body + '</div></div>';
      })() +
      genres.map(g =>
        '<div class="gsec" data-genre="' + g + '">' +
          '<div class="ghead">' +
            '<span class="g ' + g + '">' + genreLabel(g) + '</span>' +
            '<span class="cnt">' + view[g].length + '곡</span>' +
            '<span class="spacer"></span>' +
            '<button class="btn sm playgenre">▶ 이어 듣기</button>' +
          '</div>' +
          view[g].map(x => {
            const song = x.song, d = songInfo(song);
            const url = todotangoUrl(song);
            return '<div class="song" data-song-id="' + song.id + '">' +
              '<div class="r1">' +
                '<span class="t">' + esc(song.title) + '</span>' +
                '<button class="btn sm one" title="재생">▶</button>' +
                (url ? '<button class="btn sm info" title="자세한 정보">자세한 정보</button>' : '') +
              '</div>' +
              (d ? '<div class="desc">' + esc(d) + '</div>'
                 : '<div class="nodesc">제목 뜻 · ' + esc(songTitle(song) || '—') + '</div>') +
            '</div>';
          }).join('') +
        '</div>').join('') +
    '</div>';

  item.querySelector('.head').addEventListener('click', e => {
    if(e.target.tagName !== 'BUTTON') item.classList.toggle('open');
  });

  item.querySelectorAll('.gsec').forEach(sec => {
    const g = sec.dataset.genre;
    sec.querySelector('.playgenre').addEventListener('click', e => {
      e.stopPropagation();
      playSongsNow(view[g].map(x => x.song), 0);
    });
  });

  item.querySelectorAll('.song').forEach(row => {
    const songId = row.dataset.songId;
    const song = SONG_INDEX[songId];
    row.querySelector('.one').addEventListener('click', e => {
      e.stopPropagation(); playSongsNow([song], 0);
    });
    const infoBtn = row.querySelector('.info');
    if(infoBtn){
      infoBtn.addEventListener('click', e => {
        e.stopPropagation();
        window.open(todotangoUrl(song), '_blank', 'noopener');
      });
    }
  });
  return item;
}

/** 곡목록에서 고른 곡들을 재생한다. 화면은 그대로 두고(곡목록이면 곡목록 그대로)
 *  오른쪽 영상·해설만 바뀐다. 프로그램 목록 맨 앞에도 넣어 두어, 나중에 «플레이»
 *  탭으로 가면 방금 재생한 곡이 그 자리에 그대로 보인다. */
function playSongsNow(songs, startIdx){
  if(!songs.length) return;
  const first = SONG_TANDA[songs[0].id];
  const slot = {id:uid(), kind:'tanda', tandaId:first.id, count:songs.length,
                role:null, songIds:songs.map(s => s.id)};
  programSlots.unshift(slot);
  playAt({slotId:slot.id, songIdx:startIdx || 0});
}

/* ================= 설정 ================= */
function renderCortinas(){
  const wrap = document.getElementById('cortina-list');
  if(!cortinas.length){
    wrap.innerHTML = '<div style="border:0;padding:8px 0" class="note">' +
      '목록을 모두 지우셨습니다. 기본 ' + DEFAULT_CORTINAS.length + '곡이 대신 나옵니다. ' +
      '(아래 «기본 목록 복원» 으로 되돌릴 수 있습니다)</div>';
    return;
  }
  wrap.innerHTML = cortinas.map(c =>
    '<div data-id="' + c.id + '"><span class="ttl">' + esc(c.title) + '</span>' +
    '<span class="note">' + esc(c.videoId) + '</span>' +
    '<span class="spacer"></span>' +
    '<button class="btn sm try">듣기</button>' +
    '<button class="btn sm del">삭제</button></div>').join('');
  wrap.querySelectorAll('.try').forEach(btn => btn.addEventListener('click', e => {
    const id = e.target.closest('[data-id]').dataset.id;
    const c = cortinas.find(x => x.id === id);
    if(c && ytReady){ ytPlayer.loadVideoById(c.videoId); toast('코르티나 미리듣기 · ' + c.title); }
  }));
  wrap.querySelectorAll('.del').forEach(btn => btn.addEventListener('click', e => {
    const id = e.target.closest('[data-id]').dataset.id;
    cortinas = cortinas.filter(c => c.id !== id);
    lsSet(LS.cortinas, cortinas);
    renderCortinas(); renderProgram();
  }));
}

function exportData(){
  const blob = new Blob([JSON.stringify({videoMap, cortinas, settings, exportedAt:new Date().toISOString()}, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tango_dj_backup.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('백업 파일을 내려받았습니다.');
}
function importData(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const p = JSON.parse(reader.result);
      if(p.videoMap) lsSet(LS.videoMap, p.videoMap);
      if(p.cortinas) lsSet(LS.cortinas, p.cortinas);
      if(p.settings) lsSet(LS.settings, p.settings);
      toast('가져왔습니다. 새로고침합니다…');
      setTimeout(() => location.reload(), 800);
    }catch(e){ toast('올바른 백업 파일이 아닙니다.'); }
  };
  reader.readAsText(file);
}

/* ================= 초기화 ================= */
function init(){
  if(location.protocol === 'file:') document.getElementById('filewarn').hidden = false;

  const workspace = document.getElementById('workspace');
  const paneDj = document.getElementById('pane-dj');
  const paneLibrary = document.getElementById('pane-library');
  const viewSettings = document.getElementById('view-settings');

  document.querySelectorAll('nav button').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;

    // 재생 중인 영상은 절대 DOM에서 떼어내거나 display:none 하지 않는다 — 그래야 재생이 끊기지 않는다.
    if(tab === 'settings'){
      workspace.classList.add('offscreen');
      viewSettings.classList.add('active');
    } else {
      viewSettings.classList.remove('active');
      workspace.classList.remove('offscreen');
      paneDj.hidden = (tab !== 'dj');
      paneLibrary.hidden = (tab !== 'library');
      if(tab === 'library') renderLibrary();
      syncSideStick();
    }
  }));

  const secSel = document.getElementById('cortina-seconds-input');
  secSel.value = String(settings.cortinaSeconds != null ? settings.cortinaSeconds : 30);
  if(!secSel.value) secSel.value = '30';

  document.getElementById('generate-btn').addEventListener('click', () => {
    const mode = document.getElementById('mode-select').value;
    const sets = parseInt(document.getElementById('sets-input').value, 10) || 1;
    const sec  = parseInt(secSel.value, 10) || 0;
    settings.cortinaSeconds = sec; lsSet(LS.settings, settings);
    programSlots = buildProgram(mode, sets, sec);
    pos = null;
    renderProgram();
  });

  document.getElementById('filter-genre').addEventListener('change', renderLibrary);
  document.getElementById('filter-search').addEventListener('input', renderLibrary);

  document.getElementById('cortina-add-btn').addEventListener('click', () => {
    const title = document.getElementById('cortina-title-input').value.trim() || '코르티나';
    const vid = extractVideoId(document.getElementById('cortina-url-input').value);
    if(!vid){ toast('유튜브 주소 또는 영상 ID를 입력해주세요.'); return; }
    cortinas.push({id:uid(), title, videoId:vid});
    lsSet(LS.cortinas, cortinas);
    document.getElementById('cortina-title-input').value = '';
    document.getElementById('cortina-url-input').value = '';
    renderCortinas(); renderProgram();
  });
  document.getElementById('cortina-restore-btn').addEventListener('click', () => {
    cortinas = DEFAULT_CORTINAS.map(c => Object.assign({}, c));
    lsSet(LS.cortinas, cortinas);
    renderCortinas(); renderProgram();
    toast('기본 코르티나 ' + cortinas.length + '곡을 되돌렸습니다.');
  });
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('import-file').addEventListener('change', e => { if(e.target.files[0]) importData(e.target.files[0]); });
  document.getElementById('reset-btn').addEventListener('click', () => {
    if(confirm('직접 바꾼 영상·코르티나·설정을 지우고 기본 상태로 되돌립니다. 계속할까요?')){
      Object.values(LS).forEach(k => localStorage.removeItem(k));
      location.reload();
    }
  });

  window.addEventListener('resize', syncSideStick);
  if(window.ResizeObserver){
    const ro = new ResizeObserver(syncSideStick);
    ro.observe(document.querySelector('.side'));
  }
  syncSideStick();

  document.getElementById('btn-prev').addEventListener('click', prev);
  document.getElementById('btn-next').addEventListener('click', next);
  document.getElementById('btn-stop').addEventListener('click', stop);
  document.getElementById('btn-toggle').addEventListener('click', toggle);

  renderCortinas();
  renderProgram();
}
init();
