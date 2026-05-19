import { configureStore, createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type StudentSortBy = "lastName" | "firstName";
export type StudentNameFormat = "firstLast" | "lastFirst";
export type WeekStartsOn = "monday" | "sunday";

export type AppPreferences = {
  studentSortBy: StudentSortBy;
  studentNameFormat: StudentNameFormat;
  weekStartsOn: WeekStartsOn;
};

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  studentSortBy: "lastName",
  studentNameFormat: "firstLast",
  weekStartsOn: "monday"
};

type AppState = {
  selectedClassId: string | null;
  selectedSubjectId: string;
  studentSortBy: StudentSortBy;
  studentNameFormat: StudentNameFormat;
  weekStartsOn: WeekStartsOn;
};

function readStudentSortBy(): StudentSortBy {
  if (typeof window === "undefined") return DEFAULT_APP_PREFERENCES.studentSortBy;
  const v = window.localStorage.getItem("student_sort_by");
  return v === "firstName" ? "firstName" : DEFAULT_APP_PREFERENCES.studentSortBy;
}

function readStudentNameFormat(): StudentNameFormat {
  if (typeof window === "undefined") return DEFAULT_APP_PREFERENCES.studentNameFormat;
  const v = window.localStorage.getItem("student_name_format");
  return v === "lastFirst" ? "lastFirst" : DEFAULT_APP_PREFERENCES.studentNameFormat;
}

function readWeekStartsOn(): WeekStartsOn {
  if (typeof window === "undefined") return DEFAULT_APP_PREFERENCES.weekStartsOn;
  const v = window.localStorage.getItem("week_starts_on");
  return v === "sunday" ? "sunday" : DEFAULT_APP_PREFERENCES.weekStartsOn;
}

function writePreferencesToLocalStorage(preferences: AppPreferences): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("student_sort_by", preferences.studentSortBy);
  window.localStorage.setItem("student_name_format", preferences.studentNameFormat);
  window.localStorage.setItem("week_starts_on", preferences.weekStartsOn);
}

const initialState: AppState = {
  selectedClassId: null,
  selectedSubjectId: "",
  studentSortBy: readStudentSortBy(),
  studentNameFormat: readStudentNameFormat(),
  weekStartsOn: readWeekStartsOn()
};

const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    setSelectedClass(state, action: PayloadAction<string | null>) {
      // Al cambiar de curso siempre se limpia la asignatura activa;
      // TopTabs re-seleccionará la primera disponible del nuevo curso.
      if (state.selectedClassId !== action.payload) {
        state.selectedSubjectId = "";
      }
      state.selectedClassId = action.payload;
    },
    setSelectedSubject(state, action: PayloadAction<string>) {
      state.selectedSubjectId = action.payload;
    },
    setStudentSortBy(state, action: PayloadAction<StudentSortBy>) {
      state.studentSortBy = action.payload;
      writePreferencesToLocalStorage(state);
    },
    setStudentNameFormat(state, action: PayloadAction<StudentNameFormat>) {
      state.studentNameFormat = action.payload;
      writePreferencesToLocalStorage(state);
    },
    setWeekStartsOn(state, action: PayloadAction<WeekStartsOn>) {
      state.weekStartsOn = action.payload;
      writePreferencesToLocalStorage(state);
    },
    hydrateAppPreferences(state, action: PayloadAction<Partial<AppPreferences>>) {
      const next = {
        studentSortBy:
          action.payload.studentSortBy === "firstName" ? "firstName" : DEFAULT_APP_PREFERENCES.studentSortBy,
        studentNameFormat:
          action.payload.studentNameFormat === "lastFirst"
            ? "lastFirst"
            : DEFAULT_APP_PREFERENCES.studentNameFormat,
        weekStartsOn:
          action.payload.weekStartsOn === "sunday" ? "sunday" : DEFAULT_APP_PREFERENCES.weekStartsOn
      };
      state.studentSortBy = next.studentSortBy;
      state.studentNameFormat = next.studentNameFormat;
      state.weekStartsOn = next.weekStartsOn;
      writePreferencesToLocalStorage(next);
    }
  }
});

export const {
  setSelectedClass,
  setSelectedSubject,
  setStudentSortBy,
  setStudentNameFormat,
  setWeekStartsOn,
  hydrateAppPreferences
} = appSlice.actions;

export const store = configureStore({
  reducer: {
    app: appSlice.reducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
