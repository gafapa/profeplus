import { useEffect, useId, useMemo, useState } from "react";
import { db } from "../db/database";
import type { FeedbackComment, FeedbackCommentCategory } from "../db/types";
import { appendFeedbackComment } from "./comments";

type FeedbackCommentPickerProps = {
  category: FeedbackCommentCategory;
  value: string;
  onChange: (value: string) => void;
};

export function FeedbackCommentPicker({ category, value, onChange }: FeedbackCommentPickerProps) {
  const selectId = useId();
  const [comments, setComments] = useState<FeedbackComment[]>([]);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    let active = true;
    void db.feedbackComments.toArray().then((rows) => {
      if (active) setComments(rows.sort((left, right) => left.text.localeCompare(right.text)));
    });
    return () => { active = false; };
  }, [category]);

  const available = useMemo(
    () => comments.filter((comment) => comment.category === "general" || comment.category === category),
    [category, comments]
  );

  if (available.length === 0) return null;

  return (
    <div className="feedback-picker">
      <label htmlFor={selectId}>Comentario guardado</label>
      <select id={selectId} className="input" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
        <option value="">Selecciona un comentario</option>
        {available.map((comment) => <option key={comment.id} value={comment.id}>{comment.text}</option>)}
      </select>
      <button
        type="button"
        className="btn secondary"
        disabled={!selectedId}
        onClick={() => {
          const selected = available.find((comment) => comment.id === selectedId);
          if (!selected) return;
          onChange(appendFeedbackComment(value, selected.text));
          setSelectedId("");
        }}
      >
        Insertar
      </button>
    </div>
  );
}
