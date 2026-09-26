export function renderEmailTemplate(
  templateString: string,
  variables: Record<string, string | number | undefined | null>,
): string {
  let result = templateString;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, "g");
    result = result.replace(regex, String(value ?? ""));
  }
  return result;
}
