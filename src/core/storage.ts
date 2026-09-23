import { JourneyPlan } from '../types';

const STORAGE_KEY = 'complan_saved_journeys';

export class StorageManager {
  public static saveJourney(journey: JourneyPlan): void {
    try {
      const saved = this.getSavedJourneys();
      const filtered = saved.filter((j) => j.id !== journey.id);
      filtered.unshift(journey);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, 10)));
    } catch (_) {}
  }

  public static getSavedJourneys(): JourneyPlan[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  public static removeSavedJourney(id: string): void {
    try {
      const saved = this.getSavedJourneys();
      const filtered = saved.filter((j) => j.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (_) {}
  }
}
