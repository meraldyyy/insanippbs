export const attendanceMonitorChannelName = 'insani-attendance-monitor';

export type AttendanceMonitorEvent = {
  id: string;
  result: string;
  message: string;
  fullName: string | null;
  className: string | null;
  photoPath: string | null;
  status: string | null;
  time: string;
};
