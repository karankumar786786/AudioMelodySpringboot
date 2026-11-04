import { Redirect } from "expo-router";
import { useSelector } from "react-redux";
import { AppState } from "@/store";

export default function Index() {
  const authToken = useSelector((state: AppState) => state.auth);

  if (authToken?.accessToken) {
    return <Redirect href="/(authenticated)/(tabs)/home" />;
  }

  return <Redirect href="/login" />;
}

