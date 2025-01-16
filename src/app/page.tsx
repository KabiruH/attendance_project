import LoginPage from "@/app/(auth)/login/page"
import { UserProvider } from "@/hooks/UserContext";


export default function Home() {
  return (
    <UserProvider>
   <LoginPage/>
    </UserProvider>
  );
}
