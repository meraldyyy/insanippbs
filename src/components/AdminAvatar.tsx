import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { api } from '../lib/api';

type AdminAvatarProps = {
  userId: string;
  fullName: string;
  photoPath: string | null;
  file?: File | null;
  className?: string;
};

export function AdminAvatar({ userId, fullName, photoPath, file = null, className = '' }: AdminAvatarProps) {
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    async function loadPhoto() {
      if (file) {
        objectUrl = URL.createObjectURL(file);
        if (active) setSource(objectUrl);
        return;
      }
      if (!photoPath) {
        setSource(null);
        return;
      }
      const { data, error } = await api.storage
        .from('admin-photos')
        .createSignedUrl(photoPath, 60 * 60);
      if (active) setSource(error ? null : data?.signedUrl ?? null);
    }

    void loadPhoto();
    const refresh = file || !photoPath
      ? undefined
      : window.setInterval(() => void loadPhoto(), 50 * 60 * 1000);

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (refresh !== undefined) window.clearInterval(refresh);
    };
  }, [file, photoPath, userId]);

  const initials = fullName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <span className={`admin-avatar ${className}`} aria-label={`Foto profil ${fullName}`}>
      {source ? <img src={source} alt="" /> : initials || <UserRound size={16} aria-hidden="true" />}
    </span>
  );
}
