import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { api } from '../../lib/api';

type StudentPhotoProps = {
  studentId: string;
  fullName: string;
  photoPath: string | null;
  file?: File | null;
  large?: boolean;
};

export function StudentPhoto({ studentId, fullName, photoPath, file = null, large = false }: StudentPhotoProps) {
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
        .from('student-photos')
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
  }, [file, photoPath, studentId]);

  const initials = fullName.split(' ').map((part) => part[0]).join('').slice(0, 2);

  return (
    <span className={`student-photo${large ? ' student-photo-large' : ''}`} aria-label={`Foto ${fullName}`}>
      {source
        ? <img src={source} alt={`Foto ${fullName}`} />
        : <><UserRound size={large ? 25 : 17} aria-hidden="true" /><small>{initials}</small></>}
    </span>
  );
}
