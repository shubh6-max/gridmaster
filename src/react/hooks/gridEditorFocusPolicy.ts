export function getGridEditorAutoSelectOnFocus(options: {
  initialValueProvided: boolean;
}): boolean {
  return !options.initialValueProvided;
}
