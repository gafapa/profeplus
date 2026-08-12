import type { FeedbackCommentCategory } from "../db/types";

export const MAX_FEEDBACK_COMMENT_LENGTH = 500;
export const FEEDBACK_COMMENT_CATEGORIES: FeedbackCommentCategory[] = [
  "general",
  "attendance",
  "work",
  "gradebook"
];

export function feedbackCategoryLabel(category: FeedbackCommentCategory): string {
  switch (category) {
    case "attendance": return "Asistencia";
    case "work": return "Trabajo en clase";
    case "gradebook": return "Cuaderno";
    default: return "General";
  }
}

export function normalizeFeedbackComment(value: string): string {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length < 2 || text.length > MAX_FEEDBACK_COMMENT_LENGTH) {
    throw new Error(`El comentario debe tener entre 2 y ${MAX_FEEDBACK_COMMENT_LENGTH} caracteres.`);
  }
  return text;
}

export function appendFeedbackComment(currentValue: string, commentValue: string): string {
  const current = currentValue.trim();
  const comment = normalizeFeedbackComment(commentValue);
  if (!current) return comment;
  if (current.toLocaleLowerCase("es").includes(comment.toLocaleLowerCase("es"))) return currentValue;
  return `${current}\n${comment}`;
}
