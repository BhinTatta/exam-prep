import type { AcademicStatus } from "@prisma/client";

export const academicStatusOptions: { value: AcademicStatus; label: string }[] = [
  { value: "FIRST_YEAR", label: "1st year" },
  { value: "SECOND_YEAR", label: "2nd year" },
  { value: "THIRD_YEAR", label: "3rd year" },
  { value: "FINAL_YEAR", label: "Final year" },
  { value: "POST_GRADUATE", label: "Post-graduate" },
  { value: "DROPPER", label: "Dropper" },
  { value: "WORKING_PROFESSIONAL", label: "Working professional" },
  { value: "OTHER", label: "Other" },
];

const labelByValue = new Map(academicStatusOptions.map((o) => [o.value, o.label]));

export function academicStatusLabel(status: AcademicStatus | null | undefined): string | null {
  return status ? (labelByValue.get(status) ?? null) : null;
}
