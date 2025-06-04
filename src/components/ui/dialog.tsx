
"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { motion, AnimatePresence as FramerAnimatePresence, type AnimationProps, type MotionStyle, type Variants } from "framer-motion"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = ({ children, ...props }: DialogPrimitive.DialogPortalProps) => (
  <DialogPrimitive.Portal {...props}>
    {/* This div is necessary for AnimatePresence to work correctly with portalled content */}
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {children}
    </div>
  </DialogPrimitive.Portal>
)
DialogPortal.displayName = DialogPrimitive.Portal.displayName


const DialogClose = DialogPrimitive.Close

// Default animation for the overlay
const defaultOverlayAnimation: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.2, ease: "easeIn" } },
}

interface MotionDialogOverlayProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> {
  animationProps?: Variants;
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  MotionDialogOverlayProps
>(({ className, animationProps = defaultOverlayAnimation, ...props }, ref) => (
  <DialogPrimitive.Overlay forceMount asChild>
    <motion.div
      ref={ref}
      variants={animationProps}
      initial="initial"
      animate="animate"
      exit="exit"
      className={cn(
        "fixed inset-0 z-50 bg-black/80 backdrop-blur-sm",
        className
      )}
      {...props}
    />
  </DialogPrimitive.Overlay>
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

// Default animation for the content (simple fade and scale)
const defaultContentAnimation: Variants = {
  initial: { opacity: 0, scale: 0.95, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.2, ease: "easeIn" } },
}

interface MotionDialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  animationProps?: Variants;
  motionStyle?: MotionStyle;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  MotionDialogContentProps
>(({ className, children, animationProps = defaultContentAnimation, motionStyle, ...props }, ref) => (
  // DialogPortal is handled by Radix, we just need to ensure AnimatePresence wraps this
  // when used if exit animations are desired.
  // The centering is applied here directly as it's a fixed element.
  <DialogPrimitive.Content forceMount asChild>
    <motion.div
      ref={ref}
      variants={animationProps}
      initial="initial"
      animate="animate"
      exit="exit"
      style={motionStyle} // For transformPerspective etc.
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg",
        "data-[state=open]:animate-none data-[state=closed]:animate-none", // Disable default shadcn animations
        className
      )}
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

// Export AnimatePresence from framer-motion for convenience
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
  AnimatePresence, // Re-exporting AnimatePresence
}
