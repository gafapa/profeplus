import { GroupedStudentsImporter } from "../../shared/import/GroupedStudentsImporter";
import { useManagement } from "../management/ManagementContext";

export function StudentImportPage() {
  const { courses, students, refreshAll, setNotice } = useManagement();

  return (
    <article className="management-card student-import-page">
      <header className="student-import-page-heading">
        <h1>Importar alumnado</h1>
        <p>
          Crea grupos desde un listado de XADE o nuestra plantilla CSV. Edunoza forma cada grupo combinando
          las columnas CURSO y GRUPO antes de guardar nada.
        </p>
      </header>

      <GroupedStudentsImporter
        courses={courses}
        students={students}
        refreshAll={refreshAll}
        setNotice={setNotice}
      />
    </article>
  );
}
