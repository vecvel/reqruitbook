import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group font-sans"
      toastOptions={{
        classNames: {
          toast:
            "group toast font-sans !bg-card !text-foreground !border !border-border !shadow-lg !rounded-xs",
          title: "!font-sans !text-foreground !font-semibold !text-xs",
          description: "!font-sans !text-muted-foreground !text-xs",
          actionButton: "!font-sans !bg-copper !text-white !rounded-xs !text-xs !font-medium",
          cancelButton: "!font-sans !bg-muted !text-muted-foreground !rounded-xs !text-xs",
          closeButton: "!font-sans !bg-muted !text-muted-foreground !border-border",
          icon: "!text-copper",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
