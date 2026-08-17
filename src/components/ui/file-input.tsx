import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function FileInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <Input
      type="file"
      className={cn(
        "cursor-pointer file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90",
        className
      )}
      {...props}
    />
  );
}
