export type ConsultationAnswer = string | string[] | boolean;

export type BookingConsultationQuestion = {
  key: string;
  type:
    | "YES_NO"
    | "SHORT_TEXT"
    | "LONG_TEXT"
    | "SINGLE_CHOICE"
    | "MULTI_CHOICE"
    | "ACKNOWLEDGMENT";
  required: boolean;
  prompt: string;
  helpText: string | null;
  choices: Array<{ key: string; label: string }>;
};

export type BookingConsultationConfig = {
  contentVersion: number;
  requiredVersion: number;
  requiredInformation: string;
  healthConsent: string;
  accuracyAcknowledgment: string;
  questions: BookingConsultationQuestion[];
};

export type BookingConsultationPayload = {
  contentVersion: number;
  dateOfBirth: string;
  answers: Record<string, ConsultationAnswer>;
  healthConsent: true;
  accuracyAcknowledged: true;
};

export type SavedConsultationAnswers = {
  dateOfBirth: string;
  answers: Record<string, ConsultationAnswer>;
};
