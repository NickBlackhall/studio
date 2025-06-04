
"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { motion, AnimatePresence as FramerAnimatePresence, type Variants, type MotionStyle } from "framer-motion"
import { cn } from "@/lib/utils"

// Store Radix primitives in local consts
const RadixDialogRoot = DialogPrimitive.Root;
const RadixDialogTrigger = DialogPrimitive.Trigger;
const RadixDialogPortal = DialogPrimitive.Portal; // Crucial
const RadixDialogClose = DialogPrimitive.Close;
const RadixDialogTitle = DialogPrimitive.Title;
const RadixDialogDescription = DialogPrimitive.Description;

// --- Custom Animated Overlay ---
const defaultOverlayAnimation: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.5, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.3, ease: "easeIn" } },
};

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
DialogOverlay.displayName = "DialogOverlay";

// --- Custom Animated Content ---
const defaultContentAnimation: Variants = {
  initial: { opacity: 0, scale: 0.9, y: 20, rotateX: 5, rotateY: 15, z: -50, filter: 'blur(8px)' },
  animate: { opacity: 1, scale: 1, y: 0, rotateX: 0, rotateY: 0, z: 0, filter: 'blur(0px)', transition: { duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, scale: 0.9, y: 20, rotateX: 5, rotateY: 15, z: -50, filter: 'blur(8px)', transition: { duration: 0.4, ease: [0.55, 0.085, 0.68, 0.53] } },
};

interface MotionDialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  animationProps?: Variants;
  motionStyle?: MotionStyle;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  MotionDialogContentProps
>(({ className, children, animationProps = defaultContentAnimation, motionStyle, ...props }, ref) => (
  <DialogPrimitive.Content forceMount asChild>
    <motion.div
      ref={ref}
      variants={animationProps}
      initial="initial"
      animate="animate"
      exit="exit"
      style={motionStyle}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
      <RadixDialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </RadixDialogClose>
    </motion.div>
  </DialogPrimitive.Content>
))
DialogContent.displayName = "DialogContent";

// --- Standard Wrapper Components (Header, Footer) ---
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

// --- Standard Wrapper Components for Title and Description using Radix Primitives ---
const DialogTitle = React.forwardRef<
  React.ElementRef<typeof RadixDialogTitle>,
  React.ComponentPropsWithoutRef<typeof RadixDialogTitle>
>(({ className, ...props }, ref) => (
  <RadixDialogTitle
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = RadixDialogTitle.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof RadixDialogDescription>,
  React.ComponentPropsWithoutRef<typeof RadixDialogDescription>
>(({ className, ...props }, ref) => (
  <RadixDialogDescription
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = RadixDialogDescription.displayName

// --- Re-export AnimatePresence ---
const AnimatePresence = FramerAnimatePresence;

// --- Export all components with explicit aliasing for Radix parts ---
export {
  RadixDialogRoot as Dialog,
  RadixDialogTrigger as DialogTrigger,
  RadixDialogPortal as DialogPortal, // Exporting the Radix Portal aliased
  DialogOverlay, // Custom animated
  DialogContent, // Custom animated
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  RadixDialogClose as DialogClose,
  AnimatePresence,
};
