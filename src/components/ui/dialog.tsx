
"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { motion, AnimatePresence as FramerAnimatePresence, type AnimationProps, type MotionProps, type MotionStyle } from "framer-motion"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = ({ className, children, ...props }: DialogPrimitive.DialogPortalProps) => (
  <DialogPrimitive.Portal className={cn(className)} {...props} forceMount>
    <div className="fixed inset-0 z-50 flex items-start justify-center sm:items-center">
      {children}
    </div>
  </DialogPrimitive.Portal>
)
DialogPortal.displayName = DialogPrimitive.Portal.displayName

const DialogClose = DialogPrimitive.Close

// Custom overlayAnimation prop type
interface DialogOverlayProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> {
  overlayAnimation?: { initial?: AnimationProps['initial']; animate?: AnimationProps['animate']; exit?: AnimationProps['exit']; transition?: AnimationProps['transition'] };
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  DialogOverlayProps
>(({ className, overlayAnimation, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} asChild>
    <motion.div
      className={cn(
        "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm", // Added backdrop-blur-sm
        // Removed Tailwind animation: data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
        className
      )}
      initial={overlayAnimation?.initial ?? { opacity: 0 }}
      animate={overlayAnimation?.animate ?? { opacity: 1 }}
      exit={overlayAnimation?.exit ?? { opacity: 0 }}
      transition={overlayAnimation?.transition ?? { duration: 0.3, ease: "easeOut" }}
      {...props}
    />
  </DialogPrimitive.Overlay>
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

// Custom contentAnimation and contentStyle props
interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  contentAnimation?: { initial?: MotionProps['initial']; animate?: MotionProps['animate']; exit?: MotionProps['exit']; transition?: MotionProps['transition'] };
  contentStyle?: MotionStyle;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, contentAnimation, contentStyle, ...props }, ref) => (
  // DialogPortal is now used outside, so AnimatePresence should wrap DialogContent and DialogOverlay there.
  // forceMount on DialogPortal helps AnimatePresence
  <DialogPrimitive.Content ref={ref} asChild>
    <motion.div
      className={cn(
        "fixed z-50 grid w-full gap-4 rounded-b-lg border bg-background p-6 shadow-lg sm:max-w-lg sm:rounded-lg",
        // Removed Tailwind animation classes: data-[state=open]:animate-in data-[state=closed]:animate-out ...
        className
      )}
      initial={contentAnimation?.initial ?? { opacity: 0, scale: 0.95, y: 20 }}
      animate={contentAnimation?.animate ?? { opacity: 1, scale: 1, y: 0 }}
      exit={contentAnimation?.exit ?? { opacity: 0, scale: 0.95, y: 20 }}
      transition={contentAnimation?.transition ?? { duration: 0.3, ease: "easeOut" }}
      style={contentStyle}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </motion.div>
  </DialogPrimitive.Content>
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

const AnimatePresence = FramerAnimatePresence; // Re-export for convenience

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  AnimatePresence, // Exporting AnimatePresence
}
