export const CONSULTATION_CONSENT_TYPES = [
  "health_profile",
  "consultation_accuracy",
] as const;

type ConsultationConsentType = (typeof CONSULTATION_CONSENT_TYPES)[number];

export type ConsultationConsentRecord = {
  type: string;
  granted: boolean;
  textVersion: number | null;
};

export function currentConsultationConsentState(
  newestFirstRecords: readonly ConsultationConsentRecord[],
  currentVersions: Record<ConsultationConsentType, number>,
) {
  const isCurrentAndGranted = (type: ConsultationConsentType) => {
    const latest = newestFirstRecords.find((record) => record.type === type);
    return (
      latest?.granted === true && latest.textVersion === currentVersions[type]
    );
  };

  return {
    healthDataConsent: isCurrentAndGranted("health_profile"),
    accuracyAcknowledged: isCurrentAndGranted("consultation_accuracy"),
  };
}
