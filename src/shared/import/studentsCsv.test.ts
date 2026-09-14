import { describe, expect, it } from "vitest";
import { parseGroupedStudentsCsv, parseStudentsCsv } from "./studentsCsv";

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

  it("keeps line breaks inside quoted comments", () => {
    const rows = parseStudentsCsv(
      'Nombre,Apellidos,Correo,Comentarios\nAna,García,ana@example.test,"Primera línea\nSegunda línea"'
    );

    expect(rows).toEqual([
      expect.objectContaining({
        firstName: "Ana",
        lastName: "García",
        comments: "Primera línea\nSegunda línea"
      })
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

describe("grouped students CSV parser", () => {
  const headers = [
    "COD_ALUMNO",
    "APELIDO 1",
    "APELIDO 2",
    "NOME",
    "SEXO",
    "CODIGOXADE",
    "NUM. EXPEDIENTE",
    "TIPO IDENTIFICADOR",
    "NUM. IDENTIFICADOR",
    "DATA NACEMENTO",
    "NACIONALIDADE",
    "PAIS_NACEMENTO",
    "TELF. MOBIL",
    "TELF. URXENCIA",
    "EXT.TELF. URX.",
    "E-MAIL",
    "TRATAMENTO ENDEREZO",
    "ENDEREZO",
    "TELF. FAMILIAR",
    "MOBIL RESPONSABLE 1",
    "TIPO RESPONSABLE",
    "MOBIL RESPONSABLE 2",
    "TIPO RESPONSABLE",
    "CURSO",
    "GRUPO",
    "REXIME_ASISTENCIA",
    "QUENDA",
    "ENSINANZA",
    "OBSERVACIONS"
  ];

  function row(values: Partial<Record<string, string>>): string {
    return headers.map((header) => values[header] ?? "").join(";");
  }

  it("builds groups from CURSO and GRUPO using the supplied school export headers", () => {
    const result = parseGroupedStudentsCsv([
      headers.join(";"),
      row({
        COD_ALUMNO: "A-001",
        "APELIDO 1": "García",
        "APELIDO 2": "López",
        NOME: "Ana María",
        "E-MAIL": "ana@example.com",
        CURSO: "2º ESO",
        GRUPO: "A",
        OBSERVACIONS: "Seguimiento de lectura"
      }),
      row({ COD_ALUMNO: "A-002", "APELIDO 1": "Pérez", NOME: "Luis", CURSO: "2º ESO", GRUPO: "A" }),
      row({ COD_ALUMNO: "B-001", "APELIDO 1": "Vila", NOME: "Noa", CURSO: "3º ESO", GRUPO: "B" })
    ].join("\n"));

    expect(result).toMatchObject({
      totalRowCount: 3,
      skippedRowCount: 0,
      duplicateRowCount: 0,
      missingHeaders: []
    });
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0]).toMatchObject({
      course: "2º ESO",
      group: "A",
      name: "2º ESO A"
    });
    expect(result.groups[0].students).toEqual([
      expect.objectContaining({
        sourceId: "A-001",
        sourceRow: 2,
        firstName: "Ana María",
        lastName: "García López",
        email: "ana@example.com",
        comments: "Seguimiento de lectura"
      }),
      expect.objectContaining({ sourceId: "A-002", firstName: "Luis", lastName: "Pérez" })
    ]);
  });

  it("reports required headers that are missing", () => {
    const result = parseGroupedStudentsCsv("NOME;APELIDO 1;CURSO\nAna;García;2º ESO");

    expect(result.groups).toEqual([]);
    expect(result.missingHeaders).toEqual(["GRUPO"]);
    expect(result.skippedRowCount).toBe(1);
  });

  it("skips incomplete rows and repeated student codes inside the same group", () => {
    const result = parseGroupedStudentsCsv([
      "COD_ALUMNO;APELIDO 1;APELIDO 2;NOME;CURSO;GRUPO",
      "A-001;García;;Ana;2º ESO;A",
      "A-001;García;;Ana;2º ESO;A",
      "A-002;;;Luis;2º ESO;A"
    ].join("\n"));

    expect(result.groups[0].students).toHaveLength(1);
    expect(result.duplicateRowCount).toBe(1);
    expect(result.skippedRowCount).toBe(1);
  });

  it("keeps the same student code when it belongs to a different group", () => {
    const result = parseGroupedStudentsCsv([
      "COD_ALUMNO;APELIDO 1;NOME;CURSO;GRUPO",
      "A-001;García;Ana;2º ESO;A",
      "A-001;García;Ana;2º ESO;B"
    ].join("\n"));

    expect(result.groups).toHaveLength(2);
    expect(result.groups.every((group) => group.students.length === 1)).toBe(true);
  });
});
