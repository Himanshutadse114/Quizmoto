export interface PolicySlide {
  title: string;
  content: string;
  keyPoints: string[];
  imageQuery: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

export interface PolicyAnalysis {
  title: string;
  summary: string;
  slides: PolicySlide[];
  quiz: QuizQuestion[];
}

export type DetailLevel = 'detailed' | 'condensed' | 'summary';

function authToken(): string {
  return localStorage.getItem('token') || localStorage.getItem('authToken') || '';
}

export async function analyzePolicy(
  fileData: string,
  mimeType: string,
  detailLevel: DetailLevel = 'detailed'
): Promise<PolicyAnalysis> {
  const apiRoot = String(import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');
  const token = authToken();
  const response = await fetch(`${apiRoot}/api/scorm/author/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ fileBase64: fileData, mimeType, detailLevel })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'Course analysis failed.');
  return (body.analysis || body) as PolicyAnalysis;
}
