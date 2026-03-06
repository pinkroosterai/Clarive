import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MessageSquare, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { feedbackService } from "@/services";
import { handleApiError } from "@/lib/handleApiError";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const CATEGORIES = [
  { value: "General", label: "General" },
  { value: "Bug", label: "Bug Report" },
  { value: "FeatureRequest", label: "Feature Request" },
];

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("General");
  const [message, setMessage] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      feedbackService.submitFeedback(category, message, window.location.pathname),
    onSuccess: () => {
      toast.success("Thanks for your feedback!");
      setCategory("General");
      setMessage("");
      setOpen(false);
    },
    onError: handleApiError,
  });

  const canSubmit = message.trim().length > 0 && !mutation.isPending;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <SidebarMenuButton tooltip="Send Feedback">
              <MessageSquare className="size-4" />
              <span>Feedback</span>
            </SidebarMenuButton>
          </PopoverTrigger>
          <PopoverContent side="right" align="end" className="w-80 p-0">
            <div className="border-b px-4 py-3">
              <h4 className="text-sm font-semibold">Send Feedback</h4>
              <p className="text-xs text-foreground-muted mt-0.5">
                Let us know what you think
              </p>
            </div>
            <div className="p-4 space-y-3">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Your feedback..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                rows={4}
                className="resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground-muted">
                  {message.length}/2000
                </span>
                <Button
                  size="sm"
                  disabled={!canSubmit}
                  onClick={() => mutation.mutate()}
                >
                  {mutation.isPending ? (
                    <Loader2 className="mr-1 size-3 animate-spin" />
                  ) : (
                    <Send className="mr-1 size-3" />
                  )}
                  Submit
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
