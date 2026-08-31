export interface QuizOption {
  emoji: string;
  label: string;
  desc: string;
  value: string;
}

interface QuizQuestionBase {
  id: string;
  text: string;
  sub: string;
  optional?: boolean;
}

export interface QuizChoiceQuestion extends QuizQuestionBase {
  type: "rows" | "grid2";
  multi?: boolean;
  options: QuizOption[];
}

export interface QuizSliderQuestion extends QuizQuestionBase {
  type: "slider";
  min: number;
  max: number;
  default: number;
  unit: string;
}

export type QuizQuestion = QuizChoiceQuestion | QuizSliderQuestion;

export interface QuizAnswers {
  timing?: string;
  region?: string;
  days?: string;
  group?: string;
  style?: string[];
  transport?: string;
  budget?: number;
  special?: string;
}
