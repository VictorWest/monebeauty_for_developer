export type SelectPlacement = "up" | "down";

export function selectMenuLayout({
  triggerTop,
  triggerBottom,
  menuHeight,
  viewportHeight,
  gap = 6,
}: {
  triggerTop: number;
  triggerBottom: number;
  menuHeight: number;
  viewportHeight: number;
  gap?: number;
}) {
  const spaceAbove = Math.max(0, triggerTop - gap);
  const spaceBelow = Math.max(0, viewportHeight - triggerBottom - gap);
  const placement: SelectPlacement =
    menuHeight > spaceBelow && spaceAbove > spaceBelow ? "up" : "down";
  const available = placement === "up" ? spaceAbove : spaceBelow;

  return {
    placement,
    maxHeight: Math.max(0, Math.floor(available)),
  };
}
