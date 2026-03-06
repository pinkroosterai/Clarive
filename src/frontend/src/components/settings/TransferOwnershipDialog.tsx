import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { userService } from "@/services";
import { useAuthStore } from "@/store/authStore";
import { handleApiError } from "@/lib/handleApiError";
import { toast } from "sonner";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TeamMember } from "@/types";

interface TransferOwnershipDialogProps {
  activeMembers: TeamMember[];
}

export function TransferOwnershipDialog({ activeMembers }: TransferOwnershipDialogProps) {
  const queryClient = useQueryClient();
  const { currentUser, setUser } = useAuthStore();
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferConfirm, setTransferConfirm] = useState("");
  const [transferring, setTransferring] = useState(false);

  const handleTransfer = async () => {
    if (!currentUser || !transferTargetId) return;
    setTransferring(true);
    try {
      await userService.transferOwnership(transferTargetId, transferConfirm);
      setUser({ ...currentUser, role: "editor" });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Ownership transferred");
      setTransferOpen(false);
      setTransferTargetId("");
      setTransferConfirm("");
    } catch (err: unknown) {
      handleApiError(err, { fallback: "Transfer failed" });
    } finally {
      setTransferring(false);
    }
  };

  return (
    <Dialog
      open={transferOpen}
      onOpenChange={(o) => {
        setTransferOpen(o);
        if (!o) {
          setTransferTargetId("");
          setTransferConfirm("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ArrowRightLeft className="size-4" />
          Transfer Ownership
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer Ownership</DialogTitle>
          <DialogDescription>
            This will make the selected user the new admin. Your role
            will be changed to editor.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label>New owner</Label>
            <Select
              value={transferTargetId}
              onValueChange={setTransferTargetId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {activeMembers
                  .filter((u) => u.id !== currentUser?.id)
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>
              Type <span className="font-mono font-bold">TRANSFER</span> to
              confirm
            </Label>
            <Input
              value={transferConfirm}
              onChange={(e) => setTransferConfirm(e.target.value)}
              placeholder="TRANSFER"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={
              transferConfirm !== "TRANSFER" ||
              !transferTargetId ||
              transferring
            }
            onClick={handleTransfer}
          >
            {transferring ? "Transferring\u2026" : "Confirm Transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
