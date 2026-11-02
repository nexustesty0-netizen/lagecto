import { ErrorScreen } from "@/components/errors/ErrorScreen";

export default function PublicNotFound() {
  return <ErrorScreen kind="not-found" compact />;
}
