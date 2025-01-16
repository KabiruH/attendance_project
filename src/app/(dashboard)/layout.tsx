import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar }  from "@/components/ui/dashboard-sidebar"

export default function DashboardLayout({
    children,
}:{
    children: React.ReactNode
}){
    return (
        <SidebarProvider>
            <div className="flex-1 flex justify-center mt-5">
                <DashboardSidebar />
                <main className="flex-1  pt-9 pr-11 pl-11 flex justify-center"> 
                    <div className="max-w-full">
                        {children}
                    </div>
                </main>
            </div>
        </SidebarProvider>
    )
}