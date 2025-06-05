
"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog" // Corrected from react-alert-dialog if that was a prior typo
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  // AGGRESSIVE LOGGING AT THE VERY START OF THE COMPONENT FUNCTION
  console.log("--- DialogOverlay component function CALLED ---");

  // AGGRESSIVE VISUAL DEBUG - useEffect for computed styles after mount
  React.useEffect(() => {
    const currentRef = ref && typeof ref !== 'function' ? ref.current : null; // Basic ref handling
    if (currentRef) {
      const element = currentRef;
      const computedStyle = window.getComputedStyle(element);
      console.log("--- DialogOverlay Debug Info (useEffect) ---");
      console.log("Overlay Element HTML (mount):", element.outerHTML.split('>')[0] + '>');
      console.log("Overlay className (mount):", element.className);
      console.log("Computed backgroundColor (mount):", computedStyle.backgroundColor);
      console.log("Computed opacity (mount):", computedStyle.opacity);
      console.log("---------------------------------------");
    } else {
      // Fallback if ref is not immediately available or complex
      const overlayElements = document.querySelectorAll('[data-radix-dialog-overlay]'); // More generic selector
      if (overlayElements.length > 0) {
        const element = overlayElements[overlayElements.length -1] as HTMLElement; // Assume last one if multiple
         const computedStyle = window.getComputedStyle(element);
         console.log("--- DialogOverlay Debug Info (useEffect fallback querySelector) ---");
         console.log("Overlay Element HTML (mount fallback):", element.outerHTML.split('>')[0] + '>');
         console.log("Overlay className (mount fallback):", element.className);
         console.log("Computed backgroundColor (mount fallback):", computedStyle.backgroundColor);
         console.log("Computed opacity (mount fallback):", computedStyle.opacity);
         console.log("-----------------------------------------------------------------");
      } else {
        console.log("--- DialogOverlay Debug Info (useEffect): Overlay element not found via ref or querySelector ---");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array, runs on mount

  return (
    <DialogPrimitive.Overlay
      ref={ref}
      data-radix-dialog-overlay // Add a data attribute for easier selection if needed
      // AGGRESSIVE VISUAL DEBUG STYLES
      style={{
        border: "10px solid red",
        backgroundColor: "rgba(0, 255, 0, 0.3)", // Semi-transparent green
        zIndex: 10000 // Ensure it's on top
      }}
      className={cn(
        "fixed inset-0", // Removed z-50 as it's in style, removed bg-black/80 to see green
        // "fixed inset-0 z-50 bg-black/80", // Original attempt
        // Animation classes are still commented out:
        // "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
})
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay /> {/* This will use our debugged DialogOverlay */}
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
