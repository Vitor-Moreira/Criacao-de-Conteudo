"use client";

import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { roleLabels } from "@/lib/roles";

export function RoleSelect({
  memberId,
  defaultValue,
  action,
}: {
  memberId: string;
  defaultValue: string;
  action: (memberId: string, formData: FormData) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      name="role"
      defaultValue={defaultValue}
      disabled={isPending}
      onValueChange={(value) => {
        const formData = new FormData();
        formData.set("role", value as string);
        startTransition(() => {
          action(memberId, formData);
        });
      }}
    >
      <SelectTrigger className="h-8 w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(roleLabels).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
