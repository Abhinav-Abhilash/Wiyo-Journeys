import Fuse from 'fuse.js';
import { Stop, StopMatchResult, QueryParseResult, SupportedLanguage } from '../types';

export class MultilingualStopMatcher {
  private stops: Stop[];
  private fuse: Fuse<Stop>;

  constructor(stops: Stop[]) {
    this.stops = stops;

    this.fuse = new Fuse(stops, {
      keys: [
        { name: 'names.en', weight: 0.35 },
        { name: 'names.ml', weight: 0.35 },
        { name: 'names.ta', weight: 0.3 },
        { name: 'names.hi', weight: 0.3 },
        { name: 'aliases', weight: 0.25 },
        { name: 'district', weight: 0.1 },
      ],
      threshold: 0.45,
      includeScore: true,
      ignoreLocation: true,
    });
  }

  /**
   * Search stops returning a strict tri-state (matched | ambiguous | not_found)
   */
  public search(query: string, limit = 5): StopMatchResult {
    const trimmed = query.trim();
    if (!trimmed) {
      return { status: 'not_found', query };
    }

    const results = this.fuse.search(trimmed);
    if (results.length === 0) {
      return { status: 'not_found', query };
    }

    const topResult = results[0];
    const topScore = topResult.score ?? 1; // 0 is perfect match in Fuse.js

    // If score is very good (< 0.22) and significantly better than second result
    if (
      topScore < 0.22 ||
      (results.length === 1 && topScore < 0.38) ||
      (results.length > 1 && (results[1].score ?? 1) - topScore > 0.2)
    ) {
      return {
        status: 'matched',
        stop: topResult.item,
        confidence: Math.round((1 - topScore) * 100) / 100,
      };
    }

    // Otherwise ambiguous - return candidates for clarification
    const candidates = results.slice(0, limit).map((r) => ({
      stop: r.item,
      score: Math.round((1 - (r.score ?? 1)) * 100) / 100,
    }));

    return {
      status: 'ambiguous',
      candidates,
    };
  }

  /**
   * Deterministic rule-based query parser (origin & destination)
   * Handles patterns in English, Malayalam, Hindi, and Tamil without LLMs
   */
  public parseNaturalQuery(rawText: string, defaultOriginStop?: Stop): QueryParseResult {
    const text = rawText.trim();

    // Regex patterns for multilingual extraction
    // English: "from <Origin> to <Dest>", "<Origin> to <Dest>", "bus to <Dest>"
    // Malayalam: "<Origin>ൽ നിന്ന് <Dest> വരെ", "<Dest> ലേക്ക്"
    // Hindi: "<Origin> से <Dest> तक / को"
    // Tamil: "<Origin> இருந்து <Dest> வரை"
    let originStr = '';
    let destStr = '';

    // Pattern 1: Malayalam "<Origin>ൽ നിന്ന് <Dest> വരെ" or "നിന്ന് <Dest>"
    const mlMatch = text.match(/(?:(.+?)(?:ിൽ|ൽ|യിൽ)?\s*(?:നിന്ന്|നിന്നും))\s*(?:(.+?)(?:ലേക്ക്|വരെ|ക്ക്)?$)/i);
    // Pattern 2: English "from <Origin> to <Dest>"
    const enMatch = text.match(/(?:from\s+(.+?)\s+to\s+(.+)|(.+?)\s+to\s+(.+))/i);
    // Pattern 3: Hindi "<Origin> से <Dest>"
    const hiMatch = text.match(/(?:(.+?)\s+से\s+(.+?)(?:\s+तक|\s+को|$))/i);
    // Pattern 4: Tamil "<Origin> இருந்து <Dest>"
    const taMatch = text.match(/(?:(.+?)\s*(?:இருந்து|இருந்த)\s+(.+?)(?:\s*வரை|$))/i);

    if (mlMatch) {
      originStr = mlMatch[1] || '';
      destStr = mlMatch[2] || '';
    } else if (enMatch) {
      originStr = enMatch[1] || enMatch[3] || '';
      destStr = enMatch[2] || enMatch[4] || '';
    } else if (hiMatch) {
      originStr = hiMatch[1] || '';
      destStr = hiMatch[2] || '';
    } else if (taMatch) {
      originStr = taMatch[1] || '';
      destStr = taMatch[2] || '';
    } else {
      // Direct single place target (e.g. "Lulu Mall", "to Aluva", "വൈറ്റില")
      const singleToMatch = text.match(/(?:to\s+|ലേക്ക്\s+|വരെ\s+|तक\s+|வரை\s+)(.+)/i);
      destStr = singleToMatch ? singleToMatch[1] : text;
    }

    let originResult: StopMatchResult;
    if (originStr.trim()) {
      originResult = this.search(originStr);
    } else if (defaultOriginStop) {
      originResult = { status: 'matched', stop: defaultOriginStop, confidence: 1.0 };
    } else {
      originResult = { status: 'not_found', query: originStr };
    }

    const destResult = this.search(destStr);

    return {
      origin: originResult,
      destination: destResult,
      rawText,
    };
  }
}
