import { Icon } from "@/components/ui/Icon";
import { Alert01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

export function WalletErrorModal({
  isOpen,
  onClose,
  title = "Wallet Error",
  message = "Could not connect to your wallet. Please ensure your wallet extension is unlocked or refresh the page.",
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}) {
  const { disconnect, connected } = useWallet();
  const { setVisible } = useWalletModal();

  const handleFix = async () => {
    if (connected) {
      await disconnect();
    }
    onClose();
    setTimeout(() => {
      setVisible(true);
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose} 
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-2xl animate-slide-in-up">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-text-dimmer hover:text-text"
        >
          <Icon icon={Cancel01Icon} size={20} />
        </button>
        
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
          <Icon icon={Alert01Icon} size={24} />
        </div>
        
        <h3 className="mb-2 text-lg font-semibold text-text">{title}</h3>
        <p className="text-sm text-text-dim">{message}</p>
        
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={handleFix}
            className="w-full rounded-xl bg-accent py-3 font-bold text-white transition-shadow hover:shadow-[0_0_8px_rgba(129,140,248,0.4)]"
          >
            Disconnect & Reconnect
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-surface-2 py-3 font-semibold text-text hover:bg-surface-hover hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
