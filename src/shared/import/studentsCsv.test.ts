import { describe, expect, it } from "vitest";
import { parseStudentsCsv } from "./studentsCsv";

describe("students CSV parser", () => {
  it("parses Spanish headers with semicolon delimiter", () => {
    const rows = parseStudentsCsv(
      [
        "Nombre;Apellidos;Correo;Comentarios;ACS;Refuerzo",
        "Ana;García López;ana@example.com;Necesita seguimiento;sí;x",
        "Luis;Pérez;;;;"
      ].join("\n")
    );

    expect(rows).toEqual([
      {
        firstName: "Ana",
        lastName: "García López",
        email: "ana@example.com",
        comments: "Necesita seguimiento",
        hasAcs: true,
        hasReinforcement: true
      },
      {
        firstName: "Luis",
        lastName: "Pérez",
        email: undefined,
        comments: undefined,
        hasAcs: false,
        hasReinforcement: false
      }
    ]);
  });

  it("supports quoted values and comma delimiter", () => {
    const rows = parseStudentsCsv('firstName,lastName,email,comments\n"Ana María","García, López",ana@example.com,"Text with, comma"');

    expect(rows).toEqual([
      {
        firstName: "Ana María",
        lastName: "García, López",
        email: "ana@example.com",
        comments: "Text with, comma",
        hasAcs: false,
        hasReinforcement: false
      }
    ]);
  });

  it("can split full names", () => {
    const rows = parseStudentsCsv("Nombre completo\nAna María García");

    expect(rows).toEqual([
      {
        firstName: "Ana María",
        lastName: "García",
        email: undefined,
        comments: undefined,
        hasAcs: false,
        hasReinforcement: false
      }
    ]);
  });

  it("parses school exports that use last-name comma first-name format", () => {
    const rows = parseStudentsCsv(
      [
        "Alumno/a;Correo electrónico;Observación;Adaptación curricular;Apoyo",
        "García López, Ana María;ana@example.com;Revisar lectura;Sí;1"
      ].join("\n")
    );

    expect(rows).toEqual([
      {
        firstName: "Ana María",
        lastName: "García López",
        email: "ana@example.com",
        comments: "Revisar lectura",
        hasAcs: true,
        hasReinforcement: true
      }
    ]);
  });

  it("detects full-name headers with Spanish connector words", () => {
    const rows = parseStudentsCsv("Apellidos y nombre;Notas\nPérez Ruiz, Luis;Pendiente de autorización");

    expect(rows).toEqual([
      {
        firstName: "Luis",
        lastName: "Pérez Ruiz",
        email: undefined,
        comments: "Pendiente de autorización",
        hasAcs: false,
        hasReinforcement: false
      }
    ]);
  });

  it("parses tabular text copied from a spreadsheet", () => {
    const rows = parseStudentsCsv(
      [
        "Nombre\tApellidos\tCorreo\tObservaciones\tACS\tRefuerzo",
        "Marta\tRuiz\tmarta@example.com\tSeguimiento familiar\tx\t"
      ].join("\n")
    );

    expect(rows).toEqual([
      {
        firstName: "Marta",
        lastName: "Ruiz",
        email: "marta@example.com",
        comments: "Seguimiento familiar",
        hasAcs: true,
        hasReinforcement: false
      }
    ]);
  });

  it("skips incomplete rows", () => {
    expect(parseStudentsCsv("Nombre;Apellidos\nAna;\n;García\nLuis;Pérez")).toHaveLength(1);
  });
});
