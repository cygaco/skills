export function capture(text: string) {
  return { text, at: Date.now() };
}
