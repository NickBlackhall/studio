
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
    {/* Removed flex items-center justify-center. This div is now just a fixed layer. */}
    <div className="fixed inset-0 z-50">
      {children}
    </div>
  </DialogPrimitive.Portal>
)
DialogPortal.displayName = DialogPrimitive.Portal.displayName

const DialogClose = DialogPrimitive.Close

// Custom overlayAnimation prop type
interface DialogOverlayProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> {
  animationProps?: { initial?: AnimationProps['initial']; animate?: AnimationProps['animate']; exit?: AnimationProps['exit']; transition?: AnimationProps['transition'] };
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  DialogOverlayProps
>(({ className, animationProps, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} asChild>
    <motion.div
      className={cn(
        "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm", // Ensures overlay is also fixed and covers screen
        className
      )}
      initial={animationProps?.initial ?? { opacity: 0 }}
      animate={animationProps?.animate ?? { opacity: 1 }}
      exit={animationProps?.exit ?? { opacity: 0 }}
      transition={animationProps?.transition ?? { duration: 0.3, ease: "easeOut" }}
      {...props}
    />
  </DialogPrimitive.Overlay>
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

// Custom contentAnimation and contentStyle props
interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  contentAnimation?: { initial?: MotionProps['initial']; animate?: MotionProps['animate']; exit?: MotionProps['exit']; transition?: MotionProps['transition'] };
  contentStyle?: MotionStyle;
  overlayAnimation?: DialogOverlayProps['animationProps']; 
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, contentAnimation, contentStyle, overlayAnimation, ...props }, ref) => (
  <DialogPrimitive.Content ref={ref} asChild>
    <motion.div
      className={cn(
        // Restored explicit fixed positioning and transform-based centering
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg",
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

const AnimatePresence = FramerAnimatePresence;

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
  AnimatePresence,
}
