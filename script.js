import { supabase, signUp, signIn, signOut, getSession, onAuthChange, deleteMyAccount, changePassword } from './auth.js';

(() => {
  'use strict';

  let currentUser = null;
  let currentSession = null;
  let records = [];
  let ruleChanges = [];

  // ===================== 검증 =====================

  function isValidDateStr(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }

  function isValidNumber(v) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n);
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ===================== 인증 화면 =====================

  const authScreen = document.getElementById('auth-screen');
  const appScreen = document.getElementById('app-screen');
  const authForm = document.getElementById('auth-form');
  const authEmail = document.getElementById('auth-email');
  const authPassword = document.getElementById('auth-password');
  const authSubmit = document.getElementById('auth-submit');
  const authMsg = document.getElementById('auth-msg');
  const authTabLogin = document.getElementById('auth-tab-login');
  const authTabSignup = document.getElementById('auth-tab-signup');

  let authMode = 'login'; // 'login' | 'signup'

  function setAuthMsg(text, kind) {
    authMsg.textContent = text;
    authMsg.className = 'auth-msg' + (kind ? ' is-' + kind : '');
  }

  authTabLogin.addEventListener('click', () => {
    authMode = 'login';
    authTabLogin.classList.add('is-active');
    authTabSignup.classList.remove('is-active');
    authSubmit.textContent = '로그인';
    setAuthMsg('', '');
  });
  authTabSignup.addEventListener('click', () => {
    authMode = 'signup';
    authTabSignup.classList.add('is-active');
    authTabLogin.classList.remove('is-active');
    authSubmit.textContent = '가입';
    setAuthMsg('', '');
  });

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = authEmail.value.trim();
    const password = authPassword.value;
    authSubmit.disabled = true;
    try {
      if (authMode === 'login') {
        await signIn(email, password);
        // 성공하면 onAuthChange가 화면 전환을 처리한다.
      } else {
        const data = await signUp(email, password);
        if (data.session) {
          // 이메일 확인 없이 즉시 로그인되는 프로젝트 설정
        } else {
          setAuthMsg('가입 완료. 이메일 확인이 필요하면 메일함을 확인한 뒤 로그인하세요.', 'ok');
          authMode = 'login';
          authTabLogin.click();
        }
      }
    } catch (err) {
      // Supabase는 "비밀번호 오류"와 "계정 없음"을 구분해서 알려주지 않는다
      // (둘 다 Invalid login credentials) — T07-C99 요구사항에 해당.
      setAuthMsg(translateAuthError(err), 'error');
    } finally {
      authSubmit.disabled = false;
    }
  });

  function translateAuthError(err) {
    const msg = String(err?.message || err);
    if (/invalid login credentials/i.test(msg)) return '이메일 또는 비밀번호가 올바르지 않습니다.';
    if (/user already registered/i.test(msg)) return '이미 가입된 이메일입니다.';
    if (/password/i.test(msg) && /least/i.test(msg)) return '비밀번호는 6자 이상이어야 합니다.';
    return msg;
  }

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await signOut();
  });

  document.getElementById('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('new-password');
    const newPassword = input.value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      await changePassword(newPassword);
      input.value = '';
      setPasswordMsg('비밀번호를 변경했습니다. 이 기기는 로그인이 유지되고, 다른 기기의 로그인은 모두 끊겼습니다.', 'ok');
    } catch (err) {
      setPasswordMsg('비밀번호 변경 실패: ' + translateAuthError(err), 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  document.getElementById('delete-account-btn').addEventListener('click', async () => {
    if (!confirm('정말 계정을 삭제할까요? 계정에 속한 모든 기록이 함께 삭제되며 되돌릴 수 없습니다.')) return;
    try {
      await deleteMyAccount();
      await signOut();
      setDataMsg('계정과 자료가 삭제되었습니다.', 'ok');
    } catch (err) {
      setDataMsg('계정 삭제 실패: ' + err.message, 'error');
    }
  });

  // ===================== 인증 상태 변화에 따른 화면 전환 =====================

  onAuthChange((session) => {
    currentSession = session;
    currentUser = session?.user ?? null;
    if (currentUser) {
      authScreen.classList.add('is-hidden');
      appScreen.classList.remove('is-hidden');
      document.getElementById('account-email').textContent = currentUser.email;
      renderSessionExpiry();
      refreshAll();
    } else {
      appScreen.classList.add('is-hidden');
      authScreen.classList.remove('is-hidden');
      records = [];
      ruleChanges = [];
    }
  });

  function renderSessionExpiry() {
    if (!currentSession?.expires_at) return;
    const expiresAt = currentSession.expires_at * 1000;
    const remainMin = Math.max(0, Math.round((expiresAt - Date.now()) / 60000));
    const text = `${remainMin}분 후 만료`;
    document.getElementById('session-expiry').textContent = text;
    document.getElementById('status-expiry').textContent =
      `${new Date(expiresAt).toLocaleString('ko-KR')} (${text})`;
  }
  setInterval(renderSessionExpiry, 30000);

  // 초기 세션 확인 (새로고침 시)
  getSession().then((session) => {
    currentSession = session;
    currentUser = session?.user ?? null;
    if (currentUser) {
      authScreen.classList.add('is-hidden');
      appScreen.classList.remove('is-hidden');
      document.getElementById('account-email').textContent = currentUser.email;
      renderSessionExpiry();
      refreshAll();
    }
  });

  // ===================== 탭 전환 =====================

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => {
        b.classList.remove('is-active');
        b.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('is-active'));
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('is-active');
      if (btn.dataset.tab === 'summary') renderSummary();
      if (btn.dataset.tab === 'data') renderDataStatus();
    });
  });

  async function refreshAll() {
    await Promise.all([loadRecords(), loadRuleChanges()]);
    renderRecords();
    renderSummary();
    renderDataStatus();
  }

  // ===================== 기록 CRUD (Supabase) =====================

  async function loadRecords() {
    const { data, error } = await supabase.from('records').select('*').order('date', { ascending: false });
    if (error) {
      console.error(error);
      setFormMsg('기록을 불러오지 못했습니다: ' + error.message, 'error');
      records = [];
      return;
    }
    records = data;
  }

  const form = document.getElementById('record-form');
  const idField = document.getElementById('record-id');
  const dateField = document.getElementById('f-date');
  const tzField = document.getElementById('f-tz');
  const itemField = document.getElementById('f-item');
  const valueField = document.getElementById('f-value');
  const unitField = document.getElementById('f-unit');
  const tagField = document.getElementById('f-tag');
  const memoField = document.getElementById('f-memo');
  const submitBtn = document.getElementById('submit-btn');
  const cancelEditBtn = document.getElementById('cancel-edit-btn');
  const formMsg = document.getElementById('form-msg');

  function setFormMsg(text, kind) {
    formMsg.textContent = text;
    formMsg.className = 'form-msg' + (kind ? ' is-' + kind : '');
  }

  function resetForm() {
    form.reset();
    idField.value = '';
    dateField.value = new Date().toISOString().slice(0, 10);
    submitBtn.textContent = '기록 추가';
    cancelEditBtn.classList.add('is-hidden');
    setFormMsg('', '');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const date = dateField.value;
    const item = itemField.value.trim();
    const value = valueField.value;
    const unit = unitField.value.trim();

    if (!date || !isValidDateStr(date)) return setFormMsg('날짜를 올바르게 입력하세요.', 'error');
    if (!item) return setFormMsg('항목을 입력하세요.', 'error');
    if (value === '' || !isValidNumber(value)) return setFormMsg('값은 숫자로 입력하세요.', 'error');
    if (!unit) return setFormMsg('단위를 입력하세요.', 'error');

    const payload = {
      date, tz: tzField.value, item, value: parseFloat(value), unit,
      tag: tagField.value.trim(), memo: memoField.value.trim(),
    };

    submitBtn.disabled = true;
    try {
      if (idField.value) {
        // 수정 — RLS 때문에 내 소유가 아닌 id는 0건 영향으로 조용히 실패한다.
        const { data, error } = await supabase.from('records').update(payload).eq('id', idField.value).select();
        if (error) throw error;
        if (!data || data.length === 0) {
          setFormMsg('수정할 수 없습니다 (내 기록이 아니거나 이미 삭제됨).', 'error');
        } else {
          setFormMsg('기록을 수정했습니다.', 'ok');
        }
      } else {
        const { error } = await supabase.from('records').insert(payload);
        if (error) throw error;
        setFormMsg('기록을 추가했습니다.', 'ok');
      }
      await loadRecords();
      renderRecords();
      renderSummary();
      renderDataStatus();
      resetForm();
    } catch (err) {
      setFormMsg('저장 실패: ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  cancelEditBtn.addEventListener('click', resetForm);

  function startEdit(id) {
    const r = records.find((x) => x.id === id);
    if (!r) return;
    idField.value = r.id;
    dateField.value = r.date;
    tzField.value = r.tz || 'Asia/Seoul';
    itemField.value = r.item;
    valueField.value = r.value;
    unitField.value = r.unit;
    tagField.value = r.tag || '';
    memoField.value = r.memo || '';
    submitBtn.textContent = '수정 저장';
    cancelEditBtn.classList.remove('is-hidden');
    setFormMsg('', '');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function deleteRecord(id) {
    if (!confirm('이 기록을 삭제할까요? 되돌릴 수 없습니다.')) return;
    const { data, error } = await supabase.from('records').delete().eq('id', id).select();
    if (error) {
      setFormMsg('삭제 실패: ' + error.message, 'error');
      return;
    }
    if (!data || data.length === 0) {
      setFormMsg('삭제할 수 없습니다 (내 기록이 아니거나 이미 삭제됨).', 'error');
      return;
    }
    if (idField.value === id) resetForm();
    await loadRecords();
    renderRecords();
    renderSummary();
    renderDataStatus();
  }

  function renderRecords() {
    const tbody = document.getElementById('record-tbody');
    document.getElementById('record-count').textContent = records.length + '건';

    if (records.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">아직 기록이 없습니다. 위 양식으로 첫 기록을 남겨보세요.</td></tr>';
      return;
    }

    tbody.innerHTML = records.map((r) => `
      <tr>
        <td>${escapeHtml(r.date)}</td>
        <td>${escapeHtml(r.item)}</td>
        <td>${escapeHtml(r.value)}</td>
        <td>${escapeHtml(r.unit)}</td>
        <td>${r.tag ? `<span class="tag-chip">${escapeHtml(r.tag)}</span>` : ''}</td>
        <td>${escapeHtml(r.memo)}</td>
        <td class="col-actions">
          <div class="row-actions">
            <button class="edit-btn" data-id="${r.id}">수정</button>
            <button class="delete-btn" data-id="${r.id}">삭제</button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.edit-btn').forEach((b) => b.addEventListener('click', () => startEdit(b.dataset.id)));
    tbody.querySelectorAll('.delete-btn').forEach((b) => b.addEventListener('click', () => deleteRecord(b.dataset.id)));
  }

  document.getElementById('seed-btn').addEventListener('click', async () => {
    const today = new Date();
    const seeds = [
      { offset: 0, item: '수면 시간', value: 6.5, unit: '시간', tag: '실제', memo: '늦게 잠들어 부족' },
      { offset: -1, item: '수면 시간', value: 7.5, unit: '시간', tag: '계획', memo: '' },
      { offset: -1, item: '코딩 연습', value: 2, unit: '시간', tag: '실제', memo: 'T07 카드1 작업' },
      { offset: -3, item: '물 섭취량', value: 1.2, unit: 'L', tag: '실제', memo: '' },
      { offset: -6, item: '코딩 연습', value: 1.5, unit: '시간', tag: '계획', memo: '' },
    ];
    const rows = seeds.map((s) => {
      const d = new Date(today);
      d.setDate(d.getDate() + s.offset);
      return {
        date: d.toISOString().slice(0, 10), tz: 'Asia/Seoul',
        item: s.item, value: s.value, unit: s.unit, tag: s.tag, memo: s.memo,
      };
    });
    const { error } = await supabase.from('records').insert(rows);
    if (error) { setFormMsg('가상 기록 추가 실패: ' + error.message, 'error'); return; }
    await loadRecords();
    renderRecords();
    renderSummary();
    renderDataStatus();
  });

  // ===================== 주간 요약 =====================

  function startOfWeek(date) {
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setDate(date.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  let currentWeekStart = startOfWeek(new Date());

  function formatDate(d) {
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }

  function renderSummary() {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    document.getElementById('week-range').textContent =
      `${formatDate(currentWeekStart)} (월) ~ ${formatDate(weekEnd)} (일)`;

    const groups = new Map();
    const excluded = [];

    records.forEach((r) => {
      if (!isValidDateStr(r.date)) {
        excluded.push({ date: r.date, item: r.item, value: r.value, reason: '날짜 형식을 해석할 수 없음' });
        return;
      }
      const [y, m, d] = r.date.split('-').map(Number);
      const recordDate = new Date(y, m - 1, d, 12, 0, 0);
      const inWeek = recordDate >= currentWeekStart && recordDate <= weekEnd;
      if (!inWeek) return;

      if (!isValidNumber(r.value)) {
        excluded.push({ date: r.date, item: r.item, value: r.value, reason: '값이 숫자가 아님' });
        return;
      }

      const key = `${r.item}|${r.unit}`;
      if (!groups.has(key)) groups.set(key, { item: r.item, unit: r.unit, sum: 0, count: 0 });
      const g = groups.get(key);
      g.sum += parseFloat(r.value);
      g.count += 1;
    });

    const summaryTbody = document.getElementById('summary-tbody');
    const rows = [...groups.values()].sort((a, b) => a.item.localeCompare(b.item, 'ko'));
    summaryTbody.innerHTML = rows.length === 0
      ? '<tr class="empty-row"><td colspan="4">이 주에 유효한 기록이 없습니다.</td></tr>'
      : rows.map((g) => `
        <tr>
          <td>${escapeHtml(g.item)}</td>
          <td>${Number(g.sum.toFixed(4))}</td>
          <td>${escapeHtml(g.unit)}</td>
          <td>${g.count}</td>
        </tr>
      `).join('');

    const excludedTbody = document.getElementById('excluded-tbody');
    document.getElementById('excluded-count').textContent = excluded.length + '건';
    excludedTbody.innerHTML = excluded.length === 0
      ? '<tr class="empty-row"><td colspan="4">제외된 기록이 없습니다.</td></tr>'
      : excluded.map((e) => `
        <tr>
          <td>${escapeHtml(e.date)}</td>
          <td>${escapeHtml(e.item)}</td>
          <td>${escapeHtml(e.value)}</td>
          <td>${escapeHtml(e.reason)}</td>
        </tr>
      `).join('');

    renderRuleChanges();
  }

  document.getElementById('week-prev').addEventListener('click', () => { currentWeekStart.setDate(currentWeekStart.getDate() - 7); renderSummary(); });
  document.getElementById('week-next').addEventListener('click', () => { currentWeekStart.setDate(currentWeekStart.getDate() + 7); renderSummary(); });
  document.getElementById('week-today').addEventListener('click', () => { currentWeekStart = startOfWeek(new Date()); renderSummary(); });

  // ===================== 규칙 변경 로그 =====================

  async function loadRuleChanges() {
    const { data, error } = await supabase.from('rule_changes').select('*').order('changed_at', { ascending: true });
    if (error) { console.error(error); ruleChanges = []; return; }
    ruleChanges = data;
  }

  function renderRuleChanges() {
    const tbody = document.getElementById('rulechange-tbody');
    tbody.innerHTML = ruleChanges.length === 0
      ? '<tr class="empty-row"><td colspan="3">아직 규칙 변경 기록이 없습니다.</td></tr>'
      : ruleChanges.map((r) => `
        <tr>
          <td>${escapeHtml(new Date(r.changed_at).toLocaleString('ko-KR'))}</td>
          <td>${escapeHtml(r.content)}</td>
          <td>${escapeHtml(r.reason)}</td>
        </tr>
      `).join('');
  }

  document.getElementById('rulechange-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = document.getElementById('rc-content').value.trim();
    const reason = document.getElementById('rc-reason').value.trim();
    if (!content || !reason) return;
    const { error } = await supabase.from('rule_changes').insert({ content, reason });
    if (error) { console.error(error); return; }
    document.getElementById('rulechange-form').reset();
    await loadRuleChanges();
    renderRuleChanges();
  });

  // ===================== 데이터 관리 =====================

  const dataMsg = document.getElementById('data-msg');
  function setDataMsg(text, kind) {
    dataMsg.textContent = text;
    dataMsg.className = 'data-msg' + (kind ? ' is-' + kind : '');
  }

  const passwordMsg = document.getElementById('password-msg');
  function setPasswordMsg(text, kind) {
    passwordMsg.textContent = text;
    passwordMsg.className = 'data-msg' + (kind ? ' is-' + kind : '');
  }

  function renderDataStatus() {
    document.getElementById('status-account').textContent = currentUser?.email || '—';
    document.getElementById('status-count').textContent = records.length + '건';
    renderSessionExpiry();
  }

  document.getElementById('export-btn').addEventListener('click', () => {
    const exportData = { exportedAt: new Date().toISOString(), account: currentUser?.email, records, ruleChanges };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `plan-do-see-export-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setDataMsg('내보내기가 완료되었습니다.', 'ok');
  });

  document.getElementById('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (err) {
        setDataMsg('파일을 읽을 수 없습니다 (JSON 형식 오류). 기존 기록은 그대로입니다.', 'error');
        e.target.value = '';
        return;
      }

      // T06 형식: { schemaVersion, records: [...] } 또는 과거 v1 배열
      const incoming = Array.isArray(parsed) ? parsed : (parsed.records || []);
      const rows = [];
      let skipped = 0;
      incoming.forEach((r) => {
        if (!r || typeof r !== 'object' || !isValidDateStr(r.date) || !r.item || !isValidNumber(r.value) || !r.unit) {
          skipped++;
          return;
        }
        // id는 새로 발급 — T06 로컬 자료의 id와 Supabase uuid 충돌을 피한다.
        rows.push({
          date: r.date, tz: r.tz || 'Asia/Seoul', item: r.item,
          value: parseFloat(r.value), unit: r.unit, tag: r.tag || '', memo: r.memo || '',
        });
      });

      if (rows.length === 0) {
        setDataMsg(`가져올 유효한 기록이 없습니다 (형식 오류로 건너뜀 ${skipped}건).`, 'error');
        e.target.value = '';
        return;
      }

      const { error } = await supabase.from('records').insert(rows);
      if (error) {
        setDataMsg('가져오기 실패: ' + error.message, 'error');
      } else {
        await loadRecords();
        renderRecords();
        renderSummary();
        renderDataStatus();
        setDataMsg(`가져오기 완료 — ${rows.length}건을 내 계정으로 옮겼습니다. 형식 오류로 건너뜀 ${skipped}건.`, 'ok');
      }
      e.target.value = '';
    };
    reader.onerror = () => {
      setDataMsg('파일을 읽는 중 오류가 발생했습니다.', 'error');
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  // ===================== 초기화 =====================

  dateField.value = new Date().toISOString().slice(0, 10);
})();
