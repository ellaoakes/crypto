export interface SuggestedOption {
  destination: string;
  dateRange: string;
  estimatedCostPerHeadPence: number;
  rationale: string;
}

export interface ResponseInput {
  participantName: string;
  unavailableDates: string;
  budgetPence: number;
  destinationPreference: string;
  notes?: string | null;
}
