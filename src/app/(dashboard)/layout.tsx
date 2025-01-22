import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar }  from "@/components/ui/dashboard-sidebar"
import LocationCheck  from "@/components/locationCheck/location";

export default function DashboardLayout({
    children,
}:{
    children: React.ReactNode
}){
    return (
      <LocationCheck>
         <SidebarProvider>
            <div className="flex-1 flex max-w-full justify-center mt-7">
                <DashboardSidebar />
                <main className="flex-grow overflow-auto max-w-full"> 
                    <div className="max-w-18 mt-7 justify-center">
                        {children}
                    </div>
                </main>
            </div>
        </SidebarProvider>
        </LocationCheck> 
    )
}