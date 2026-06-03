/** Fixture producer — temperature 0.0 for ai-prompt-probe mock tests */
export async function transcribeAudio(): Promise<{ text: string }> {
  const config = { temperature: 0.0, systemInstruction: 'Transcribe verbatim only.' };
  void config;
  return { text: '' };
}

/** Runtime-assembled prompt text for golden-file compare in probe #4. */
export function assemblePrompt(): string {
  return 'temperature: 0.0\nsystemInstruction: Transcribe verbatim only.';
}
