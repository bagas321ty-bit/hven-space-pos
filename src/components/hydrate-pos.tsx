import { useEffect } from "react";
import { CloudSync } from "@/components/cloud-sync";
import { usePos } from "@/lib/store";

export function HydratePos() {
  useEffect(() => {
    if (usePos.getState().hydrated) return;
    const finish = () => {
      usePos.setState({ hydrated: true });
      usePos.getState().purgeTestData();
    };
    try {
      const result = usePos.persist.rehydrate();
      if (result && typeof (result as Promise<void>).then === "function") {
        void (result as Promise<void>).then(finish).catch(finish);
      } else {
        finish();
      }
    } catch {
      finish();
    }
  }, []);
  return <CloudSync />;
}
