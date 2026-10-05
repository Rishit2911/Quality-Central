import api from './axios.js';

export const verifyApi = {
  // Assessment Builder
  createAssessment: (data) => api.post('/verify/builder/assessments', data),
  getAssessments: () => api.get('/verify/builder/assessments'),
  getAssessment: (id) => api.get(`/verify/builder/assessments/${id}`),
  updateAssessment: (id, data) => api.put(`/verify/builder/assessments/${id}`, data),
  deleteAssessment: (id) => api.delete(`/verify/builder/assessments/${id}`),
  publishAssessment: (id) => api.post(`/verify/builder/assessments/${id}/publish`),
  importQuestions: (formData) => api.post('/verify/builder/import-questions', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  importFromUrl: (data) => api.post('/verify/builder/import-url', data),
  uploadQuestionImage: (formData) => api.post('/verify/builder/questions/upload-image', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  aiGenerateCode: (data) => api.post('/verify/builder/ai-generate-code', data),
  randomizeAssessment: (data) => api.post('/verify/builder/randomize-assessment', data),
  
  // Question Bank
  createBankItem: (data) => api.post('/verify/question-bank', data),
  getBankItems: () => api.get('/verify/question-bank'),
  updateBankItem: (id, data) => api.put(`/verify/question-bank/${id}`, data),
  deleteBankItem: (id) => api.delete(`/verify/question-bank/${id}`),
  bulkAddToAssessment: (data) => api.post('/verify/question-bank/bulk-add-to-assessment', data),
  importBankFile: (formData) => api.post('/verify/question-bank/import-file', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  importBankUrl: (data) => api.post('/verify/question-bank/import-url', data),

  // Assignments
  assignAssessment: (id, data) => api.post(`/verify/assignments/${id}/assign`, data),
  myAssessments: () => api.get('/verify/assignments/my-assessments'),
  recordStrike: (id, data) => api.post(`/verify/assignments/${id}/record-strike`, data),
  startSession: (id) => api.post(`/verify/assignments/${id}/start-session`),

  // Submissions & Results
  submitAssessment: (data) => api.post('/verify/submissions/submit', data),
  myResults: () => api.get('/verify/submissions/my-results'),
  getResult: (id) => api.get(`/verify/submissions/result/${id}`),
  leaderboard: (id) => api.get(`/verify/submissions/leaderboard/${id}`),
  analytics: (id) => api.get(`/verify/submissions/analytics/${id}`),
  userResults: (userId) => api.get(`/verify/submissions/users/${userId}/results`),
  releaseResult: (id) => api.post(`/verify/submissions/result/${id}/release`),
  assessmentSubmissions: (id) => api.get(`/verify/submissions/assessments/${id}/submissions`),
  uploadSubmissionFile: (formData) => api.post('/verify/submissions/upload-file', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  // Queries
  appealResult: (id, data) => api.post(`/verify/queries/result/${id}/appeal`, data),
  getAssessmentQueries: (id) => api.get(`/verify/queries/assessments/${id}/queries`),
  updateQuery: (id, data) => api.patch(`/verify/queries/${id}`, data),

  // Sandbox
  runCode: (data) => api.post('/verify/sandbox/run-code', data),
};
