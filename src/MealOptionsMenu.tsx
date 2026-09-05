import { KeyboardEvent, useEffect, useRef, useState } from "react";

type MealOptionsMenuProps = {
  mealName: string;
  onEdit: () => void;
  onDelete: () => void;
};

export default function MealOptionsMenu({ mealName, onEdit, onDelete }: MealOptionsMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const initialIndex = useRef(0);

  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']");
    items?.[initialIndex.current]?.focus();
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  function openMenu(index: number) {
    initialIndex.current = index;
    setOpen(true);
  }

  function closeMenu(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) queueMicrotask(() => triggerRef.current?.focus());
  }

  function handleTriggerKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") { event.preventDefault(); openMenu(0); }
    if (event.key === "ArrowUp") { event.preventDefault(); openMenu(1); }
  }

  function handleMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']") ?? [])];
    const current = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement));
    if (event.key === "Escape") { event.preventDefault(); closeMenu(); return; }
    if (event.key === "Tab") { setOpen(false); return; }
    let next: number | null = null;
    if (event.key === "ArrowDown") next = (current + 1) % items.length;
    if (event.key === "ArrowUp") next = (current - 1 + items.length) % items.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = items.length - 1;
    if (next !== null) { event.preventDefault(); items[next]?.focus(); }
  }

  function select(action: () => void) {
    closeMenu();
    action();
  }

  return <div className="meal-options">
    <button
      ref={triggerRef}
      type="button"
      className="meal-options-trigger"
      aria-label={`Meal options for ${mealName}`}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={() => open ? closeMenu(false) : openMenu(0)}
      onKeyDown={handleTriggerKey}
    >•••</button>
    {open ? <div ref={menuRef} className="meal-options-menu" role="menu" aria-label={`Options for ${mealName}`} onKeyDown={handleMenuKey}>
      <button type="button" role="menuitem" onClick={() => select(onEdit)}>Edit</button>
      <button type="button" role="menuitem" className="delete-action" onClick={() => select(onDelete)}>Delete</button>
    </div> : null}
  </div>;
}
