import { textIncludes } from './text-match';

/** A relance statut that means "call back later" (ex: "A rappeler") -> a next-call date is mandatory. */
export function isRappelStatut(s: string | null | undefined): boolean {
  return textIncludes(s, 'rappel');
}
