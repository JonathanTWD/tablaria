import { useTranslation } from "react-i18next";
import type { DemoDataset } from "./demo-table-features";

export const DEMO_CASES = ["shop", "workshop", "warehouse", "office"] as const;
export type DemoCase = (typeof DEMO_CASES)[number];

/** Sample inventory for a business type; its content is translated with the rest of the page. */
export function useDemoDataset(demoCase: DemoCase): DemoDataset {
  const { t } = useTranslation("landing");
  return t(`demo.cases.${demoCase}`, { returnObjects: true });
}
