import { configureStore, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { DEFAULT_WEBLLM_MODEL } from "../modules/ai-assistant/webllmModels";

type AppState = {
  selectedClassId: string | null;
  aiModel: string;
};

function readAiModel(): string {
  if (typeof window === "undefined") {
    return DEFAULT_WEBLLM_MODEL;
  }
  return window.localStorage.getItem("ai_model") || DEFAULT_WEBLLM_MODEL;
}

const initialState: AppState = {
  selectedClassId: null,
  aiModel: readAiModel()
};

const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    setSelectedClass(state, action: PayloadAction<string | null>) {
      state.selectedClassId = action.payload;
    },
    setAiModel(state, action: PayloadAction<string>) {
      state.aiModel = action.payload;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("ai_model", action.payload);
      }
    }
  }
});

export const { setSelectedClass, setAiModel } = appSlice.actions;

export const store = configureStore({
  reducer: {
    app: appSlice.reducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
