"use client";

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { PureMorphingModal } from '@/components/PureMorphingModal';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * Getting friends into the room without reading a code across the table:
 * a share-sheet link (text it to the group chat — the link lands them straight
 * in this room) and a QR code to scan off the host's screen.
 *
 * The join deep-link already exists — /?room=CODE is how every join navigates —
 * so this is only packaging, no new join path.
 */
export default function InvitePanel({ roomCode }: { roomCode: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const inviteUrl =
    typeof window !== 'undefined' && roomCode
      ? `${window.location.origin}/?room=${roomCode}`
      : null;

  useEffect(() => {
    if (!isOpen || !inviteUrl) return;
    QRCode.toDataURL(inviteUrl, { width: 512, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [isOpen, inviteUrl]);

  if (!roomCode) return null;

  const handleShare = async () => {
    if (!inviteUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Make It Terrible',
          text: `Join our game of Make It Terrible! Room ${roomCode}`,
          url: inviteUrl,
        });
        return;
      } catch {
        // User closed the share sheet — nothing to do.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast({ title: 'Link copied!', description: 'Send it to your friends.' });
    } catch {
      toast({ title: `Room code: ${roomCode}`, description: inviteUrl ?? '' });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mx-auto flex items-center gap-2 rounded-md bg-black/70 px-4 py-2 font-im-fell text-lg text-amber-300 shadow-md"
        data-testid="invite-friends-button"
      >
        <Share2 className="h-4 w-4" /> Invite Friends
      </button>

      <PureMorphingModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        variant="settings"
        icon="📲"
        title="Invite Friends"
      >
        <div className="flex flex-col items-center gap-4 pb-2">
          <div className="text-black/90 text-center">
            Scan to join room <span className="font-bold tracking-widest">{roomCode}</span>
          </div>
          {qrDataUrl ? (
            // Plain <img>: the QR is a locally generated data URL, so next/image
            // optimization has nothing to add.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt={`QR code to join room ${roomCode}`}
              className="h-56 w-56 rounded-md border-4 border-black/80 bg-white p-2"
            />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center rounded-md bg-black/10 text-black/50">
              …
            </div>
          )}
          <Button onClick={handleShare} className="w-full bg-black text-amber-300 hover:bg-black/80">
            <Share2 className="mr-2 h-4 w-4" /> Share invite link
          </Button>
        </div>
      </PureMorphingModal>
    </>
  );
}
