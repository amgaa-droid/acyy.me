"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { requireOnboardedUser } from "@/server/auth/current";
import { db } from "@/server/db";
import {
  CannotDeleteSelfError,
  GenderLockedError,
  PeopleLimitError,
  PersonNotFoundError,
  SelfRelationError,
  createPerson,
  deletePerson,
  updatePerson,
} from "@/server/persons";

export type PersonFormError =
  "name" | "birthDate" | "relationLabel" | "genderLocked" | "limit" | "generic";
export type PersonActionResult = { ok: true; id: string } | { ok: false; error: PersonFormError };

function toFormError(err: unknown): PersonFormError {
  if (err instanceof GenderLockedError) return "genderLocked";
  if (err instanceof PeopleLimitError) return "limit";
  if (err instanceof z.ZodError) {
    const field = err.issues[0]?.path[0];
    if (field === "name" || field === "birthDate" || field === "relationLabel") return field;
  }
  return "generic";
}

export async function createPersonAction(input: unknown): Promise<PersonActionResult> {
  const { user } = await requireOnboardedUser();
  try {
    const person = await createPerson(db, user.id, input as never);
    revalidatePath("/people");
    revalidatePath("/home");
    return { ok: true, id: person.id };
  } catch (err) {
    if (!(err instanceof z.ZodError || err instanceof PeopleLimitError))
      console.error("[people:create]", err);
    return { ok: false, error: toFormError(err) };
  }
}

export async function updatePersonAction(id: string, input: unknown): Promise<PersonActionResult> {
  const { user } = await requireOnboardedUser();
  try {
    const person = await updatePerson(db, user.id, id, input as never);
    revalidatePath("/people");
    revalidatePath(`/people/${person.id}`);
    revalidatePath("/home");
    return { ok: true, id: person.id };
  } catch (err) {
    if (err instanceof PersonNotFoundError) notFound();
    const expected =
      err instanceof z.ZodError ||
      err instanceof SelfRelationError ||
      err instanceof GenderLockedError;
    if (!expected) {
      console.error("[people:update]", err);
    }
    return { ok: false, error: toFormError(err) };
  }
}

export async function deletePersonAction(id: string): Promise<{ ok: false; error: "generic" }> {
  const { user } = await requireOnboardedUser();
  try {
    await deletePerson(db, user.id, id);
  } catch (err) {
    if (err instanceof PersonNotFoundError) notFound();
    if (!(err instanceof CannotDeleteSelfError)) console.error("[people:delete]", err);
    return { ok: false, error: "generic" };
  }
  revalidatePath("/people");
  revalidatePath("/home");
  redirect("/people");
}
