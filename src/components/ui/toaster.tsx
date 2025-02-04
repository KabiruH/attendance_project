"use client"
import { useToast } from "@/components/ui/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()
  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props} className="p-6">
            <div className="grid gap-2">
              {title && (
                <ToastTitle className="text-lg font-semibold">
                  {title}
                </ToastTitle>
              )}
              {description && (
                <ToastDescription className="text-left text-lg">
                  {description}
                </ToastDescription>
              )}
            </div>
            {action}
            <ToastClose className="h-6 w-9" />
          </Toast>
        )
      })}
      <ToastViewport 
        className="fixed bottom-0 left-1/2 transform -translate-x-1/2 flex flex-col p-12 gap-3 w-[500px] max-w-[100vw] m-0 mb-12 list-none z-[100] outline-none"
      />
    </ToastProvider>
  )
}