import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
  } from "@/components/ui/sidebar";
  import { LayoutDashboard, ClipboardCheck, FileBarChart } from "lucide-react"; // Assuming you are using these icons
  
  export function DashboardSidebar() {
    const navItems = [
      { 
        label: 'Dashboard', 
        icon: <LayoutDashboard size={20} />, 
        href: '/employees' 
      },
      { 
        label: 'Attendance', 
        icon: <ClipboardCheck size={20} />, 
        href: '/attendance' 
      },
      { 
        label: 'Reports', 
        icon: <FileBarChart size={20} />, 
        href: '/reports' 
      },
    ];
  
    return (
      <Sidebar className="mt-16">
        <SidebarContent>
          <SidebarGroup>
            <nav className="p-4">
              <ul className="space-y-2">
                {navItems.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className="flex items-center space-x-2 p-2 rounded-lg text-black-300 hover:bg-gray-800 hover:text-white"
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </SidebarGroup>
        </SidebarContent>
        Licenced by Optimum Commputer Services
        <SidebarFooter />
      </Sidebar>
    );
  }
  