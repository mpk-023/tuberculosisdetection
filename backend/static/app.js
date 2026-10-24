(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const STORAGE = {
    session: "tbta.session",
    patients: "tbta.patients",
    questions: "tbta.questions",
    draft: "tbta.draft",
    language: "tbta.language",
  };
  const { languages, en, translations } = window.TBTALocales;
  const tr = key => (translations[localStorage.getItem(STORAGE.language) || "en"] || en)[key] || en[key] || key;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[ch]);
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const setStore = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  };
  const today = new Date().toISOString().slice(0, 10);
  const samplePatients = [
    { id:"demo-1001", name:"Meena Devi", age:42, sex:"Female", mobile:"9000000001", village:"Example village", date:today, triage:"High", mock:true, answers:{ "Persistent cough for 2+ weeks?":"Yes", "Fever?":"Yes", "Night sweats?":"No", "Unexplained weight loss?":"Yes", "Contact with a TB patient?":"Not sure", "Previous TB treatment?":"No" } },
    { id:"demo-1002", name:"Ravi Kumar", age:35, sex:"Male", mobile:"9000000002", village:"Sample ward", date:today, triage:"Medium", mock:true, answers:{ "Persistent cough for 2+ weeks?":"Yes", "Fever?":"No", "Night sweats?":"No", "Unexplained weight loss?":"No", "Contact with a TB patient?":"Yes", "Previous TB treatment?":"No" } },
    { id:"demo-1003", name:"Fatima Begum", age:29, sex:"Female", mobile:"9000000003", village:"Example village", date:today, triage:"Low", mock:true, answers:{ "Persistent cough for 2+ weeks?":"No", "Fever?":"No", "Night sweats?":"No", "Unexplained weight loss?":"No", "Contact with a TB patient?":"No", "Previous TB treatment?":"No" } },
    { id:"demo-1004", name:"Suresh Patel", age:57, sex:"Male", mobile:"9000000004", village:"Sample ward", date:today, triage:"Pending", mock:true, answers:{} },
    { id:"demo-1005", name:"Lakshmi Rao", age:51, sex:"Female", mobile:"9000000005", village:"Example village", date:today, triage:"Medium", mock:true, answers:{ "Persistent cough for 2+ weeks?":"Yes", "Fever?":"Yes", "Night sweats?":"Yes", "Unexplained weight loss?":"No", "Contact with a TB patient?":"No", "Previous TB treatment?":"No" } },
  ];
  const defaultQuestions = [
    { id:"cough", textKey:"cough", type:"yesno" },
    { id:"fever", textKey:"fever", type:"yesno" },
    { id:"night", textKey:"nightSweats", type:"yesno" },
    { id:"weight", textKey:"weightLoss", type:"yesno" },
    { id:"contact", textKey:"tbContact", type:"yesno" },
    { id:"treatment", textKey:"previousTreatment", type:"yesno" },
  ];
  const basePath = String(window.TBTABasePath || "").replace(/\/$/, "");
  const routeFromLocation = () => {
    const pathname = location.pathname;
    return basePath && pathname.startsWith(basePath)
      ? pathname.slice(basePath.length) || "/"
      : pathname;
  };
  const routeUrl = path => `${basePath}${path === "/" ? "/" : path}`;
  let route = routeFromLocation();
  let otpSent = false;
  let resendSeconds = 0;
  let resendTimer = null;
  let loginDraft = { name:"", age:"", mobile:"" };
  let editingQuestion = null;
  let settingsOpen = false;
  let modalHtml = "";
  let wizardStep = 1;
  let wizardDraft = read(STORAGE.draft, { name:"", age:"", sex:"", mobile:"", village:"", patientId:"", answers:{}, photo:"", xray:"" });
  let currentPatientId = null;

  function session() { return read(STORAGE.session, null); }
  function questions() { return read(STORAGE.questions, defaultQuestions); }
  function patients() {
    const saved = read(STORAGE.patients, null);
    return saved === null ? samplePatients : saved;
  }
  function navigate(path) {
    history.pushState({}, "", routeUrl(path));
    route = path;
    settingsOpen = false;
    modalHtml = "";
    render();
  }
  window.addEventListener("popstate", () => { route = routeFromLocation(); render(); });
  function languageSelect(className = "language-top") {
    const selected = localStorage.getItem(STORAGE.language) || "en";
    return `<label class="sr-only" for="language-select">${tr("language")}</label><select id="language-select" class="${className}" aria-label="${esc(tr("language"))}">${languages.map(([code,name]) => `<option value="${code}" ${selected===code?"selected":""}>${esc(name)}</option>`).join("")}</select>`;
  }
  function shell(content, options = {}) {
    const worker = session();
    const settingsButton = options.login ? "" : `<button class="icon-button" id="settings-open" type="button" aria-label="${esc(tr("settings"))}" title="${esc(tr("settings"))}">⚙ <span class="sr-only">${esc(tr("settings"))}</span></button>`;
    return `<div class="app-shell">
      <header class="topbar">
        <a class="brand" href="${esc(routeUrl("/dashboard"))}" data-route="/dashboard" aria-label="Alveo — Assisted Lung Visualization and Explainable Outcomes">
          <img class="brand-logo" src="${esc(basePath)}/static/alveo-logo.png" alt="">
          <span class="brand-copy"><strong>Alveo</strong><small>Assisted Lung Visualization and Explainable Outcomes</small></span>
        </a>
        <div class="top-actions">${options.login ? languageSelect() : `<span class="hint">${worker ? esc(worker.name) : ""}</span>${settingsButton}`}</div>
      </header>
      ${content}
      <footer class="decision-note" role="note">${esc(tr("note"))}</footer>
      ${settingsOpen ? settingsDrawer() : ""}
      ${modalHtml ? `<div class="modal" id="modal-root" role="presentation"><section class="card modal-card" role="dialog" aria-modal="true" aria-label="${esc(tr("dialog"))}">${modalHtml}</section></div>` : ""}
    </div>`;
  }
  function settingsDrawer() {
    return `<div class="settings-backdrop" id="settings-backdrop"></div><aside class="settings-panel" aria-label="${esc(tr("settings"))}">
      <div class="page-header"><h2>${esc(tr("settings"))}</h2><button id="settings-close" class="icon-button" aria-label="${esc(tr("cancel"))}">✕</button></div>
      <div class="field"><label for="drawer-language">${esc(tr("language"))}</label>${languageSelect("filter-select")}</div>
      <div class="btn-row"><button class="btn btn-danger" id="logout-button">${esc(tr("logout"))}</button></div>
      <p class="small-print">${esc(tr("localOnly"))}</p>
    </aside>`;
  }
  function loginPage() {
    const content = `<main class="container" style="max-width:620px">
      <section class="card">
        <div class="page-header"><div><h1>${esc(tr("login"))}</h1><p>${esc(tr("loginIntro"))}</p></div></div>
        <form id="login-form" novalidate>
          <div class="field-grid">
            <div class="field full"><label for="worker-name">${esc(tr("fullName"))}</label><input id="worker-name" name="name" value="${esc(loginDraft.name)}" autocomplete="name" required minlength="2"></div>
            <div class="field"><label for="worker-age">${esc(tr("age"))}</label><input id="worker-age" name="age" value="${esc(loginDraft.age)}" inputmode="numeric" type="number" min="18" max="100" required></div>
            <div class="field"><label for="worker-mobile">${esc(tr("mobile"))}</label><div style="display:flex;gap:7px"><span class="btn btn-quiet" aria-hidden="true">+91</span><input id="worker-mobile" name="mobile" value="${esc(loginDraft.mobile)}" inputmode="numeric" autocomplete="tel-national" maxlength="10" pattern="[0-9]{10}" required></div></div>
          </div>
          <p class="hint">${esc(tr("otpMockNote"))}</p>
          <div id="login-error" class="error-text" role="alert"></div>
          <div id="otp-area" class="${otpSent ? "" : "hidden"}">
            <div class="field"><label for="otp-code">${esc(tr("otp"))}</label><input id="otp-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" aria-describedby="otp-hint"></div>
            <div class="hint" id="otp-hint">${esc(tr("demoOtp"))} ${resendSeconds ? `${esc(tr("resendIn"))} ${resendSeconds} ${esc(tr("seconds"))}.` : ""}</div>
            <button class="btn btn-secondary" id="resend-otp" type="button" ${resendSeconds ? "disabled" : ""}>${esc(tr("resend"))}</button>
          </div>
          <div class="btn-row"><button class="btn btn-primary" type="button" id="send-otp">${esc(tr("sendOtp"))}</button><button class="btn btn-primary ${otpSent ? "" : "hidden"}" type="submit">${esc(tr("verify"))}</button></div>
        </form>
      </section>
    </main>`;
    $("#app").innerHTML = shell(content, { login:true });
  }
  function dashboardPage() {
    const worker = session();
    const content = `<main class="container">
      <div class="page-header"><div><h1>${esc(tr("welcome"))}, ${esc(worker?.name || "")}</h1><p>${esc(tr("dashboardIntro"))}</p></div></div>
      <section class="grid dashboard-grid" aria-label="${esc(tr("dashboard"))}">
        <button class="card action-card" data-route="/patients/new"><span class="action-icon" aria-hidden="true">＋</span><span><strong>${esc(tr("addPatient"))}</strong><small>${esc(tr("addCardDescription"))}</small></span></button>
        <button class="card action-card" data-route="/questionnaire"><span class="action-icon" aria-hidden="true">☷</span><span><strong>${esc(tr("questionnaire"))}</strong><small>${esc(tr("questionnaireCardDescription"))}</small></span></button>
        <button class="card action-card" data-route="/patients"><span class="action-icon" aria-hidden="true">▤</span><span><strong>${esc(tr("patientList"))}</strong><small>${esc(tr("patientListCardDescription"))}</small></span></button>
      </section>
      <p class="small-print">${esc(tr("localOnly"))}</p>
    </main>`;
    $("#app").innerHTML = shell(content);
  }
  function progress() {
    const labels = [tr("step1"), tr("step2"), tr("step3")];
    return `<div class="progress" aria-label="Step ${wizardStep} of 3">${labels.map((label,index) => `${index ? `<span class="progress-line"></span>` : ""}<div class="progress-step ${wizardStep===index+1?"active":wizardStep>index+1?"done":""}"><span class="bubble">${wizardStep>index+1?"✓":index+1}</span><span>${esc(label)}</span></div>`).join("")}</div>`;
  }
  function field(name, label, value = "", type = "text", required = false, extra = "") {
    return `<div class="field"><label for="draft-${name}">${esc(label)}${required?" *":""}</label><input id="draft-${name}" name="${name}" type="${type}" value="${esc(value)}" ${required?"required":""} ${extra}></div>`;
  }
  function questionPrompt(question, index) {
    const title = question.textKey ? tr(question.textKey) : question.text;
    const id = esc(question.id);
    if (question.type === "yesno") {
      return `<fieldset class="question"><legend class="question-title">${esc(title)}</legend><div class="choice-row">${[[tr("yes"),"Yes"],[tr("no"),"No"],[tr("notSure"),"Not sure"]].map(([label,value]) => `<label class="choice"><input type="radio" name="answer-${id}" value="${esc(value)}" ${wizardDraft.answers?.[id]===value?"checked":""}><span>${esc(label)}</span></label>`).join("")}</div></fieldset>`;
    }
    if (question.type === "choice") {
      const options = (question.options || []).filter(Boolean);
      return `<div class="question"><label class="question-title" for="answer-${id}">${esc(title)}</label><select id="answer-${id}" name="answer-${id}" class="filter-select"><option value="">—</option>${options.map(value=>`<option ${wizardDraft.answers?.[id]===value?"selected":""} value="${esc(value)}">${esc(value)}</option>`).join("")}</select></div>`;
    }
    return `<div class="question field"><label class="question-title" for="answer-${id}">${esc(title)}</label><input id="answer-${id}" name="answer-${id}" ${question.type==="number"?'type="number" inputmode="decimal"':'type="text"'} value="${esc(wizardDraft.answers?.[id]||"")}"></div>`;
  }
  function wizardPage() {
    const content = `<main class="container">
      <div class="page-header"><div><h1>${esc(tr("addPatient"))}</h1><p>${esc(tr("localOnly"))}</p></div><button class="btn btn-quiet" data-route="/dashboard">${esc(tr("back"))}</button></div>
      ${progress()}
      <section class="card">
        ${wizardStep===1 ? `<h2>${esc(tr("patientDetails"))}</h2><div class="field-grid">
          ${field("name",tr("fullName"),wizardDraft.name,"text",true,'autocomplete="name"')}
          ${field("age",tr("age"),wizardDraft.age,"number",true,'min="1" max="120" inputmode="numeric"')}
          <div class="field"><label for="draft-sex">${esc(tr("sex"))}</label><select id="draft-sex" name="sex"><option value="">—</option>${[[tr("female"),"Female"],[tr("male"),"Male"],[tr("other"),"Other"],[tr("preferNot"),"Prefer not to say"]].map(([a,b])=>`<option value="${b}" ${wizardDraft.sex===b?"selected":""}>${esc(a)}</option>`).join("")}</select></div>
          ${field("mobile",tr("mobile"),wizardDraft.mobile,"tel",false,'inputmode="numeric" maxlength="10"')}
          ${field("village",tr("village"),wizardDraft.village)}
          ${field("patientId",tr("patientId"),wizardDraft.patientId)}
          <div class="field full"><label for="patient-photo">${esc(tr("patientPhoto"))}</label><input id="patient-photo" type="file" accept="image/*" capture="user"><span class="hint">${esc(tr("choosePhoto"))}</span>          ${wizardDraft.photo?`<img class="preview-image" alt="${esc(tr("patientPhotoPreview"))}" src="${wizardDraft.photo}">`:""}</div>
        </div>` : wizardStep===2 ? `<h2>${esc(tr("questionsTitle"))}</h2>${questions().map(questionPrompt).join("")}` : `<h2>${esc(tr("xrayTitle"))}</h2><p>${esc(tr("xrayHint"))}</p><div class="upload-zone"><label class="stack"><span aria-hidden="true" style="font-size:30px">▧</span><span>${esc(tr("takePhoto"))}</span><input id="xray-file" type="file" accept="image/*" capture="environment"></label></div><p class="hint">${esc(tr("compressHint"))}</p>${wizardDraft.xray?`<img class="preview-image" alt="${esc(tr("xrayPreview"))}" src="${wizardDraft.xray}">`:""}<div id="upload-error" class="error-text" role="alert"></div>`}
        <div id="wizard-error" class="error-text" role="alert"></div>
        <div class="btn-row">${wizardStep>1?`<button class="btn btn-quiet" id="wizard-back">${esc(tr("back"))}</button>`:""}<button class="btn btn-primary" id="wizard-next">${wizardStep===3?esc(tr("analyze")):esc(tr("next"))}</button></div>
      </section>
    </main>`;
    $("#app").innerHTML = shell(content);
  }
  function questionnairePage() {
    const content = `<main class="container">    <div class="page-header"><div><h1>${esc(tr("questionnaire"))}</h1><p>${esc(tr("questionnaireIntro"))}</p></div><button class="btn btn-quiet" data-route="/dashboard">${esc(tr("back"))}</button></div>
      <section class="card"><div class="page-header"><h2>${esc(tr("questionsTitle"))}</h2><button class="btn btn-primary" id="question-add">${esc(tr("addQuestion"))}</button></div>
      ${questions().map((q,index)=>`<div class="question-editor"><div><strong>${esc(q.textKey?tr(q.textKey):q.text)}</strong><div class="hint">${esc(q.type==="yesno"?tr("yesNo"):q.type==="number"?tr("number"):q.type==="choice"?tr("singleChoice"):tr("shortText"))}${q.type==="choice"&&q.options?.length?` · ${esc(q.options.join(", "))}`:""}</div></div>
      <div class="btn-row" style="margin:0"><button class="btn btn-quiet" data-question-edit="${esc(q.id)}">${esc(tr("edit"))}</button><button class="btn btn-quiet" data-question-up="${index}" aria-label="${esc(tr("moveUp"))}" ${index===0?"disabled":""}>↑</button><button class="btn btn-quiet" data-question-down="${index}" aria-label="${esc(tr("moveDown"))}" ${index===questions().length-1?"disabled":""}>↓</button><button class="btn btn-danger" data-question-delete="${esc(q.id)}">${esc(tr("delete"))}</button></div></div>`).join("")}
      <p id="question-saved" class="hint" role="status"></p></section></main>`;
    $("#app").innerHTML = shell(content);
  }
  function badge(label) {
    const cls = String(label || "Pending").toLowerCase();
    const localized = ({ high:tr("high"), medium:tr("medium"), low:tr("low"), pending:tr("pending") })[cls] || label;
    return `<span class="badge ${["high","medium","low"].includes(cls)?cls:"pending"}">${esc(localized || tr("pending"))}</span>`;
  }
  function patientCard(patient) {
    const initials = patient.name.split(/\s+/).slice(0,2).map(word=>word[0]||"").join("").toUpperCase();
    const photo = patient.photo ? `<img src="${patient.photo}" alt="">` : esc(initials);
    return `<button class="card patient-row" data-patient="${esc(patient.id)}"><span class="avatar" aria-hidden="true">${photo}</span><span><span class="patient-name">${esc(patient.name)}</span><span class="patient-meta">${esc(patient.age)} · ${esc(patient.date||today)} · ${esc(patient.id)}</span></span>${badge(patient.triage)}</button>`;
  }
  function patientListPage() {
    const all = patients();
    const content = `<main class="container"><div class="page-header"><div><h1>${esc(tr("patientList"))}</h1><p>${esc(tr("localOnly"))}</p></div><button class="btn btn-primary" data-route="/patients/new">${esc(tr("addPatient"))}</button></div>
    <section class="toolbar no-print"><input id="patient-search" class="search-input" type="search" placeholder="${esc(tr("search"))}" aria-label="${esc(tr("search"))}"><select id="triage-filter" class="filter-select" aria-label="${esc(tr("allResults"))}"><option value="">${esc(tr("allResults"))}</option>${["High","Medium","Low","Pending"].map(x=>`<option value="${x}">${esc(({High:tr("high"),Medium:tr("medium"),Low:tr("low"),Pending:tr("pending")})[x])}</option>`).join("")}</select><select id="date-filter" class="filter-select" aria-label="${esc(tr("allDates"))}"><option value="">${esc(tr("allDates"))}</option>${[...new Set(all.map(p=>p.date||today))].sort().reverse().map(d=>`<option>${esc(d)}</option>`).join("")}</select></section>
      <section class="patient-list" id="patient-list" aria-live="polite">${all.length?all.map(patientCard).join(""):`<div class="card empty-state">${esc(tr("emptyPatients"))}</div>`}</section></main>`;
    $("#app").innerHTML = shell(content);
  }
  function loadPatient(id) { return patients().find(item=>item.id===id) || null; }
  function reportPage(patient) {
    if (!patient) return `<main class="container"><div class="card empty-state">${esc(tr("reportMissing"))} <button class="btn btn-secondary" data-route="/patients">${esc(tr("backToPatientList"))}</button></div></main>`;
    const report = patient.report || patient.mockReport || { label:patient.triage||"Pending", confidence:72, observations:[{region:"Right upper zone",importance:"Illustrative"},{region:"Left mid zone",importance:"Illustrative"}], explanation:tr("exampleExplanation") };
    const answers = patient.answers || {};
    const answerPairs = Object.entries(answers);
    const xray = patient.xray || "";
    const patientName = patient.name;
    const workerName = session()?.name || "Demo worker";
    return `<main class="container"><div class="page-header"><div><h1>${esc(tr("report"))}</h1><p>${esc(tr("localOnly"))}</p></div><button class="btn btn-quiet" data-route="/patients">${esc(tr("back"))}</button></div>
      <div class="report-stack">
        <section class="card report-card"><h2>1. ${esc(patientName)}</h2><div class="hint">${esc(patient.age)} · ${esc(patient.date||today)} · ${esc(workerName)}</div></section>
        <section class="card report-card"><h2>2. ${esc(tr("triage"))}</h2><div class="triage-result">${badge(report.label||patient.triage||"Pending")}<strong>${esc(({High:tr("high"),Medium:tr("medium"),Low:tr("low"),Pending:tr("pending")})[report.label||patient.triage]||report.label||patient.triage)} — ${esc(tr("illustrativeSample"))}</strong></div><p><strong>${esc(tr("confidence"))}: ${esc(report.confidence??72)}%</strong></p><div class="meter ${(report.label||"").toLowerCase()}"><span style="width:${Math.min(100,Math.max(0,Number(report.confidence)||0))}%"></span></div><p class="hint">${esc(tr("recommendation"))}</p></section>
        <section class="card report-card"><h2>3. ${esc(tr("heatmap"))}</h2><div class="heatmap-toggle"><button class="btn btn-secondary" data-heat-view="original" aria-pressed="true">${esc(tr("original"))}</button><button class="btn btn-secondary" data-heat-view="overlay" aria-pressed="false">${esc(tr("overlay"))}</button></div><div class="heatmap-grid" data-view="original">${[[tr("original"),false],[tr("overlay"),true]].map(([label,overlay])=>`<div><strong>${esc(label)}</strong><div class="xray-frame">${xray?`<img src="${xray}" alt="${esc(label)} X-ray (demo only)">`:`<div class="xray-placeholder">${esc(tr("imagePreview"))}</div>`}${overlay?'<div class="heat-overlay" aria-hidden="true"></div>':""}</div></div>`).join("")}</div><label class="field" style="margin-top:12px"><span>${esc(tr("opacity"))}</span><input id="heat-opacity" type="range" min="0" max="100" value="55" aria-label="${esc(tr("opacity"))}"></label><label class="field" style="margin-top:12px"><span>${esc(tr("zoom"))}</span><input id="heat-zoom" type="range" min="100" max="200" value="100" aria-label="${esc(tr("zoom"))}"></label><div class="toolbar"><span class="legend-scale" aria-hidden="true"></span><span class="hint">${esc(tr("warmer"))}</span></div><p class="small-print">${esc(tr("heatmapCaption"))}</p></section>
        <section class="card report-card"><h2>4. ${esc(tr("observations"))}</h2>${(report.observations||[]).map(item=>`<div class="observation"><span>${esc(item.region)}</span><span class="badge pending">${esc(item.importance||"Mock")}</span></div>`).join("")}</section>
        <section class="card report-card"><h2>5. ${esc(tr("summary"))}</h2>${answerPairs.length?answerPairs.map(([key,value])=>`<div class="observation"><span>${esc(questionLabel(key))}</span><span class="${value==="Yes"?"risk-answer":""}">${esc(answerLabel(value))}</span></div>`).join(""):`<p class="hint">${esc(tr("noAnswer"))}</p>`}</section>
        <section class="card report-card"><h2>6. ${esc(tr("why"))}</h2><p>${esc(report.explanation||tr("exampleExplanation"))}</p><p class="small-print">${esc(tr("noClinicalFinding"))}</p></section>
        <section class="card report-card"><h2>7. ${esc(tr("nextSteps"))}</h2><div class="checklist"><label><input type="checkbox"><span>${esc(tr("confirmatory"))}</span></label><label><input type="checkbox"><span>${esc(tr("advise"))}</span></label><label><input type="checkbox"><span>${esc(tr("followup"))}</span></label></div><div class="btn-row no-print"><button class="btn btn-secondary" id="referral-note">${esc(tr("referral"))}</button><button class="btn btn-quiet" id="share-note">${esc(tr("share"))}</button><button class="btn btn-quiet" id="save-record">${esc(tr("saveRecord"))}</button><button class="btn btn-primary" id="print-report">${esc(tr("print"))}</button></div></section>
      </div></main>`;
  }
  function questionLabel(id) {
    const q = questions().find(item=>item.id===id);
    if (q) return q.textKey ? tr(q.textKey) : q.text;
    const common = {
      "Persistent cough for 2+ weeks?":"cough",
      "Fever?":"fever",
      "Night sweats?":"nightSweats",
      "Unexplained weight loss?":"weightLoss",
      "Contact with a TB patient?":"tbContact",
      "Previous TB treatment?":"previousTreatment",
    };
    return common[id] ? tr(common[id]) : id;
  }
  function answerLabel(value) {
    return ({ Yes:tr("yes"), No:tr("no"), "Not sure":tr("notSure") })[value] || value || tr("noAnswer");
  }
  function render() {
    document.documentElement.lang = localStorage.getItem(STORAGE.language) || "en";
    const path = routeFromLocation();
    route = path;
    if (path === "/login" || !session()) {
      if (session()) { history.replaceState({}, "", routeUrl("/dashboard")); route="/dashboard"; dashboardPage(); bindEvents(); return; }
      if (path !== "/login") history.replaceState({}, "", routeUrl("/login"));
      route="/login"; loginPage(); bindEvents(); return;
    }
    if (path === "/dashboard" || path === "/") { dashboardPage(); bindEvents(); return; }
    if (path === "/patients/new") { wizardPage(); bindEvents(); return; }
    if (path === "/questionnaire") { questionnairePage(); bindEvents(); return; }
    if (path === "/patients") { patientListPage(); bindEvents(); return; }
    const match = path.match(/^\/patients\/([^/]+)\/report$/);
    if (match) { currentPatientId = decodeURIComponent(match[1]); $("#app").innerHTML = shell(reportPage(loadPatient(currentPatientId))); bindEvents(); return; }
    history.replaceState({}, "", routeUrl("/dashboard")); dashboardPage(); bindEvents();
  }
  function startResendTimer() {
    if (resendTimer) clearInterval(resendTimer);
    resendSeconds = 30;
    const updateTimer = () => {
      const hint = $("#otp-hint");
      if (hint) hint.textContent = `${tr("demoOtp")} ${resendSeconds ? `${tr("resendIn")} ${resendSeconds} ${tr("seconds")}.` : ""}`;
      const button = $("#resend-otp");
      if (button) button.disabled = resendSeconds > 0;
      if (resendSeconds === 0) {
        clearInterval(resendTimer);
        resendTimer = null;
      }
    };
    updateTimer();
    resendTimer = setInterval(() => {
      resendSeconds = Math.max(0, resendSeconds - 1);
      updateTimer();
    }, 1000);
  }
  function persistDraft() {
    if (!setStore(STORAGE.draft, wizardDraft)) {
      const error = $("#wizard-error");
      if (error) error.textContent = tr("draftStorageError");
      return false;
    }
    return true;
  }
  function imageData(file, maxSide = 1600, quality = .78) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) return reject(new Error(tr("uploadError")));
      if (file.size > 15 * 1024 * 1024) return reject(new Error(tr("imageTooLarge")));
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(tr("uploadError"))); };
      image.src = url;
    });
  }
  function setPatientList(items) {
    const target = $("#patient-list");
    if (target) target.innerHTML = items.length ? items.map(patientCard).join("") : `<div class="card empty-state">${esc(tr("emptyPatients"))}</div>`;
  }
  function filterPatients() {
    const query = ($("#patient-search")?.value || "").trim().toLowerCase();
    const triage = $("#triage-filter")?.value || "";
    const date = $("#date-filter")?.value || "";
    setPatientList(patients().filter(p =>
      (!query || `${p.name} ${p.id}`.toLowerCase().includes(query)) &&
      (!triage || p.triage===triage) &&
      (!date || (p.date||today)===date)
    ));
  }
  function openQuestionModal(question = null) {
    editingQuestion = question?.id || null;
    modalHtml = `<h2>${esc(question?tr("edit"):tr("addQuestion"))}</h2><form id="question-form" class="stack">
      <div class="field"><label for="q-text">${esc(tr("questionText"))}</label><input id="q-text" required value="${esc(question?.text||"")}"></div>
      <div class="field"><label for="q-type">${esc(tr("questionType"))}</label><select id="q-type"><option value="yesno" ${question?.type==="yesno"?"selected":""}>${esc(tr("yesNo"))}</option><option value="text" ${question?.type==="text"?"selected":""}>${esc(tr("shortText"))}</option><option value="number" ${question?.type==="number"?"selected":""}>${esc(tr("number"))}</option><option value="choice" ${question?.type==="choice"?"selected":""}>${esc(tr("singleChoice"))}</option></select></div>
      <div class="field ${question?.type==="choice"?"":"hidden"}" id="q-options-wrap"><label for="q-options">${esc(tr("options"))}</label><input id="q-options" value="${esc(question?.options?.join(", ")||"")}"></div>
      <div class="btn-row"><button class="btn btn-primary" type="submit">${esc(tr("save"))}</button><button class="btn btn-quiet" type="button" id="modal-cancel">${esc(tr("cancel"))}</button></div></form>`;
    render();
  }
  function showReport(patient) {
    currentPatientId = patient.id;
    navigate(`/patients/${encodeURIComponent(patient.id)}/report`);
  }
  async function analyzeDraft() {
    const error = $("#wizard-error");
    error.textContent = "";
    if (!wizardDraft.xray) { error.textContent = tr("chooseXray"); return; }
    const imageBlob = await (await fetch(wizardDraft.xray)).blob();
    const next = await window.TBTriageApi.analyze(imageBlob);
    const worker = session();
    const patient = {
      ...wizardDraft,
      id: wizardDraft.patientId || `demo-${Date.now()}`,
      date: today,
      worker: worker?.name || "Demo worker",
      triage: next.label,
      report: next,
      mock: true,
    };
    const saved = [patient, ...patients().filter(p=>p.id!==patient.id)];
    if (!setStore(STORAGE.patients, saved)) {
      error.textContent = tr("patientStorageError");
      return;
    }
    localStorage.removeItem(STORAGE.draft);
    wizardDraft = { name:"", age:"", sex:"", mobile:"", village:"", patientId:"", answers:{}, photo:"", xray:"" };
    showReport(patient);
  }
  function bindEvents() {
    $("#language-select")?.addEventListener("change", event => {
      loginDraft = {
        name:$("#worker-name")?.value || loginDraft.name,
        age:$("#worker-age")?.value || loginDraft.age,
        mobile:$("#worker-mobile")?.value || loginDraft.mobile,
      };
      localStorage.setItem(STORAGE.language, event.target.value);
      render();
    });
    $("#login-form")?.addEventListener("input",()=>{
      loginDraft={name:$("#worker-name").value,age:$("#worker-age").value,mobile:$("#worker-mobile").value};
    });
    document.querySelectorAll("[data-route]").forEach(el => el.addEventListener("click", event => {
      event.preventDefault();
      const path = el.dataset.route;
      if (path === "/patients/new") {
        wizardStep=1;
        wizardDraft=read(STORAGE.draft,{name:"",age:"",sex:"",mobile:"",village:"",patientId:"",answers:{},photo:"",xray:""});
      }
      navigate(path);
    }));
    $("#settings-open")?.addEventListener("click",()=>{settingsOpen=true;render();});
    $("#settings-close")?.addEventListener("click",()=>{settingsOpen=false;render();});
    $("#settings-backdrop")?.addEventListener("click",()=>{settingsOpen=false;render();});
    $("#logout-button")?.addEventListener("click",()=>{
      if (window.confirm(tr("logoutConfirm"))) { localStorage.removeItem(STORAGE.session); settingsOpen=false; otpSent=false; if(resendTimer)clearInterval(resendTimer);resendTimer=null; navigate("/login"); }
    });
    $("#send-otp")?.addEventListener("click",async()=>{
      loginDraft={name:$("#worker-name").value,age:$("#worker-age").value,mobile:$("#worker-mobile").value};
      const name=loginDraft.name.trim(), age=Number(loginDraft.age), mobile=loginDraft.mobile.trim();
      const error=$("#login-error"); error.textContent="";
      if(name.length<2){error.textContent=tr("required");$("#worker-name").focus();return;}
      if(!Number.isInteger(age)||age<18||age>100){error.textContent=tr("invalidAge");$("#worker-age").focus();return;}
      if(!/^\d{10}$/.test(mobile)){error.textContent=tr("invalidMobile");$("#worker-mobile").focus();return;}
      let sent;
      try { sent=await window.TBTriageApi.sendOtp({name,age,mobile}); }
      catch (requestError) { error.textContent=requestError.message || tr("otpSendError");return; }
      if(!sent.sent){error.textContent=tr("otpSendError");return;}
      otpSent=true;render();startResendTimer();
      $("#otp-code")?.focus();
    });
    $("#resend-otp")?.addEventListener("click",async()=>{
      const error=$("#login-error");
      error.textContent="";
      try { await window.TBTriageApi.sendOtp({});startResendTimer(); }
      catch (requestError) { error.textContent=requestError.message || tr("otpSendError"); }
    });
    $("#login-form")?.addEventListener("submit",async event=>{
      event.preventDefault();
      const otp=$("#otp-code")?.value.trim()||"";
      if(!/^\d{6}$/.test(otp)){ $("#login-error").textContent=tr("invalidOtp");$("#otp-code")?.focus();return; }
      let verified;
      try { verified=await window.TBTriageApi.verifyOtp({otp}); }
      catch (error) { $("#login-error").textContent=error.message || tr("otpVerificationError");return; }
      if(!verified.verified){ $("#login-error").textContent=tr("invalidOtp");return; }
      const worker={name:$("#worker-name").value.trim(),age:Number($("#worker-age").value),mobile:$("#worker-mobile").value.trim()};
      if(!setStore(STORAGE.session,worker)){ $("#login-error").textContent=tr("sessionStorageError");return; }
      loginDraft={name:"",age:"",mobile:""};
      navigate("/dashboard");
    });
    $("#wizard-back")?.addEventListener("click",()=>{wizardStep=Math.max(1,wizardStep-1);persistDraft();render();});
    $("#wizard-next")?.addEventListener("click",async()=>{
      const error=$("#wizard-error");error.textContent="";
      if(wizardStep===1){
        wizardDraft.name=$("#draft-name").value.trim();wizardDraft.age=$("#draft-age").value;wizardDraft.sex=$("#draft-sex").value;wizardDraft.mobile=$("#draft-mobile").value.trim();wizardDraft.village=$("#draft-village").value.trim();wizardDraft.patientId=$("#draft-patientId").value.trim();
        if(wizardDraft.name.length<2){error.textContent=tr("required");return;}
        if(!Number.isInteger(Number(wizardDraft.age))||Number(wizardDraft.age)<1||Number(wizardDraft.age)>120){error.textContent=tr("invalidAge");return;}
        if(wizardDraft.mobile&&!/^\d{10}$/.test(wizardDraft.mobile)){error.textContent=tr("invalidMobile");return;}
        if(!persistDraft())return;
        wizardStep=2;render();return;
      }
      if(wizardStep===2){
        questions().forEach(q=>{const input=$(`[name="answer-${CSS.escape(q.id)}"]:checked`)||$(`#answer-${CSS.escape(q.id)}`);if(input)wizardDraft.answers[q.id]=input.value;});
        if(!persistDraft())return;wizardStep=3;render();return;
      }
      try { await analyzeDraft(); }
      catch (error) { $("#wizard-error").textContent = error.message || tr("analysisError"); }
    });
    $("#patient-photo")?.addEventListener("change",async event=>{
      const file=event.target.files?.[0];if(!file)return;
      try{wizardDraft.photo=await imageData(file,640,.72);persistDraft();render();}catch(err){$("#wizard-error").textContent=err.message||tr("uploadError");}
    });
    $("#xray-file")?.addEventListener("change",async event=>{
      const file=event.target.files?.[0];if(!file)return;
      const error=$("#upload-error");error.textContent="";
      try{wizardDraft.xray=await imageData(file,1600,.78);persistDraft();render();}catch(err){error.textContent=err.message||tr("uploadError");}
    });
    $("#patient-search")?.addEventListener("input",filterPatients);
    $("#triage-filter")?.addEventListener("change",filterPatients);
    $("#date-filter")?.addEventListener("change",filterPatients);
    $("#patient-list")?.addEventListener("click",event=>{const button=event.target.closest("[data-patient]");if(button)showReport(loadPatient(button.dataset.patient));});
    $("#question-add")?.addEventListener("click",()=>openQuestionModal());
    document.querySelectorAll("[data-question-edit]").forEach(button=>button.addEventListener("click",()=>openQuestionModal(questions().find(q=>q.id===button.dataset.questionEdit))));
    document.querySelectorAll("[data-question-delete]").forEach(button=>button.addEventListener("click",()=>{
      if(!window.confirm(tr("confirmDelete")))return;
      const next=questions().filter(q=>q.id!==button.dataset.questionDelete);
      if(!setStore(STORAGE.questions,next)){window.alert(tr("questionnaireStorageError"));return;}
      render();const status=$("#question-saved");if(status)status.textContent=tr("saved");
    }));
    document.querySelectorAll("[data-question-up],[data-question-down]").forEach(button=>button.addEventListener("click",()=>{
      const list=questions(),index=Number(button.dataset.questionUp??button.dataset.questionDown),target=index+(button.hasAttribute("data-question-up")?-1:1);
      if(target<0||target>=list.length)return;
      [list[index],list[target]]=[list[target],list[index]];
      if(!setStore(STORAGE.questions,list)){window.alert(tr("questionnaireOrderError"));return;}
      render();
    }));
    $("#modal-cancel")?.addEventListener("click",()=>{modalHtml="";editingQuestion=null;render();});
    $("#q-type")?.addEventListener("change",event=>$("#q-options-wrap").classList.toggle("hidden",event.target.value!=="choice"));
    $("#question-form")?.addEventListener("submit",event=>{
      event.preventDefault();
      const text=$("#q-text").value.trim(),type=$("#q-type").value,options=$("#q-options").value.split(",").map(x=>x.trim()).filter(Boolean);
      if(!text){$("#q-text").focus();return;}
      if(type==="choice"&&options.length<2){$("#q-options").setCustomValidity(tr("twoChoicesRequired"));$("#q-options").reportValidity();return;}
      const list=questions(),id=editingQuestion||`q-${Date.now()}`;
      const item={id,text,type,...(type==="choice"?{options}:{})};
      const index=list.findIndex(q=>q.id===id);
      if(index>=0)list[index]=item;else list.push(item);
      if(!setStore(STORAGE.questions,list)){window.alert(tr("questionnaireStorageError"));return;}
      modalHtml="";editingQuestion=null;render();const status=$("#question-saved");if(status)status.textContent=tr("saved");
    });
    $("#heat-opacity")?.addEventListener("input",event=>document.querySelectorAll(".heat-overlay").forEach(el=>el.style.opacity=Number(event.target.value)/100));
    $("#heat-zoom")?.addEventListener("input",event=>document.querySelectorAll(".xray-frame img").forEach(img=>img.style.transform=`scale(${Number(event.target.value)/100})`));
    document.querySelectorAll("[data-heat-view]").forEach(button=>button.addEventListener("click",()=>{
      const view=button.dataset.heatView;
      $(".heatmap-grid").dataset.view=view;
      document.querySelectorAll("[data-heat-view]").forEach(item=>item.setAttribute("aria-pressed",String(item===button)));
    }));
    $("#print-report")?.addEventListener("click",()=>window.print());
    $("#save-record")?.addEventListener("click",()=>window.alert(tr("alreadySaved")));
    $("#referral-note")?.addEventListener("click",()=>{
      const p=loadPatient(currentPatientId);if(!p)return;
      const body=`EXAMPLE REFERRAL NOTE — MOCK DEMO ONLY\nPatient: ${p.name}\nAge: ${p.age}\nDate: ${p.date||today}\n\nPlease assess the patient and decide on further testing according to local clinical protocols. This demo does not provide diagnostic findings.`;
      modalHtml=`<h2>${esc(tr("referral"))}</h2><div class="notice demo">${esc(tr("mockOnly"))}</div><pre style="white-space:pre-wrap;font:inherit;line-height:1.6">${esc(body)}</pre><div class="btn-row"><button class="btn btn-primary" id="referral-print">${esc(tr("print"))}</button><button class="btn btn-quiet" id="modal-cancel">${esc(tr("cancel"))}</button></div>`;
      render();$("#referral-print")?.addEventListener("click",()=>window.print());
    });
    $("#share-note")?.addEventListener("click",()=>{
      const text=encodeURIComponent("Alveo demo: illustrative mock interface only. Please do not use this as a diagnosis.");
      window.open(`https://wa.me/?text=${text}`,"_blank","noopener,noreferrer");
    });
  }
  render();
})();
