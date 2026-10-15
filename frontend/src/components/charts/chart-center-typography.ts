/**
 * Fluid typography for pie / ring / gauge center labels.
 *
 * Uses CSS container query units (`cqw`) so values scale with the center
 * hole — not the viewport — which keeps stat text readable on small charts.
 */
export const chartCenterContainerClassName =
  "@container/chart-center size-full min-w-0";

/** Primary stat — fixed rem size (NOT cqw). NumberFlow's digit-spin mask is
 * em-based (--number-flow-mask-height: 0.25em); a container-query (cqw)
 * font-size desyncs that math from the rendered line box, which makes the
 * mask band collapse to full height and show every digit stacked
 * ("012345789"). A fixed rem keeps em and the mask in sync. The chart
 * center size is already known in px, so fluid scaling bought nothing here. */
export const chartCenterValueClassName =
  "font-bold tabular-nums leading-none text-[1.5rem]";

/** Supporting label — ~9% of center width, clamped between 10px and text-xs. */
export const chartCenterLabelClassName =
  "max-w-full truncate leading-tight text-[clamp(0.625rem,9cqw,0.75rem)]";
