import { ErrorScreen } from "@/components/errors/ErrorScreen";

export default function CustomerNotFound() {
  return <ErrorScreen kind="not-found" compact />;
}
