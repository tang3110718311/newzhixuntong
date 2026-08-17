export function getDisplayedLength(textLength: number, progress: number): number {
  if (textLength <= 0 || !Number.isFinite(progress) || progress <= 0) return 0;
  return Math.min(textLength, Math.ceil(textLength * Math.min(progress, 1)));
}

export function getFullTextFallback(text: string): string {
  return text;
}

export interface SpeechSegment {
  start: number;
  end: number;
  ttsText: string;
}

export function splitSpeechSegments(text: string): SpeechSegment[] {
  const parts = (text || "").match(/[^。！？…!?\n]+[。！？…!?\n]*/g) || [];
  const segments: SpeechSegment[] = [];
  let offset = 0;

  for (const part of parts) {
    const start = offset;
    const end = start + part.length;
    const ttsText = part.trim();
    offset = end;
    if (ttsText) segments.push({ start, end, ttsText });
  }

  if (!segments.length && text.trim()) {
    const start = 0;
    segments.push({ start, end: text.length, ttsText: text.trim() });
  }

  return segments;
}
