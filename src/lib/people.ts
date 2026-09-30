import { mn } from "@/i18n/mn";
import { RELATION_GROUP, type Relation } from "@/lib/domain";

/** Display text for a person's relation ("other" shows the user's own label). */
export function relationText(p: { relation: Relation; relationLabel: string | null }): string {
  return p.relation === "other" && p.relationLabel ? p.relationLabel : mn.relations[p.relation];
}

/** Pastel tint per relation group, so people are easy to tell apart at a glance. */
export function relationTint(relation: Relation): string {
  switch (RELATION_GROUP[relation]) {
    case "self":
      return "bg-tint-1";
    case "family":
      return "bg-tint-2";
    case "romantic":
      return "bg-tint-1";
    case "friend":
      return "bg-tint-3";
    default:
      return "bg-subtle";
  }
}
