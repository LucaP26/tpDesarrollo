import { Redirect } from "expo-router";

import { useSession } from "@/src/lib/session";

export default function IndexScreen() {
  const { token } = useSession();

  return <Redirect href={token ? "/(tabs)/home" : "/login"} />;
}
