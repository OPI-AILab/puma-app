export const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);
export const AUDIO_EXT = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']);

export function getEvaluationName(evaluation: { name?: string | null; id: string }): string {
  return evaluation.name || `Evaluation ${evaluation.id.substring(0, 8)}`;
}

export function getStatusClasses(status: string): Record<string, boolean> {
  return {
    'bg-green-100 text-green-800': status === 'completed',
    'bg-blue-100 text-blue-800': status === 'running',
    'bg-red-100 text-red-800': status === 'failed',
    'bg-yellow-100 text-yellow-800': status === 'cancelled',
    'bg-orange-100 text-orange-800': status === 'cancelling',
    'bg-gray-100 text-gray-800': status === 'pending',
  };
}

export function getScoreClass(score: string): string {
  const val = parseFloat(score);
  if (val >= 80) return 'text-green-600';
  if (val >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function validateJsonText(text: string): { error: string | null; parsed: unknown } {
  if (!text.trim()) return { error: null, parsed: null };
  try {
    return { error: null, parsed: JSON.parse(text) };
  } catch {
    return { error: 'Invalid JSON', parsed: null };
  }
}

export function getFileIconClass(fileId: string | null): string {
  if (!fileId) return 'pi pi-file text-gray-600';
  const ext = (fileId.split('.').pop() || '').toLowerCase();
  if (IMAGE_EXT.has(ext)) return 'pi pi-image text-emerald-600';
  if (AUDIO_EXT.has(ext)) return 'pi pi-volume-up text-blue-600';
  return 'pi pi-file text-gray-600';
}
