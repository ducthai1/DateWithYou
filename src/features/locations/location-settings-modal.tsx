"use client";

import { useState } from "react";
import { X, Plus, Save } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Modal, ModalHeader, ModalContent, ModalFooter } from "@/components/ui/modal";
import { ConfirmButton } from "@/components/ui/confirm-button";

import { useToast } from "@/components/ui/toast";

type LocationSettingsModalProps = {
  initialCategories: string[];
  initialDistricts: string[];
  onClose: () => void;
};

export function LocationSettingsModal({
  initialCategories,
  initialDistricts,
  onClose,
}: LocationSettingsModalProps) {
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [districts, setDistricts] = useState<string[]>(initialDistricts);
  const [newCategory, setNewCategory] = useState("");
  const [newDistrict, setNewDistrict] = useState("");

  const toast = useToast();
  const utils = trpc.useUtils();
  const updateConfig = trpc.location.updateConfig.useMutation({
    onSuccess: () => {
      utils.location.getConfig.invalidate();
      // Optional: invalidate list if removing things changes filters
      utils.location.list.invalidate();
      toast("Đã lưu cấu hình", "success");
      onClose();
    },
    onError: (err) => toast(err.message, "error")
  });

  const handleAddCategory = () => {
    const val = newCategory.trim();
    if (val && !categories.includes(val)) {
      setCategories([...categories, val]);
      setNewCategory("");
    }
  };

  const handleAddDistrict = () => {
    const val = newDistrict.trim();
    if (val && !districts.includes(val)) {
      setDistricts([...districts, val]);
      setNewDistrict("");
    }
  };

  const handleRemoveCategory = (cat: string) => {
    setCategories(categories.filter((c) => c !== cat));
  };

  const handleRemoveDistrict = (dist: string) => {
    setDistricts(districts.filter((d) => d !== dist));
  };

  const handleSave = () => {
    updateConfig.mutate({ categories, districts });
  };

  return (
    <Modal open={true} onClose={onClose} className="max-w-4xl">
      <ModalHeader title="Cài đặt Danh mục & Quận" onClose={onClose} />
      <ModalContent className="space-y-8 p-6">
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            <strong>Lưu ý:</strong> Nếu bạn xoá một Danh mục hoặc Quận đang được sử dụng bởi các địa điểm đã lưu, các địa điểm đó có thể không được hiển thị đúng khi lọc. Hãy cân nhắc trước khi xoá.
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Categories */}
            <div className="space-y-3 w-full">
              <h3 className="font-medium text-foreground">Loại danh mục</h3>
              <div className="flex gap-2 w-full">
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                  placeholder="Thêm danh mục..."
                  className="flex-1 min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
                <Button onClick={handleAddCategory} size="icon" className="shrink-0 rounded-xl">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <ul className="space-y-2 w-full">
                {categories.map((c) => (
                  <li key={c} className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
                    <span className="truncate">{c}</span>
                    <ConfirmButton
                      onConfirm={() => handleRemoveCategory(c)}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-0"
                      icon={<X className="h-4 w-4" />}
                      idle=""
                      title="Xoá danh mục"
                      description={`Bạn có chắc muốn xoá danh mục "${c}"? Các địa điểm đang sử dụng danh mục này có thể bị lỗi hiển thị.`}
                      confirmText="Xoá danh mục"
                    />
                  </li>
                ))}
              </ul>
            </div>

            {/* Districts */}
            <div className="space-y-3 w-full">
              <h3 className="font-medium text-foreground">Quận / Huyện</h3>
              <div className="flex gap-2 w-full">
                <input
                  type="text"
                  value={newDistrict}
                  onChange={(e) => setNewDistrict(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddDistrict()}
                  placeholder="Thêm quận..."
                  className="flex-1 min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
                <Button onClick={handleAddDistrict} size="icon" className="shrink-0 rounded-xl">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <ul className="space-y-2 w-full">
                {districts.map((d) => (
                  <li key={d} className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
                    <span className="truncate">{d}</span>
                    <ConfirmButton
                      onConfirm={() => handleRemoveDistrict(d)}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-0"
                      icon={<X className="h-4 w-4" />}
                      idle=""
                      title="Xoá quận / huyện"
                      description={`Bạn có chắc muốn xoá quận "${d}"? Các địa điểm đang thuộc quận này có thể bị lỗi hiển thị.`}
                      confirmText="Xoá quận"
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>Huỷ</Button>
        <Button onClick={handleSave} disabled={updateConfig.isPending} className="gap-2">
          <Save className="h-4 w-4" /> {updateConfig.isPending ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
