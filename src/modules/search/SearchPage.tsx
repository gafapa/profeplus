import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppDispatch } from "../../app/hooks";
import { setSelectedClass, setSelectedSubject } from "../../app/store";
import { db } from "../../shared/db/database";
import {
  buildSearchResults,
  searchResultKindLabel,
  type SearchData,
  type SearchResult,
  type SearchResultKind
} from "../../shared/search/search";

const ALL_KINDS = "all";

const resultKinds: SearchResultKind[] = [
  "student",
  "task",
  "assessment",
  "followUp",
  "familyContact",
  "resource"
];

const emptySearchData: SearchData = {
  students: [],
  classGroups: [],
  subjects: [],
  tasks: [],
  taskSubjectLinks: [],
  subjectCourseLinks: [],
  assessments: [],
  followUps: [],
  familyContacts: [],
  resources: []
};

export function SearchPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [selectedKind, setSelectedKind] = useState<SearchResultKind | typeof ALL_KINDS>(ALL_KINDS);
  const [data, setData] = useState<SearchData>(emptySearchData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      const [
        students,
        classGroups,
        subjects,
        tasks,
        taskSubjectLinks,
        subjectCourseLinks,
        assessments,
        followUps,
        familyContacts,
        resources
      ] = await Promise.all([
        db.students.toArray(),
        db.classGroups.toArray(),
        db.subjects.toArray(),
        db.tasks.toArray(),
        db.taskSubjectLinks.toArray(),
        db.subjectCourseLinks.toArray(),
        db.assessments.toArray(),
        db.studentFollowUps.toArray(),
        db.familyContacts.toArray(),
        db.resourceAttachments.toArray()
      ]);
      if (!active) return;
      setData({
        students,
        classGroups,
        subjects,
        tasks,
        taskSubjectLinks,
        subjectCourseLinks,
        assessments,
        followUps,
        familyContacts,
        resources
      });
      setIsLoading(false);
    };
    void load().catch((loadError: unknown) => {
      if (!active) return;
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los datos.");
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    if (query.trim()) nextParams.set("q", query.trim());
    else nextParams.delete("q");
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [query, searchParams, setSearchParams]);

  const results = useMemo(() => buildSearchResults(data, query), [data, query]);
  const filteredResults = useMemo(
    () => selectedKind === ALL_KINDS ? results : results.filter((result) => result.kind === selectedKind),
    [results, selectedKind]
  );

  const openResult = (result: SearchResult): void => {
    if (result.classId) dispatch(setSelectedClass(result.classId));
    if (result.subjectId) dispatch(setSelectedSubject(result.subjectId));
    navigate(result.href);
  };

  const normalizedQueryLength = query.trim().length;

  return (
    <section className="search-page" aria-labelledby="search-page-title">
      <header className="workflow-page-header">
        <div>
          <p className="eyebrow">Acceso rápido</p>
          <h1 id="search-page-title">Buscar en ProfePlus</h1>
          <p>Encuentra alumnado, tareas, pruebas, seguimientos, contactos y recursos.</p>
        </div>
      </header>

      <div className="search-controls card-panel">
        <label className="detail-field search-query-field">
          <span>Texto de búsqueda</span>
          <input
            autoFocus
            className="input"
            type="search"
            value={query}
            placeholder="Nombre, tarea, nota, recurso…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="detail-field search-kind-field">
          <span>Tipo de resultado</span>
          <select
            className="input"
            value={selectedKind}
            onChange={(event) => setSelectedKind(event.target.value as SearchResultKind | typeof ALL_KINDS)}
          >
            <option value={ALL_KINDS}>Todos</option>
            {resultKinds.map((kind) => (
              <option key={kind} value={kind}>{searchResultKindLabel(kind)}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {normalizedQueryLength >= 2 && !isLoading
          ? `${filteredResults.length} resultados encontrados.`
          : ""}
      </p>

      {error ? <p className="runtime-error" role="alert">{error}</p> : null}
      {isLoading ? <p className="empty-state" role="status">Cargando índice de búsqueda…</p> : null}
      {!isLoading && normalizedQueryLength < 2 ? (
        <p className="empty-state">Escribe al menos dos caracteres para buscar en tus datos.</p>
      ) : null}
      {!isLoading && normalizedQueryLength >= 2 && filteredResults.length === 0 ? (
        <p className="empty-state">No hay resultados para esta búsqueda.</p>
      ) : null}

      {filteredResults.length > 0 ? (
        <div className="search-results" aria-label="Resultados de búsqueda">
          {filteredResults.map((result) => (
            <button
              key={result.id}
              type="button"
              className="search-result-card"
              onClick={() => openResult(result)}
            >
              <span className={`search-result-kind kind-${result.kind}`}>
                {searchResultKindLabel(result.kind)}
              </span>
              <strong>{result.title}</strong>
              <span className="search-result-context">{result.context}</span>
              <span className="search-result-snippet">{result.snippet}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
