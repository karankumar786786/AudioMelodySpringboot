import { AppDispatch, AppState, loadAuthToken } from "@/store";
import { AuthToken } from "@/types";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { Provider, useDispatch, useSelector } from "react-redux";
function RootNavigator(){
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const segment = useSegments();
  const authToken:AuthToken = useSelector((state: AppState) => state.auth);
  useEffect(()=>{
    dispatch(loadAuthToken());
  },[]);
  useEffect(()=>{
    const isAuthGroup = segment[0] as string === "(authenticated)";
    if (!isAuthGroup) {
      if (!authToken.accessToken) {
        // router.replace("");
      }
    }
    else {
      if (authToken.accessToken) {
        // router.replace("");
      }
    }
  },[authToken.accessToken,authToken.refreshToken,segment]);
  
}


export default function RootLayout() {
  return <Stack />;
}
