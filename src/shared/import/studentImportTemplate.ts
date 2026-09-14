/** A header-only template avoids importing fictional examples as real pupils. */
export const STUDENT_IMPORT_TEMPLATE = "\uFEFFNOMBRE;APELLIDO 1;CURSO;GRUPO\r\n";

export function downloadStudentImportTemplate(): void {
  const url = URL.createObjectURL(new Blob([STUDENT_IMPORT_TEMPLATE], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "edunoza-plantilla-alumnado.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Keep the URL alive while the browser starts the asynchronous download.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
