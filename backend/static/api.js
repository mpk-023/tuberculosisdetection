/* Replace these mock implementations with authenticated backend calls when the API is ready. */
(() => {
  const USE_MOCK_API = true;

  async function request(path, options = {}) {
    const response = await fetch(path, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.detail || `Request failed (${response.status}).`);
    }
    return payload;
  }

  const mockReport = () => ({
    source: "mock",
    label: "Medium",
    confidence: 72,
    observations: [
      { region: "Right upper zone", importance: "Illustrative" },
      { region: "Left mid zone", importance: "Illustrative" },
    ],
    explanation: "This sample report is generated mock content, not an analysis of the uploaded X-ray or symptoms.",
  });

  window.TBTriageApi = {
    mockMode: USE_MOCK_API,
    async sendOtp(payload) {
      if (!USE_MOCK_API) return request("/auth/send-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      await new Promise(resolve => setTimeout(resolve, 250));
      return { sent: true, mock: true };
    },
    async verifyOtp(payload) {
      if (!USE_MOCK_API) return request("/auth/verify-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      await new Promise(resolve => setTimeout(resolve, 250));
      return { verified: /^\d{6}$/.test(payload.otp), token: "local-demo-session" };
    },
    async getQuestionnaire() {
      if (!USE_MOCK_API) return request("/questionnaire");
      return JSON.parse(localStorage.getItem("tbta.questions") || "null");
    },
    async putQuestionnaire(questions) {
      if (!USE_MOCK_API) return request("/questionnaire", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questions }) });
      localStorage.setItem("tbta.questions", JSON.stringify(questions));
      return { saved: true, mock: true };
    },
    async createPatient(patient) {
      if (!USE_MOCK_API) return request("/patients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patient) });
      return { ...patient, id: patient.id || crypto.randomUUID(), mock: true };
    },
    async getPatients() {
      if (!USE_MOCK_API) return request("/patients");
      return JSON.parse(localStorage.getItem("tbta.patients") || "[]");
    },
    async analyze(image) {
      if (!USE_MOCK_API) {
        const form = new FormData();
        form.append("image", image);
        return request("/analyze", { method: "POST", body: form });
      }
      await new Promise(resolve => setTimeout(resolve, 900));
      return mockReport();
    },
  };
})();
